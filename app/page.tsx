"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { calculateTotals, expandItemsToUnits, moneyFromCents } from "@/lib/split";
import { AssignableUnit, ParsedReceipt } from "@/lib/types";

type Step = "upload" | "people" | "assign" | "results";
type AssignMode = "byItem" | "byPerson";

function stepIndex(step: Step): number {
  return { upload: 1, people: 2, assign: 3, results: 4 }[step];
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
  const newPersonInputRef = useRef<HTMLInputElement>(null);

  const currentUnit = units[currentUnitIndex];
  const currentAssignedPeople = currentUnit ? assignments[currentUnit.id] ?? [] : [];
  const currentPerson = people[currentPersonIndex] ?? null;

  const allItemsAssigned = useMemo(
    () => units.length > 0 && units.every((unit) => (assignments[unit.id] ?? []).length > 0),
    [units, assignments]
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
      tipCents
    });
  }, [step, people, units, assignments, taxCents, tipCents]);

  const overallSubtotal = useMemo(() => units.reduce((sum, unit) => sum + unit.amountCents, 0), [units]);

  useEffect(() => {
    setCurrentUnitIndex((prev) => Math.max(0, Math.min(units.length - 1, prev)));
  }, [units.length]);

  useEffect(() => {
    setCurrentPersonIndex((prev) => Math.max(0, Math.min(people.length - 1, prev)));
  }, [people.length]);

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
        body: formData
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

    const duplicate = people.some((person) => person.toLowerCase() === trimmed.toLowerCase());
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
        [unitId]: exists ? selected.filter((n) => n !== name) : [...selected, name]
      };
    });
  }

  function setAllPeopleForUnit(unitId: string) {
    setAssignments((prev) => ({
      ...prev,
      [unitId]: [...people]
    }));
  }

  function clearAllPeopleForUnit(unitId: string) {
    setAssignments((prev) => ({
      ...prev,
      [unitId]: []
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
        next[unit.id] = (next[unit.id] ?? []).filter((name) => name !== currentPerson);
      });
      return next;
    });
  }

  function moveCurrentUnit(delta: number) {
    setCurrentUnitIndex((prev) => Math.max(0, Math.min(units.length - 1, prev + delta)));
  }

  function moveCurrentPerson(delta: number) {
    setCurrentPersonIndex((prev) => Math.max(0, Math.min(people.length - 1, prev + delta)));
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
          <p className="text-sm uppercase tracking-[0.24em] text-teal-800">Step 1</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight">Upload a receipt photo.</h1>
          <p className="mt-3 text-sm text-gray-700">
            We will parse line items, quantity rows, tax, and tip so you can quickly assign who ate each item.
          </p>
        </div>

        <label className="block rounded-2xl border border-dashed border-gray-400 bg-white p-6">
          <span className="mb-2 block text-sm text-gray-800">Receipt Image (jpg, png, etc.)</span>
          <input type="file" accept="image/*" onChange={onFileChange} />
        </label>

        {file && (
          <p className="mono text-sm text-gray-600">
            Selected: {file.name} ({Math.round(file.size / 1024)} KB)
          </p>
        )}

        <button
          type="submit"
          disabled={!file || isParsing}
          className="rounded-xl bg-teal-700 px-5 py-3 text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
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
          <p className="text-sm uppercase tracking-[0.24em] text-teal-800">Step 2</p>
          <h2 className="mt-2 text-3xl font-semibold">Add everyone at the table.</h2>
        </div>

        <div className="rounded-2xl border border-gray-300 bg-white p-5">
          <p className="text-sm text-gray-700">
            Parsed {receipt.items.length} rows into {units.length} assignable units. Currency: {receipt.currency}.
          </p>
          <div className="mt-3 space-y-1 text-sm text-gray-600">
            <p>Subtotal: ${moneyFromCents(overallSubtotal)}</p>
            <p>Tax: ${moneyFromCents(taxCents)}</p>
            <p>Tip: ${moneyFromCents(tipCents)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Tax ($)
              <input
                type="number"
                min={0}
                step="0.01"
                defaultValue={moneyFromCents(taxCents)}
                onChange={(e) => setTaxCents(toCents(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Tip ($)
              <input
                type="number"
                min={0}
                step="0.01"
                defaultValue={moneyFromCents(tipCents)}
                onChange={(e) => setTipCents(toCents(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-300 bg-white p-5">
          <p className="mb-3 text-sm text-gray-700">People (names must be unique):</p>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <button
                key={person}
                onClick={() => removePerson(person)}
                className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-900 hover:bg-red-50 hover:text-red-900"
              >
                {person} ×
              </button>
            ))}
            {people.length === 0 && <p className="text-sm text-gray-500">No people added yet.</p>}
          </div>

          <form onSubmit={onAddPersonSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              ref={newPersonInputRef}
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              placeholder="Add a name"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            />
            <button type="submit" className="rounded-lg border border-teal-700 px-4 py-2 text-teal-800 hover:bg-teal-50">
              Add person
            </button>
          </form>
        </div>

        <button
          onClick={() => setStep("assign")}
          disabled={people.length === 0}
          className="rounded-xl bg-teal-700 px-5 py-3 text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          Start assigning items
        </button>
      </div>
    );
  }

  function renderAssignStep() {
    if (people.length === 0) {
      return (
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.24em] text-teal-800">Step 3</p>
          <h2 className="text-3xl font-semibold">Assign each item.</h2>
          <p className="text-sm text-gray-700">Add at least one person before assigning items.</p>
          <button onClick={() => setStep("people")} className="rounded-lg border border-gray-400 px-4 py-2">
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
      (assignments[unit.id] ?? []).includes(currentPerson)
    ).length;

    return (
      <div className="space-y-7">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-teal-800">Step 3</p>
          <h2 className="mt-2 text-3xl font-semibold">Assign each item.</h2>
          <p className="mt-2 text-sm text-gray-700">
            {assignMode === "byItem"
              ? `Item ${currentUnitIndex + 1} of ${units.length}`
              : `Person ${currentPersonIndex + 1} of ${people.length}`}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-300 bg-white p-4">
          <p className="text-sm text-gray-600">Assignment mode</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setAssignMode("byItem")}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                assignMode === "byItem" ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              View each item
            </button>
            <button
              onClick={() => setAssignMode("byPerson")}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                assignMode === "byPerson" ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
              }`}
            >
              View each person
            </button>
          </div>
        </div>

        {assignMode === "byItem" ? (
          <div className="rounded-2xl border border-gray-300 bg-white p-6">
            <p className="text-sm text-gray-500">Current item</p>
            <h3 className="mt-1 text-2xl font-semibold">{currentUnit.label}</h3>
            <p className="mono mt-1 text-lg">${moneyFromCents(currentUnit.amountCents)}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {people.map((person) => {
                const selected = currentAssignedPeople.includes(person);
                return (
                  <button
                    key={person}
                    onClick={() => togglePersonForCurrentUnit(person)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      selected ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
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
                className="rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-900"
              >
                Select all
              </button>
              <button onClick={clearForCurrentUnit} className="rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-700">
                Clear
              </button>
              <p className="self-center text-sm text-gray-600">Selected: {selectedCount}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-300 bg-white p-6">
            <p className="text-sm text-gray-500">Current person</p>
            <h3 className="mt-1 text-2xl font-semibold">{currentPerson}</h3>
            <p className="mt-1 text-sm text-gray-700">
              Select every item this person is sharing. Selected items: {selectedItemCountForCurrentPerson}
            </p>

            <div className="mt-5 grid gap-2">
              {units.map((unit) => {
                const selected = (assignments[unit.id] ?? []).includes(currentPerson);
                return (
                  <button
                    key={unit.id}
                    onClick={() => toggleCurrentPersonForUnit(unit.id)}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm transition ${
                      selected ? "bg-teal-700 text-white" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    <span>{unit.label}</span>
                    <span className="mono">${moneyFromCents(unit.amountCents)}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={selectAllItemsForCurrentPerson}
                className="rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-900"
              >
                Select all items
              </button>
              <button
                onClick={clearAllItemsForCurrentPerson}
                className="rounded-lg border border-gray-400 px-3 py-2 text-sm text-gray-700"
              >
                Clear all items
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => (assignMode === "byItem" ? moveCurrentUnit(-1) : moveCurrentPerson(-1))}
            disabled={assignMode === "byItem" ? currentUnitIndex === 0 : currentPersonIndex === 0}
            className="rounded-lg border border-gray-400 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => (assignMode === "byItem" ? moveCurrentUnit(1) : moveCurrentPerson(1))}
            disabled={assignMode === "byItem" ? currentUnitIndex === units.length - 1 : currentPersonIndex === people.length - 1}
            className="rounded-lg border border-gray-400 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
          <button
            onClick={() => setStep("results")}
            disabled={!allItemsAssigned}
            className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          >
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
          <p className="text-sm uppercase tracking-[0.24em] text-teal-800">Step 4</p>
          <h2 className="mt-2 text-3xl font-semibold">Final split.</h2>
        </div>

        <div className="rounded-2xl border border-gray-300 bg-white p-5">
          <p className="mono text-sm text-gray-700">Receipt total: ${moneyFromCents(overallTotal)}</p>
          <p className="mono text-sm text-gray-700">Subtotal: ${moneyFromCents(overallSubtotal)}</p>
          <p className="mono text-sm text-gray-700">Tax: ${moneyFromCents(taxCents)}</p>
          <p className="mono text-sm text-gray-700">Tip: ${moneyFromCents(tipCents)}</p>
        </div>

        <div className="grid gap-3">
          {totals.map((person) => (
            <div key={person.name} className="rounded-2xl border border-gray-300 bg-white p-5">
              <h3 className="text-xl font-semibold">{person.name}</h3>
              <p className="mono mt-2 text-sm">Food: ${moneyFromCents(person.subtotalCents)}</p>
              <p className="mono text-sm">Tax share: ${moneyFromCents(person.taxShareCents)}</p>
              <p className="mono text-sm">Tip share: ${moneyFromCents(person.tipShareCents)}</p>
              <p className="mono mt-2 text-lg font-semibold">Owes: ${moneyFromCents(person.totalCents)}</p>
            </div>
          ))}
        </div>

        <button onClick={() => setStep("assign")} className="rounded-lg border border-gray-400 px-4 py-2">
          Back to assignment
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="mono text-xs uppercase tracking-[0.18em] text-gray-500">Receipt Splitter</p>
        <p className="mt-1 text-sm text-gray-700">Progress: Step {stepIndex(step)} of 4</p>
      </div>

      <section className="rounded-3xl border border-gray-300 bg-white/80 p-6 shadow-sm sm:p-8">
        {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {step === "upload" && renderUploadStep()}
        {step === "people" && renderPeopleStep()}
        {step === "assign" && renderAssignStep()}
        {step === "results" && renderResultsStep()}
      </section>
    </main>
  );
}
