// What you see on the map, the language, live status and data sources.
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { MODES, type ModeKey } from "../../lib/modes";
import type { ConnectionState, Snapshot } from "../../lib/types";
import { useTheme } from "../../lib/theme";
import { ModeIcon } from "../icons";
import { Button, Txt } from "../ui";
import { LANGS, useLang } from "../../i18n";

type Props = {
  state: ConnectionState;
  snapshot: Snapshot | null;
  counts: Partial<Record<ModeKey, number>>;
  enabled: Set<ModeKey>;
  onToggle: (key: ModeKey) => void;
  showLines: boolean;
  onShowLines: (v: boolean) => void;
  linesReady: boolean;
  onTour: () => void;
  onClose: () => void;
};

export function SettingsPanel({ state, snapshot, counts, enabled, onToggle, showLines, onShowLines, linesReady, onTour, onClose }: Props) {
  const th = useTheme();
  const { t, lang, setLang } = useLang();
  const vehiclesText = (n: number) => t(n === 1 ? "1 vehicle" : "{n} vehicles", { n });
  let status: string, isError = false;
  if (state === "closed") { status = t("Disconnected. Reconnecting…"); isError = true; }
  else if (state === "connecting") status = t("Connecting…");
  else if (snapshot?.error) { status = t(snapshot.error); isError = true; }
  else if (!snapshot?.updatedAt) status = t("Loading live data and the VBB timetable…");
  else status = `${vehiclesText(snapshot.vehicles.length)} · ${new Date(snapshot.updatedAt).toLocaleTimeString("de-DE")}`;
  const src = state === "open" && snapshot?.updatedAt ? snapshot.sources : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Txt size={20} weight={800} style={{ flex: 1 }}>{t("Map & settings")}</Txt>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Close")} style={[styles.close, { backgroundColor: th.chipBg }]}>
          <Txt size={18} weight={700} muted>×</Txt>
        </Pressable>
      </View>

      <View style={styles.modes}>
        {MODES.map(m => {
          const on = enabled.has(m.key);
          return (
            <Pressable key={m.key} onPress={() => onToggle(m.key)} accessibilityRole="switch" accessibilityState={{ checked: on }}
              style={[styles.mode, { borderColor: on ? th.fg + "44" : th.line, backgroundColor: on ? th.panel : th.chipBg, opacity: on ? 1 : 0.6 }]}>
              <ModeIcon mode={m.key} size={20} dim={!on} />
              <Txt size={14} weight={700} style={{ flex: 1 }} numberOfLines={1}>{t(m.label)}</Txt>
              <Txt size={12} weight={700} muted>{counts[m.key] ?? 0}</Txt>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.switchRow}>
        <Txt size={15} weight={700} style={{ flex: 1 }}>{t("Line map")} {!linesReady && showLines ? <Txt size={13} muted>· {t("loading…")}</Txt> : null}</Txt>
        <Switch value={showLines} onValueChange={onShowLines} />
      </View>

      <View style={styles.langRow}>
        <Txt size={15} weight={700} style={{ flex: 1 }}>{t("Language")}</Txt>
        <View style={[styles.seg, { backgroundColor: th.chipBg }]}>
          {LANGS.map(l => (
            <Pressable key={l.key} onPress={() => setLang(l.key)} accessibilityRole="radio" accessibilityState={{ checked: lang === l.key }}
              style={[styles.segBtn, lang === l.key && { backgroundColor: th.panel }]}>
              <Txt size={13} weight={lang === l.key ? 800 : 600} muted={lang !== l.key}>{l.label}</Txt>
            </Pressable>
          ))}
        </View>
      </View>

      <Txt size={13} weight={600} color={isError ? th.err : th.muted}>{status}</Txt>
      {src && (
        <View style={[styles.sources, { borderColor: th.line }]}>
          <Txt size={12} weight={800} muted>{t("Data sources").toUpperCase()}</Txt>
          {src.live.enabled && <SourceRow ok={src.live.areas > 0} label={t("Live positions")} value={t("{n}/{total} areas", { n: src.live.areas, total: src.live.totalAreas })} />}
          <SourceRow ok={src.delays.ok} label={t("Timetable + delays")} value={src.delays.ok ? vehiclesText(src.delays.vehicles) : t("delays off")} />
          <SourceRow ok={src.timetable.ready} label={t("Timetable only")} value={src.timetable.ready ? vehiclesText(src.timetable.vehicles) : t("loading…")} />
        </View>
      )}

      <Button label={t("How it works")} onPress={onTour} />
      <Txt size={11} muted>{t("Data: VBB timetable (CC BY 4.0) and live positions. Map © OpenMapTiles, © OpenStreetMap contributors.")}</Txt>
    </View>
  );
}

function SourceRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  const th = useTheme();
  return (
    <View style={styles.srcRow}>
      <View style={[styles.srcDot, { backgroundColor: ok ? th.ok : th.line }]} />
      <Txt size={13} weight={600} style={{ flex: 1 }}>{label}</Txt>
      <Txt size={13} muted>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  head: { flexDirection: "row", alignItems: "center" },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  modes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mode: { flexBasis: "48%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 46, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  switchRow: { flexDirection: "row", alignItems: "center" },
  langRow: { flexDirection: "row", alignItems: "center" },
  seg: { flexDirection: "row", borderRadius: 10, padding: 3 },
  segBtn: { paddingHorizontal: 12, height: 32, borderRadius: 8, justifyContent: "center" },
  sources: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  srcRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  srcDot: { width: 8, height: 8, borderRadius: 4 },
});
