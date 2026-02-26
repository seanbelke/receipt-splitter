import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { AssignableUnit } from "@/lib/types";
import { moneyFromCents } from "@/lib/split";
import { AIPrefillDetail, AssignMode } from "./types";

type CurrentPersonPrefill = {
  unit: AssignableUnit;
  detail: AIPrefillDetail;
};

type AiPrefillDialogProps = {
  open: boolean;
  assignMode: AssignMode;
  currentUnit: AssignableUnit | undefined;
  currentPerson: string | null;
  currentUnitAIPrefill: AIPrefillDetail | null;
  currentPersonAIPrefills: CurrentPersonPrefill[];
  onClose: () => void;
};

export function AiPrefillDialog({
  open,
  assignMode,
  currentUnit,
  currentPerson,
  currentUnitAIPrefill,
  currentPersonAIPrefills,
  onClose,
}: AiPrefillDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>AI prefill details</DialogTitle>
      <DialogContent dividers>
        {assignMode === "byItem" ? (
          currentUnitAIPrefill && currentUnit ? (
            <div className="space-y-2 text-sm">
              <p className="text-slate-800">
                Item: <span className="font-medium">{currentUnit.label}</span>
              </p>
              <p className="text-slate-600">{currentUnitAIPrefill.reason}</p>
              {currentUnitAIPrefill.assignments.length > 0 ? (
                <ul className="space-y-1">
                  {currentUnitAIPrefill.assignments.map((assignment) => (
                    <li
                      key={`${assignment.person}-${assignment.reason}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <p className="font-medium text-slate-800">
                        {assignment.person} <span className="capitalize text-slate-500">({assignment.confidence})</span>
                      </p>
                      <p className="text-slate-600">{assignment.reason}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-700">No AI assignment suggestions for this item.</p>
              )}
              {currentUnitAIPrefill.missingContext.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-amber-800">
                  {currentUnitAIPrefill.missingContext.map((entry, index) => (
                    <li key={`${entry}-${index}`}>{entry}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-700">No AI prefill details for the current item.</p>
          )
        ) : currentPerson ? (
          currentPersonAIPrefills.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-800">
                AI prefill entries for <span className="font-medium">{currentPerson}</span>
              </p>
              <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {currentPersonAIPrefills.map(({ unit, detail }) =>
                  detail.assignments
                    .filter((assignment) => assignment.person === currentPerson)
                    .map((assignment) => (
                      <div key={`${unit.id}-${assignment.reason}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <p className="font-medium text-slate-900">
                          {unit.label} (${moneyFromCents(unit.amountCents)})
                        </p>
                        <p className="mt-1 capitalize text-slate-700">Confidence: {assignment.confidence}</p>
                        <p className="mt-1 text-slate-600">{assignment.reason}</p>
                      </div>
                    )),
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-700">No AI prefill details for the current person.</p>
          )
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
