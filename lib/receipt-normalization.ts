import type { ParsedReceipt } from "./types.ts";

export function normalizeReceipt(data: ParsedReceipt): ParsedReceipt {
  return {
    restaurantName: data.restaurantName?.trim() || undefined,
    currency: (data.currency || "USD").trim().toUpperCase(),
    taxCents: Math.max(0, Math.floor(data.taxCents || 0)),
    tipCents: Math.max(0, Math.floor(data.tipCents || 0)),
    items: (data.items || [])
      .map((item) => ({
        name: item.name.trim(),
        quantity: Math.max(1, Math.floor(item.quantity || 1)),
        totalPriceCents: Math.max(0, Math.floor(item.totalPriceCents || 0)),
      }))
      .filter((item) => item.name.length > 0 && item.totalPriceCents > 0),
  };
}
