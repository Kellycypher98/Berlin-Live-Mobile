// Transport-mode badges (U square, S circle, tram/bus/ferry pictograms, RE) and place icons, as SVG.
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import { MODES, modeOf, type ModeKey } from "../lib/modes";
import type { Place } from "../lib/api";
import { P } from "../lib/api";

const TRAM = "M7.6 1.2h8.8L12.9 4.9h-1.8z M11.4 4.6h1.2v1.3h-1.2z M7.6 5.6h8.8A2.6 2.6 0 0 1 19 8.2v8.2a2.6 2.6 0 0 1-2.6 2.6H7.6A2.6 2.6 0 0 1 5 16.4V8.2a2.6 2.6 0 0 1 2.6-2.6z M7 8.1v4.6h10V8.1z M8.6 14.4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z M15.4 14.4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z M7.4 19.6h2.1l-1.3 2.9H6.1z M14.5 19.6h2.1l1.3 2.9h-2.1z";
const BUS = "M5.2 4h13.6A2.2 2.2 0 0 1 21 6.2v9.7a1.6 1.6 0 0 1-1.6 1.6h-.4a2.6 2.6 0 0 0-5.2 0H9.8a2.6 2.6 0 0 0-5.2 0h-.1A1.5 1.5 0 0 1 3 16V6.2A2.2 2.2 0 0 1 5.2 4z M5 6.3v4.6h3.1V6.3z M9.4 6.3v4.6h3.1V6.3z M13.8 6.3v4.6h3.1V6.3z M18.2 6.3v6.4h1.1V6.3z M7.2 15.9a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z M16.4 15.9a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z";
const FERRY = "M11 2.5h2V5h3.6l1 4.6 2.6 1.1-2 6.1c-.9.3-1.8.1-2.7-.5-1.3 1-2.9 1-4.2 0-1.3 1-2.9 1-4.2 0-.9.6-1.8.8-2.7.5l-2-6.1 2.6-1.1 1-4.6H11z M7.6 7l-.5 2.4h9.8L16.4 7z M2.5 20.2c1.6.7 3.2.7 4.8 0 1.6.7 3.2.7 4.7 0 1.6.7 3.2.7 4.8 0 1.6.7 3.2.7 4.7 0v1.9c-1.6.7-3.1.7-4.7 0-1.6.7-3.2.7-4.8 0-1.5.7-3.1.7-4.7 0-1.6.7-3.2.7-4.8 0z";

const BADGES: Record<ModeKey, { shape: "square" | "circle"; text?: string; path?: string }> = {
  subway: { shape: "square", text: "U" },
  suburban: { shape: "circle", text: "S" },
  tram: { shape: "square", path: TRAM },
  bus: { shape: "square", path: BUS },
  regional: { shape: "square", text: "RE" },
  ferry: { shape: "circle", path: FERRY },
};
export const modeColor = (m: ModeKey) => MODES.find(x => x.key === m)!.color;

export function ModeIcon({ mode, size = 18, dim = false }: { mode: ModeKey | string; size?: number; dim?: boolean }) {
  const key = (modeOf(mode as string) ?? (mode as ModeKey)) as ModeKey;
  const b = BADGES[key];
  if (!b) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={dim ? 0.4 : 1}>
      {b.shape === "circle" ? <Circle cx={12} cy={12} r={12} fill={modeColor(key)} /> : <Rect width={24} height={24} rx={4.5} fill={modeColor(key)} />}
      {b.text && (
        <SvgText x={12} y={b.text.length > 1 ? 16.4 : 17.8} textAnchor="middle" fontWeight="700" fontSize={b.text.length > 1 ? 12 : 17} fill="#fff">{b.text}</SvgText>
      )}
      {b.path && <Path d={b.path} fill="#fff" fillRule="evenodd" transform="translate(3.6 3.6) scale(.7)" />}
    </Svg>
  );
}

const PLACE_PATHS: Record<string, string> = {
  address: "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
  poi: "M6 3h2v18H6z M8 4h10l-2 4 2 4H8z",
  location: "M12 2v3 M12 19v3 M2 12h3 M19 12h3 M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  walk: "M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7",
};

export function PlaceIcon({ kind, size = 18, color = "#5b6875" }: { kind: Place["kind"] | "walk"; size?: number; color?: string }) {
  const stroke = kind === "location";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={PLACE_PATHS[kind] ?? PLACE_PATHS.address} fill={stroke ? "none" : color} stroke={stroke ? color : "none"} strokeWidth={stroke ? 2 : 0} strokeLinecap="round" />
    </Svg>
  );
}

/** Station: its main mode badge; anything else: a place icon. */
export function PlaceGlyph({ place, size = 18, color }: { place: Place; size?: number; color?: string }) {
  if (place.kind === "station") {
    const p = place.p ?? 0;
    const mode = p & P.suburban ? "suburban" : p & P.subway ? "subway" : p & P.regional ? "regional" : p & P.tram ? "tram" : p & P.ferry ? "ferry" : "bus";
    return <ModeIcon mode={mode} size={size} />;
  }
  return <PlaceIcon kind={place.kind} size={size} color={color} />;
}
