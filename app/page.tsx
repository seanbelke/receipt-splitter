"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  calculateTotals,
  expandItemsToUnits,
  moneyFromCents,
} from "@/lib/split";
import { AssignableUnit, ParsedReceipt } from "@/lib/types";

type Step = "upload" | "people" | "assign" | "results";
type AssignMode = "byItem" | "byPerson";

function stepIndex(step: Step): number {
  return { upload: 1, people: 2, assign: 3, results: 4 }[step];
}

type IconProps = { className?: string };

function UploadIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0 4 4m-4-4-4 4M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </svg>
  );
}

function UsersIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m18 0v-1a4 4 0 0 0-3-3.87M9.5 7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 1a3 3 0 0 1 0 6" />
    </svg>
  );
}

function AssignIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" />
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4.5 19v-1a4.5 4.5 0 0 1 4.5-4.5h4.5" />
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="m16.5 15.5 2 2 3.5-4" />
    </svg>
  );
}

function ResultIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M7 13h10M7 9h6m-6 8h8M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export default function HomePage() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<ParsedReceipt | null>(null);
  const [units, setUnits] = useState<AssignableUnit[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [newPerson, setNewPerson] = useState("");
  const [currentUnitIndex, setCurrentUnitIndex] = useState(0);
  const [currentPersonIndex, setCurrentPersonIndex] = useState(0);
  const [assignMode, setAssignMode] = useState<AssignMode>("byItem");
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [taxCents, setTaxCents] = useState(0);
  const [tipCents, setTipCents] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignPanelHeight, setAssignPanelHeight] = useState<number | null>(
    null,
  );
  const newPersonInputRef = useRef<HTMLInputElement>(null);
  const assignContentPanelRef = useRef<HTMLDivElement>(null);

  const currentUnit = units[currentUnitIndex];
  const currentAssignedPeople = currentUnit
    ? (assignments[currentUnit.id] ?? [])
    : [];
  const currentPerson = people[currentPersonIndex] ?? null;

  const allItemsAssigned = useMemo(
    () =>
      units.length > 0 &&
      units.every((unit) => (assignments[unit.id] ?? []).length > 0),
    [units, assignments],
  );

  const totals = useMemo(() => {
    if (step !== "results" || people.length === 0 || units.length === 0) {
      return [];
    }

    return calculateTotals({
      people,
      units,
      assignments,
      taxCents,
      tipCents,
    });
  }, [step, people, units, assignments, taxCents, tipCents]);

  const overallSubtotal = useMemo(
    () => units.reduce((sum, unit) => sum + unit.amountCents, 0),
    [units],
  );

  useEffect(() => {
    setCurrentUnitIndex((prev) =>
      Math.max(0, Math.min(units.length - 1, prev)),
    );
  }, [units.length]);

  useEffect(() => {
    setCurrentPersonIndex((prev) =>
      Math.max(0, Math.min(people.length - 1, prev)),
    );
  }, [people.length]);

  useEffect(() => {
    if (
      step !== "assign" ||
      typeof window === "undefined" ||
      typeof ResizeObserver === "undefined"
    ) {
      setAssignPanelHeight(null);
      return;
    }

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const updateHeight = () => {
      if (!desktopQuery.matches) {
        setAssignPanelHeight(null);
        return;
      }
      setAssignPanelHeight(assignContentPanelRef.current?.offsetHeight ?? null);
    };

    updateHeight();
    const observer = new ResizeObserver(() => updateHeight());
    if (assignContentPanelRef.current) {
      observer.observe(assignContentPanelRef.current);
    }
    desktopQuery.addEventListener("change", updateHeight);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      desktopQuery.removeEventListener("change", updateHeight);
      window.removeEventListener("resize", updateHeight);
    };
  }, [step, assignMode, currentPersonIndex, currentUnitIndex]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
  }

  async function parseReceipt(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a receipt image first.");
      return;
    }

    try {
      setIsParsing(true);
      setError(null);

      const formData = new FormData();
      formData.append("receipt", file);

      const res = await fetch("/api/parse-receipt", {
        method: "POST",
        body: formData,
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to parse receipt.");
      }

      const parsed = payload.receipt as ParsedReceipt;
      const expanded = expandItemsToUnits(parsed);

      setReceipt(parsed);
      setUnits(expanded);
      setTaxCents(parsed.taxCents);
      setTipCents(parsed.tipCents);
      setAssignments({});
      setPeople([]);
      setCurrentUnitIndex(0);
      setCurrentPersonIndex(0);
      setAssignMode("byItem");
      setStep("people");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse receipt.");
    } finally {
      setIsParsing(false);
    }
  }

  function addPerson() {
    const trimmed = newPerson.trim();
    if (!trimmed) {
      newPersonInputRef.current?.focus();
      return;
    }

    const duplicate = people.some(
      (person) => person.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setError("Names must be unique (case-insensitive).");
      newPersonInputRef.current?.focus();
      return;
    }

    setPeople((prev) => [...prev, trimmed]);
    setNewPerson("");
    setError(null);
    newPersonInputRef.current?.focus();
  }

  function onAddPersonSubmit(event: FormEvent) {
    event.preventDefault();
    addPerson();
  }

  function removePerson(name: string) {
    setPeople((prev) => prev.filter((person) => person !== name));
    setAssignments((prev) => {
      const next: Record<string, string[]> = {};
      Object.entries(prev).forEach(([unitId, names]) => {
        next[unitId] = names.filter((n) => n !== name);
      });
      return next;
    });
  }

  function toggleAssignmentForUnit(unitId: string, name: string) {
    setAssignments((prev) => {
      const selected = prev[unitId] ?? [];
      const exists = selected.includes(name);
      return {
        ...prev,
        [unitId]: exists
          ? selected.filter((n) => n !== name)
          : [...selected, name],
      };
    });
  }

  function setAllPeopleForUnit(unitId: string) {
    setAssignments((prev) => ({
      ...prev,
      [unitId]: [...people],
    }));
  }

  function clearAllPeopleForUnit(unitId: string) {
    setAssignments((prev) => ({
      ...prev,
      [unitId]: [],
    }));
  }

  function togglePersonForCurrentUnit(name: string) {
    if (!currentUnit) {
      return;
    }
    toggleAssignmentForUnit(currentUnit.id, name);
  }

  function selectAllForCurrentUnit() {
    if (!currentUnit) {
      return;
    }
    setAllPeopleForUnit(currentUnit.id);
  }

  function clearForCurrentUnit() {
    if (!currentUnit) {
      return;
    }
    clearAllPeopleForUnit(currentUnit.id);
  }

  function toggleCurrentPersonForUnit(unitId: string) {
    if (!currentPerson) {
      return;
    }
    toggleAssignmentForUnit(unitId, currentPerson);
  }

  function selectAllItemsForCurrentPerson() {
    if (!currentPerson) {
      return;
    }

    setAssignments((prev) => {
      const next = { ...prev };
      units.forEach((unit) => {
        const selected = next[unit.id] ?? [];
        if (!selected.includes(currentPerson)) {
          next[unit.id] = [...selected, currentPerson];
        }
      });
      return next;
    });
  }

  function clearAllItemsForCurrentPerson() {
    if (!currentPerson) {
      return;
    }

    setAssignments((prev) => {
      const next = { ...prev };
      units.forEach((unit) => {
        next[unit.id] = (next[unit.id] ?? []).filter(
          (name) => name !== currentPerson,
        );
      });
      return next;
    });
  }

  function moveCurrentUnit(delta: number) {
    setCurrentUnitIndex((prev) =>
      Math.max(0, Math.min(units.length - 1, prev + delta)),
    );
  }

  function moveCurrentPerson(delta: number) {
    setCurrentPersonIndex((prev) =>
      Math.max(0, Math.min(people.length - 1, prev + delta)),
    );
  }

  function toCents(value: string): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }
    return Math.round(numeric * 100);
  }

  function renderUploadStep() {
    return (
      <form onSubmit={parseReceipt} className="space-y-6">
        <div>
          <p className="step-kicker flex items-center gap-2">
            <span className="icon-badge">
              <UploadIcon />
            </span>
            Step 1
          </p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight">
            Upload a receipt photo.
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            We will parse line items, quantity rows, tax, and tip so you can
            quickly assign who ate each item.
          </p>
        </div>

        <label className="block rounded-2xl border border-dashed border-slate-400/70 bg-white/90 p-6">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Receipt Image (jpg, png, etc.)
          </span>
          <input type="file" accept="image/*" onChange={onFileChange} />
        </label>

        {file && (
          <p className="mono rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Selected: {file.name} ({Math.round(file.size / 1024)} KB)
          </p>
        )}

        <button
          type="submit"
          disabled={!file || isParsing}
          className="primary-btn inline-flex items-center gap-2 px-5 py-3"
        >
          <UploadIcon />
          {isParsing ? "Parsing receipt..." : "Parse receipt"}
        </button>
      </form>
    );
  }

  function renderPeopleStep() {
    if (!receipt) {
      return null;
    }

    return (
      <div className="space-y-7">
        <div>
          <p className="step-kicker flex items-center gap-2">
            <span className="icon-badge">
              <UsersIcon />
            </span>
            Step 2
          </p>
          <h2 className="mt-2 text-3xl font-semibold">
            Add everyone at the table.
          </h2>
        </div>

        <div className="soft-card rounded-2xl p-5">
          <p className="text-sm text-slate-700">
            Parsed {receipt.items.length} rows into {units.length} assignable
            units. Currency: {receipt.currency}.
          </p>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>Subtotal: ${moneyFromCents(overallSubtotal)}</p>
            <p>Tax: ${moneyFromCents(taxCents)}</p>
            <p>Tip: ${moneyFromCents(tipCents)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Tax ($)
              <input
                type="number"
                min={0}
                step="0.01"
                defaultValue={moneyFromCents(taxCents)}
                onChange={(e) => setTaxCents(toCents(e.target.value))}
                className="input-field mt-1"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Tip ($)
              <input
                type="number"
                min={0}
                step="0.01"
                defaultValue={moneyFromCents(tipCents)}
                onChange={(e) => setTipCents(toCents(e.target.value))}
                className="input-field mt-1"
              />
            </label>
          </div>
        </div>

        <div className="soft-card rounded-2xl p-5">
          <p className="mb-3 text-sm text-slate-700">
            People (names must be unique):
          </p>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <button
                key={person}
                onClick={() => removePerson(person)}
                className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-900 transition hover:bg-rose-50 hover:text-rose-900"
              >
                {person} ×
              </button>
            ))}
            {people.length === 0 && (
              <p className="text-sm text-slate-500">No people added yet.</p>
            )}
          </div>

          <form
            onSubmit={onAddPersonSubmit}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <input
              ref={newPersonInputRef}
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              placeholder="Add a name"
              className="input-field flex-1"
            />
            <button
              type="submit"
              className="secondary-btn inline-flex items-center gap-2 px-4 py-2"
            >
              <UsersIcon />
              Add person
            </button>
          </form>
        </div>

        <button
          onClick={() => setStep("assign")}
          disabled={people.length === 0}
          className="primary-btn inline-flex items-center gap-2 px-5 py-3"
        >
          <AssignIcon />
          Start assigning items
        </button>
      </div>
    );
  }

  function renderAssignStep() {
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
          <p className="text-sm text-slate-700">
            Add at least one person before assigning items.
          </p>
          <button
            onClick={() => setStep("people")}
            className="secondary-btn px-4 py-2"
          >
            Back to people
          </button>
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
    const isByItem = assignMode === "byItem";
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
          progress: units.filter((unit) =>
            (assignments[unit.id] ?? []).includes(person),
          ).length,
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
            <button
              onClick={() => setAssignMode("byItem")}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                assignMode === "byItem"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200"
              }`}
            >
              View each item
            </button>
            <button
              onClick={() => setAssignMode("byPerson")}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                assignMode === "byPerson"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200"
              }`}
            >
              View each person
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[15rem_1fr] lg:items-start">
          <aside
            className="soft-card rounded-2xl p-3 lg:flex lg:min-h-[32rem] lg:flex-col"
            style={
              assignPanelHeight
                ? { maxHeight: `${assignPanelHeight}px` }
                : undefined
            }
          >
            <p className="px-2 pb-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              {isByItem ? "Jump to item" : "Jump to person"}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-1 lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
              {jumpNavEntries.map((entry) => (
                <button
                  key={entry.key}
                  onClick={entry.onClick}
                  className={`min-w-44 rounded-xl px-3 py-2 text-left text-sm transition lg:min-w-0 ${
                    entry.isActive
                      ? "bg-teal-700 text-white"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  <p className="truncate font-medium">{entry.title}</p>
                  <div
                    className={`mt-1 flex items-center justify-between text-xs ${
                      entry.isActive ? "text-teal-50" : "text-slate-600"
                    }`}
                  >
                    <span className="truncate">{entry.subtitle}</span>
                    <span>{entry.progress + "/" + entry.progressTotal}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {isByItem ? (
            <div
              ref={assignContentPanelRef}
              className="soft-card rounded-2xl p-6 lg:min-h-[32rem] lg:self-start"
            >
              <p className="text-sm text-slate-500">Current item</p>
              <h3 className="mt-1 text-2xl font-semibold">
                {currentUnit.label}
              </h3>
              <p className="mono mt-1 text-lg">
                ${moneyFromCents(currentUnit.amountCents)}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {people.map((person) => {
                  const selected = currentAssignedPeople.includes(person);
                  return (
                    <button
                      key={person}
                      onClick={() => togglePersonForCurrentUnit(person)}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        selected
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                      }`}
                    >
                      {person}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={selectAllForCurrentUnit}
                  className="secondary-btn px-3 py-2 text-sm text-teal-900"
                >
                  Select all
                </button>
                <button
                  onClick={clearForCurrentUnit}
                  className="secondary-btn px-3 py-2 text-sm text-slate-700"
                >
                  Clear
                </button>
                <p className="self-center text-sm text-slate-600">
                  Selected: {selectedCount}
                </p>
              </div>
            </div>
          ) : (
            <div
              ref={assignContentPanelRef}
              className="soft-card rounded-2xl p-6 lg:min-h-[32rem] lg:self-start"
            >
              <p className="text-sm text-slate-500">Current person</p>
              <h3 className="mt-1 text-2xl font-semibold">{currentPerson}</h3>
              <p className="mt-1 text-sm text-slate-700">
                Select every item this person is sharing. Selected items:{" "}
                {selectedItemCountForCurrentPerson}
              </p>

              <div className="mt-5 grid gap-2">
                {units.map((unit) => {
                  const selected = (assignments[unit.id] ?? []).includes(
                    currentPerson,
                  );
                  return (
                    <button
                      key={unit.id}
                      onClick={() => toggleCurrentPersonForUnit(unit.id)}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                        selected
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                      }`}
                    >
                      <span>{unit.label}</span>
                      <span className="mono">
                        ${moneyFromCents(unit.amountCents)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={selectAllItemsForCurrentPerson}
                  className="secondary-btn px-3 py-2 text-sm text-teal-900"
                >
                  Select all items
                </button>
                <button
                  onClick={clearAllItemsForCurrentPerson}
                  className="secondary-btn px-3 py-2 text-sm text-slate-700"
                >
                  Clear all items
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() =>
              assignMode === "byItem"
                ? moveCurrentUnit(-1)
                : moveCurrentPerson(-1)
            }
            disabled={
              assignMode === "byItem"
                ? currentUnitIndex === 0
                : currentPersonIndex === 0
            }
            className="secondary-btn px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() =>
              assignMode === "byItem"
                ? moveCurrentUnit(1)
                : moveCurrentPerson(1)
            }
            disabled={
              assignMode === "byItem"
                ? currentUnitIndex === units.length - 1
                : currentPersonIndex === people.length - 1
            }
            className="secondary-btn px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
          <button
            onClick={() => setStep("results")}
            disabled={!allItemsAssigned}
            className="primary-btn inline-flex items-center gap-2 px-4 py-2"
          >
            <ResultIcon />
            See results
          </button>
        </div>
      </div>
    );
  }

  function renderResultsStep() {
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
          <p className="mono text-sm text-slate-700">
            Receipt total: ${moneyFromCents(overallTotal)}
          </p>
          <p className="mono text-sm text-slate-700">
            Subtotal: ${moneyFromCents(overallSubtotal)}
          </p>
          <p className="mono text-sm text-slate-700">
            Tax: ${moneyFromCents(taxCents)}
          </p>
          <p className="mono text-sm text-slate-700">
            Tip: ${moneyFromCents(tipCents)}
          </p>
        </div>

        <div className="grid gap-3">
          {totals.map((person) => (
            <div
              key={person.name}
              className="soft-card rounded-2xl p-5"
            >
              <h3 className="text-xl font-semibold">{person.name}</h3>
              <p className="mono mt-2 text-sm">
                Food: ${moneyFromCents(person.subtotalCents)}
              </p>
              <p className="mono text-sm">
                Tax share: ${moneyFromCents(person.taxShareCents)}
              </p>
              <p className="mono text-sm">
                Tip share: ${moneyFromCents(person.tipShareCents)}
              </p>
              <p className="mono mt-2 text-lg font-semibold">
                Owes: ${moneyFromCents(person.totalCents)}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={() => setStep("assign")}
          className="secondary-btn px-4 py-2"
        >
          Back to assignment
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="mono text-xs uppercase tracking-[0.18em] text-slate-500">
          Receipt Splitter
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Progress: Step {stepIndex(step)} of 4
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["upload", "people", "assign", "results"] as Step[]).map(
            (stepName) => {
              const isCurrent = stepName === step;
              const isDone = stepIndex(stepName) < stepIndex(step);
              return (
                <div
                  key={stepName}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                    isCurrent
                      ? "bg-teal-700 text-white"
                      : isDone
                        ? "bg-teal-100 text-teal-900"
                        : "bg-slate-200/70 text-slate-600"
                  }`}
                >
                  {stepName}
                </div>
              );
            },
          )}
        </div>
      </div>

      <section className="surface-panel rounded-3xl p-6 sm:p-8">
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {step === "upload" && renderUploadStep()}
        {step === "people" && renderPeopleStep()}
        {step === "assign" && renderAssignStep()}
        {step === "results" && renderResultsStep()}
      </section>
    </main>
  );
}
