import assert from "node:assert/strict";
import test from "node:test";
import { toCents } from "./currency.ts";

test("toCents returns rounded cents for valid non-negative currency input", () => {
  assert.equal(toCents("0"), 0);
  assert.equal(toCents("12.34"), 1234);
  assert.equal(toCents("12.345"), 1235);
});

test("toCents clamps invalid and negative input to zero", () => {
  assert.equal(toCents(""), 0);
  assert.equal(toCents("abc"), 0);
  assert.equal(toCents("-1"), 0);
});
