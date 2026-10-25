// "Near you": the closest stations with walking times.
import { Pressable, StyleSheet, View } from "react-native";
import { stationPlace, type Station } from "../../lib/api";
import { walkMin, type NearStation } from "../../lib/nearby";
import { useTheme } from "../../lib/theme";
import { PlaceGlyph, PlaceIcon } from "../icons";
import { Button, LineChip, Txt } from "../ui";
import { locale, t } from "../../i18n";

export function NearbyList({ near, locating, onSelect, onFrom, onClose }: {
  near: NearStation[]; locating: boolean; onSelect: (s: Station) => void; onFrom: (s: Station) => void; onClose: () => void;
}) {
  const th = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <PlaceIcon kind="location" size={18} color={th.accent} />
        <Txt size={17} weight={800} style={{ flex: 1 }}>{t("Near you")}</Txt>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Hide stations near you")} style={[styles.close, { backgroundColor: th.chipBg }]}>
          <Txt size={18} weight={700} muted>×</Txt>
        </Pressable>
      </View>
      {locating && <Txt size={14} muted>{t("Finding your location…")}</Txt>}
      {!locating && near.length === 0 && <Txt size={14} muted>{t("No stations within 1.5 km.")}</Txt>}
      {near.map(({ s, d }) => (
        <View key={s.i} style={[styles.row, { borderBottomColor: th.line }]}>
          <Pressable onPress={() => onSelect(s)} style={styles.main} accessibilityRole="button">
            <PlaceGlyph place={stationPlace(s)} size={24} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt size={15} weight={700} numberOfLines={1}>{s.name}</Txt>
              <View style={styles.lines}>
                {s.lines.slice(0, 5).map(l => <LineChip key={l} line={l} small />)}
                {s.lines.length > 5 && <Txt size={11} muted>+{s.lines.length - 5}</Txt>}
              </View>
            </View>
            <View style={styles.dist}>
              <Txt size={14} weight={800}>{t("{n} min", { n: walkMin(d) })}</Txt>
              <Txt size={11} muted>{d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} km`}</Txt>
            </View>
          </Pressable>
          <Button small label={t("From here")} onPress={() => onFrom(s)} accessibilityLabel={t("Route from {place}", { place: s.name })} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  lines: { flexDirection: "row", flexWrap: "wrap", gap: 3, alignItems: "center" },
  dist: { alignItems: "flex-end" },
});
