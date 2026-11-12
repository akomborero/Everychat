import { API_URL } from "../config";

// One connection to the server. When it says something changed, anything on screen that opted in reloads.
// If the connection drops, the screens fall back to their ordinary refresh timers, so nothing breaks.
let source: EventSource | null = null;
let connected = false;
const listeners = new Set<() => void>();

export const isLive = () => connected;
export const onLive = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export function startLive() {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource(`${API_URL}/events`, { withCredentials: true });
  source.onopen = () => { connected = true; };
  source.onerror = () => { connected = false; }; // the browser reconnects by itself
  source.addEventListener("changed", () => listeners.forEach((l) => l()));
}

export function stopLive() {
  source?.close();
  source = null;
  connected = false;
}
