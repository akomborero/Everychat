// Live updates over Server-Sent Events. The server tells a signed-in browser "something changed" and the
// browser reloads what it is showing. Events carry no data about customers or messages, only the fact of a change.
//
// This lives in one server's memory. With several servers an event only reaches browsers connected to the same one,
// which is why the app also keeps a slow background refresh as a safety net.

export interface Writer { write(chunk: string): unknown }

export const MAX_CONNECTIONS_PER_BUSINESS = 50;
const DEBOUNCE_MS = 150;

const clients = new Map<string, Set<Writer>>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();

export const formatEvent = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

/** Registers a connection. Returns a function that removes it, or null if the business has too many open connections. */
export function subscribe(businessId: string, client: Writer): (() => void) | null {
  const set = clients.get(businessId) ?? new Set<Writer>();
  if (set.size >= MAX_CONNECTIONS_PER_BUSINESS) return null;
  set.add(client);
  clients.set(businessId, set);
  return () => {
    set.delete(client);
    if (set.size === 0 && clients.get(businessId) === set) clients.delete(businessId);
  };
}

/** Announces a change. A burst of changes becomes one event, so a busy conversation doesn't flood browsers. */
export function publishChange(businessId: string) {
  if (!clients.has(businessId) || pending.has(businessId)) return;
  pending.set(businessId, setTimeout(() => {
    pending.delete(businessId);
    for (const c of clients.get(businessId) ?? []) {
      try { c.write(formatEvent("changed", {})); } catch { /* a dead connection removes itself when it closes */ }
    }
  }, DEBOUNCE_MS));
}

export const connectionCount = (businessId: string) => clients.get(businessId)?.size ?? 0;
