// A tapped vehicle: its line, direction, delay and where the position comes from.
import { Pressable, StyleSheet, View } from "react-native";
import { delayLabel } from "../../lib/api";
import type { Vehicle } from "../../lib/types";
import { useTheme } from "../../lib/theme";
import { ModeIcon } from "../icons";
import { LineChip, Txt } from "../ui";
import { t } from "../../i18n";

const SOURCE_TEXT = { live: "Live position", delays: "Timetable + live delay", timetable: "Timetable estimate" } as const;

export function VehicleCard({ v, onClose }: { v: Vehicle; onClose: () => void }) {
  const th = useTheme();
  const d = v.delay;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <ModeIcon mode={v.product} size={26} />
        <LineChip line={v.line} product={v.product} />
        <Txt size={17} weight={800} style={{ flex: 1 }} numberOfLines={2}>→ {v.dir}</Txt>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Close")} style={[styles.close, { backgroundColor: th.chipBg }]}>
          <Txt size={18} weight={700} muted>×</Txt>
        </Pressable>
      </View>
      <View style={styles.meta}>
        <Txt size={13} weight={700} color={v.source === "live" ? th.ok : th.muted}>{t(SOURCE_TEXT[v.source])}</Txt>
        {d != null && <Txt size={13} weight={700} color={d >= 60 ? th.err : th.ok}>{d >= 60 ? t("{delay} min late", { delay: delayLabel(d) ?? "" }) : t("On time")}</Txt>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  meta: { flexDirection: "row", gap: 12 },
});
