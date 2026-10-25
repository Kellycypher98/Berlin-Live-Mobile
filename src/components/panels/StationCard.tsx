// A station's lines and next departures (refreshed every 30 s), with route shortcuts.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { delayLabel, fetchDepartures, hhmm, P, type DepartureResult, type Station } from "../../lib/api";
import { useTheme } from "../../lib/theme";
import { ModeIcon } from "../icons";
import { Button, LineChip, Txt } from "../ui";
import { t } from "../../i18n";

const SERVED = [["subway", P.subway], ["suburban", P.suburban], ["regional", P.regional], ["tram", P.tram], ["bus", P.bus], ["ferry", P.ferry]] as const;

export function StationCard({ station, onClose, onFrom, onTo }: { station: Station; onClose: () => void; onFrom: (s: Station) => void; onTo: (s: Station) => void }) {
  const th = useTheme();
  const [data, setData] = useState<DepartureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null); setError(null);
    const load = () => fetchDepartures(station.i, ctrl.signal).then(setData).catch(e => { if (!ctrl.signal.aborted) setError(e.message); });
    load();
    const timer = setInterval(load, 30000);
    return () => { ctrl.abort(); clearInterval(timer); };
  }, [station.i]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.served}>{SERVED.filter(([, bit]) => station.p & bit).map(([m]) => <ModeIcon key={m} mode={m} size={22} />)}</View>
        <Txt size={20} weight={800} style={{ flex: 1 }}>{station.name}</Txt>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Close station")} style={[styles.close, { backgroundColor: th.chipBg }]}>
          <Txt size={18} weight={700} muted>×</Txt>
        </Pressable>
      </View>
      <View style={styles.chips}>{station.lines.map(l => <LineChip key={l} line={l} />)}</View>
      <View style={styles.actions}>
        <Button label={t("Route from here")} onPress={() => onFrom(station)} style={{ flex: 1 }} />
        <Button label={t("Route to here")} onPress={() => onTo(station)} style={{ flex: 1 }} />
      </View>

      <Txt size={15} weight={800}>{t("Next departures")} {data && !data.delays ? <Txt size={13} muted>· {t("timetable")}</Txt> : null}</Txt>
      {error && <Txt size={14} color={th.err}>{error}</Txt>}
      {!data && !error && <Txt size={14} muted>{t("Loading…")}</Txt>}
      {data && data.departures.length === 0 && <Txt size={14} muted>{t("No departures in the next hour.")}</Txt>}
      {data?.departures.map((d, k) => {
        const dl = delayLabel(d.delay);
        return (
          <View key={k} style={[styles.dep, { borderBottomColor: th.line }]}>
            <View style={styles.t}>
              <Txt size={14} weight={800}>{hhmm(d.planned)}</Txt>
              {dl && dl !== "0" ? <Txt size={12} weight={800} color={th.err}>{dl}</Txt> : null}
            </View>
            <View style={styles.line}><ModeIcon mode={d.product} size={16} /><LineChip line={d.line} product={d.product} /></View>
            <Txt size={14} style={{ flex: 1 }} numberOfLines={1}>{d.dir}</Txt>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  served: { flexDirection: "row", gap: 3 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  actions: { flexDirection: "row", gap: 8 },
  dep: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  t: { width: 52, flexDirection: "row", gap: 3, alignItems: "baseline" },
  line: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 70 },
});
