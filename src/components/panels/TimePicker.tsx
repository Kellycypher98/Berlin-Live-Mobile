// Leave now / Depart at / Arrive by, with Today/Tomorrow and a time you nudge in 5-minute steps
// (hold for 15). No native date picker module needed.
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../lib/theme";
import { Txt } from "../ui";
import { t } from "../../i18n";

export type TimeMode = "now" | "depart" | "arrive";
export type TimeChoice = { mode: TimeMode; date: string; time: string }; // date YYYY-MM-DD, time HH:MM

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function defaultChoice(mode: TimeMode = "now"): TimeChoice {
  const d = new Date(Date.now() + 5 * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return { mode, date: ymd(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export function choiceToIso(c: TimeChoice): string | null {
  if (c.mode === "now") return null;
  const d = new Date(`${c.date}T${c.time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Moves the chosen moment by some minutes, rolling over midnight into the next/previous day. */
function shift(c: TimeChoice, minutes: number): TimeChoice {
  const d = new Date(`${c.date}T${c.time}:00`);
  d.setMinutes(d.getMinutes() + minutes);
  const min = Date.now() - 60 * 60000, max = Date.now() + 60 * 86400000;
  if (d.getTime() < min || d.getTime() > max) return c;
  return { ...c, date: ymd(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

const MODES: { key: TimeMode; label: string }[] = [
  { key: "now", label: "Leave now" },
  { key: "depart", label: "Depart at" },
  { key: "arrive", label: "Arrive by" },
];

export function TimePicker({ value, onChange }: { value: TimeChoice; onChange: (c: TimeChoice) => void }) {
  const th = useTheme();
  const today = ymd(new Date());
  const tomorrow = ymd(new Date(Date.now() + 86400000));
  const tap = (c: TimeChoice) => { Haptics.selectionAsync().catch(() => {}); onChange(c); };
  const dayText = value.date === today ? t("Today") : value.date === tomorrow ? t("Tomorrow")
    : new Date(`${value.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  return (
    <View style={styles.wrap}>
      <View style={[styles.seg, { backgroundColor: th.chipBg }]} accessibilityRole="radiogroup">
        {MODES.map(m => {
          const on = value.mode === m.key;
          return (
            <Pressable key={m.key} accessibilityRole="radio" accessibilityState={{ checked: on }}
              onPress={() => tap(m.key === "now" ? { ...value, mode: "now" } : { ...(value.mode === "now" ? defaultChoice() : value), mode: m.key })}
              style={[styles.segBtn, on && { backgroundColor: th.panel, shadowOpacity: 0.12 }]}>
              <Txt size={13} weight={on ? 700 : 600} muted={!on}>{t(m.label)}</Txt>
            </Pressable>
          );
        })}
      </View>
      {value.mode !== "now" && (
        <View style={styles.when}>
          <View style={styles.days}>
            {[[today, "Today"], [tomorrow, "Tomorrow"]].map(([d, label]) => {
              const on = value.date === d;
              return (
                <Pressable key={d} onPress={() => tap({ ...value, date: d })} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={[styles.day, { borderColor: on ? th.fg : th.line, backgroundColor: on ? th.fg : "transparent" }]}>
                  <Txt size={13} weight={700} color={on ? th.panel : th.fg}>{t(label)}</Txt>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.stepper, { borderColor: th.line }]}>
            <Pressable onPress={() => tap(shift(value, -5))} onLongPress={() => tap(shift(value, -15))} hitSlop={6} style={styles.step} accessibilityLabel={t("5 minutes earlier")}>
              <Txt size={20} weight={700}>−</Txt>
            </Pressable>
            <View style={styles.timeBox}>
              <Txt size={17} weight={800}>{value.time}</Txt>
              {value.date !== today && value.date !== tomorrow && <Txt size={10} muted>{dayText}</Txt>}
            </View>
            <Pressable onPress={() => tap(shift(value, 5))} onLongPress={() => tap(shift(value, 15))} hitSlop={6} style={styles.step} accessibilityLabel={t("5 minutes later")}>
              <Txt size={20} weight={700}>+</Txt>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  seg: { flexDirection: "row", borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, alignItems: "center", justifyContent: "center", height: 34, borderRadius: 8, shadowColor: "#000", shadowOpacity: 0, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  when: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  days: { flexDirection: "row", gap: 6 },
  day: { paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, justifyContent: "center" },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, height: 40 },
  step: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  timeBox: { minWidth: 64, alignItems: "center" },
});
