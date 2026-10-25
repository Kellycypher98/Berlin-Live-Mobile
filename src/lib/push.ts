// Journey notifications while the app is closed: the server follows the tracked journey and sends
// updates through Expo's push service (APNs on iPhone, FCM on Android).
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import type { Journey } from "./api";
import { API_URL } from "../config";
import { getLang, t } from "../i18n";

export type PushSupport = "ok" | "unsupported" | "denied";

// While the app is open, the tracking panel already shows everything: keep notifications quiet
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

let channelsReady = false;
async function ensureChannels() {
  if (Platform.OS !== "android" || channelsReady) return;
  await Notifications.setNotificationChannelAsync("journey", {
    name: t("Journey updates"), importance: Notifications.AndroidImportance.DEFAULT, sound: null, vibrationPattern: [0],
  });
  await Notifications.setNotificationChannelAsync("journey-alerts", {
    name: t("Board and get-off alerts"), importance: Notifications.AndroidImportance.HIGH, sound: "default", vibrationPattern: [0, 250, 150, 250],
  });
  channelsReady = true;
}

export async function pushSupport(): Promise<PushSupport> {
  if (!Device.isDevice) return "unsupported"; // simulators can't get push tokens
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === "denied" && !canAskAgain) return "denied";
  return "ok";
}

let token: string | null = null;
async function expoToken(): Promise<string> {
  if (token) return token;
  await ensureChannels();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowTimeSensitive: true } as never })).status;
  if (status !== "granted") throw new Error("denied");
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error(t("Notifications aren't set up in this build yet (missing EAS project id)."));
  token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(API_URL + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || `Request failed (${res.status})`);
  return out;
}

/** Asks for permission, gets this phone's push token and tells the server to follow the journey. Returns the watch id. */
export async function startPushWatch(journey: Journey): Promise<string> {
  const expo = await expoToken();
  const rides = journey.legs.filter(l => l.mode === "transit" && l.track).map(l => ({
    line: l.line, dir: l.dir, from: l.from.name, to: l.to.name, dep: l.dep, arr: l.arr, track: l.track,
  }));
  const { id } = await postJson("/api/push/watch", { expoToken: expo, rides, lang: getLang() });
  return id;
}

export function stopPushWatch(id: string) {
  postJson("/api/push/unwatch", { id }).catch(() => {});
}
