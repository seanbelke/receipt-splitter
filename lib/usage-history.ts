import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  UsageHistoryEntry,
  UsageHistoryRecord,
  UsageSnapshot,
} from "./types.ts";

type UsageRow = {
  id: string;
  restaurant_name: string | null;
  total_cents: number;
  created_at: string;
  updated_at: string;
  snapshot_json: string;
};

let database: DatabaseSync | null = null;

function getDatabasePath(): string {
  return process.env.RECEIPT_SPLITTER_DB_PATH ?? join(process.cwd(), "data", "receipt-splitter.db");
}

function ensureDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  const databasePath = getDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });
  const nextDatabase = new DatabaseSync(databasePath);
  nextDatabase.exec(`
    CREATE TABLE IF NOT EXISTS usage_history (
      id TEXT PRIMARY KEY,
      restaurant_name TEXT,
      total_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    )
  `);
  database = nextDatabase;
  return nextDatabase;
}

function sumReceiptTotalCents(snapshot: UsageSnapshot): number {
  const itemsTotal = snapshot.receipt.items.reduce(
    (sum, item) => sum + item.totalPriceCents,
    0,
  );
  return itemsTotal + snapshot.taxCents + snapshot.tipCents;
}

function mapEntry(row: Omit<UsageRow, "snapshot_json">): UsageHistoryEntry {
  return {
    id: row.id,
    restaurantName: row.restaurant_name,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listUsageHistory(): UsageHistoryEntry[] {
  const db = ensureDatabase();
  const rows = db
    .prepare(
      `SELECT id, restaurant_name, total_cents, created_at, updated_at
       FROM usage_history
       ORDER BY updated_at DESC`,
    )
    .all() as Array<Omit<UsageRow, "snapshot_json">>;

  return rows.map(mapEntry);
}

export function getUsageHistoryRecord(id: string): UsageHistoryRecord | null {
  const db = ensureDatabase();
  const row = db
    .prepare(
      `SELECT id, restaurant_name, total_cents, created_at, updated_at, snapshot_json
       FROM usage_history
       WHERE id = ?`,
    )
    .get(id) as UsageRow | undefined;

  if (!row) {
    return null;
  }

  return {
    ...mapEntry(row),
    snapshot: JSON.parse(row.snapshot_json) as UsageSnapshot,
  };
}

export function saveUsageHistoryRecord(input: {
  id?: string | null;
  snapshot: UsageSnapshot;
}): UsageHistoryRecord {
  const db = ensureDatabase();
  const now = new Date().toISOString();
  const id = input.id ?? randomUUID();
  const snapshotJson = JSON.stringify(input.snapshot);
  const restaurantName = input.snapshot.receipt.restaurantName?.trim() || null;
  const totalCents = sumReceiptTotalCents(input.snapshot);
  const existing = db
    .prepare("SELECT created_at FROM usage_history WHERE id = ?")
    .get(id) as { created_at: string } | undefined;
  const createdAt = existing?.created_at ?? now;

  db.prepare(
    `INSERT OR REPLACE INTO usage_history (
      id,
      restaurant_name,
      total_cents,
      created_at,
      updated_at,
      snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, restaurantName, totalCents, createdAt, now, snapshotJson);

  return {
    id,
    restaurantName,
    totalCents,
    createdAt,
    updatedAt: now,
    snapshot: input.snapshot,
  };
}
