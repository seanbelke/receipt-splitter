import type OpenAI from "openai";
import type {
  ChatClaimsPrefill,
  ClaimAssignment,
  ClaimSuggestion,
} from "./types.ts";

const MAX_FOLLOW_UP_ROUNDS = 2;
const MAX_QUESTIONS_PER_ROUND = 3;

const CHAT_CLAIMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions", "unmatchedNotes", "followUpQuestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["unitId", "assignments", "reason"],
        properties: {
          unitId: { type: "string" },
          assignments: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["person", "confidence", "status", "reason"],
              properties: {
                person: { type: ["string", "null"] },
                confidence: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                },
                status: {
                  type: "string",
                  enum: ["suggested", "missing_context"],
                },
                reason: { type: "string" },
              },
            },
          },
          reason: { type: "string" },
        },
      },
    },
    unmatchedNotes: {
      type: "array",
      items: { type: "string" },
    },
    followUpQuestions: {
      type: "array",
      maxItems: MAX_QUESTIONS_PER_ROUND,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "why"],
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          why: { type: "string" },
        },
      },
    },
  },
} as const;

export type ResponseClient = {
  responses: Pick<OpenAI["responses"], "create">;
};

type PrefillUnit = {
  id: string;
  label: string;
  amountCents: number;
};

type FollowUpAnswer = {
  id: string;
  question: string;
  answer: string;
};

type ModelChatClaimsResponse = Pick<
  ChatClaimsPrefill,
  "suggestions" | "unmatchedNotes" | "followUpQuestions"
>;

function parseJsonField<T>(value: FormDataEntryValue | null, fieldName: string): T {
  if (!value || typeof value !== "string") {
    throw new Error(`Missing ${fieldName}.`);
  }

  return JSON.parse(value) as T;
}

function normalizeAssignments(params: {
  assignments: ClaimAssignment[];
  validPeople: Set<string>;
}): ClaimAssignment[] {
  const { assignments, validPeople } = params;
  const seen = new Set<string>();
  const normalized: ClaimAssignment[] = [];

  assignments.forEach((assignment) => {
    const reason = assignment.reason.trim();
    if (reason.length === 0) {
      return;
    }

    const person =
      typeof assignment.person === "string" ? assignment.person.trim() : null;
    if (assignment.status === "suggested") {
      if (!person || !validPeople.has(person)) {
        return;
      }
    } else if (person && !validPeople.has(person)) {
      return;
    }

    const dedupeKey = `${assignment.status}|${person ?? "unknown"}|${reason.toLowerCase()}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);
    normalized.push({
      ...assignment,
      person,
      reason,
    });
  });

  return normalized;
}

function normalizeSuggestions(params: {
  suggestions: ClaimSuggestion[];
  validUnitIds: Set<string>;
  validPeople: Set<string>;
}): ClaimSuggestion[] {
  const { suggestions, validUnitIds, validPeople } = params;

  return suggestions
    .filter((suggestion) => validUnitIds.has(suggestion.unitId))
    .map((suggestion) => {
      const assignments = normalizeAssignments({
        assignments: suggestion.assignments,
        validPeople,
      });

      return {
        ...suggestion,
        assignments,
        reason: suggestion.reason.trim(),
      };
    })
    .filter((suggestion) => suggestion.assignments.length > 0 && suggestion.reason.length > 0);
}

export async function parseChatClaimsRequest(
  req: Request,
  getClient: () => ResponseClient,
): Promise<{ status: number; body: { error?: string; prefill?: ChatClaimsPrefill } }> {
  try {
    const formData = await req.formData();

    const people = parseJsonField<string[]>(formData.get("people"), "people");
    const units = parseJsonField<PrefillUnit[]>(formData.get("units"), "units");
    const extraContextRaw = formData.get("extraContext");
    const extraContext =
      typeof extraContextRaw === "string" ? extraContextRaw.trim() : "";
    const rawRound = Number.parseInt(String(formData.get("round") ?? "1"), 10);
    const round = Number.isFinite(rawRound) ? Math.max(1, rawRound) : 1;
    const followUpAnswers = parseJsonField<FollowUpAnswer[]>(
      formData.get("followUpAnswers") ?? "[]",
      "followUpAnswers",
    );
    const screenshots = formData
      .getAll("screenshots")
      .filter((entry): entry is File => entry instanceof File);

    if (people.length === 0) {
      return {
        status: 400,
        body: { error: "Add at least one person before parsing chat claims." },
      };
    }

    if (units.length === 0) {
      return {
        status: 400,
        body: { error: "Receipt units are missing." },
      };
    }

    if (screenshots.length === 0) {
      return {
        status: 400,
        body: { error: "Upload at least one screenshot." },
      };
    }

    for (const screenshot of screenshots) {
      if (!screenshot.type.startsWith("image/")) {
        return {
          status: 400,
          body: { error: "All screenshots must be image files." },
        };
      }
    }

    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const client = getClient();
    const imageContent = await Promise.all(
      screenshots.map(async (screenshot) => {
        const bytes = Buffer.from(await screenshot.arrayBuffer());
        const dataUrl = `data:${screenshot.type};base64,${bytes.toString("base64")}`;

        return {
          type: "input_image" as const,
          image_url: dataUrl,
          detail: "auto" as const,
        };
      }),
    );

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You extract restaurant item claims from group-chat screenshots.",
                "Return only JSON matching the schema.",
                "Focus on assignment quality over coverage: include only explicit or strongly implied claims.",
                "Never invent people or items that are not in the provided lists.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Use only the provided people and units.",
                "Interpret common phrasing for claims and sharing:",
                "- 'I got X' => assign X to the message sender.",
                "- 'Person got X' => assign X to that named person.",
                "- 'split/shared X with Person' or 'Person and I got X' => assign X to all named participants, including the sender when implied.",
                "- Include sides/drinks/desserts as separate claims when clearly stated.",
                "Resolve light wording variation and aliases (e.g., abbreviations, singular/plural, reordered words, nearby menu wording).",
                "If a claimed item appears missing from receipt units, do not force-match it; add a concise unmatchedNotes entry.",
                "Ignore operational/payment chatter that is not an item claim (for example reminders about tip/gratuity).",
                "Confidence rubric:",
                "- high: explicit person-to-item claim with clear unit match.",
                "- medium: likely match with minor wording ambiguity.",
                "- low: only weakly implied; include sparingly.",
                "Reason field rules:",
                "- brief, factual mapping summary.",
                "- no private/sensitive commentary.",
                "If uncertain, skip that unit and add a brief note in unmatchedNotes.",
                "Return assignment confidence per person-unit assignment, not per unit row.",
                "Use assignment status 'missing_context' when you cannot assign with confidence due to missing identity/context.",
                `You may ask up to ${MAX_QUESTIONS_PER_ROUND} follow-up questions in followUpQuestions.`,
                "Each question must unlock multiple unresolved assignments when possible.",
                "Ask follow-up questions only when answers could materially improve assignment quality.",
                "If no high-value follow-up questions remain, return an empty followUpQuestions list.",
                `Current clarification round: ${round} of ${MAX_FOLLOW_UP_ROUNDS}.`,
                round >= MAX_FOLLOW_UP_ROUNDS
                  ? "Do not ask follow-up questions in this round. Leave followUpQuestions empty."
                  : "",
                extraContext
                  ? `Additional user context (treat as authoritative when mapping names/aliases): ${extraContext}`
                  : "",
                followUpAnswers.length > 0
                  ? `Resolved follow-up answers (treat as authoritative): ${JSON.stringify(followUpAnswers)}`
                  : "",
                `People: ${JSON.stringify(people)}`,
                `Units: ${JSON.stringify(units)}`,
              ]
                .filter((line) => line.length > 0)
                .join("\n"),
            },
            ...imageContent,
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "chat_claims_prefill",
          schema: CHAT_CLAIMS_SCHEMA,
          strict: true,
        },
      },
    });

    if (!response.output_text) {
      return {
        status: 502,
        body: { error: "Model did not return chat claims output." },
      };
    }

    const parsed = JSON.parse(response.output_text) as ModelChatClaimsResponse;
    const validUnitIds = new Set(units.map((unit) => unit.id));
    const validPeople = new Set(people);
    const followUpQuestions =
      round >= MAX_FOLLOW_UP_ROUNDS
        ? []
        : parsed.followUpQuestions
            .map((entry) => ({
              id: entry.id.trim(),
              question: entry.question.trim(),
              why: entry.why.trim(),
            }))
            .filter(
              (entry) =>
                entry.id.length > 0 &&
                entry.question.length > 0 &&
                entry.why.length > 0,
            )
            .slice(0, MAX_QUESTIONS_PER_ROUND);
    const isComplete = followUpQuestions.length === 0 || round >= MAX_FOLLOW_UP_ROUNDS;
    const stopReason =
      round >= MAX_FOLLOW_UP_ROUNDS
        ? "Reached the follow-up question round limit."
        : followUpQuestions.length === 0
          ? "No additional clarifications needed."
          : "Waiting for follow-up answers.";

    return {
      status: 200,
      body: {
        prefill: {
          suggestions: normalizeSuggestions({
            suggestions: parsed.suggestions,
            validUnitIds,
            validPeople,
          }),
          unmatchedNotes: parsed.unmatchedNotes
            .map((note) => note.trim())
            .filter((note) => note.length > 0),
          followUpQuestions,
          isComplete,
          stopReason,
          round,
          maxRounds: MAX_FOLLOW_UP_ROUNDS,
        },
      },
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error while parsing chat claims.",
      },
    };
  }
}
