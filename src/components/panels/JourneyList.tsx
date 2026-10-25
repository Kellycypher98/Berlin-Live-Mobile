// Connections for the chosen trip: times, lines, changes; tap one to see every leg and track it live.
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { dayLabel, delayLabel, hhmm, type Journey, type JourneyResult, type Leg } from "../../lib/api";
import { lineStyle } from "../../lib/lines";
import { useTheme } from "../../lib/theme";
import { ModeIcon, PlaceIcon } from "../icons";
import { Button, LineChip, Txt } from "../ui";
import { locale, t } from "../../i18n";

const legMinutes = (l: Leg) => Math.max(1, Math.round((Date.parse(l.arr) - Date.parse(l.dep)) / 60000));
export const fmtDistance = (m?: number | null) => (m == null ? "" : m >= 1000 ? `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} km` : `${Math.round(m / 10) * 10} m`);

type Props = {
  result: JourneyResult;
  selected: number;
  onSelect: (k: number) => void;
  onEarlier: () => void;
  onLater: () => void;
  onTrack: (journeyIndex: number, leg: number | null) => void;
  onRefresh: () => void;
  refreshing: boolean;
  fetchedAt: number | null;
};

function RefreshButton({ onRefresh, refreshing, fetchedAt }: Pick<Props, "onRefresh" | "refreshing" | "fetchedAt">) {
  const th = useTheme();
  const at = fetchedAt ? new Date(fetchedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <Pressable onPress={onRefresh} disabled={refreshing} style={styles.refresh} hitSlop={6} accessibilityRole="button"
      accessibilityLabel={refreshing ? t("Refreshing connections") : t("Refresh connections")}>
      {refreshing ? <ActivityIndicator size="small" color={th.muted} /> : <Txt size={15} weight={700} muted>↻</Txt>}
      <Txt size={12} weight={600} muted>{refreshing ? t("Refreshing…") : at ? t("Updated {time}", { time: at }) : t("Refresh")}</Txt>
    </Pressable>
  );
}

function whenText(r: JourneyResult) {
  const day = dayLabel(r.when);
  return `${t(r.mode === "arrive" ? "Arriving by {time}" : "Departing from {time}", { time: hhmm(r.when) })}${day ? ` · ${day}` : ""}`;
}

export function JourneyList({ result, selected, onSelect, onEarlier, onLater, onTrack, onRefresh, refreshing, fetchedAt }: Props) {
  const th = useTheme();
  if (!result.journeys.length) {
    return (
      <View style={styles.empty}>
        <RefreshButton onRefresh={onRefresh} refreshing={refreshing} fetchedAt={fetchedAt} />
        <Txt size={16} weight={800}>{t("No connection found")}</Txt>
        <Txt size={14} muted>
          {result.outOfRange
            ? t("The live journey planner is unavailable, and the timetable here only covers today and tomorrow. Try a time within the next two days.")
            : t(result.mode === "arrive"
              ? "Nothing runs from {from} to {to} in the 4 hours before {time}. Try another time or a nearby station."
              : "Nothing runs from {from} to {to} within 4 hours of {time}. Try another time or a nearby station.",
            { from: result.from.name, to: result.to.name, time: hhmm(result.when) })}
        </Txt>
      </View>
    );
  }
  return (
    <View style={[styles.list, refreshing && { opacity: 0.6 }]}>
      <View style={styles.head}>
        <Txt size={13} weight={700} style={{ flexShrink: 1 }}>{whenText(result)}</Txt>
        <View style={[styles.source, { backgroundColor: result.source === "live" ? th.ok + "22" : th.chipBg }]}>
          <Txt size={11} weight={700} color={result.source === "live" ? th.ok : th.muted}>{result.source === "live" ? t("Live, with delays") : t("Timetable")}</Txt>
        </View>
      </View>
      <View style={styles.pager}>
        <Button small label={`↑ ${t("Earlier")}`} onPress={onEarlier} />
        <RefreshButton onRefresh={onRefresh} refreshing={refreshing} fetchedAt={fetchedAt} />
      </View>
      {result.journeys.map((j, k) => (
        <JourneyCard key={k} journey={j} open={k === selected} onToggle={() => onSelect(k)} onTrack={leg => onTrack(k, leg)} />
      ))}
      <Button small label={`↓ ${t("Later")}`} onPress={onLater} style={{ alignSelf: "flex-start" }} />
    </View>
  );
}

function WalkChip({ leg }: { leg: Leg }) {
  const th = useTheme();
  return (
    <View style={[styles.walkChip, { backgroundColor: th.chipBg }]}>
      <PlaceIcon kind="walk" size={13} color={th.muted} />
      <Txt size={12} weight={700} muted>{legMinutes(leg)}</Txt>
    </View>
  );
}

function JourneyCard({ journey: j, open, onToggle, onTrack }: { journey: Journey; open: boolean; onToggle: () => void; onTrack: (leg: number | null) => void }) {
  const th = useTheme();
  const rides = j.legs.filter(l => l.mode === "transit");
  const firstDelay = rides[0]?.delay;
  const walkOnly = rides.length === 0;
  const first = j.legs[0], last = j.legs[j.legs.length - 1];
  const walkIn = first?.mode === "walk" && !first.transfer && !walkOnly ? first : null;
  const walkOut = last?.mode === "walk" && !last.transfer && !walkOnly ? last : null;
  const day = dayLabel(j.dep);
  return (
    <View style={[styles.card, { borderColor: open ? th.fg + "55" : th.line, backgroundColor: th.panel }]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.cardHead}>
        <View style={styles.timesRow}>
          <Txt size={17} weight={800}>
            {day ? `${day} ` : ""}{hhmm(j.dep)} – {hhmm(j.arr)}
          </Txt>
          {firstDelay != null && firstDelay >= 60 && <Txt size={14} weight={800} color={th.err}> {delayLabel(firstDelay)}</Txt>}
          <View style={{ flex: 1 }} />
          <Txt size={13} weight={600} muted>
            {t("{n} min", { n: j.duration })} · {walkOnly ? fmtDistance(first.distance) : j.transfers === 0 ? t("direct") : t(j.transfers > 1 ? "{n} changes" : "1 change", { n: j.transfers })}
          </Txt>
        </View>
        <View style={styles.lines}>
          {walkOnly && <View style={[styles.walkChip, { backgroundColor: th.chipBg }]}><PlaceIcon kind="walk" size={14} color={th.muted} /><Txt size={12} weight={700} muted>{t("Walk all the way")}</Txt></View>}
          {walkIn && <WalkChip leg={walkIn} />}
          {rides.map((l, k) => (
            <View key={k} style={styles.ride}>
              {(k > 0 || walkIn) && <Txt size={13} muted>›</Txt>}
              <ModeIcon mode={l.product ?? "bus"} size={16} />
              <LineChip line={l.line} product={l.product} />
            </View>
          ))}
          {walkOut && <><Txt size={13} muted>›</Txt><WalkChip leg={walkOut} /></>}
        </View>
      </Pressable>
      {open && rides.some(l => l.track) && (
        <Button kind="primary" label={t("Track this journey live")} onPress={() => onTrack(null)} icon={<View style={[styles.pulse, { backgroundColor: th.ok }]} />} style={{ marginHorizontal: 12, marginBottom: 8 }} />
      )}
      {open && (
        <View style={styles.legs}>
          {j.legs.map((l, k) => <LegRow key={k} leg={l} onTrack={l.track ? () => onTrack(k) : undefined} />)}
          <View style={styles.legRow}>
            <Txt size={13} weight={800} style={styles.t}>{hhmm(j.arr)}</Txt>
            <Txt size={14} weight={700} style={{ flex: 1 }}>{last?.to.name}</Txt>
          </View>
        </View>
      )}
    </View>
  );
}

function LegRow({ leg, onTrack }: { leg: Leg; onTrack?: () => void }) {
  const th = useTheme();
  const [showStops, setShowStops] = useState(false);
  const mins = legMinutes(leg);
  if (leg.mode === "walk") {
    if (leg.transfer) {
      return (
        <View style={styles.legRow}>
          <View style={styles.t} />
          <Txt size={13} muted style={{ flex: 1 }}>{t("Change platforms")} · {t("{n} min", { n: mins })}</Txt>
        </View>
      );
    }
    return (
      <View style={styles.legRow}>
        <Txt size={13} weight={700} style={styles.t}>{hhmm(leg.dep)}</Txt>
        <View style={[styles.legBody, { borderLeftColor: th.line, borderStyle: "dashed" }]}>
          <Txt size={14} weight={700}>{leg.from.name}</Txt>
          <View style={styles.inline}>
            <PlaceIcon kind="walk" size={14} color={th.muted} />
            <Txt size={13} muted>{t(leg.streetRoute ? "Walk {distance}" : "Walk about {distance}", { distance: fmtDistance(leg.distance) })} · {t("{n} min", { n: mins })}</Txt>
          </View>
          <Txt size={12} muted>{t("to {place}", { place: leg.to.name })}</Txt>
        </View>
      </View>
    );
  }
  const color = lineStyle(leg.line, leg.product).background;
  const d = delayLabel(leg.delay);
  return (
    <View style={styles.legRow}>
      <View style={styles.t}>
        <Txt size={13} weight={800}>{hhmm(leg.dep)}</Txt>
        {d && d !== "0" ? <Txt size={12} weight={800} color={th.err}>{d}</Txt> : null}
      </View>
      <View style={[styles.legBody, { borderLeftColor: color, borderLeftWidth: 4 }]}>
        <Txt size={14} weight={700}>{leg.from.name}</Txt>
        <View style={styles.inline}>
          <ModeIcon mode={leg.product ?? "bus"} size={16} />
          <LineChip line={leg.line} product={leg.product} />
          <Txt size={13} weight={600} style={{ flexShrink: 1 }} numberOfLines={1}>→ {leg.dir}</Txt>
        </View>
        {leg.cancelled && <Txt size={12} weight={800} color={th.err}>{t("Cancelled")}</Txt>}
        {onTrack && <Button kind="link" label={t("Track")} onPress={onTrack} />}
        {leg.stops.length > 0 ? (
          <Pressable onPress={() => setShowStops(v => !v)} hitSlop={6} accessibilityRole="button" accessibilityState={{ expanded: showStops }}>
            <Txt size={12} weight={600} color={th.accent}>
              {t(showStops ? (leg.stops.length > 1 ? "Hide {n} stops" : "Hide 1 stop") : (leg.stops.length > 1 ? "Show {n} stops" : "Show 1 stop"), { n: leg.stops.length })} · {t("{n} min", { n: mins })}
            </Txt>
          </Pressable>
        ) : <Txt size={12} muted>{t("{n} min, no stops between", { n: mins })}</Txt>}
        {showStops && leg.stops.map((s, k) => (
          <View key={k} style={styles.inline}>
            <Txt size={12} muted style={{ width: 40 }}>{s.time ? hhmm(s.time) : ""}</Txt>
            <Txt size={12} style={{ flex: 1 }}>{s.name}</Txt>
          </View>
        ))}
        <Txt size={14} weight={700}>{leg.to.name} <Txt size={12} muted>· {t("arr. {time}", { time: hhmm(leg.arr) })}</Txt></Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  empty: { gap: 8, paddingVertical: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  source: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  refresh: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  card: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  cardHead: { padding: 12, gap: 8 },
  timesRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
  lines: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  ride: { flexDirection: "row", alignItems: "center", gap: 4 },
  walkChip: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, height: 20, borderRadius: 5 },
  pulse: { width: 8, height: 8, borderRadius: 4 },
  legs: { paddingHorizontal: 12, paddingBottom: 12, gap: 10 },
  legRow: { flexDirection: "row", gap: 8 },
  t: { width: 48 },
  legBody: { flex: 1, gap: 4, borderLeftWidth: 2, paddingLeft: 10 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
});
