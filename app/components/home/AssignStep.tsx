import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import { CSSProperties, RefObject } from "react";
import { AssignableUnit, ParsedReceipt } from "@/lib/types";
import { toCents } from "@/lib/currency";
import { moneyFromCents } from "@/lib/split";
import { AIPrefillDetail, AssignMode } from "./types";
import { AssignIcon, CheckIcon, EditIcon, ResultIcon } from "./icons";

function getAssignmentCoverageTone(
  assignedCount: number,
  totalPeople: number,
): {
  cardClass: string;
  statusClass: string;
  cardStyle?: CSSProperties;
  statusStyle?: CSSProperties;
} {
  if (assignedCount <= 0 || totalPeople <= 0) {
    return {
      cardClass: "bg-slate-100 text-slate-800 hover:bg-slate-200",
      statusClass: "text-slate-500",
    };
  }

  const boundedCount = Math.max(1, Math.min(assignedCount, totalPeople));
  const stepIndex = boundedCount - 1;
  const normalized = totalPeople <= 1 ? 1 : boundedCount / totalPeople;
  const hue = Math.max(18, 56 - stepIndex * 6.9 - normalized * 6.9);
  const saturation = Math.min(92, 72 + stepIndex * 4.6);
  const lightness = Math.max(62, 96 - stepIndex * 5.2 - normalized * 5.75);
  const borderLightness = Math.max(44, lightness - 17);

  return {
    cardClass: "border",
    statusClass: "",
    cardStyle: {
      backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
      borderColor: `hsl(${hue} 44% ${borderLightness}%)`,
      color: `hsl(${Math.max(16, hue - 14)} 42% 30%)`,
    },
    statusStyle: {
      color: `hsl(${Math.max(16, hue - 14)} 36% 34%)`,
    },
  };
}

type CurrentPersonPrefill = {
  unit: AssignableUnit;
  detail: AIPrefillDetail;
};

export type AssignStepProps = {
  receipt: ParsedReceipt | null;
  units: AssignableUnit[];
  people: string[];
  assignments: Record<string, string[]>;
  assignMode: AssignMode;
  setAssignMode: (mode: AssignMode) => void;
  currentUnitIndex: number;
  setCurrentUnitIndex: (index: number) => void;
  currentPersonIndex: number;
  setCurrentPersonIndex: (index: number) => void;
  currentUnit: AssignableUnit | undefined;
  currentPerson: string | null;
  currentAssignedPeople: string[];
  currentSourceRowIndex: number | null;
  currentSourceItem: ParsedReceipt["items"][number] | null;
  currentUnitAIPrefill: AIPrefillDetail | null;
  currentPersonAIPrefills: CurrentPersonPrefill[];
  editingItemRowIndex: number | null;
  setEditingItemRowIndex: (index: number | null) => void;
  updateReceiptItem: (rowIndex: number, updates: Partial<ParsedReceipt["items"][number]>) => void;
  togglePersonForCurrentUnit: (name: string) => void;
  selectAllForCurrentUnit: () => void;
  clearForCurrentUnit: () => void;
  toggleCurrentPersonForUnit: (unitId: string) => void;
  jumpToItemRow: (rowIndex: number, enableEdit?: boolean) => void;
  selectAllItemsForCurrentPerson: () => void;
  clearAllItemsForCurrentPerson: () => void;
  moveCurrentUnit: (delta: number) => void;
  moveCurrentPerson: (delta: number) => void;
  allItemsAssigned: boolean;
  assignPanelHeight: number | null;
  assignContentPanelRef: RefObject<HTMLDivElement | null>;
  openAiReasoning: () => void;
  goToSetup: () => void;
  goToResults: () => void;
};

export function AssignStep(props: AssignStepProps) {
  const {
    receipt,
    units,
    people,
    assignments,
    assignMode,
    setAssignMode,
    currentUnitIndex,
    setCurrentUnitIndex,
    currentPersonIndex,
    setCurrentPersonIndex,
    currentUnit,
    currentPerson,
    currentAssignedPeople,
    currentSourceRowIndex,
    currentSourceItem,
    currentUnitAIPrefill,
    currentPersonAIPrefills,
    editingItemRowIndex,
    setEditingItemRowIndex,
    updateReceiptItem,
    togglePersonForCurrentUnit,
    selectAllForCurrentUnit,
    clearForCurrentUnit,
    toggleCurrentPersonForUnit,
    jumpToItemRow,
    selectAllItemsForCurrentPerson,
    clearAllItemsForCurrentPerson,
    moveCurrentUnit,
    moveCurrentPerson,
    allItemsAssigned,
    assignPanelHeight,
    assignContentPanelRef,
    openAiReasoning,
    goToSetup,
    goToResults,
  } = props;

  if (!receipt || units.length === 0) {
    return (
      <div className="space-y-4">
        <p className="step-kicker flex items-center gap-2">
          <span className="icon-badge">
            <AssignIcon />
          </span>
          Step 3
        </p>
        <h2 className="text-3xl font-semibold">Assign each item.</h2>
        <p className="text-sm text-slate-700">Wait for receipt parsing to finish before assigning items.</p>
        <Button onClick={goToSetup} className="secondary-btn px-4 py-2">
          Back to setup
        </Button>
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="space-y-4">
        <p className="step-kicker flex items-center gap-2">
          <span className="icon-badge">
            <AssignIcon />
          </span>
          Step 3
        </p>
        <h2 className="text-3xl font-semibold">Assign each item.</h2>
        <p className="text-sm text-slate-700">Add at least one person before assigning items.</p>
        <Button onClick={goToSetup} className="secondary-btn px-4 py-2">
          Back to setup
        </Button>
      </div>
    );
  }

  if (!currentUnit || !currentPerson) {
    return null;
  }

  const selectedCount = currentAssignedPeople.length;
  const selectedItemCountForCurrentPerson = units.filter((unit) =>
    (assignments[unit.id] ?? []).includes(currentPerson),
  ).length;
  const unassignedUnitCount = units.filter((unit) => (assignments[unit.id] ?? []).length === 0).length;
  const isByItem = assignMode === "byItem";
  const hasAiPrefillInCurrentContext = isByItem ? !!currentUnitAIPrefill : currentPersonAIPrefills.length > 0;
  const jumpNavEntries = isByItem
    ? units.map((unit, index) => ({
        key: unit.id,
        title: unit.label,
        subtitle: `$${moneyFromCents(unit.amountCents)}`,
        progress: (assignments[unit.id] ?? []).length,
        progressTotal: people.length,
        isActive: index === currentUnitIndex,
        onClick: () => setCurrentUnitIndex(index),
      }))
    : people.map((person, index) => ({
        key: person,
        title: person,
        subtitle: `${units.filter((unit) => (assignments[unit.id] ?? []).includes(person)).length} / ${units.length} items`,
        progress: units.filter((unit) => (assignments[unit.id] ?? []).includes(person)).length,
        progressTotal: units.length,
        isActive: index === currentPersonIndex,
        onClick: () => setCurrentPersonIndex(index),
      }));

  return (
    <div className="space-y-7">
      <div>
        <p className="step-kicker flex items-center gap-2">
          <span className="icon-badge">
            <AssignIcon />
          </span>
          Step 3
        </p>
        <h2 className="mt-2 text-3xl font-semibold">Assign each item.</h2>
        <p className="mt-2 text-sm text-slate-700">
          {assignMode === "byItem"
            ? `Item ${currentUnitIndex + 1} of ${units.length}`
            : `Person ${currentPersonIndex + 1} of ${people.length}`}
        </p>
      </div>

      <div className="soft-card rounded-2xl p-4">
        <p className="text-sm text-slate-600">Assignment mode</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => setAssignMode("byItem")}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              assignMode === "byItem" ? "bg-teal-700 text-white shadow-sm" : "bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
          >
            View each item
          </Button>
          <Button
            onClick={() => setAssignMode("byPerson")}
            className={`rounded-lg px-4 py-2 text-sm transition ${
              assignMode === "byPerson"
                ? "bg-teal-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
          >
            View each person
          </Button>
          <Button
            type="button"
            onClick={openAiReasoning}
            disabled={!hasAiPrefillInCurrentContext}
            className="secondary-btn px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            View AI prefill details
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[15rem_1fr] lg:items-start">
        <aside
          className="soft-card rounded-2xl p-3 lg:flex lg:min-h-[32rem] lg:flex-col"
          style={assignPanelHeight ? { maxHeight: `${assignPanelHeight}px` } : undefined}
        >
          <p className="px-2 pb-2 text-xs uppercase tracking-[0.16em] text-slate-500">
            {isByItem ? "Jump to item" : "Jump to person"}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
            {jumpNavEntries.map((entry) => (
              <ButtonBase
                component="button"
                key={entry.key}
                onClick={entry.onClick}
                className={`min-w-44 rounded-xl px-3 py-2 text-left text-sm transition lg:min-w-0 ${
                  entry.isActive ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                }`}
                sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "stretch" }}
              >
                <p className="truncate font-medium">{entry.title}</p>
                <div className={`mt-1 flex items-center justify-between text-xs ${entry.isActive ? "text-teal-50" : "text-slate-600"}`}>
                  <span className="min-w-0 truncate">{entry.subtitle}</span>
                  <span className="shrink-0 pl-2">{entry.progress + "/" + entry.progressTotal}</span>
                </div>
              </ButtonBase>
            ))}
          </div>
        </aside>

        {isByItem ? (
          <div ref={assignContentPanelRef} className="soft-card rounded-2xl p-6 lg:min-h-[32rem] lg:self-start">
            <p className="text-sm text-slate-500">Current item</p>
            {currentSourceItem ? (
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={currentSourceItem.name}
                    readOnly={editingItemRowIndex !== currentSourceRowIndex}
                    onChange={(event) =>
                      updateReceiptItem(currentSourceRowIndex as number, {
                        name: event.target.value,
                      })
                    }
                    className={`w-full rounded-md border px-2 py-1 text-2xl font-semibold ${
                      editingItemRowIndex === currentSourceRowIndex ? "border-slate-300 bg-white" : "border-transparent bg-transparent"
                    }`}
                  />
                  <Button
                    type="button"
                    onClick={() =>
                      setEditingItemRowIndex(editingItemRowIndex === currentSourceRowIndex ? null : (currentSourceRowIndex as number))
                    }
                    className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={editingItemRowIndex === currentSourceRowIndex ? "Done editing item" : "Edit item"}
                    title="Edit name/price"
                  >
                    {editingItemRowIndex === currentSourceRowIndex ? <CheckIcon /> : <EditIcon />}
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm text-slate-600">
                    Row total ($)
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={(currentSourceItem.totalPriceCents / 100).toFixed(2)}
                      readOnly={editingItemRowIndex !== currentSourceRowIndex}
                      onChange={(event) =>
                        updateReceiptItem(currentSourceRowIndex as number, {
                          totalPriceCents: toCents(event.target.value),
                        })
                      }
                      className={`mono ml-2 w-28 rounded-md border px-2 py-1 text-right ${
                        editingItemRowIndex === currentSourceRowIndex ? "border-slate-300 bg-white" : "border-transparent bg-transparent"
                      }`}
                    />
                  </label>
                  <p className="text-sm text-slate-600">Qty: {currentSourceItem.quantity}</p>
                </div>
              </div>
            ) : (
              <>
                <h3 className="mt-1 text-2xl font-semibold">{currentUnit.label}</h3>
                <p className="mono mt-1 text-lg">${moneyFromCents(currentUnit.amountCents)}</p>
              </>
            )}
            <p className="mono mt-1 text-lg">Unit amount: ${moneyFromCents(currentUnit.amountCents)}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {people.map((person) => {
                const selected = currentAssignedPeople.includes(person);
                return (
                  <Button
                    key={person}
                    onClick={() => togglePersonForCurrentUnit(person)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      selected ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                    }`}
                  >
                    {person}
                  </Button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={selectAllForCurrentUnit} className="secondary-btn px-3 py-2 text-sm text-teal-900">
                Select all
              </Button>
              <Button onClick={clearForCurrentUnit} className="secondary-btn px-3 py-2 text-sm text-slate-700">
                Clear
              </Button>
              <p className="self-center text-sm text-slate-600">Selected: {selectedCount}</p>
            </div>
          </div>
        ) : (
          <div ref={assignContentPanelRef} className="soft-card rounded-2xl p-6 lg:min-h-[32rem] lg:self-start">
            <p className="text-sm text-slate-500">Current person</p>
            <h3 className="mt-1 text-2xl font-semibold">{currentPerson}</h3>
            <p className="mt-1 text-sm text-slate-700">
              Select every item this person is sharing. Selected items: {selectedItemCountForCurrentPerson}
            </p>
            <p className="mt-1 text-sm text-slate-700">Unassigned units remaining: {unassignedUnitCount}</p>

            <div className="mt-5 grid gap-2">
              {units.map((unit) => {
                const assignedPeopleForUnit = assignments[unit.id] ?? [];
                const selected = assignedPeopleForUnit.includes(currentPerson);
                const assignedCount = assignedPeopleForUnit.length;
                const claimedByOthers = !selected && assignedCount > 0;
                const coverageTone = getAssignmentCoverageTone(assignedCount, people.length);
                const statusLabel =
                  assignedCount === 0 ? "Unassigned" : `Assigned to ${assignedCount}: ${assignedPeopleForUnit.join(", ")}`;
                return (
                  <div key={unit.id} className="flex items-center gap-2">
                    <Button
                      onClick={() => toggleCurrentPersonForUnit(unit.id)}
                      style={selected ? undefined : claimedByOthers ? coverageTone.cardStyle : undefined}
                      className={`flex flex-1 flex-col items-start rounded-xl px-4 py-3 text-left text-sm transition ${
                        selected
                          ? "bg-teal-700 text-white"
                          : claimedByOthers
                            ? coverageTone.cardClass
                            : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                      }`}
                    >
                      <span className="flex w-full items-center justify-between gap-3">
                        <span>{unit.label}</span>
                        <span className="mono">${moneyFromCents(unit.amountCents)}</span>
                      </span>
                      <span
                        style={selected ? undefined : claimedByOthers ? coverageTone.statusStyle : undefined}
                        className={`mt-1 text-xs ${
                          selected ? "text-teal-50" : claimedByOthers ? coverageTone.statusClass : "text-slate-500"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      onClick={() => jumpToItemRow(unit.sourceRowIndex, true)}
                      className={`rounded-md p-2 transition ${
                        editingItemRowIndex === unit.sourceRowIndex
                          ? "bg-teal-100 text-teal-800"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                      aria-label="Edit this item"
                      title="Edit this item"
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={selectAllItemsForCurrentPerson} className="secondary-btn px-3 py-2 text-sm text-teal-900">
                Select all items
              </Button>
              <Button onClick={clearAllItemsForCurrentPerson} className="secondary-btn px-3 py-2 text-sm text-slate-700">
                Clear all items
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => (assignMode === "byItem" ? moveCurrentUnit(-1) : moveCurrentPerson(-1))}
          disabled={assignMode === "byItem" ? currentUnitIndex === 0 : currentPersonIndex === 0}
          className="secondary-btn px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </Button>
        <Button
          onClick={() => (assignMode === "byItem" ? moveCurrentUnit(1) : moveCurrentPerson(1))}
          disabled={assignMode === "byItem" ? currentUnitIndex === units.length - 1 : currentPersonIndex === people.length - 1}
          className="secondary-btn px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </Button>
        <Button onClick={goToResults} disabled={!allItemsAssigned} className="primary-btn inline-flex items-center gap-2 px-4 py-2">
          <ResultIcon />
          See results
        </Button>
      </div>
    </div>
  );
}
