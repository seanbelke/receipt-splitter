import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { ParsedReceipt } from "@/lib/types";

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["currency", "items", "taxCents", "tipCents"],
  properties: {
    restaurantName: { type: "string" },
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
          totalPriceCents: { type: "integer", minimum: 0 }
        }
      }
    }
  }
} as const;

function normalizeReceipt(data: ParsedReceipt): ParsedReceipt {
  return {
    restaurantName: data.restaurantName?.trim() || undefined,
    currency: (data.currency || "USD").trim().toUpperCase(),
    taxCents: Math.max(0, Math.floor(data.taxCents || 0)),
    tipCents: Math.max(0, Math.floor(data.tipCents || 0)),
    items: (data.items || [])
      .map((item) => ({
        name: item.name.trim(),
        quantity: Math.max(1, Math.floor(item.quantity || 1)),
        totalPriceCents: Math.max(0, Math.floor(item.totalPriceCents || 0))
      }))
      .filter((item) => item.name.length > 0 && item.totalPriceCents > 0)
  };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("receipt");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing receipt image file." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image." }, { status: 400 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-5-mini";
    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;

    const client = getOpenAIClient();
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "Extract restaurant receipt details for bill splitting. Return only valid JSON matching the schema. Exclude discounts, payments, and non-food fees from items. Include tax and tip if visible; otherwise set to 0."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Parse this receipt image. For each menu item, include name, quantity, and total item price in cents (for the row)."
            },
            {
              type: "input_image",
              image_url: dataUrl
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "receipt_parse",
          schema: RECEIPT_SCHEMA,
          strict: true
        }
      }
    });

    if (!response.output_text) {
      return NextResponse.json({ error: "Model did not return parse output." }, { status: 502 });
    }

    const parsed = JSON.parse(response.output_text) as ParsedReceipt;
    const normalized = normalizeReceipt(parsed);

    if (normalized.items.length === 0) {
      return NextResponse.json({ error: "No line items were detected. Try a clearer photo." }, { status: 422 });
    }

    return NextResponse.json({ receipt: normalized });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
