// WhatsApp reports each message as sent, then delivered, then read, or failed.
// Events can arrive out of order, so a status may only move forward, and failure is final.

const RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

/** The status to store, or null when the incoming event should be ignored. */
export function nextDeliveryStatus(current: string | null | undefined, incoming: string): string | null {
  if (current === "failed") return null;
  if (incoming === "failed") return current === "delivered" || current === "read" ? null : "failed";
  if (!Object.prototype.hasOwnProperty.call(RANK, incoming)) return null;
  const have = current && Object.prototype.hasOwnProperty.call(RANK, current) ? RANK[current] : 0;
  return RANK[incoming] > have ? incoming : null;
}
