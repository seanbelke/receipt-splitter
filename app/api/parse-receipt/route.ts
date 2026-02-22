import { NextResponse } from "next/server";
import { getOpenAIClient } from "../../../lib/openai.ts";
import { parseReceiptRequest } from "../../../lib/parse-receipt.ts";

export async function POST(req: Request) {
  const { status, body } = await parseReceiptRequest(req, getOpenAIClient);
  return NextResponse.json(body, { status });
}
