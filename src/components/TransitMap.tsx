// The map: line network, your journey, stations, every vehicle (moving smoothly between updates),
// the tracked vehicle, stations near you and your position. MapLibre draws it all natively,
// so thousands of vehicles stay smooth.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { Camera, GeoJSONSource, Images, Layer, Map, Marker, NativeUserLocation, type CameraRef } from "@maplibre/maplibre-react-native";
import type { Journey, MapLine, Place, Station, TrackState } from "../lib/api";
import { isRail, P } from "../lib/api";
import type { Vehicle } from "../lib/types";
import { colorOf, modeOf, type ModeKey } from "../lib/modes";
import { lineStyle } from "../lib/lines";
import type { Me, NearStation } from "../lib/nearby";
import { BERLIN_CENTER, MAP_STYLE_DARK, MAP_STYLE_LIGHT } from "../config";
import { useTheme } from "../lib/theme";
import { ModeIcon } from "./icons";
import { Txt } from "./ui";

const ICONS = {
  "badge-subway": require("../../assets/map/badge-subway.png"),
  "badge-suburban": require("../../assets/map/badge-suburban.png"),
  "badge-tram": require("../../assets/map/badge-tram.png"),
  "badge-bus": require("../../assets/map/badge-bus.png"),
  "badge-regional": require("../../assets/map/badge-regional.png"),
  "badge-ferry": require("../../assets/map/badge-ferry.png"),
  arrow: require("../../assets/map/arrow.png"),
};
const FONT = ["Noto Sans Bold"];
const DRAW_ORDER: Record<string, number> = { bus: 0, ferry: 1, tram: 2, regional: 3, suburban: 4, subway: 5 };

export type MapHandle = {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  fitJourney: (j: Journey) => void;
  fitPoints: (pts: [number, number][]) => void;
};

type Props = {
  vehicles: Vehicle[];
  interval: number;
  enabled: Set<ModeKey>;
  dimmed: boolean;
  stations: Station[];
  highlight: number[];
  lines: MapLine[];
  showLines: boolean;
  lineFade: "none" | "journey" | "focus";
  journey: Journey | null;
  activeLeg: number | null;
  tracked: TrackState | null;
  follow: boolean;
  onUnfollow: () => void;
  me: Me | null;
  near: NearStation[];
  from: Place | null;
  to: Place | null;
  bottomInset: number; // height of the sheet, so framing keeps things above it
  topInset: number;
  onSelectStation: (s: Station) => void;
  onSelectVehicle: (v: Vehicle) => void;
  onLongPress: (lng: number, lat: number) => void;
  onMapPress: () => void;
};

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });

export const TransitMap = forwardRef<MapHandle, Props>(function TransitMap(p, ref) {
  const th = useTheme();
  const camera = useRef<CameraRef>(null);
  const insetsRef = useRef({ top: p.topInset, bottom: p.bottomInset });
  insetsRef.current = { top: p.topInset, bottom: p.bottomInset };

  useImperativeHandle(ref, () => ({
    flyTo: (lng, lat, zoom = 15) => camera.current?.easeTo({ center: [lng, lat], zoom, duration: 700, padding: padding() }),
    fitJourney: j => {
      const pts = j.legs.flatMap(l => l.path.map(([la, ln]) => [ln, la] as [number, number]));
      fit(pts);
    },
    fitPoints: pts => fit(pts),
  }));
  const padding = () => ({ top: insetsRef.current.top + 40, bottom: insetsRef.current.bottom + 40, left: 40, right: 40 });
  const fit = (pts: [number, number][]) => {
    if (!pts.length) return;
    let w = 180, s = 90, e = -180, n = -90;
    for (const [ln, la] of pts) { w = Math.min(w, ln); e = Math.max(e, ln); s = Math.min(s, la); n = Math.max(n, la); }
    if (e - w < 0.002 && n - s < 0.002) { camera.current?.easeTo({ center: [(w + e) / 2, (s + n) / 2], zoom: 15, duration: 700, padding: padding() }); return; }
    camera.current?.fitBounds([w, s, e, n], { padding: padding(), duration: 700 });
  };

  // ---------- vehicles, moving smoothly between the 10 s updates ----------
  const anim = useRef(new globalThis.Map<string, { from: [number, number]; to: [number, number]; v: Vehicle }>());
  const t0 = useRef(Date.now());
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const m = anim.current, seen = new Set<string>();
    const k = Math.min(1, (Date.now() - t0.current) / Math.max(1000, p.interval));
    for (const v of p.vehicles) {
      seen.add(v.id);
      const prev = m.get(v.id);
      const cur: [number, number] = prev ? [prev.from[0] + (prev.to[0] - prev.from[0]) * k, prev.from[1] + (prev.to[1] - prev.from[1]) * k] : [v.lng, v.lat];
      m.set(v.id, { from: cur, to: [v.lng, v.lat], v });
    }
    for (const id of m.keys()) if (!seen.has(id)) m.delete(id);
    t0.current = Date.now();
    setFrame(f => f + 1);
  }, [p.vehicles, p.interval]);
  useEffect(() => {
    // ~3 frames per second is smooth enough for vehicles and light on the battery
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => setFrame(f => f + 1), 333);
    const sub = AppState.addEventListener("change", s => {
      if (s !== "active" && timer) { clearInterval(timer); timer = null; }
      else if (s === "active" && !timer) timer = setInterval(() => setFrame(f => f + 1), 333);
    });
    return () => { if (timer) clearInterval(timer); sub.remove(); };
  }, []);

  const vehicleData = useMemo(() => {
    const k = Math.min(1, (Date.now() - t0.current) / Math.max(1000, p.interval));
    const out: GeoJSON.Feature[] = [];
    for (const { from, to, v } of anim.current.values()) {
      const mode = modeOf(v.product);
      if (!mode || !p.enabled.has(mode)) continue;
      const ls = lineStyle(v.line, v.product);
      out.push({
        type: "Feature", id: v.id,
        geometry: { type: "Point", coordinates: [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k] },
        properties: { id: v.id, mode, line: v.line, color: colorOf(v.product), lineColor: ls.background, h: v.h ?? -1, live: v.source === "live" ? 1 : 0, order: DRAW_ORDER[mode] ?? 0 },
      });
    }
    return fc(out);
  }, [frame, p.enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- stations ----------
  const stationData = useMemo(() => fc(p.stations.map(s => ({
    type: "Feature", id: s.i,
    geometry: { type: "Point", coordinates: [s.lng, s.lat] },
    properties: { i: s.i, name: s.name, rail: isRail(s) ? 1 : 0, minz: isRail(s) ? 12 : s.p & P.tram ? 14 : 15 },
  }))), [p.stations]);
  const byIndex = useMemo(() => new globalThis.Map(p.stations.map(s => [s.i, s])), [p.stations]);
  const highlightData = useMemo(() => fc(p.highlight.map(i => byIndex.get(i)).filter(Boolean).map(s => ({
    type: "Feature", geometry: { type: "Point", coordinates: [s!.lng, s!.lat] }, properties: {},
  }))), [p.highlight, byIndex]);

  // ---------- line network ----------
  const lineData = useMemo(() => fc(p.lines.flatMap(l => {
    const mode = modeOf(l.product);
    if (!mode || !p.enabled.has(mode)) return [];
    const color = lineStyle(l.line, l.product).background;
    return l.paths.map(path => ({
      type: "Feature" as const, geometry: { type: "LineString" as const, coordinates: path.map(([la, ln]) => [ln, la]) },
      properties: { color, width: l.product === "tram" || l.product === "ferry" ? 2 : 3 },
    }));
  })), [p.lines, p.enabled]);
  const lineOpacity = p.lineFade === "focus" ? 0.12 : p.lineFade === "journey" ? 0.3 : 0.75;

  // ---------- journey ----------
  const journeyData = useMemo(() => {
    if (!p.journey) return fc([]);
    const feats: GeoJSON.Feature[] = [];
    p.journey.legs.forEach((l, k) => {
      const coords = l.path.filter(x => x[0] != null).map(([la, ln]) => [ln, la]);
      if (coords.length < 2) return;
      const quiet = p.activeLeg != null && k !== p.activeLeg;
      feats.push({
        type: "Feature", geometry: { type: "LineString", coordinates: coords },
        properties: { walk: l.mode === "walk" ? 1 : 0, color: l.mode === "walk" ? "#5b6875" : lineStyle(l.line, l.product).background, quiet: quiet ? 1 : 0 },
      });
      if (l.mode === "transit") for (const s of l.stops) {
        feats.push({ type: "Feature", geometry: { type: "Point", coordinates: [s.lng, s.lat] }, properties: { stop: 1, color: lineStyle(l.line, l.product).background } });
      }
    });
    return fc(feats);
  }, [p.journey, p.activeLeg]);

  // ---------- near you ----------
  const nearData = useMemo(() => fc(p.near.map(n => ({
    type: "Feature", geometry: { type: "Point", coordinates: [n.s.lng, n.s.lat] }, properties: { rail: isRail(n.s) ? 1 : 0 },
  }))), [p.near]);

  // ---------- follow the tracked vehicle ----------
  useEffect(() => {
    if (!p.tracked || p.tracked.lat == null || !p.follow) return;
    camera.current?.easeTo({ center: [p.tracked.lng, p.tracked.lat], zoom: 15, duration: 900, padding: padding() });
  }, [p.tracked?.lat, p.tracked?.lng, p.follow]); // eslint-disable-line react-hooks/exhaustive-deps

  const dim = p.dimmed ? 0.12 : 1;
  const pressFeature = (e: { nativeEvent: { features: GeoJSON.Feature[] } }) => e.nativeEvent.features?.[0]?.properties;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={th.dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        touchRotate={false}
        touchPitch={false}
        logo={false}
        attributionPosition={{ bottom: p.bottomInset + 4, left: 8 }}
        compass={false}
        onLongPress={e => { const [ln, la] = e.nativeEvent.lngLat; p.onLongPress(ln, la); }}
        onPress={() => p.onMapPress()}
        onRegionWillChange={e => { if (e.nativeEvent.userInteraction && p.follow) p.onUnfollow(); }}
      >
        <Camera ref={camera} initialViewState={{ center: BERLIN_CENTER, zoom: 12 }} minZoom={8} maxZoom={18} />
        <Images images={ICONS} />

        {p.showLines && (
          <GeoJSONSource id="lines" data={lineData}>
            <Layer id="lines-casing" type="line" layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": th.dark ? "#0f151b" : "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 10, ["+", ["get", "width"], 1], 15, ["+", ["*", ["get", "width"], 2], 2]], "line-opacity": lineOpacity * 0.8 }} />
            <Layer id="lines" type="line" layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, ["get", "width"], 15, ["*", ["get", "width"], 2]], "line-opacity": lineOpacity }} />
          </GeoJSONSource>
        )}

        <GeoJSONSource id="journey" data={journeyData}>
          <Layer id="journey-halo" type="line" filter={["==", ["get", "walk"], 0]} layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": "#ffffff", "line-width": ["case", ["==", ["get", "quiet"], 1], 7, 11], "line-opacity": 0.9 }} />
          <Layer id="journey-ride" type="line" filter={["==", ["get", "walk"], 0]} layout={{ "line-cap": "round", "line-join": "round" }}
            paint={{ "line-color": ["get", "color"], "line-width": ["case", ["==", ["get", "quiet"], 1], 4, 7], "line-opacity": ["case", ["==", ["get", "quiet"], 1], 0.55, 1] }} />
          <Layer id="journey-walk" type="line" filter={["==", ["get", "walk"], 1]} layout={{ "line-cap": "round" }}
            paint={{ "line-color": "#5b6875", "line-width": 4, "line-dasharray": [0.5, 2] }} />
          <Layer id="journey-stops" type="circle" filter={["==", ["get", "stop"], 1]}
            paint={{ "circle-radius": 3.5, "circle-color": "#ffffff", "circle-stroke-color": ["get", "color"], "circle-stroke-width": 2 }} />
        </GeoJSONSource>

        <GeoJSONSource id="stations" data={stationData} hitbox={{ top: 12, right: 12, bottom: 12, left: 12 }}
          onPress={e => { const pr = pressFeature(e); const s = pr && byIndex.get(pr.i as number); if (s) p.onSelectStation(s); }}>
          <Layer id="stations" type="circle" filter={[">=", ["zoom"], ["get", "minz"]]}
            paint={{
              "circle-radius": ["case", ["==", ["get", "rail"], 1], ["interpolate", ["linear"], ["zoom"], 12, 3.5, 16, 6], 3],
              "circle-color": th.dark ? "#18212b" : "#ffffff",
              "circle-stroke-color": th.dark ? "#c6d0da" : "#3d4a57",
              "circle-stroke-width": ["case", ["==", ["get", "rail"], 1], 2, 1.5],
              "circle-opacity": p.dimmed ? 0.2 : 1, "circle-stroke-opacity": p.dimmed ? 0.2 : 1,
            }} />
          <Layer id="station-names" type="symbol" minzoom={15} filter={["==", ["get", "rail"], 1]}
            layout={{ "text-field": ["get", "name"], "text-font": FONT, "text-size": 11, "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true }}
            paint={{ "text-color": th.dark ? "#c6d0da" : "#3d4a57", "text-halo-color": th.dark ? "#0f151b" : "#ffffff", "text-halo-width": 1.5, "text-opacity": p.dimmed ? 0.2 : 1 }} />
        </GeoJSONSource>
        <GeoJSONSource id="highlight" data={highlightData}>
          <Layer id="highlight" type="circle" paint={{ "circle-radius": 8, "circle-color": "#ffffff", "circle-stroke-color": "#16202b", "circle-stroke-width": 3 }} />
        </GeoJSONSource>

        <GeoJSONSource id="near" data={nearData}>
          <Layer id="near-ring" type="circle" paint={{ "circle-radius": 16, "circle-color": ["case", ["==", ["get", "rail"], 1], "#0065ae", "#5b6875"], "circle-opacity": 0.15, "circle-stroke-width": 2, "circle-stroke-color": ["case", ["==", ["get", "rail"], 1], "#0065ae", "#5b6875"], "circle-stroke-opacity": 0.5 }} />
          <Layer id="near-dot" type="circle" paint={{ "circle-radius": 7, "circle-color": "#ffffff", "circle-stroke-width": 3, "circle-stroke-color": ["case", ["==", ["get", "rail"], 1], "#0065ae", "#5b6875"] }} />
        </GeoJSONSource>

        <GeoJSONSource id="vehicles" data={vehicleData} hitbox={{ top: 14, right: 14, bottom: 14, left: 14 }}
          onPress={e => { const pr = pressFeature(e); const a = pr && anim.current.get(pr.id as string); if (a) p.onSelectVehicle(a.v); }}>
          <Layer id="vehicle-dots" type="circle" maxzoom={12}
            paint={{ "circle-radius": 3.5, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 1, "circle-opacity": ["*", dim, ["case", ["==", ["get", "live"], 1], 1, 0.8]], "circle-stroke-opacity": dim }} />
          <Layer id="vehicle-arrows" type="symbol" minzoom={12} filter={[">=", ["get", "h"], 0]}
            layout={{ "icon-image": "arrow", "icon-rotate": ["get", "h"], "icon-rotation-alignment": "map", "icon-offset": [0, -17], "icon-allow-overlap": true, "icon-ignore-placement": true, "symbol-sort-key": ["get", "order"] }}
            paint={{ "icon-opacity": dim }} />
          <Layer id="vehicle-badges" type="symbol" minzoom={12}
            layout={{
              "icon-image": ["concat", "badge-", ["get", "mode"]], "icon-size": ["interpolate", ["linear"], ["zoom"], 12, 0.85, 15, 1],
              "icon-allow-overlap": true, "icon-ignore-placement": true, "symbol-sort-key": ["get", "order"],
              "text-field": ["step", ["zoom"], "", 15, ["get", "line"]], "text-font": FONT, "text-size": 12,
              "text-anchor": "left", "text-offset": [1.1, 0], "text-allow-overlap": true, "text-optional": true,
            }}
            paint={{ "icon-opacity": ["*", dim, ["case", ["==", ["get", "live"], 1], 1, 0.85]], "text-color": ["get", "lineColor"], "text-halo-color": "#ffffff", "text-halo-width": 2, "text-opacity": dim }} />
        </GeoJSONSource>

        {p.tracked && p.tracked.lat != null && (
          <Marker lngLat={[p.tracked.lng, p.tracked.lat]} anchor="center">
            <TrackedBadge t={p.tracked} />
          </Marker>
        )}
        {p.from && p.from.station == null && <Marker lngLat={[p.from.lng, p.from.lat]} anchor="bottom"><Pin color="#1f8a4c" /></Marker>}
        {p.to && p.to.station == null && <Marker lngLat={[p.to.lng, p.to.lat]} anchor="bottom"><Pin color="#be1414" /></Marker>}
        {p.me && <NativeUserLocation />}
      </Map>
    </View>
  );
});

function TrackedBadge({ t }: { t: TrackState }) {
  const ls = lineStyle(t.line, t.product);
  return (
    <View style={[styles.tracked, { borderColor: ls.background }]}>
      <View style={[styles.trackedPill, { backgroundColor: ls.background }]}>
        <ModeIcon mode={t.product} size={18} />
        <Txt size={14} weight={800} color={ls.color}>{t.line}</Txt>
      </View>
    </View>
  );
}

function Pin({ color }: { color: string }) {
  return (
    <View style={styles.pinWrap}>
      <View style={[styles.pin, { backgroundColor: color }]}><View style={styles.pinDot} /></View>
      <View style={[styles.pinTip, { borderTopColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tracked: { padding: 4, borderRadius: 14, borderWidth: 3, backgroundColor: "rgba(255,255,255,.5)" },
  trackedPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 3, paddingLeft: 3, paddingRight: 8, borderRadius: 8, borderWidth: 2, borderColor: "#fff" },
  pinWrap: { alignItems: "center" },
  pin: { width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  pinDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  pinTip: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7, borderLeftColor: "transparent", borderRightColor: "transparent", marginTop: -1 },
});
