// Small building blocks: text in Manrope, buttons, line chips.
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { lineStyle } from "../lib/lines";
import { useTheme } from "../lib/theme";

const FAMILY = { 400: "Manrope_400Regular", 500: "Manrope_500Medium", 600: "Manrope_600SemiBold", 700: "Manrope_700Bold", 800: "Manrope_800ExtraBold" } as const;

type TxtProps = { children?: ReactNode; size?: number; weight?: keyof typeof FAMILY; color?: string; muted?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number };
export function Txt({ children, size = 15, weight = 500, color, muted, style, numberOfLines }: TxtProps) {
  const th = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: FAMILY[weight], fontSize: size, color: color ?? (muted ? th.muted : th.fg), fontVariant: ["tabular-nums"] }, style]}>
      {children}
    </Text>
  );
}

type BtnProps = { label: string; onPress: () => void; kind?: "primary" | "plain" | "accent" | "link"; small?: boolean; disabled?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle>; accessibilityLabel?: string };
export function Button({ label, onPress, kind = "plain", small, disabled, icon, style, accessibilityLabel }: BtnProps) {
  const th = useTheme();
  if (kind === "link") {
    return (
      <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} style={style}>
        <Txt size={13} weight={600} muted style={{ textDecorationLine: "underline" }}>{label}</Txt>
      </Pressable>
    );
  }
  const bg = kind === "primary" ? th.fg : kind === "accent" ? (th.dark ? "#1d3350" : "#e8f0fd") : th.panel;
  const fg = kind === "primary" ? th.panel : kind === "accent" ? th.accent : th.fg;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.btn, small && styles.btnSmall, { backgroundColor: bg, borderColor: kind === "accent" ? th.accent + "55" : th.line, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }, style]}>
      {icon}
      <Txt size={small ? 13 : 15} weight={700} color={fg}>{label}</Txt>
    </Pressable>
  );
}

export function LineChip({ line, product, small }: { line?: string; product?: string; small?: boolean }) {
  const s = lineStyle(line, product);
  return (
    <View style={[styles.chip, small && styles.chipSmall, { backgroundColor: s.background }]}>
      <Txt size={small ? 10 : 12} weight={800} color={s.color}>{line}</Txt>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const th = useTheme();
  return <View style={[styles.card, { backgroundColor: th.dark ? "#1f2a35" : "#f3f5f7" }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 44, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  btnSmall: { height: 32, paddingHorizontal: 10, borderRadius: 9 },
  chip: { paddingHorizontal: 5, minWidth: 22, height: 19, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  chipSmall: { height: 16, paddingHorizontal: 4, minWidth: 18 },
  card: { borderRadius: 12, padding: 12 },
});
