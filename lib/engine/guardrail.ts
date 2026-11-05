import type { InventoryItem } from "./types";
import { burnRate } from "./forecast";

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** AI proposals are clamped, never trusted: at most 40% of source stock, and
    the source must retain more than 14 days of its own supply. */
export function clampTransfer(qty: number, source: InventoryItem, sourceTrendPct: number): number {
  const cap = Math.floor(source.currentStock * 0.4);
  const keep = Math.ceil(burnRate(source, sourceTrendPct) * 14);
  const givable = Math.min(cap, source.currentStock - keep);
  return Math.max(0, Math.min(qty, givable));
}
