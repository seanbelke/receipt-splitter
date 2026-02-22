"use client";

import Image from "next/image";
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  calculateSplitBreakdown,
  expandItemsToUnits,
  moneyFromCents,
} from "@/lib/split";
import { AssignableUnit, ParsedReceipt, SplitBreakdown } from "@/lib/types";

type Step = "setup" | "assign" | "results";
type AssignMode = "byItem" | "byPerson";

function stepIndex(step: Step): number {
  return { setup: 1, assign: 2, results: 3 }[step];
}

type IconProps = { className?: string };

function UploadIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
    >
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V4m0 0 4 4m-4-4-4 4M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3"
      />
    </svg>
  );
}

function UsersIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
    >
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m18 0v-1a4 4 0 0 0-3-3.87M9.5 7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 1a3 3 0 0 1 0 6"
      />
    </svg>
  );
}

function AssignIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
    >
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.5 8.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
      />
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 19v-1a4.5 4.5 0 0 1 4.5-4.5h4.5"
      />
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.5 15.5 2 2 3.5-4"
      />
    </svg>
  );
}

function ResultIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
    >
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 13h10M7 9h6m-6 8h8M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
      />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
    >
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M9 7V5h6v2m-7 4v6m4-6v6m4-6v6"
      />
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 7l1 12h10l1-12"
      />
    </svg>
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtmlReport(params: {
  generatedAtIso: string;
  receipt: ParsedReceipt;
  breakdown: SplitBreakdown;
  overallSubtotal: number;
  taxCents: number;
  tipCents: number;
}): string {
  const {
    generatedAtIso,
    receipt,
    breakdown,
    overallSubtotal,
    taxCents,
    tipCents,
  } = params;
  const overallTotal = overallSubtotal + taxCents + tipCents;
  const generatedAt = new Date(generatedAtIso).toLocaleString();

  const receiptRows = receipt.items
    .map(
      (item) =>
        `<tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.quantity}</td>
          <td class="mono">$${moneyFromCents(item.totalPriceCents)}</td>
        </tr>`,
    )
    .join("");

  const unitRows = breakdown.unitAllocations
    .map((unit) => {
      const assigned =
        unit.assignedPeople.length > 0
          ? unit.assignedPeople.map((name) => escapeHtml(name)).join(", ")
          : "Unassigned";
      const splitMath =
        unit.perPersonShares.length > 0
          ? unit.perPersonShares
              .map(
                (share) =>
                  `${escapeHtml(share.name)}: $${moneyFromCents(share.amountCents)}`,
              )
              .join(" + ")
          : "Excluded from split (no assignees)";
      return `<tr>
        <td>${escapeHtml(unit.label)}</td>
        <td class="mono">$${moneyFromCents(unit.amountCents)}</td>
        <td>${assigned}</td>
        <td>${splitMath}</td>
      </tr>`;
    })
    .join("");

  const personRows = breakdown.personTotals
    .map(
      (person) => `<tr>
        <td>${escapeHtml(person.name)}</td>
        <td class="mono">$${moneyFromCents(person.subtotalCents)}</td>
        <td class="mono">$${moneyFromCents(person.taxShareCents)}</td>
        <td class="mono">$${moneyFromCents(person.tipShareCents)}</td>
        <td class="mono strong">$${moneyFromCents(person.totalCents)}</td>
      </tr>`,
    )
    .join("");

  const taxShareRows = breakdown.taxShares
    .map(
      (share) =>
        `<tr><td>${escapeHtml(share.name)}</td><td class="mono">$${moneyFromCents(share.amountCents)}</td></tr>`,
    )
    .join("");

  const tipShareRows = breakdown.tipShares
    .map(
      (share) =>
        `<tr><td>${escapeHtml(share.name)}</td><td class="mono">$${moneyFromCents(share.amountCents)}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt Split Report</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: "Avenir Next", "Segoe UI", sans-serif;
      color: #0f172a;
      background: #f8fafc;
      line-height: 1.4;
      padding: 32px;
    }
    .report {
      max-width: 980px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #dbeafe;
      border-radius: 14px;
      padding: 24px;
    }
    h1, h2 { margin: 0 0 8px 0; }
    h1 { font-size: 26px; }
    h2 { font-size: 20px; margin-top: 28px; }
    p { margin: 6px 0; }
    .meta { color: #334155; font-size: 14px; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
    .strong { font-weight: 700; }
    .actions { margin-top: 12px; }
    .print-btn {
      border: 1px solid #0f766e;
      background: #0f766e;
      color: white;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 14px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 800px) {
      body { padding: 10px; }
      .report { padding: 14px; }
      .grid { grid-template-columns: 1fr; }
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .report {
        border: none;
        border-radius: 0;
        max-width: none;
      }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="report">
    <h1>Receipt Split Report</h1>
    <p class="meta">Generated: ${escapeHtml(generatedAt)}</p>
    <p class="meta">Currency: ${escapeHtml(receipt.currency)}</p>
    ${receipt.restaurantName ? `<p class="meta">Restaurant: ${escapeHtml(receipt.restaurantName)}</p>` : ""}
    <div class="actions"><button class="print-btn" onclick="window.print()">Print report</button></div>

    <h2>Totals</h2>
    <p class="mono">Subtotal: $${moneyFromCents(overallSubtotal)}</p>
    <p class="mono">Tax: $${moneyFromCents(taxCents)}</p>
    <p class="mono">Tip: $${moneyFromCents(tipCents)}</p>
    <p class="mono strong">Total: $${moneyFromCents(overallTotal)}</p>

    <h2>Line Items</h2>
    <table>
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Row Total</th></tr>
      </thead>
      <tbody>${receiptRows}</tbody>
    </table>

    <h2>Unit-Level Math</h2>
    <p class="meta">Each unit is split evenly among assigned people, then rounded to cents deterministically.</p>
    <table>
      <thead>
        <tr><th>Unit</th><th>Amount</th><th>Assigned People</th><th>Split Math</th></tr>
      </thead>
      <tbody>${unitRows}</tbody>
    </table>

    <h2>Tax and Tip Apportionment</h2>
    <p class="meta">Tax and tip are apportioned by each person's food subtotal using weighted rounding.</p>
    <div class="grid">
      <div>
        <h3>Tax Shares</h3>
        <table>
          <thead><tr><th>Person</th><th>Tax Share</th></tr></thead>
          <tbody>${taxShareRows}</tbody>
        </table>
      </div>
      <div>
        <h3>Tip Shares</h3>
        <table>
          <thead><tr><th>Person</th><th>Tip Share</th></tr></thead>
          <tbody>${tipShareRows}</tbody>
        </table>
      </div>
    </div>

    <h2>Final Amounts</h2>
    <table>
      <thead>
        <tr>
          <th>Person</th>
          <th>Food Subtotal</th>
          <th>Tax Share</th>
          <th>Tip Share</th>
          <th>Total Owed</th>
        </tr>
      </thead>
      <tbody>${personRows}</tbody>
    </table>
  </div>
</body>
</html>`;
}

export default function HomePage() {
  const [step, setStep] = useState<Step>("setup");
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
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [reportHtmlPreview, setReportHtmlPreview] = useState<string | null>(
    null,
  );
  const [assignPanelHeight, setAssignPanelHeight] = useState<number | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const breakdown = useMemo(() => {
    if (step !== "results" || people.length === 0 || units.length === 0) {
      return null;
    }

    return calculateSplitBreakdown({
      people,
      units,
      assignments,
      taxCents,
      tipCents,
    });
  }, [step, people, units, assignments, taxCents, tipCents]);

  const totals = useMemo(() => {
    return breakdown?.personTotals ?? [];
  }, [breakdown]);

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
    if (!file) {
      setSelectedImageUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedImageUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    if (!isImagePreviewOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsImagePreviewOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isImagePreviewOpen]);

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
    const changedFile =
      (selected && !file) ||
      (!selected && !!file) ||
      (selected &&
        file &&
        (selected.name !== file.name || selected.size !== file.size));
    setFile(selected);
    if (changedFile) {
      setReceipt(null);
      setUnits([]);
      setAssignments({});
      setTaxCents(0);
      setTipCents(0);
      setStep("setup");
    }
    if (!selected) {
      setIsImagePreviewOpen(false);
    }
    setError(null);
  }

  function removeSelectedFile() {
    setFile(null);
    setReceipt(null);
    setUnits([]);
    setAssignments({});
    setTaxCents(0);
    setTipCents(0);
    setStep("setup");
    setIsImagePreviewOpen(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function startReceiptParse() {
    if (!file) {
      setError("Choose a receipt image first.");
      return;
    }

    try {
      setIsParsing(true);
      setError(null);
      setStep("setup");
      setReceipt(null);
      setUnits([]);
      setAssignments({});
      setTaxCents(0);
      setTipCents(0);
      setCurrentUnitIndex(0);
      setCurrentPersonIndex(0);
      setAssignMode("byItem");

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse receipt.");
    } finally {
      setIsParsing(false);
    }
  }

  async function parseReceipt(event: FormEvent) {
    event.preventDefault();
    await startReceiptParse();
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

  function makeHtmlReport(): string | null {
    if (!receipt || !breakdown) {
      return null;
    }

    return buildHtmlReport({
      generatedAtIso: new Date().toISOString(),
      receipt,
      breakdown,
      overallSubtotal,
      taxCents,
      tipCents,
    });
  }

  function openHtmlReportPreview() {
    const html = makeHtmlReport();
    if (!html) {
      return;
    }
    setError(null);
    setReportHtmlPreview(html);
  }

  function printHtmlReport() {
    const html = makeHtmlReport();
    if (!html) {
      return;
    }

    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.visibility = "hidden";
    document.body.appendChild(frame);

    const cleanup = () => {
      frame.remove();
    };

    frame.onload = () => {
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        cleanup();
        setError("Could not print report.");
        return;
      }

      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = cleanup;
      window.setTimeout(cleanup, 1500);
    };

    const printDoc = frame.contentDocument;
    if (!printDoc) {
      cleanup();
      setError("Could not print report.");
      return;
    }

    setError(null);
    printDoc.open();
    printDoc.write(html);
    printDoc.close();
  }

  function renderSetupStep() {
    return (
      <div className="space-y-7">
        <div>
          <p className="step-kicker flex items-center gap-2">
            <span className="icon-badge">
              <UploadIcon />
            </span>
            Step 1
          </p>
          <h2 className="mt-2 text-3xl font-semibold">
            Upload a receipt and add everyone.
          </h2>
        </div>

        <form onSubmit={parseReceipt} className="space-y-4">
          <label className="block rounded-2xl border border-dashed border-slate-400/70 bg-white/90 p-6">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Receipt image
            </span>
            <input
              ref={fileInputRef}
              id="receipt-image-input"
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="sr-only"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <label
                htmlFor="receipt-image-input"
                className="file-picker-btn inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold"
              >
                <UploadIcon />
                {file ? "Replace file" : "Choose file"}
              </label>
              <span className="text-sm text-slate-500">
                {file ? file.name : "No file selected"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Supported formats: JPG, PNG, HEIC, and most mobile photo types.
            </p>
          </label>

          {file && selectedImageUrl && (
            <div className="soft-card flex items-center justify-between gap-2 rounded-xl p-2 sm:p-3">
              <button
                type="button"
                onClick={() => setIsImagePreviewOpen(true)}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left transition hover:bg-slate-100/80"
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <Image
                    src={selectedImageUrl}
                    alt={`Selected receipt image: ${file.name}`}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Selected image
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-medium text-slate-900">
                    {file.name}
                  </span>
                  <span className="mono mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {Math.round(file.size / 1024)} KB
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={removeSelectedFile}
                aria-label="Remove selected image"
                title="Remove selected image"
                className="secondary-btn shrink-0 p-2.5 text-slate-600"
              >
                <TrashIcon />
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || isParsing}
            aria-busy={isParsing}
            className="primary-btn parse-receipt-btn inline-flex items-center gap-2 px-5 py-3"
          >
            {isParsing ? (
              <>
                <span className="loading-spinner" aria-hidden="true" />
                <span className="inline-flex items-center">
                  Parsing receipt
                  <span className="loading-dots" aria-hidden="true">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </span>
              </>
            ) : (
              <>
                <UploadIcon />
                Parse receipt
              </>
            )}
          </button>
        </form>

        <div className="soft-card rounded-2xl p-5">
          {receipt ? (
            <>
              <p className="text-sm text-slate-700">
                Parsed {receipt.items.length} rows into {units.length}{" "}
                assignable units. Currency: {receipt.currency}.
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
                    value={(taxCents / 100).toFixed(2)}
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
                    value={(tipCents / 100).toFixed(2)}
                    onChange={(e) => setTipCents(toCents(e.target.value))}
                    className="input-field mt-1"
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                {isParsing
                  ? "Parsing receipt in the background. You can add everyone'snames now."
                  : "Receipt has not been parsed yet. Choose a photo and parse when ready."}
              </p>
            </div>
          )}
        </div>

        <div className="soft-card rounded-2xl p-5">
          <p className="mb-3 text-sm text-slate-700">
            People involved (names must be unique):
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
          disabled={people.length === 0 || !receipt || isParsing}
          className="primary-btn inline-flex items-center gap-2 px-5 py-3"
        >
          <AssignIcon />
          {receipt ? "Start assigning items" : "Waiting for parsed receipt"}
        </button>
      </div>
    );
  }

  function renderAssignStep() {
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
          <p className="text-sm text-slate-700">
            Wait for receipt parsing to finish before assigning items.
          </p>
          <button
            onClick={() => setStep("setup")}
            className="secondary-btn px-4 py-2"
          >
            Back to setup
          </button>
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
          <p className="text-sm text-slate-700">
            Add at least one person before assigning items.
          </p>
          <button
            onClick={() => setStep("setup")}
            className="secondary-btn px-4 py-2"
          >
            Back to setup
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
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={openHtmlReportPreview}
              className="secondary-btn px-4 py-2"
            >
              View HTML report
            </button>
            <button
              onClick={printHtmlReport}
              className="secondary-btn px-4 py-2"
            >
              Print report
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {totals.map((person) => (
            <div key={person.name} className="soft-card rounded-2xl p-5">
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
          Progress: Step {stepIndex(step)} of 3
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["setup", "assign", "results"] as Step[]).map((stepName) => {
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
          })}
        </div>
      </div>

      <section className="surface-panel rounded-3xl p-6 sm:p-8">
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {step === "setup" && renderSetupStep()}
        {step === "assign" && renderAssignStep()}
        {step === "results" && renderResultsStep()}
      </section>

      {reportHtmlPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-3 sm:p-6">
          <div className="w-full max-w-6xl rounded-2xl bg-white p-3 shadow-2xl sm:p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">
                HTML report preview
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={printHtmlReport}
                  className="secondary-btn px-3 py-2 text-sm"
                >
                  Print
                </button>
                <button
                  onClick={() => setReportHtmlPreview(null)}
                  className="secondary-btn px-3 py-2 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              title="Receipt split report preview"
              srcDoc={reportHtmlPreview}
              className="h-[72vh] w-full rounded-xl border border-slate-200 bg-white"
            />
          </div>
        </div>
      )}

      {isImagePreviewOpen && selectedImageUrl && file && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-3 sm:p-6"
          onClick={() => setIsImagePreviewOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-white p-3 shadow-2xl sm:p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-slate-700">
                {file.name}
              </p>
              <button
                type="button"
                onClick={() => setIsImagePreviewOpen(false)}
                className="secondary-btn px-3 py-2 text-sm"
              >
                Close
              </button>
            </div>
            <Image
              src={selectedImageUrl}
              alt={`Full-size selected receipt image: ${file.name}`}
              width={1600}
              height={2200}
              unoptimized
              className="max-h-[78vh] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
            />
          </div>
        </div>
      )}
    </main>
  );
}
