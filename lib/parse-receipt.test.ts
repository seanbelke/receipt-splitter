import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import { parseReceiptRequest } from "./parse-receipt.ts";
import type { ResponseClient } from "./parse-receipt.ts";

type MockResponse = { output_text?: string | null };

function buildRequest(file?: File): Request {
  const form = new FormData();
  if (file) {
    form.set("receipt", file);
  }

  return new Request("http://localhost/api/parse-receipt", {
    method: "POST",
    body: form,
  });
}

function makeImageFile(): File {
  return new File([new Uint8Array([1, 2, 3])], "receipt.png", {
    type: "image/png",
  });
}

function makeClient(response: MockResponse | Error): ResponseClient {
  const create = (async (_params: Parameters<OpenAI["responses"]["create"]>[0]) => {
    if (response instanceof Error) {
      throw response;
    }
    return response;
  }) as OpenAI["responses"]["create"];

  return { responses: { create } };
}

test("parseReceiptRequest returns 400 when receipt file is missing", async () => {
  const result = await parseReceiptRequest(buildRequest(), () =>
    makeClient({ output_text: "{}" })
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Missing receipt image file.");
});

test("parseReceiptRequest returns 400 when file is not an image", async () => {
  const textFile = new File(["a,b"], "receipt.csv", { type: "text/csv" });
  const result = await parseReceiptRequest(buildRequest(textFile), () =>
    makeClient({ output_text: "{}" })
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.error, "File must be an image.");
});

test("parseReceiptRequest returns 502 when model does not return output_text", async () => {
  const result = await parseReceiptRequest(buildRequest(makeImageFile()), () =>
    makeClient({ output_text: "" })
  );

  assert.equal(result.status, 502);
  assert.equal(result.body.error, "Model did not return parse output.");
});

test("parseReceiptRequest returns 422 when normalized receipt has no line items", async () => {
  const result = await parseReceiptRequest(buildRequest(makeImageFile()), () =>
    makeClient({
      output_text: JSON.stringify({
        restaurantName: "Cafe",
        currency: "usd",
        taxCents: 100,
        tipCents: 100,
        items: [{ name: "Water", quantity: 1, totalPriceCents: 0 }],
      }),
    })
  );

  assert.equal(result.status, 422);
  assert.equal(result.body.error, "No line items were detected. Try a clearer photo.");
});

test("parseReceiptRequest returns 500 on unexpected errors", async () => {
  const result = await parseReceiptRequest(buildRequest(makeImageFile()), () =>
    makeClient(new Error("OpenAI unavailable"))
  );

  assert.equal(result.status, 500);
  assert.equal(result.body.error, "OpenAI unavailable");
});

test("parseReceiptRequest returns normalized receipt on success", async () => {
  const result = await parseReceiptRequest(buildRequest(makeImageFile()), () =>
    makeClient({
      output_text: JSON.stringify({
        restaurantName: "  Diner  ",
        currency: " usd ",
        taxCents: 105.9,
        tipCents: 200.2,
        items: [
          { name: " Burger ", quantity: 2.8, totalPriceCents: 1599.9 },
          { name: " ", quantity: 1, totalPriceCents: 400 },
        ],
      }),
    })
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    receipt: {
      restaurantName: "Diner",
      currency: "USD",
      taxCents: 105,
      tipCents: 200,
      items: [{ name: "Burger", quantity: 2, totalPriceCents: 1599 }],
    },
  });
});
