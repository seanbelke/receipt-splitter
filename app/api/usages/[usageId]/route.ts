import { NextResponse } from "next/server";
import { getUsageHistoryRecord } from "@/lib/usage-history";

export function GET(
  _request: Request,
  context: { params: Promise<{ usageId: string }> },
) {
  return context.params.then(({ usageId }) => {
    const usage = getUsageHistoryRecord(usageId);
    if (!usage) {
      return NextResponse.json({ error: "Usage not found." }, { status: 404 });
    }

    return NextResponse.json({ usage });
  });
}
