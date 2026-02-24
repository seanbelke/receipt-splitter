import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import { parseChatClaimsRequest } from "./parse-chat-claims.ts";
import type { ResponseClient } from "./parse-chat-claims.ts";

type MockResponse = { output_text?: string | null };

function buildRequest(params?: {
  people?: string[];
  units?: Array<{ id: string; label: string; amountCents: number }>;
  screenshots?: File[];
}): Request {
  const form = new FormData();
  form.set("people", JSON.stringify(params?.people ?? ["Alice", "Bob"]));
  form.set(
    "units",
    JSON.stringify(
      params?.units ?? [
        { id: "0:0", label: "Tacos", amountCents: 1200 },
        { id: "1:0", label: "Fries", amountCents: 500 },
      ],
    ),
  );

  for (const file of params?.screenshots ?? [makeImageFile()]) {
    form.append("screenshots", file);
  }

  return new Request("http://localhost/api/parse-chat-claims", {
    method: "POST",
    body: form,
  });
}

function makeImageFile(): File {
  return new File([new Uint8Array([7, 8, 9])], "chat.png", {
    type: "image/png",
  });
}

function makeClient(response: MockResponse | Error): ResponseClient {
  const create = (async (...args: Parameters<OpenAI["responses"]["create"]>) => {
    void args;
    if (response instanceof Error) {
      throw response;
    }
    return response;
  }) as OpenAI["responses"]["create"];

  return { responses: { create } };
}

test("parseChatClaimsRequest returns 400 when screenshot is missing", async () => {
  const result = await parseChatClaimsRequest(
    buildRequest({ screenshots: [] }),
    () => makeClient({ output_text: "{}" }),
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Upload at least one screenshot.");
});

test("parseChatClaimsRequest returns 400 when screenshot is not an image", async () => {
  const file = new File(["hello"], "chat.txt", { type: "text/plain" });

  const result = await parseChatClaimsRequest(
    buildRequest({ screenshots: [file] }),
    () => makeClient({ output_text: "{}" }),
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.error, "All screenshots must be image files.");
});

test("parseChatClaimsRequest returns 502 when model output_text is empty", async () => {
  const result = await parseChatClaimsRequest(buildRequest(), () =>
    makeClient({ output_text: "" }),
  );

  assert.equal(result.status, 502);
  assert.equal(result.body.error, "Model did not return chat claims output.");
});

test("parseChatClaimsRequest normalizes and filters invalid suggestions", async () => {
  const result = await parseChatClaimsRequest(buildRequest(), () =>
    makeClient({
      output_text: JSON.stringify({
        suggestions: [
          {
            unitId: "0:0",
            people: ["Alice", "Alice", "Unknown"],
            confidence: "high",
            reason: " Alice claimed tacos ",
          },
          {
            unitId: "9:9",
            people: ["Bob"],
            confidence: "low",
            reason: "invalid unit",
          },
        ],
        unmatchedNotes: ["  Could not map wings message "],
      }),
    }),
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.prefill, {
    suggestions: [
      {
        unitId: "0:0",
        people: ["Alice"],
        confidence: "high",
        reason: "Alice claimed tacos",
      },
    ],
    unmatchedNotes: ["Could not map wings message"],
  });
});

test("parseChatClaimsRequest returns 500 on unexpected errors", async () => {
  const result = await parseChatClaimsRequest(buildRequest(), () =>
    makeClient(new Error("OpenAI unavailable")),
  );

  assert.equal(result.status, 500);
  assert.equal(result.body.error, "OpenAI unavailable");
});
