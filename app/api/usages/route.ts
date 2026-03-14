import { NextRequest, NextResponse } from "next/server";
import { saveUsageHistoryRecord, listUsageHistory } from "@/lib/usage-history";
import { UsageSnapshot } from "@/lib/types";

export function GET() {
  return NextResponse.json({ usages: listUsageHistory() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    id?: string | null;
    snapshot?: UsageSnapshot;
  };

  if (!body.snapshot) {
    return NextResponse.json({ error: "Snapshot is required." }, { status: 400 });
  }

  const usage = saveUsageHistoryRecord({
    id: body.id,
    snapshot: body.snapshot,
  });

  return NextResponse.json({ usage });
}
