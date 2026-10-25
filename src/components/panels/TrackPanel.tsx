// Live tracking: where your vehicle is, when to board and when to get off.
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { delayLabel, hhmm, type Journey, type Leg, type TrackState } from "../../lib/api";
import { boardAlight } from "../../hooks/useTracking";
import { lineStyle } from "../../lib/lines";
import { useTheme, type Theme } from "../../lib/theme";
import type { PushSupport } from "../../lib/push";
import { ModeIcon } from "../icons";
import { Button, LineChip, Txt } from "../ui";
import { t } from "../../i18n";

export type PushState = { status: "off" | "starting" | "on" | "error"; error?: string; support: PushSupport; onEnable: () => void; onDisable: () => void };

export type TrackPanelProps = {
  journey: Journey;
  legIndex: number;
  leg: Leg | null;
  data: TrackState | null;
  error: string | null;
  follow: boolean;
  onFollow: () => void;
  onPickLeg: (k: number | null) => void;
  auto: boolean;
  onStop: () => void;
  push: PushState;
};

const SOURCE_TEXT = { live: "Live position", delays: "Timetable + live delay", timetable: "Timetable estimate" } as const;
type Tone = "bad" | "go" | "wait" | "ride" | "done";

const minutesUntil = (iso: string, delay: number | null | undefined) => Math.round((Date.parse(iso) + (delay ?? 0) * 1000 - Date.now()) / 60000);
const inMin = (m: number) => (m <= 0 ? t("now") : m === 1 ? t("in 1 min") : t("in {n} min", { n: m }));

function status(leg: Leg, tr: TrackState): { tone: Tone; title: string; sub: string } {
  const { board, alight } = boardAlight(leg, tr);
  const s = tr.stops;
  const name = (i: number) => s[i]?.name ?? "";
  if (tr.state === "cancelled") return { tone: "bad", title: t("{line} is cancelled", { line: tr.line }), sub: t("Look for another connection.") };
  if (tr.next <= board || tr.state === "scheduled") {
    if (tr.atStop === board) return { tone: "go", title: t("{line} is at {stop}", { line: tr.line, stop: name(board) }), sub: t("Board now.") };
    const m = minutesUntil(s[board].dep, tr.delay);
    const stopsAway = Math.max(0, board - tr.next);
    return {
      tone: m <= 2 ? "go" : "wait",
      title: t("{line} reaches {stop} {when}", { line: tr.line, stop: name(board), when: inMin(m) }),
      sub: tr.state === "scheduled" ? t("Starts its run at {time}", { time: hhmm(s[0].dep) }) : stopsAway > 0 ? t(stopsAway > 1 ? "{n} stops away" : "1 stop away", { n: stopsAway }) : t("Approaching your stop"),
    };
  }
  if (tr.next <= alight && tr.state !== "finished") {
    if (tr.atStop === alight) return { tone: "go", title: t("At {stop}", { stop: name(alight) }), sub: t("Get off here.") };
    const left = alight - tr.next + 1;
    const m = minutesUntil(s[alight].arr, tr.delay);
    return {
      tone: left <= 1 ? "go" : "ride",
      title: left <= 1 ? t("Next stop: {stop}", { stop: name(alight) }) : t("{n} stops to {stop}", { n: left, stop: name(alight) }),
      sub: t("Arrives {time} ({when})", { time: hhmm(new Date(Date.parse(s[alight].arr) + (tr.delay ?? 0) * 1000).toISOString()), when: inMin(m) }),
    };
  }
  return { tone: "done", title: t("Arrived at {stop}", { stop: name(alight) }), sub: "" };
}

const toneColor = (th: Theme, tone: Tone) => (tone === "bad" ? th.err : tone === "go" ? th.ok : tone === "done" ? th.muted : th.accent);

export function TrackPanel({ journey, legIndex, leg, data, error, follow, onFollow, onPickLeg, auto, onStop, push }: TrackPanelProps) {
  const th = useTheme();
  const rides = journey.legs.map((l, k) => ({ l, k })).filter(x => x.l.mode === "transit");
  const st = leg && data ? status(leg, data) : null;
  const range = leg && data ? boardAlight(leg, data) : null;
  // The stop list starts folded so the map (and your vehicle) stays visible
  const [showStops, setShowStops] = useState(false);
  const stopCount = range ? range.alight - range.board + 1 : 0;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <View style={[styles.pulse, { backgroundColor: th.ok }]} />
        <Txt size={16} weight={800} style={{ flex: 1 }}>{t("Tracking live")}</Txt>
        <Button small label={t("Stop")} onPress={onStop} />
      </View>

      {rides.length > 1 && (
        <View style={styles.steps} accessibilityRole="tablist">
          <Pressable onPress={() => onPickLeg(null)} accessibilityRole="tab" accessibilityState={{ selected: auto }}
            style={[styles.step, { borderColor: auto ? th.fg : th.line, backgroundColor: auto ? th.fg : "transparent" }]}>
            <Txt size={13} weight={700} color={auto ? th.panel : th.fg}>{t("Auto")}</Txt>
          </Pressable>
          {rides.map(({ l, k }) => {
            const on = !auto && k === legIndex, cur = auto && k === legIndex;
            return (
              <Pressable key={k} onPress={() => onPickLeg(k)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={[styles.step, { borderColor: on || cur ? th.fg : th.line, borderWidth: on ? 2 : 1 }]}>
                <ModeIcon mode={l.product ?? "bus"} size={14} />
                <LineChip line={l.line} product={l.product} small />
              </Pressable>
            );
          })}
        </View>
      )}

      {leg && (
        <View style={styles.line}>
          <ModeIcon mode={leg.product ?? "bus"} size={22} />
          <LineChip line={leg.line} product={leg.product} />
          <Txt size={15} weight={600} style={{ flex: 1 }} numberOfLines={1}>→ {leg.dir}</Txt>
        </View>
      )}

      {error && !data && <Txt size={14} color={th.err}>{t(error)}</Txt>}
      {!data && !error && <Txt size={14} muted>{t("Finding the vehicle…")}</Txt>}

      {st && data && (
        <>
          <View style={[styles.status, { borderLeftColor: toneColor(th, st.tone), backgroundColor: toneColor(th, st.tone) + "14" }]}>
            <Txt size={18} weight={800}>{st.title}</Txt>
            {st.sub ? <Txt size={14} muted>{st.sub}</Txt> : null}
          </View>
          <View style={styles.meta}>
            <Txt size={12} weight={700} color={data.source === "live" ? th.ok : th.muted}>{t(SOURCE_TEXT[data.source])}</Txt>
            {data.delay != null && (
              <Txt size={12} weight={700} color={data.delay >= 60 ? th.err : th.ok}>
                {data.delay >= 60 ? t("{delay} min late", { delay: delayLabel(data.delay) ?? "" }) : t("On time")}
              </Txt>
            )}
            <View style={{ flex: 1 }} />
            {!follow && <Button small label={t("Re-center")} onPress={onFollow} />}
          </View>

          <PushRow push={push} />

          {range && (
            <Pressable onPress={() => setShowStops(v => !v)} hitSlop={6} accessibilityRole="button" accessibilityState={{ expanded: showStops }}>
              <Txt size={13} weight={700} color={th.accent}>{t(showStops ? "Hide stops" : "Show all {n} stops", { n: stopCount })} {showStops ? "▴" : "▾"}</Txt>
            </Pressable>
          )}
          {range && showStops && (
            <View>
              {data.stops.map((s, i) => {
                if (i < range.board || i > range.alight) return null;
                const passed = i < data.next && data.atStop !== i;
                const here = data.atStop === i || (data.atStop == null && i === data.next);
                const end = i === range.board || i === range.alight;
                return (
                  <View key={i} style={[styles.stop, passed && { opacity: 0.45 }]}>
                    <Txt size={13} weight={700} style={{ width: 46 }}>{hhmm(i === range.board ? s.dep : s.arr)}</Txt>
                    <View style={[styles.dot, { borderColor: leg ? lineColor(leg) : th.fg, backgroundColor: here ? (leg ? lineColor(leg) : th.fg) : th.panel }, end && styles.dotEnd]} />
                    <Txt size={14} weight={end || here ? 800 : 500} style={{ flex: 1 }}>
                      {s.name}{i === range.board ? ` · ${t("board")}` : i === range.alight ? ` · ${t("get off")}` : ""}
                    </Txt>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const lineColor = (l: Leg) => lineStyle(l.line, l.product).background;

/** "Notify me when the app is closed" — journey updates as notifications. */
function PushRow({ push }: { push: PushState }) {
  const th = useTheme();
  if (push.support === "unsupported") return null;
  if (push.support === "denied") return <Txt size={13} muted>🔕 {t("Notifications are off for Berlin Live. Turn them on in Settings.")}</Txt>;
  if (push.status === "on") {
    return (
      <View style={[styles.push, { backgroundColor: th.ok + "14" }]}>
        <Txt size={13} weight={600} style={{ flex: 1 }}>🔔 {t("You'll get updates even with the app closed.")}</Txt>
        <Button kind="link" label={t("Turn off")} onPress={push.onDisable} />
      </View>
    );
  }
  return (
    <View style={{ gap: 4 }}>
      <Button kind="accent" small label={`🔔 ${push.status === "starting" ? t("Turning on…") : t("Notify me when the app is closed")}`} onPress={push.onEnable} disabled={push.status === "starting"} style={{ alignSelf: "flex-start" }} />
      {push.status === "error" && push.error ? <Txt size={12} color={th.err}>{t(push.error)}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  pulse: { width: 10, height: 10, borderRadius: 5 },
  steps: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  step: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  status: { borderLeftWidth: 4, borderRadius: 10, padding: 12, gap: 2 },
  meta: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  push: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10 },
  stop: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  dotEnd: { width: 14, height: 14, borderRadius: 7 },
});
