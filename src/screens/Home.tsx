// The one screen: the live map with a bottom sheet for search, results, stations, tracking and settings.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import Svg, { Path } from "react-native-svg";
import { TransitMap, type MapHandle } from "../components/TransitMap";
import { PlaceInput } from "../components/panels/PlaceInput";
import { TimePicker, choiceToIso, defaultChoice, type TimeChoice } from "../components/panels/TimePicker";
import { JourneyList } from "../components/panels/JourneyList";
import { StationCard } from "../components/panels/StationCard";
import { TrackPanel, type PushState } from "../components/panels/TrackPanel";
import { NearbyList } from "../components/panels/NearbyList";
import { SettingsPanel } from "../components/panels/SettingsPanel";
import { VehicleCard } from "../components/panels/VehicleCard";
import { LoadingScreen } from "../components/overlays/LoadingScreen";
import { Tour, hasSeenTour } from "../components/overlays/Tour";
import { PlaceIcon } from "../components/icons";
import { Button, Txt } from "../components/ui";
import { useLiveVehicles } from "../hooks/useLiveVehicles";
import { useStations } from "../hooks/useStations";
import { useLines } from "../hooks/useLines";
import { useTracking, type Tracking } from "../hooks/useTracking";
import { currentPosition, useMyLocation } from "../hooks/useMyLocation";
import { fetchJourneys, fetchReverse, placeKey, stationPlace, type JourneyResult, type Place, type Station } from "../lib/api";
import { MODES, modeOf, type ModeKey } from "../lib/modes";
import { nearestStations } from "../lib/nearby";
import { pushSupport, startPushWatch, stopPushWatch, type PushSupport } from "../lib/push";
import type { Vehicle } from "../lib/types";
import { useTheme } from "../lib/theme";
import { t, useLang } from "../i18n";

const PEEK = 168; // collapsed sheet: the "To" field and the near-me button stay in view

export default function Home() {
  useLang();
  const th = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const map = useRef<MapHandle>(null);
  const sheet = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [PEEK + insets.bottom, "50%", "92%"], [insets.bottom]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const sheetHeight = sheetIndex === 0 ? PEEK + insets.bottom : sheetIndex === 1 ? winH * 0.5 : winH * 0.5; // at 92% the map is covered anyway; frame above half
  const snap = (k: number) => sheet.current?.snapToIndex(k);

  const { snapshot, state } = useLiveVehicles();
  const { stations, searchIndex, error: stationsError } = useStations();
  const mapLines = useLines();
  const [showLines, setShowLines] = useState(true);
  const [enabled, setEnabled] = useState<Set<ModeKey>>(() => new Set(MODES.filter(m => m.defaultOn).map(m => m.key)));
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ---------- journey search ----------
  const [from, setFrom] = useState<Place | null>(null);
  const [to, setTo] = useState<Place | null>(null);
  const fromKey = placeKey(from), toKey = placeKey(to);
  const [result, setResult] = useState<JourneyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const lastSearch = useRef("");
  const [timeChoice, setTimeChoice] = useState<TimeChoice>(() => defaultChoice());
  const [page, setPage] = useState<{ mode: "depart" | "arrive"; when: string } | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [picked, setPicked] = useState<Place | null>(null); // long-pressed spot waiting for "from" / "to"
  const [inputOpen, setInputOpen] = useState(false);

  // ---------- tracking ----------
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [follow, setFollow] = useState(true);
  const tracked = useTracking(tracking);
  useEffect(() => setTracking(null), [fromKey, toKey]);
  useEffect(() => setPage(null), [fromKey, toKey, timeChoice]);
  const query = page ?? { mode: timeChoice.mode === "arrive" ? "arrive" as const : "depart" as const, when: choiceToIso(timeChoice) };

  const startTracking = (journeyIndex: number, leg: number | null) => {
    const j = result?.journeys[journeyIndex];
    if (!j) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setSelected(journeyIndex); setStation(null); setVehicle(null); setFollow(true);
    setTracking({ journey: j, leg });
    snap(0);
  };

  // ---------- notifications while the app is closed ----------
  const [support, setSupport] = useState<PushSupport>("unsupported");
  useEffect(() => { pushSupport().then(setSupport).catch(() => {}); }, [tracking?.journey]);
  const [push, setPush] = useState<Omit<PushState, "support" | "onEnable" | "onDisable">>({ status: "off" });
  const pushId = useRef<string | null>(null);
  useEffect(() => {
    if (pushId.current) { stopPushWatch(pushId.current); pushId.current = null; }
    setPush({ status: "off" });
  }, [tracking?.journey]);
  const enablePush = async () => {
    if (!tracking) return;
    setPush({ status: "starting" });
    try {
      pushId.current = await startPushWatch(tracking.journey);
      setPush({ status: "on" });
    } catch (e) {
      const m = (e as Error).message;
      if (m === "denied") setSupport("denied");
      setPush({ status: "error", error: m === "denied" ? "" : m });
    }
  };
  const disablePush = () => { if (pushId.current) stopPushWatch(pushId.current); pushId.current = null; setPush({ status: "off" }); };
  // Tapping a journey notification opens the app on the tracking panel (it's still there if the app was in memory)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => { setFollow(true); snap(0); });
    return () => sub.remove();
  }, []);

  // ---------- journey search requests ----------
  useEffect(() => {
    const searchKey = `${fromKey}|${toKey}|${query.mode}|${query.when}`;
    const isRefresh = searchKey === lastSearch.current && result !== null;
    lastSearch.current = searchKey;
    setError(null);
    if (!isRefresh) { setResult(null); setSelected(0); }
    if (!from || !to) return;
    if (fromKey === toKey) { setError(t("Start and destination are the same place.")); return; }
    if (!isRefresh) { setStation(null); setVehicle(null); }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetchJourneys(from, to, query, ctrl.signal)
        .then(r => {
          if (ctrl.signal.aborted) return;
          setResult(r); setFetchedAt(Date.now());
          if (isRefresh) setSelected(k => Math.min(k, Math.max(0, r.journeys.length - 1)));
          else { Keyboard.dismiss(); snap(1); }
        })
        .catch(e => { if (!ctrl.signal.aborted) setError(isRefresh ? t("Couldn't refresh: {message}", { message: e.message }) : e.message); })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, isRefresh ? 0 : 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [fromKey, toKey, query.mode, query.when, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => setRefreshKey(k => k + 1);
  const earlier = () => { const f = result?.journeys[0]; if (f) setPage({ mode: "arrive", when: new Date(Date.parse(f.arr) - 60000).toISOString() }); };
  const later = () => { const l = result?.journeys[result.journeys.length - 1]; if (l) setPage({ mode: "depart", when: new Date(Date.parse(l.dep) + 60000).toISOString() }); };

  const journey = tracking ? tracking.journey : !station ? result?.journeys?.[selected] ?? null : null;
  // Frame the selected connection (not while tracking: then the map follows the vehicle)
  useEffect(() => { if (journey && !tracking) map.current?.fitJourney(journey); }, [journey, tracking]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickFrom = (p: Place | null) => { setStation(null); setVehicle(null); setPicked(null); setFrom(p); if (p && !to) map.current?.flyTo(p.lng, p.lat); };
  const pickTo = (p: Place | null) => { setStation(null); setVehicle(null); setPicked(null); setTo(p); if (p && !from) map.current?.flyTo(p.lng, p.lat); };

  // "Use my location" as the start
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const useHere = async () => {
    setLocating(true); setLocError(null);
    try {
      const pos = await currentPosition();
      if (!pos) { setLocError(t("Location access was blocked. Type an address or station instead.")); return; }
      const here: Place = { kind: "location", name: t("My location"), lat: pos.lat, lng: pos.lng };
      pickFrom(here);
      fetchReverse(here.lat, here.lng).then(r => { if (r.name) setFrom(f => (f && f.kind === "location" && f.lat === here.lat ? { ...here, detail: t("near {place}", { place: r.name! }) } : f)); }).catch(() => {});
    } catch {
      setLocError(t("Couldn't get your location. Type an address or station instead."));
    } finally { setLocating(false); }
  };

  // ---------- long-press the map: route from / to that spot ----------
  const onLongPress = useCallback((lng: number, lat: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const base: Place = { kind: "location", name: t("Dropped pin"), lat, lng };
    setPicked(base); setStation(null); setVehicle(null); setSettingsOpen(false);
    snap(0);
    fetchReverse(lat, lng).then(r => { if (r.name) setPicked(p => (p && p.lat === lat ? { ...base, kind: "address", name: r.name!, detail: r.detail ?? null } : p)); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- vehicles per mode ----------
  const vehicles = snapshot?.vehicles ?? [];
  const counts = useMemo(() => {
    const c: Partial<Record<ModeKey, number>> = {};
    for (const v of vehicles) { const m = modeOf(v.product); if (m) c[m] = (c[m] ?? 0) + 1; }
    return c;
  }, [vehicles]);
  const toggle = (key: ModeKey) => setEnabled(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ---------- stations near me ----------
  const loc = useMyLocation();
  const near = useMemo(() => (loc.me && stations.length ? nearestStations(stations, loc.me) : []), [loc.me, stations]);
  // Frame you and the stations around you once when the list first appears, and again on "show me"
  const framedNear = useRef(false);
  useEffect(() => { if (!loc.on) framedNear.current = false; }, [loc.on]);
  const frameNear = () => { if (loc.me) map.current?.fitPoints([[loc.me.lng, loc.me.lat], ...near.map(n => [n.s.lng, n.s.lat] as [number, number])]); };
  useEffect(() => {
    if (!loc.me || !near.length || framedNear.current) return;
    framedNear.current = true;
    frameNear();
  }, [loc.me, near]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (loc.recenter) frameNear(); }, [loc.recenter]); // eslint-disable-line react-hooks/exhaustive-deps
  const nearMe = () => { setStation(null); setVehicle(null); setSettingsOpen(false); loc.start(); snap(1); };

  // ---------- first-use tour ----------
  const [tourOpen, setTourOpen] = useState(false);
  const tourChecked = useRef(false);
  const appReady = stations.length > 0 && !!snapshot?.updatedAt;
  useEffect(() => {
    if (!appReady || tourChecked.current) return;
    tourChecked.current = true;
    let timer: ReturnType<typeof setTimeout>;
    hasSeenTour().then(seen => { if (!seen) timer = setTimeout(() => setTourOpen(true), 900); });
    return () => clearTimeout(timer);
  }, [appReady]);

  const selectStation = (s: Station) => { setStation(s); setVehicle(null); setPicked(null); setSettingsOpen(false); map.current?.flyTo(s.lng, s.lat, 15.5); snap(1); };
  const selectVehicle = (v: Vehicle) => { if (tracking) return; setVehicle(v); setStation(null); setPicked(null); setSettingsOpen(false); snap(0); };

  const highlight = [from?.station, to?.station, station?.i].filter((x): x is number => x != null);
  const ready = stations.length > 0;
  const view = settingsOpen ? "settings" : tracking ? "tracking" : picked ? "picked" : vehicle ? "vehicle" : station ? "station" : "search";

  return (
    <View style={[styles.root, { backgroundColor: th.bg }]}>
      <TransitMap
        ref={map}
        vehicles={vehicles} interval={snapshot?.interval ?? 10000} enabled={enabled} dimmed={!!tracking}
        stations={stations} highlight={highlight}
        lines={mapLines} showLines={showLines} lineFade={tracking ? "focus" : journey ? "journey" : "none"}
        journey={journey} activeLeg={tracking ? tracked.legIndex : null}
        tracked={tracking ? tracked.data : null} follow={follow} onUnfollow={() => setFollow(false)}
        me={loc.me} near={tracking ? [] : near}
        from={from} to={to}
        topInset={insets.top} bottomInset={sheetHeight}
        onSelectStation={selectStation}
        onSelectVehicle={selectVehicle}
        onLongPress={onLongPress}
        onMapPress={() => { Keyboard.dismiss(); }}
      />

      {/* Floating buttons */}
      <View style={[styles.fabs, { top: insets.top + 10 }]}>
        <Fab label={t("Map & settings")} onPress={() => { setSettingsOpen(true); snap(1); }}>
          <Svg width={22} height={22} viewBox="0 0 24 24"><Path d="M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 17.5l10 5 10-5" fill="none" stroke={th.fg} strokeWidth={2} strokeLinejoin="round" /></Svg>
        </Fab>
        {(loc.on || tracking) && (
          <Fab label={tracking ? t("Re-center") : t("Show me on the map")} onPress={() => (tracking ? setFollow(true) : loc.start())}>
            {loc.locating ? <ActivityIndicator size="small" color={th.accent} /> : <PlaceIcon kind="location" size={22} color={th.accent} />}
          </Fab>
        )}
      </View>
      <View style={[styles.liveBadge, { top: insets.top + 12, backgroundColor: th.panel }]} pointerEvents="none">
        <View style={[styles.liveDot, { backgroundColor: state === "open" ? th.ok : th.warn }]} />
        <Txt size={12} weight={800}>{snapshot?.updatedAt ? t(vehicles.length === 1 ? "1 vehicle" : "{n} vehicles", { n: vehicles.length }) : "Berlin Live"}</Txt>
      </View>

      <BottomSheet
        ref={sheet}
        index={0}
        snapPoints={snapPoints}
        onChange={setSheetIndex}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={{ backgroundColor: th.panel }}
        handleIndicatorStyle={{ backgroundColor: th.line, width: 44 }}
        style={styles.sheetShadow}
      >
        <BottomSheetScrollView contentContainerStyle={[styles.sheetBody, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          {view === "settings" && (
            <SettingsPanel state={state} snapshot={snapshot} counts={counts} enabled={enabled} onToggle={toggle}
              showLines={showLines} onShowLines={setShowLines} linesReady={mapLines.length > 0}
              onTour={() => setTourOpen(true)} onClose={() => { setSettingsOpen(false); snap(0); }} />
          )}

          {view === "tracking" && tracking && (
            <TrackPanel
              journey={tracking.journey} legIndex={tracked.legIndex} leg={tracked.leg} data={tracked.data} error={tracked.error}
              follow={follow} onFollow={() => setFollow(true)} auto={tracking.leg === null}
              onPickLeg={k => { setTracking({ ...tracking, leg: k }); setFollow(true); }}
              onStop={() => { setTracking(null); snap(1); }}
              push={{ ...push, support, onEnable: enablePush, onDisable: disablePush }}
            />
          )}

          {view === "picked" && picked && (
            <View style={styles.gap}>
              <View style={styles.rowCenter}>
                <PlaceIcon kind="address" size={20} color={th.muted} />
                <View style={{ flex: 1 }}>
                  <Txt size={17} weight={800} numberOfLines={2}>{picked.name}</Txt>
                  {picked.detail ? <Txt size={13} muted>{picked.detail}</Txt> : null}
                </View>
                <CloseBtn onPress={() => setPicked(null)} />
              </View>
              <View style={styles.row}>
                <Button label={t("Route from here")} onPress={() => pickFrom(picked)} style={{ flex: 1 }} />
                <Button kind="primary" label={t("Route to here")} onPress={() => pickTo(picked)} style={{ flex: 1 }} />
              </View>
            </View>
          )}

          {view === "vehicle" && vehicle && <VehicleCard v={vehicle} onClose={() => setVehicle(null)} />}

          {view === "station" && station && (
            <StationCard station={station} onClose={() => setStation(null)} onFrom={s => pickFrom(stationPlace(s))} onTo={s => pickTo(stationPlace(s))} />
          )}

          {view === "search" && (
            <View style={styles.gap}>
              <PlaceInput
                label={t("To")} placeholder={ready ? t("Where to? Address, place or station") : t("Loading stations…")}
                value={to} onChange={pickTo} searchIndex={searchIndex} disabled={!ready}
                onFocus={() => snap(2)} onOpenChange={setInputOpen}
                trailing={
                  <Pressable onPress={() => { const f = from; setFrom(to); setTo(f); }} disabled={!from && !to} hitSlop={6} style={styles.iconBtn}
                    accessibilityRole="button" accessibilityLabel={t("Swap start and destination")}>
                    <Txt size={18} weight={700} muted>⇅</Txt>
                  </Pressable>
                }
              />
              {!inputOpen && !from && !to && !loc.on && ready && (
                <Button kind="accent" label={t("Stations near me")} onPress={nearMe} icon={<PlaceIcon kind="location" size={18} color={th.accent} />} />
              )}
              <PlaceInput
                label={t("From")} placeholder={ready ? t("Address, place or station") : t("Loading stations…")}
                value={from} onChange={pickFrom} searchIndex={searchIndex} disabled={!ready}
                onFocus={() => snap(2)} onOpenChange={setInputOpen}
                trailing={
                  <Pressable onPress={useHere} disabled={!ready || locating} hitSlop={6} style={styles.iconBtn}
                    accessibilityRole="button" accessibilityLabel={t("Use my location")}>
                    {locating ? <ActivityIndicator size="small" color={th.muted} /> : <PlaceIcon kind="location" size={18} color={th.accent} />}
                  </Pressable>
                }
              />
              {from?.detail && from.kind === "location" ? <Txt size={12} muted>{t("From {place}", { place: from.detail })}</Txt> : null}
              <TimePicker value={timeChoice} onChange={setTimeChoice} />
              {!ready && stationsError ? <Txt size={13} muted>{t(stationsError)}</Txt> : null}
              {locError ? <Txt size={13} color={th.err}>{locError}</Txt> : null}

              {loading && !result && <View style={styles.rowCenter}><ActivityIndicator color={th.muted} /><Txt size={14} muted>{t("Finding connections…")}</Txt></View>}
              {error && (
                <View style={styles.rowCenter}>
                  <Txt size={14} color={th.err} style={{ flex: 1 }}>{error}</Txt>
                  {from && to && fromKey !== toKey && <Button small label={t("Try again")} onPress={refresh} />}
                </View>
              )}
              {result && (!loading || result) && (
                <JourneyList result={result} selected={selected} onSelect={setSelected} onEarlier={earlier} onLater={later}
                  onTrack={startTracking} onRefresh={refresh} refreshing={loading && result !== null} fetchedAt={fetchedAt} />
              )}
              {loc.error ? <Txt size={13} color={th.err}>{loc.error}</Txt> : null}
              {loc.on && !result && !loading && (
                <NearbyList near={near} locating={loc.locating} onSelect={selectStation} onFrom={s => pickFrom(stationPlace(s))} onClose={loc.stop} />
              )}
              {!loc.on && !result && !loading && ready && !error && (
                <Txt size={12} muted>{t("Search any address, place or station. Tap a station for its departures, or long-press the map to route from or to that spot.")}</Txt>
              )}
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      <Tour open={tourOpen} onClose={() => setTourOpen(false)} />
      <LoadingScreen state={state} snapshot={snapshot} stationsReady={stations.length > 0} linesReady={mapLines.length > 0} />
    </View>
  );
}

function Fab({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  const th = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => [styles.fab, { backgroundColor: th.panel, opacity: pressed ? 0.8 : 1 }]}>
      {children}
    </Pressable>
  );
}

function CloseBtn({ onPress }: { onPress: () => void }) {
  const th = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Close")} style={[styles.close, { backgroundColor: th.chipBg }]}>
      <Txt size={18} weight={700} muted>×</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fabs: { position: "absolute", right: 12, gap: 10, zIndex: 5 },
  fab: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  liveBadge: { position: "absolute", left: 12, flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  sheetShadow: { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 12 },
  sheetBody: { paddingHorizontal: 16, paddingTop: 4 },
  gap: { gap: 12 },
  row: { flexDirection: "row", gap: 8 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
