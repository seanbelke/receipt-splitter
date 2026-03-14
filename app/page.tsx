import Link from "next/link";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import { listUsageHistory } from "@/lib/usage-history";
import { moneyFromCents } from "@/lib/split";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const usages = listUsageHistory();

  return (
    <Container maxWidth="lg" sx={{ minHeight: "100vh", py: { xs: 4, sm: 6 } }}>
      <section className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 px-6 py-8 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:px-8">
        <p className="step-kicker">Receipt Splitter</p>
        <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Keep every split, then reopen it without rebuilding the receipt.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Local history is stored on this machine. Start a new split or reopen an older one to review,
              edit, and regenerate the final totals.
            </p>
          </div>
          <Link href="/split" className="primary-btn inline-flex w-full items-center justify-center px-5 py-3 text-sm font-semibold sm:w-auto">
            Start a new split
          </Link>
        </div>
      </section>

      <Paper className="surface-panel overflow-hidden" sx={{ borderRadius: 4 }}>
        <div className="border-b border-slate-200/80 px-6 py-5">
          <h2 className="text-2xl font-semibold text-slate-950">Past receipts</h2>
          <p className="mt-1 text-sm text-slate-600">
            {usages.length === 0
              ? "No saved receipts yet. A receipt is stored automatically once you reach results."
              : `${usages.length} saved receipt${usages.length === 1 ? "" : "s"}.`}
          </p>
        </div>

        {usages.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-600">
            Run through one receipt to populate this table. The local database file is created automatically
            under `data/`.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/90 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-6 py-4">Restaurant</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {usages.map((usage) => (
                  <tr key={usage.id} className="border-t border-slate-200/80">
                    <td className="px-6 py-4">
                      <Link
                        href={`/split?usageId=${usage.id}`}
                        className="group inline-flex flex-col text-left"
                      >
                        <span className="text-sm font-semibold text-slate-900 transition group-hover:text-teal-700">
                          {usage.restaurantName ?? "Untitled receipt"}
                        </span>
                        <span className="mt-1 text-xs text-slate-500">Open saved split</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(usage.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      ${moneyFromCents(usage.totalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Paper>
    </Container>
  );
}
