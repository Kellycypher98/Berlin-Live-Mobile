// Full-screen loader until there are vehicles to show, then a small pill while stations and the
// line map finish loading.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ConnectionState, Snapshot } from "../../lib/types";
import { API_URL } from "../../config";
import { Button, Txt } from "../ui";
import { t } from "../../i18n";

const LOGO = require("../../../assets/icon.png");

type Props = { state: ConnectionState; snapshot: Snapshot | null; stationsReady: boolean; linesReady: boolean };

export function LoadingScreen({ state, snapshot, stationsReady, linesReady }: Props) {
  const insets = useSafeAreaInsets();
  const connected = state === "open";
  const hasVehicles = !!snapshot?.updatedAt && snapshot.vehicles.length > 0;
  const timetableReady = !!snapshot?.sources?.timetable.ready || stationsReady;
  const [skipped, setSkipped] = useState(false);
  const [slow, setSlow] = useState(false);
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => { const timer = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(timer); }, []);
  const open = !(hasVehicles || skipped);
  useEffect(() => {
    if (open) { setGone(false); fade.setValue(1); return; }
    Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setGone(true));
  }, [open, fade]);

  const steps = [
    { label: t("Connecting to the live server"), done: connected, active: !connected },
    { label: t("Finding vehicles"), done: hasVehicles, active: connected && !hasVehicles },
    { label: t("Stations and timetable"), done: timetableReady, active: connected && !timetableReady, note: t("The first start downloads the VBB timetable, which takes a minute or two.") },
  ];
  const failed = state === "closed" || !!snapshot?.error;
  const message = !API_URL ? t("No server address set. Add EXPO_PUBLIC_API_URL or extra.apiUrl in app.json.")
    : state === "closed" ? t("Can't reach the server. Retrying…") : snapshot?.error ? t(snapshot.error) : null;
  const pending = [!stationsReady && t("stations"), !linesReady && t("line map")].filter(Boolean);

  return (
    <>
      {!gone && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.screen, { opacity: fade }]} pointerEvents={open ? "auto" : "none"} accessibilityLiveRegion="polite">
          <Image source={LOGO} style={styles.logo} />
          <Txt size={24} weight={800} color="#fff">Berlin Live</Txt>
          <Txt size={15} color="#b9c4cf" style={{ marginBottom: 20 }}>{t("Every train, tram, bus and ferry, live.")}</Txt>
          <View style={styles.steps}>
            {steps.map(s => (
              <View key={s.label} style={styles.step}>
                <View style={styles.mark}>
                  {s.done ? <Txt size={14} weight={800} color="#3cc477">✓</Txt> : s.active ? <ActivityIndicator size="small" color="#fff" /> : <View style={styles.idle} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={15} weight={s.active ? 700 : 500} color={s.done || s.active ? "#fff" : "#7f8b97"}>{s.label}</Txt>
                  {s.active && s.note && slow ? <Txt size={12} color="#b9c4cf">{s.note}</Txt> : null}
                </View>
              </View>
            ))}
          </View>
          {(failed || !API_URL) && message ? <Txt size={14} color="#ff8f8f" style={styles.err}>{message}</Txt> : null}
          {slow && open && <Button label={t("Show the map anyway")} onPress={() => setSkipped(true)} style={{ marginTop: 20 }} />}
        </Animated.View>
      )}
      {!open && pending.length > 0 && (
        <View style={[styles.pill, { top: insets.top + 64 }]} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" />
          <Txt size={13} weight={700} color="#fff">{t("Loading {what}…", { what: pending.join(` ${t("and")} `) })}</Txt>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#17212B", alignItems: "center", justifyContent: "center", padding: 32, zIndex: 50 },
  logo: { width: 88, height: 88, borderRadius: 20, marginBottom: 16 },
  steps: { alignSelf: "stretch", maxWidth: 340, gap: 14, marginHorizontal: "auto" },
  step: { flexDirection: "row", alignItems: "center", gap: 12 },
  mark: { width: 22, alignItems: "center" },
  idle: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4a5663" },
  err: { marginTop: 18, textAlign: "center" },
  pill: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(22,32,43,.88)", paddingHorizontal: 14, height: 36, borderRadius: 18, zIndex: 20 },
});
