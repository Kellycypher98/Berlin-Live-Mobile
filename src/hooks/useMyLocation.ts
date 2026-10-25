import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { t } from "../i18n";
import type { Me } from "../lib/nearby";

/** Your position while "Stations near me" is on (or once, for "use my location"). */
export function useMyLocation() {
  const [me, setMe] = useState<Me | null>(null);
  const [on, setOn] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recenter, setRecenter] = useState(0);
  const sub = useRef<Location.LocationSubscription | null>(null);

  const stop = useCallback(() => {
    sub.current?.remove(); sub.current = null;
    setOn(false); setMe(null); setLocating(false);
  }, []);

  const start = useCallback(async () => {
    if (on && me) { setRecenter(k => k + 1); return; }
    setError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") { setError(t("Location access is off. Allow it in Settings to see stations near you.")); return; }
    setOn(true); setLocating(true);
    try {
      sub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 10000 },
        pos => { setLocating(false); setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy ?? 50 }); },
      );
    } catch {
      setError(t("Couldn't find your location.")); stop();
    }
  }, [on, me, stop]);

  useEffect(() => () => { sub.current?.remove(); }, []);
  return { me, on, locating, error, start, stop, recenter };
}

/** One-off position for "use my location" in the search. */
export async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== "granted") return null;
  const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
  const pos = last ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
