import assert from "node:assert/strict";
import test from "node:test";
import { calculateTotals, expandItemsToUnits, moneyFromCents } from "./split.ts";
import type { ParsedReceipt } from "./types.ts";

test("moneyFromCents formats cents as a two-decimal currency string", () => {
  assert.equal(moneyFromCents(0), "0.00");
  assert.equal(moneyFromCents(105), "1.05");
  assert.equal(moneyFromCents(1999), "19.99");
});

test("expandItemsToUnits expands quantity and distributes remainder cents", () => {
  const receipt: ParsedReceipt = {
    currency: "USD",
    items: [{ name: "Wings", quantity: 3, totalPriceCents: 1000 }],
    taxCents: 0,
    tipCents: 0,
  };

  const units = expandItemsToUnits(receipt);
  assert.equal(units.length, 3);
  assert.deepEqual(units.map((unit) => unit.amountCents), [334, 333, 333]);
  assert.deepEqual(units.map((unit) => unit.label), [
    "Wings (1/3)",
    "Wings (2/3)",
    "Wings (3/3)",
  ]);
});

test("expandItemsToUnits falls back to quantity 1 when quantity is invalid", () => {
  const receipt: ParsedReceipt = {
    currency: "USD",
    items: [{ name: "Soda", quantity: 0, totalPriceCents: 250 }],
    taxCents: 0,
    tipCents: 0,
  };

  const units = expandItemsToUnits(receipt);
  assert.equal(units.length, 1);
  assert.equal(units[0].label, "Soda");
  assert.equal(units[0].amountCents, 250);
});

test("calculateTotals splits shared units deterministically and sorts by person name", () => {
  const totals = calculateTotals({
    people: ["Bob", "Alice"],
    units: [{ id: "u1", label: "Nachos", amountCents: 101, sourceItemName: "Nachos", sourceRowIndex: 0, unitIndex: 0 }],
    assignments: { u1: ["Bob", "Alice"] },
    taxCents: 1,
    tipCents: 1,
  });

  assert.deepEqual(totals, [
    {
      name: "Alice",
      subtotalCents: 51,
      taxShareCents: 1,
      tipShareCents: 1,
      totalCents: 53,
    },
    {
      name: "Bob",
      subtotalCents: 50,
      taxShareCents: 0,
      tipShareCents: 0,
      totalCents: 50,
    },
  ]);
});

test("calculateTotals ignores invalid assignees, deduplicates names, and ignores unassigned units", () => {
  const totals = calculateTotals({
    people: ["Alice", "Bob"],
    units: [
      { id: "u1", label: "Burger", amountCents: 1200, sourceItemName: "Burger", sourceRowIndex: 0, unitIndex: 0 },
      { id: "u2", label: "Fries", amountCents: 500, sourceItemName: "Fries", sourceRowIndex: 1, unitIndex: 0 },
    ],
    assignments: {
      u1: ["Alice", "Mallory", "Alice"],
      u2: [],
    },
    taxCents: 120,
    tipCents: 0,
  });

  assert.deepEqual(totals, [
    {
      name: "Alice",
      subtotalCents: 1200,
      taxShareCents: 120,
      tipShareCents: 0,
      totalCents: 1320,
    },
    {
      name: "Bob",
      subtotalCents: 0,
      taxShareCents: 0,
      tipShareCents: 0,
      totalCents: 0,
    },
  ]);
});

test("calculateTotals falls back to equal split for tax/tip when all subtotals are zero", () => {
  const totals = calculateTotals({
    people: ["Bob", "Alice"],
    units: [{ id: "u1", label: "Tea", amountCents: 300, sourceItemName: "Tea", sourceRowIndex: 0, unitIndex: 0 }],
    assignments: {},
    taxCents: 3,
    tipCents: 1,
  });

  assert.deepEqual(totals, [
    {
      name: "Alice",
      subtotalCents: 0,
      taxShareCents: 2,
      tipShareCents: 1,
      totalCents: 3,
    },
    {
      name: "Bob",
      subtotalCents: 0,
      taxShareCents: 1,
      tipShareCents: 0,
      totalCents: 1,
    },
  ]);
});
