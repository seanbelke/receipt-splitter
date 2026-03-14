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

  return <SplitPageClient initialUsageId={initialUsageId?.trim() || null} />;
}
