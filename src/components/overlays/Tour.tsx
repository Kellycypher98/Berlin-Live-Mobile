// First-use walkthrough: a few cards explaining the app. Shown once; replay from Map & settings.
import { useEffect, useState } from "react";
import { Image, Modal, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../lib/theme";
import { ModeIcon, PlaceIcon } from "../icons";
import { Button, Txt } from "../ui";
import { t, useLang } from "../../i18n";

const SEEN_KEY = "blt-tour-v1";
const LOGO = require("../../../assets/icon.png");

type Step = { title: string; body: string; visual?: "logo" | "modes" | "track" | "search" | "near" | "settings" };
const STEPS: Step[] = [
  { title: "Welcome to Berlin Live Transit", body: "See every U-Bahn, S-Bahn, tram, bus and ferry in Berlin move on the map, live. Here's a 30-second tour.", visual: "logo" },
  { title: "The vehicles", body: "Each badge is a vehicle: U for U-Bahn, S for S-Bahn, plus tram, bus and ferry icons. The arrow shows where it's heading. Zoom in to see line numbers; tap a vehicle for its direction and delay.", visual: "modes" },
  { title: "Plan a journey", body: "Pull up the panel at the bottom and type any address, place or station, or use your location. Long-press the map to route from or to that spot.", visual: "search" },
  { title: "Stations near you", body: "One tap shows the closest stops with walking times. Tap a stop for its next departures.", visual: "near" },
  { title: "Track your ride live", body: "In any connection, tap \"Track this journey live\". The map follows your vehicle and tells you when to board and when to get off.", visual: "track" },
  { title: "Choose what you see", body: "Tap the layers button to switch transport types and the line map on or off, and change the language.", visual: "settings" },
];

export async function hasSeenTour() {
  try { return (await AsyncStorage.getItem(SEEN_KEY)) === "1"; } catch { return false; }
}

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  useLang();
  const th = useTheme();
  const [step, setStep] = useState(0);
  useEffect(() => { if (open) setStep(0); }, [open]);
  const finish = () => { AsyncStorage.setItem(SEEN_KEY, "1").catch(() => {}); onClose(); };
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={finish} statusBarTranslucent>
      <View style={styles.dim}>
        <View style={[styles.card, { backgroundColor: th.panel }]} accessibilityViewIsModal>
          <View style={styles.visual}>
            {s.visual === "logo" && <Image source={LOGO} style={styles.logo} />}
            {s.visual === "modes" && (["subway", "suburban", "tram", "bus", "regional", "ferry"] as const).map(m => <ModeIcon key={m} mode={m} size={30} />)}
            {s.visual === "search" && <View style={[styles.fake, { backgroundColor: th.chipBg }]}><Txt size={14} muted>{t("Where to? Address, place or station")}</Txt></View>}
            {s.visual === "near" && <View style={[styles.fakeBtn, { borderColor: th.accent }]}><PlaceIcon kind="location" size={18} color={th.accent} /><Txt size={14} weight={700} color={th.accent}>{t("Stations near me")}</Txt></View>}
            {s.visual === "track" && <View style={[styles.fakeBtn, { backgroundColor: th.fg, borderColor: th.fg }]}><View style={styles.pulse} /><Txt size={14} weight={700} color={th.panel}>{t("Track this journey live")}</Txt></View>}
            {s.visual === "settings" && <View style={[styles.layers, { backgroundColor: th.chipBg }]}><Txt size={22}>◫</Txt></View>}
          </View>
          <Txt size={20} weight={800} style={styles.center}>{t(s.title)}</Txt>
          <Txt size={15} muted style={styles.center}>{t(s.body)}</Txt>
          <View style={styles.dots}>
            {STEPS.map((_, k) => <View key={k} style={[styles.dot, { backgroundColor: k === step ? th.fg : th.line }]} />)}
          </View>
          <View style={styles.foot}>
            {step === 0 ? <Button label={t("Skip")} onPress={finish} style={{ flex: 1 }} /> : <Button label={t("Back")} onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
            <Button kind="primary" label={last ? t("Got it") : step === 0 ? t("Show me") : t("Next")} onPress={() => (last ? finish() : setStep(step + 1))} style={{ flex: 1 }} />
          </View>
          <Txt size={11} muted style={styles.center}>{t("Step {n} of {total}", { n: step + 1, total: STEPS.length })}</Txt>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { flex: 1, backgroundColor: "rgba(10,15,20,.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, borderRadius: 20, padding: 22, gap: 12 },
  visual: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, minHeight: 60 },
  logo: { width: 60, height: 60, borderRadius: 14 },
  fake: { height: 44, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center", alignSelf: "stretch", flex: 1 },
  fakeBtn: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5 },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3cc477" },
  layers: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  foot: { flexDirection: "row", gap: 10 },
});
