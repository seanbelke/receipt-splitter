import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReceipt } from "./receipt-normalization.ts";
import type { ParsedReceipt } from "./types.ts";

test("normalizeReceipt trims, clamps, and filters item rows", () => {
  const input: ParsedReceipt = {
    restaurantName: "  Tacos Place  ",
    currency: " usd ",
    taxCents: 19.9,
    tipCents: -7,
    items: [
      { name: " Taco ", quantity: 2.8, totalPriceCents: 799.9 },
      { name: "   ", quantity: 2, totalPriceCents: 500 },
      { name: "Water", quantity: 1, totalPriceCents: 0 },
      { name: "Salsa", quantity: 0, totalPriceCents: 125 },
    ],
  };

  assert.deepEqual(normalizeReceipt(input), {
    restaurantName: "Tacos Place",
    currency: "USD",
    taxCents: 19,
    tipCents: 0,
    items: [
      { name: "Taco", quantity: 2, totalPriceCents: 799 },
      { name: "Salsa", quantity: 1, totalPriceCents: 125 },
    ],
  });
});

test("normalizeReceipt defaults missing values", () => {
  const input = {
    restaurantName: null,
    currency: "",
    taxCents: 0,
    tipCents: 0,
    items: [],
  } as ParsedReceipt;

  assert.deepEqual(normalizeReceipt(input), {
    restaurantName: undefined,
    currency: "USD",
    taxCents: 0,
    tipCents: 0,
    items: [],
  });
});
