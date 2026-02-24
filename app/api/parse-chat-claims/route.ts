import { NextResponse } from "next/server";
import { getOpenAIClient } from "../../../lib/openai.ts";
import { parseChatClaimsRequest } from "../../../lib/parse-chat-claims.ts";

export async function POST(req: Request) {
  const { status, body } = await parseChatClaimsRequest(req, getOpenAIClient);
  return NextResponse.json(body, { status });
}
