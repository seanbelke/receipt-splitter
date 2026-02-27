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
  extraContext?: string;
  round?: number;
  followUpAnswers?: Array<{ id: string; question: string; answer: string }>;
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
  if (params?.extraContext) {
    form.set("extraContext", params.extraContext);
  }
  if (params?.round) {
    form.set("round", String(params.round));
  }
  if (params?.followUpAnswers) {
    form.set("followUpAnswers", JSON.stringify(params.followUpAnswers));
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

test("parseChatClaimsRequest includes optional user context in model prompt", async () => {
  let capturedArgs: unknown = null;
  const create = (async (...args: Parameters<OpenAI["responses"]["create"]>) => {
    capturedArgs = args[0];
    return {
      output_text: JSON.stringify({
        suggestions: [],
        unmatchedNotes: [],
        followUpQuestions: [],
      }),
    };
  }) as OpenAI["responses"]["create"];

  const result = await parseChatClaimsRequest(
    buildRequest({ extraContext: "I am Alice. Socks is Bob." }),
    () => ({ responses: { create } }),
  );

  assert.equal(result.status, 200);
  const input = JSON.stringify(
    (capturedArgs as { input?: unknown } | null)?.input ?? "",
  );
  assert.match(
    input,
    /Additional user context \(treat as authoritative when mapping names\/aliases\): I am Alice\. Socks is Bob\./,
  );
});

test("parseChatClaimsRequest returns 400 when screenshot is missing", async () => {
  const result = await parseChatClaimsRequest(
    buildRequest({ screenshots: [] }),
    () =>
      makeClient({
        output_text: JSON.stringify({
          suggestions: [],
          unmatchedNotes: [],
          followUpQuestions: [],
        }),
      }),
  );

  assert.equal(result.status, 400);
  assert.equal(result.body.error, "Upload at least one screenshot.");
});

test("parseChatClaimsRequest returns 400 when screenshot is not an image", async () => {
  const file = new File(["hello"], "chat.txt", { type: "text/plain" });

  const result = await parseChatClaimsRequest(
    buildRequest({ screenshots: [file] }),
    () =>
      makeClient({
        output_text: JSON.stringify({
          suggestions: [],
          unmatchedNotes: [],
          followUpQuestions: [],
        }),
      }),
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
            assignments: [
              {
                person: "Alice",
                confidence: "high",
                status: "suggested",
                reason: " Alice claimed tacos ",
              },
              {
                person: "Alice",
                confidence: "high",
                status: "suggested",
                reason: " Alice claimed tacos ",
              },
              {
                person: "Unknown",
                confidence: "low",
                status: "suggested",
                reason: "Unknown person",
              },
            ],
            reason: " Alice claimed tacos ",
          },
          {
            unitId: "9:9",
            assignments: [
              {
                person: "Bob",
                confidence: "low",
                status: "suggested",
                reason: "invalid unit",
              },
            ],
            reason: "invalid unit",
          },
        ],
        unmatchedNotes: ["  Could not map wings message "],
        followUpQuestions: [
          {
            id: " who-is-yall ",
            question: "Who is included when someone says yall? ",
            why: " Needed to map shared items ",
          },
        ],
      }),
    }),
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.prefill, {
    suggestions: [
      {
        unitId: "0:0",
        assignments: [
          {
            person: "Alice",
            confidence: "high",
            status: "suggested",
            reason: "Alice claimed tacos",
          },
        ],
        reason: "Alice claimed tacos",
      },
    ],
    unmatchedNotes: ["Could not map wings message"],
    followUpQuestions: [
      {
        id: "who-is-yall",
        question: "Who is included when someone says yall?",
        why: "Needed to map shared items",
      },
    ],
    isComplete: false,
    stopReason: "Waiting for follow-up answers.",
    round: 1,
    maxRounds: 2,
  });
});

test("parseChatClaimsRequest suppresses follow-up questions at max round", async () => {
  const result = await parseChatClaimsRequest(
    buildRequest({
      round: 2,
      followUpAnswers: [
        {
          id: "who-is-yall",
          question: "Who is included when someone says yall?",
          answer: "Alice and Bob",
        },
      ],
    }),
    () =>
      makeClient({
        output_text: JSON.stringify({
          suggestions: [],
          unmatchedNotes: [],
          followUpQuestions: [
            {
              id: "extra",
              question: "Another question",
              why: "Should be suppressed",
            },
          ],
        }),
      }),
  );

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.prefill?.followUpQuestions, []);
  assert.equal(result.body.prefill?.isComplete, true);
  assert.equal(
    result.body.prefill?.stopReason,
    "Reached the follow-up question round limit.",
  );
});

test("parseChatClaimsRequest returns 500 on unexpected errors", async () => {
  const result = await parseChatClaimsRequest(buildRequest(), () =>
    makeClient(new Error("OpenAI unavailable")),
  );

  assert.equal(result.status, 500);
  assert.equal(result.body.error, "OpenAI unavailable");
});
