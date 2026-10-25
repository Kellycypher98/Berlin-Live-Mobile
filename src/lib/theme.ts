import { useColorScheme } from "react-native";

const light = {
  bg: "#eef1f4", panel: "#ffffff", fg: "#16202b", muted: "#5b6875", line: "#d3dae1",
  ok: "#1f8a4c", err: "#be1414", warn: "#c27c0e", accent: "#1a73e8", chipBg: "#f2f4f6",
};
const dark: typeof light = {
  bg: "#0f151b", panel: "#18212b", fg: "#e7edf3", muted: "#93a1ae", line: "#2a3643",
  ok: "#3cc477", err: "#ff6b6b", warn: "#e3a33a", accent: "#7fb0ff", chipBg: "#222d38",
};
export type Theme = typeof light & { dark: boolean };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? { ...dark, dark: true } : { ...light, dark: false };
}

export const FONT = { regular: undefined as string | undefined }; // system font (San Francisco / Roboto)
