import Button from "@mui/material/Button";
import { SplitBreakdown } from "@/lib/types";
import { moneyFromCents } from "@/lib/split";
import { ResultIcon } from "./icons";

type ResultsStepProps = {
  overallSubtotal: number;
  taxCents: number;
  tipCents: number;
  totals: SplitBreakdown["personTotals"];
  openHtmlReportPreview: () => void;
};

export function ResultsStep({ overallSubtotal, taxCents, tipCents, totals, openHtmlReportPreview }: ResultsStepProps) {
  const overallTotal = overallSubtotal + taxCents + tipCents;

  return (
    <div className="space-y-7">
      <div>
        <p className="step-kicker flex items-center gap-2">
          <span className="icon-badge">
            <ResultIcon />
          </span>
          Step 4
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Final split.</h2>
      </div>

      <div className="soft-card rounded-2xl p-5">
        <p className="mono text-sm text-slate-700">Receipt total: ${moneyFromCents(overallTotal)}</p>
        <p className="mono text-sm text-slate-700">Subtotal: ${moneyFromCents(overallSubtotal)}</p>
        <p className="mono text-sm text-slate-700">Tax: ${moneyFromCents(taxCents)}</p>
        <p className="mono text-sm text-slate-700">Tip: ${moneyFromCents(tipCents)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={openHtmlReportPreview} className="secondary-btn px-4 py-2">
            View HTML report
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Person</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Food subtotal</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Tax share</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Tip share</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700">Total owed</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((person) => (
              <tr key={person.name} className="border-b border-slate-200">
                <td className="px-3 py-2 text-slate-800">{person.name}</td>
                <td className="mono px-3 py-2 text-right text-slate-700">${moneyFromCents(person.subtotalCents)}</td>
                <td className="mono px-3 py-2 text-right text-slate-700">${moneyFromCents(person.taxShareCents)}</td>
                <td className="mono px-3 py-2 text-right text-slate-700">${moneyFromCents(person.tipShareCents)}</td>
                <td className="mono px-3 py-2 text-right font-semibold text-slate-900">${moneyFromCents(person.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
