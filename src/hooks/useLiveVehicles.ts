import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { LIVE_URL } from "../config";
import type { ConnectionState, Snapshot } from "../lib/types";

/**
 * Subscribes to the server's live vehicle feed and reconnects with backoff.
 * Disconnects while the app is in the background (no point using data and battery then).
 */
export function useLiveVehicles() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [state, setState] = useState<ConnectionState>("connecting");

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    let active = AppState.currentState === "active";

    const connect = () => {
      if (!active) return;
      ws = new WebSocket(LIVE_URL);
      setState("connecting");
      ws.onopen = () => { setState("open"); delay = 1000; };
      ws.onmessage = e => {
        try {
          const msg = JSON.parse(String(e.data)) as Snapshot;
          if (msg.type === "snapshot") setSnapshot(msg);
        } catch { /* ignore a broken message */ }
      };
      ws.onclose = () => {
        ws = null;
        if (!active) return;
        setState("closed");
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30000);
      };
      ws.onerror = () => { /* onclose follows */ };
    };
    connect();

    const sub = AppState.addEventListener("change", s => {
      const nowActive = s === "active";
      if (nowActive === active) return;
      active = nowActive;
      if (active) { delay = 1000; connect(); }
      else { clearTimeout(retry); ws?.close(); ws = null; }
    });
    return () => { active = false; sub.remove(); clearTimeout(retry); ws?.close(); };
  }, []);

  return { snapshot, state };
}
