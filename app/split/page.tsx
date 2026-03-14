import { getUsageHistoryRecord } from "@/lib/usage-history";
import SplitPageClient from "./SplitPageClient";

export default async function SplitPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const rawUsageId = searchParams.usageId;
  const initialUsageId =
    typeof rawUsageId === "string"
      ? rawUsageId
      : Array.isArray(rawUsageId)
        ? rawUsageId[0] ?? null
        : null;
  const trimmedUsageId = initialUsageId?.trim() || null;
  const initialUsageRecord = trimmedUsageId
    ? getUsageHistoryRecord(trimmedUsageId)
    : null;
  const initialLoadError =
    trimmedUsageId && !initialUsageRecord ? "Saved receipt not found." : null;

  return (
    <SplitPageClient
      initialUsageId={trimmedUsageId}
      initialUsageSnapshot={initialUsageRecord?.snapshot ?? null}
      initialLoadError={initialLoadError}
    />
  );
}
