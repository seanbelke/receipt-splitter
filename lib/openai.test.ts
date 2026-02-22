import assert from "node:assert/strict";
import test from "node:test";

const ORIGINAL_OPENAI_API_KEY = process.env.OPENAI_API_KEY;

test.after(() => {
  if (ORIGINAL_OPENAI_API_KEY === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = ORIGINAL_OPENAI_API_KEY;
  }
});

test("getOpenAIClient throws when OPENAI_API_KEY is missing", async () => {
  delete process.env.OPENAI_API_KEY;
  const { getOpenAIClient } = await import("./openai.ts");
  assert.throws(
    () => getOpenAIClient(),
    /Missing OPENAI_API_KEY environment variable/
  );
});

test("getOpenAIClient returns a singleton client instance", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const { getOpenAIClient } = await import("./openai.ts");
  const first = getOpenAIClient();
  const second = getOpenAIClient();
  assert.equal(first, second);
});
