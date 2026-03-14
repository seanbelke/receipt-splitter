import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { UsageSnapshot } from "./types.ts";

const dbPath = join(tmpdir(), `receipt-splitter-${randomUUID()}.db`);
process.env.RECEIPT_SPLITTER_DB_PATH = dbPath;

test("usage history records round-trip and preserve created timestamps on update", async () => {
  const { getUsageHistoryRecord, listUsageHistory, saveUsageHistoryRecord } = await import("./usage-history.ts");

  const initialSnapshot: UsageSnapshot = {
    receipt: {
      restaurantName: "Test Kitchen",
      currency: "USD",
      items: [
        {
          name: "Fries",
          quantity: 1,
          totalPriceCents: 800,
        },
      ],
      taxCents: 64,
      tipCents: 160,
    },
    people: ["Sean"],
    assignments: {
      "item-0-unit-0": ["Sean"],
    },
    taxCents: 64,
    tipCents: 160,
  };

  const created = saveUsageHistoryRecord({ snapshot: initialSnapshot });
  const loaded = getUsageHistoryRecord(created.id);
  assert.ok(loaded);
  assert.equal(loaded.restaurantName, "Test Kitchen");
  assert.equal(loaded.totalCents, 1024);
  assert.deepEqual(loaded.snapshot, initialSnapshot);

  const updatedSnapshot: UsageSnapshot = {
    ...initialSnapshot,
    receipt: {
      ...initialSnapshot.receipt,
      items: [
        ...initialSnapshot.receipt.items,
        {
          name: "Soda",
          quantity: 1,
          totalPriceCents: 300,
        },
      ],
    },
  };

  const updated = saveUsageHistoryRecord({
    id: created.id,
    snapshot: updatedSnapshot,
  });
  assert.equal(updated.createdAt, created.createdAt);
  assert.notEqual(updated.updatedAt, created.updatedAt);
  assert.equal(updated.totalCents, 1324);

  const list = listUsageHistory();
  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, created.id);
  assert.equal(list[0]?.totalCents, 1324);
});
