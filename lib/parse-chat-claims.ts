import type OpenAI from "openai";
import type { ChatClaimsPrefill, ClaimSuggestion } from "./types.ts";

const CHAT_CLAIMS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions", "unmatchedNotes"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["unitId", "people", "confidence", "reason"],
        properties: {
          unitId: { type: "string" },
          people: {
            type: "array",
            items: { type: "string" },
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          reason: { type: "string" },
        },
      },
    },
    unmatchedNotes: {
      type: "array",
      items: { type: "string" },
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

function parseJsonField<T>(value: FormDataEntryValue | null, fieldName: string): T {
  if (!value || typeof value !== "string") {
    throw new Error(`Missing ${fieldName}.`);
  }

  return JSON.parse(value) as T;
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
      const uniquePeople = Array.from(
        new Set(suggestion.people.filter((person) => validPeople.has(person))),
      );

      return {
        ...suggestion,
        people: uniquePeople,
        reason: suggestion.reason.trim(),
      };
    })
    .filter((suggestion) => suggestion.people.length > 0 && suggestion.reason.length > 0);
}

export async function parseChatClaimsRequest(
  req: Request,
  getClient: () => ResponseClient,
): Promise<{ status: number; body: { error?: string; prefill?: ChatClaimsPrefill } }> {
  try {
    const formData = await req.formData();

    const people = parseJsonField<string[]>(formData.get("people"), "people");
    const units = parseJsonField<PrefillUnit[]>(formData.get("units"), "units");
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
              text: "Extract only explicit or strongly implied item claims from group-chat screenshots for splitting a restaurant receipt. Return only JSON matching the schema.",
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
                "If a message says someone shared an item, include every named person for that unit.",
                "If uncertain, skip that unit and add a brief note in unmatchedNotes.",
                `People: ${JSON.stringify(people)}`,
                `Units: ${JSON.stringify(units)}`,
              ].join("\n"),
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

    const parsed = JSON.parse(response.output_text) as ChatClaimsPrefill;
    const validUnitIds = new Set(units.map((unit) => unit.id));
    const validPeople = new Set(people);

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
