import { normalizeReceipt } from "./receipt-normalization.ts";
import type { ParsedReceipt } from "./types.ts";

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["restaurantName", "currency", "items", "taxCents", "tipCents"],
  properties: {
    restaurantName: { type: ["string", "null"] },
    currency: { type: "string" },
    taxCents: { type: "integer", minimum: 0 },
    tipCents: { type: "integer", minimum: 0 },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "totalPriceCents"],
        properties: {
          name: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          totalPriceCents: { type: "integer", minimum: 0 },
        },
      },
    },
  },
} as const;

export type ResponseClient = {
  responses: {
    create: (params: object) => Promise<{ output_text?: string | null }>;
  };
};

export async function parseReceiptRequest(
  req: Request,
  getClient: () => ResponseClient
): Promise<{ status: number; body: { error?: string; receipt?: ParsedReceipt } }> {
  try {
    const formData = await req.formData();
    const file = formData.get("receipt");

    if (!file || !(file instanceof File)) {
      return {
        status: 400,
        body: { error: "Missing receipt image file." },
      };
    }

    if (!file.type.startsWith("image/")) {
      return {
        status: 400,
        body: { error: "File must be an image." },
      };
    }

    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

    const client = getClient();
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "Extract restaurant receipt details for bill splitting. Return only valid JSON matching the schema. Exclude discounts, payments, and non-food fees from items. Include tax and tip if visible; otherwise set to 0.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Parse this receipt image. For each menu item, include name, quantity, and total item price in cents (for the row).",
            },
            {
              type: "input_image",
              image_url: dataUrl,
              detail: "auto",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "receipt_parse",
          schema: RECEIPT_SCHEMA,
          strict: true,
        },
      },
    });

    if (!response.output_text) {
      return {
        status: 502,
        body: { error: "Model did not return parse output." },
      };
    }

    const parsed = JSON.parse(response.output_text) as ParsedReceipt;
    const normalized = normalizeReceipt(parsed);

    if (normalized.items.length === 0) {
      return {
        status: 422,
        body: { error: "No line items were detected. Try a clearer photo." },
      };
    }

    return {
      status: 200,
      body: { receipt: normalized },
    };
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : "Unknown error" },
    };
  }
}
