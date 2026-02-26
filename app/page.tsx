"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Alert from "@mui/material/Alert";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import {
  calculateSplitBreakdown,
  expandItemsToUnits,
  moneyFromCents,
} from "@/lib/split";
import {
  AssignableUnit,
  ChatClaimsPrefill,
  ClaimAssignment,
  ClaimConfidence,
  ParsedReceipt,
  SplitBreakdown,
} from "@/lib/types";
import { AiPrefillDialog } from "@/app/components/home/AiPrefillDialog";
import { AssignStep } from "@/app/components/home/AssignStep";
import { ClaimsStep } from "@/app/components/home/ClaimsStep";
import { ImagePreviewDialog } from "@/app/components/home/ImagePreviewDialog";
import { ProgressHeader } from "@/app/components/home/ProgressHeader";
import { ReportPreviewDialog } from "@/app/components/home/ReportPreviewDialog";
import { ResultsStep } from "@/app/components/home/ResultsStep";
import { SetupStep } from "@/app/components/home/SetupStep";
import {
  AIPrefillDetail,
  AssignMode,
  FollowUpAnswer,
  Step,
} from "@/app/components/home/types";

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
  const generatedAt = new Date(generatedAtIso).toLocaleString();

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

  const overviewRows = breakdown.personTotals
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
    @media (max-width: 800px) {
      body { padding: 10px; }
      .report { padding: 14px; }
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
    }
  </style>
</head>
<body>
  <div class="report">
    <h1>Receipt Split Report</h1>
    <p class="meta">Generated: ${escapeHtml(generatedAt)}</p>
    <p class="meta">Currency: ${escapeHtml(receipt.currency)}</p>
    ${receipt.restaurantName ? `<p class="meta">Restaurant: ${escapeHtml(receipt.restaurantName)}</p>` : ""}

    <h2>Overview</h2>
    <p class="meta">Subtotal: $${moneyFromCents(overallSubtotal)} • Tax: $${moneyFromCents(taxCents)} • Tip: $${moneyFromCents(tipCents)}</p>
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
      <tbody>${overviewRows}</tbody>
    </table>

    <h2>Unit-Level Math For Each Item</h2>
    <p class="meta">Each unit is split evenly among assigned people, then rounded to cents deterministically.</p>
    <table>
      <thead>
        <tr><th>Unit</th><th>Amount</th><th>Assigned People</th><th>Split Math</th></tr>
      </thead>
      <tbody>${unitRows}</tbody>
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
  const [isParsingChatClaims, setIsParsingChatClaims] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  const [chatScreenshots, setChatScreenshots] = useState<File[]>([]);
  const [chatClaimsContext, setChatClaimsContext] = useState("");
  const [chatScreenshotPreviewUrls, setChatScreenshotPreviewUrls] = useState<
    string[]
  >([]);
  const [chatClaimsPrefill, setChatClaimsPrefill] =
    useState<ChatClaimsPrefill | null>(null);
  const [chatFollowUpDraft, setChatFollowUpDraft] = useState<
    Record<string, string>
  >({});
  const [chatFollowUpHistory, setChatFollowUpHistory] = useState<
    FollowUpAnswer[]
  >([]);
  const [keptConfidenceLevels, setKeptConfidenceLevels] = useState<
    Record<ClaimConfidence, boolean>
  >({
    high: true,
    medium: true,
    low: true,
  });
  const [aiPrefillByUnit, setAiPrefillByUnit] = useState<
    Record<string, AIPrefillDetail>
  >({});
  const [isAiReasoningOpen, setIsAiReasoningOpen] = useState(false);
  const [lastAppliedClaimCount, setLastAppliedClaimCount] = useState(0);
  const [reportHtmlPreview, setReportHtmlPreview] = useState<string | null>(
    null,
  );
  const [assignPanelHeight, setAssignPanelHeight] = useState<number | null>(
    null,
  );
  const [editingItemRowIndex, setEditingItemRowIndex] = useState<number | null>(
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
  const currentSourceRowIndex = currentUnit?.sourceRowIndex ?? null;
  const currentSourceItem =
    currentSourceRowIndex === null || !receipt
      ? null
      : receipt.items[currentSourceRowIndex] ?? null;

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
  const firstUnitIndexByRow = useMemo(() => {
    const map = new Map<number, number>();
    units.forEach((unit, index) => {
      if (!map.has(unit.sourceRowIndex)) {
        map.set(unit.sourceRowIndex, index);
      }
    });
    return map;
  }, [units]);
  const assignmentSuggestions = useMemo(
    () =>
      chatClaimsPrefill?.suggestions.flatMap((suggestion) =>
        suggestion.assignments
          .filter(
            (assignment): assignment is ClaimAssignment & { person: string } =>
              assignment.status === "suggested" && typeof assignment.person === "string",
          )
          .map((assignment) => ({
            unitId: suggestion.unitId,
            person: assignment.person,
            confidence: assignment.confidence,
            reason: assignment.reason,
          })),
      ) ?? [],
    [chatClaimsPrefill],
  );
  const filteredAssignmentSuggestions = useMemo(
    () =>
      assignmentSuggestions.filter((assignment) =>
        keptConfidenceLevels[assignment.confidence],
      ),
    [assignmentSuggestions, keptConfidenceLevels],
  );
  const missingContextAssignments = useMemo(
    () =>
      chatClaimsPrefill?.suggestions.flatMap((suggestion) =>
        suggestion.assignments
          .filter((assignment) => assignment.status === "missing_context")
          .map((assignment) => ({
            unitId: suggestion.unitId,
            person: assignment.person,
            reason: assignment.reason,
          })),
      ) ?? [],
    [chatClaimsPrefill],
  );
  const currentUnitAIPrefill = currentUnit ? aiPrefillByUnit[currentUnit.id] : null;
  const currentPersonAIPrefills = useMemo(
    () =>
      units
        .map((unit) => ({
          unit,
          detail: aiPrefillByUnit[unit.id],
        }))
        .filter(
          (entry) =>
            !!entry.detail &&
            !!currentPerson &&
            entry.detail.assignments.some(
              (assignment) => assignment.person === currentPerson,
            ),
        ) as Array<{ unit: AssignableUnit; detail: AIPrefillDetail }>,
    [units, aiPrefillByUnit, currentPerson],
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
    if (!receipt || editingItemRowIndex === null) {
      return;
    }
    if (editingItemRowIndex >= receipt.items.length) {
      setEditingItemRowIndex(null);
    }
  }, [receipt, editingItemRowIndex]);

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
    const nextUrls = chatScreenshots.map((screenshot) =>
      URL.createObjectURL(screenshot),
    );
    setChatScreenshotPreviewUrls(nextUrls);

    return () => {
      nextUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [chatScreenshots]);

  useEffect(() => {
    if (!chatClaimsPrefill) {
      setChatFollowUpDraft({});
      return;
    }

    setChatFollowUpDraft((prev) => {
      const next: Record<string, string> = {};
      chatClaimsPrefill.followUpQuestions.forEach((question) => {
        next[question.id] = prev[question.id] ?? "";
      });
      return next;
    });
  }, [chatClaimsPrefill]);

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

  function resetChatPrefillState() {
    setChatClaimsPrefill(null);
    setChatFollowUpDraft({});
    setChatFollowUpHistory([]);
    setKeptConfidenceLevels({
      high: true,
      medium: true,
      low: true,
    });
    setLastAppliedClaimCount(0);
  }

  function clearReceiptData() {
    setReceipt(null);
    setUnits([]);
    setAssignments({});
    setTaxCents(0);
    setTipCents(0);
    setEditingItemRowIndex(null);
  }

  function clearChatClaimInputs() {
    setChatScreenshots([]);
    setChatClaimsContext("");
  }

  function clearAiClaimMetadata() {
    resetChatPrefillState();
    setAiPrefillByUnit({});
  }

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
      clearReceiptData();
      clearChatClaimInputs();
      clearAiClaimMetadata();
      setStep("setup");
    }
    if (!selected) {
      setIsImagePreviewOpen(false);
    }
    setError(null);
  }

  function removeSelectedFile() {
    setFile(null);
    clearReceiptData();
    clearChatClaimInputs();
    clearAiClaimMetadata();
    setStep("setup");
    setIsImagePreviewOpen(false);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function onChatScreenshotsChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((selectedFile) =>
      selectedFile.type.startsWith("image/"),
    );
    setChatScreenshots(files);
    resetChatPrefillState();
    setError(null);
  }

  function removeChatScreenshot(index: number) {
    setChatScreenshots((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
    resetChatPrefillState();
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
      clearReceiptData();
      clearAiClaimMetadata();
      setChatClaimsContext("");
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

  async function parseChatClaims(params?: { newFollowUpAnswers?: FollowUpAnswer[] }) {
    if (!receipt || units.length === 0) {
      setError("Parse your receipt before using chat claim pre-fill.");
      return;
    }
    if (people.length === 0) {
      setError("Add at least one person before using chat claim pre-fill.");
      return;
    }
    if (chatScreenshots.length === 0) {
      setError("Upload at least one group chat screenshot.");
      return;
    }

    const hasNewAnswers = (params?.newFollowUpAnswers?.length ?? 0) > 0;
    const nextHistory = hasNewAnswers
      ? [...chatFollowUpHistory, ...(params?.newFollowUpAnswers ?? [])]
      : [];
    const nextRound =
      hasNewAnswers && chatClaimsPrefill
        ? Math.min(chatClaimsPrefill.round + 1, chatClaimsPrefill.maxRounds)
        : 1;

    try {
      setIsParsingChatClaims(true);
      setError(null);
      setLastAppliedClaimCount(0);
      if (!hasNewAnswers) {
        setChatFollowUpHistory([]);
        setChatFollowUpDraft({});
      }

      const formData = new FormData();
      formData.append("people", JSON.stringify(people));
      formData.append(
        "units",
        JSON.stringify(
          units.map((unit) => ({
            id: unit.id,
            label: unit.label,
            amountCents: unit.amountCents,
          })),
        ),
      );
      if (chatClaimsContext.trim().length > 0) {
        formData.append("extraContext", chatClaimsContext.trim());
      }
      formData.append("round", String(nextRound));
      formData.append("followUpAnswers", JSON.stringify(nextHistory));
      chatScreenshots.forEach((screenshot) =>
        formData.append("screenshots", screenshot),
      );

      const res = await fetch("/api/parse-chat-claims", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Failed to parse chat screenshots.");
      }

      setChatClaimsPrefill(payload.prefill as ChatClaimsPrefill);
      if (hasNewAnswers) {
        setChatFollowUpHistory(nextHistory);
      }
      setKeptConfidenceLevels({
        high: true,
        medium: true,
        low: true,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to parse chat screenshots.",
      );
    } finally {
      setIsParsingChatClaims(false);
    }
  }

  function toggleConfidenceLevel(level: ClaimConfidence) {
    setKeptConfidenceLevels((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[level] && activeCount === 1) {
        return prev;
      }
      return {
        ...prev,
        [level]: !prev[level],
      };
    });
    setLastAppliedClaimCount(0);
  }

  function applyChatClaimPrefill() {
    if (!chatClaimsPrefill) {
      return;
    }

    const validUnitIds = new Set(units.map((unit) => unit.id));
    const validPeople = new Set(people);
    let appliedCount = 0;
    const nextAiPrefillByUnit: Record<string, AIPrefillDetail> = {};

    setAssignments((prev) => {
      const next = { ...prev };
      const assignmentsByUnit = new Map<string, Set<string>>();
      filteredAssignmentSuggestions.forEach((suggestion) => {
        if (!validUnitIds.has(suggestion.unitId) || !validPeople.has(suggestion.person)) {
          return;
        }
        if (!assignmentsByUnit.has(suggestion.unitId)) {
          assignmentsByUnit.set(suggestion.unitId, new Set());
        }
        assignmentsByUnit.get(suggestion.unitId)?.add(suggestion.person);
      });

      assignmentsByUnit.forEach((peopleForUnit, unitId) => {
        const filteredPeople = Array.from(peopleForUnit);
        if (filteredPeople.length === 0) {
          return;
        }
        next[unitId] = filteredPeople;
        appliedCount += filteredPeople.length;
      });
      return next;
    });

    chatClaimsPrefill.suggestions.forEach((suggestion) => {
      if (!validUnitIds.has(suggestion.unitId)) {
        return;
      }
      const suggestedAssignments = suggestion.assignments
        .filter(
          (assignment): assignment is ClaimAssignment & { person: string } =>
            assignment.status === "suggested" &&
            typeof assignment.person === "string" &&
            validPeople.has(assignment.person) &&
            keptConfidenceLevels[assignment.confidence],
        )
        .map((assignment) => ({
          person: assignment.person,
          confidence: assignment.confidence,
          reason: assignment.reason,
        }));
      const missingContext = suggestion.assignments
        .filter((assignment) => assignment.status === "missing_context")
        .map((assignment) =>
          assignment.person ? `${assignment.person}: ${assignment.reason}` : assignment.reason,
        );
      if (suggestedAssignments.length === 0 && missingContext.length === 0) {
        return;
      }
      nextAiPrefillByUnit[suggestion.unitId] = {
        assignments: suggestedAssignments,
        missingContext,
        reason: suggestion.reason,
      };
    });

    setAiPrefillByUnit((prev) => ({
      ...prev,
      ...nextAiPrefillByUnit,
    }));
    setLastAppliedClaimCount(appliedCount);
    setError(null);
  }

  async function submitFollowUpAnswers() {
    if (!chatClaimsPrefill || chatClaimsPrefill.followUpQuestions.length === 0) {
      return;
    }

    const newAnswers = chatClaimsPrefill.followUpQuestions.map((question) => ({
      id: question.id,
      question: question.question,
      answer: (chatFollowUpDraft[question.id] ?? "").trim(),
    }));
    const missing = newAnswers.some((answer) => answer.answer.length === 0);
    if (missing) {
      setError("Answer each follow-up question before rerunning AI prefill.");
      return;
    }

    await parseChatClaims({ newFollowUpAnswers: newAnswers });
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
    resetChatPrefillState();
    setIsAiReasoningOpen(false);
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
    resetChatPrefillState();
    setAiPrefillByUnit((prev) => {
      const next: Record<string, AIPrefillDetail> = {};
      Object.entries(prev).forEach(([unitId, detail]) => {
        const nextAssignments = detail.assignments.filter(
          (assignment) => assignment.person !== name,
        );
        if (nextAssignments.length > 0 || detail.missingContext.length > 0) {
          next[unitId] = { ...detail, assignments: nextAssignments };
        }
      });
      return next;
    });
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

  function updateReceiptItem(
    rowIndex: number,
    updates: Partial<ParsedReceipt["items"][number]>,
  ) {
    setReceipt((prev) => {
      if (!prev || !prev.items[rowIndex]) {
        return prev;
      }

      const nextItems = prev.items.map((item, index) =>
        index === rowIndex ? { ...item, ...updates } : item,
      );
      const nextReceipt = { ...prev, items: nextItems };
      const nextUnits = expandItemsToUnits(nextReceipt);
      setUnits(nextUnits);
      resetChatPrefillState();
      setAiPrefillByUnit((prevPrefill) => {
        const validUnitIds = new Set(nextUnits.map((unit) => unit.id));
        const nextPrefill: Record<string, AIPrefillDetail> = {};
        Object.entries(prevPrefill).forEach(([unitId, detail]) => {
          if (validUnitIds.has(unitId)) {
            nextPrefill[unitId] = detail;
          }
        });
        return nextPrefill;
      });
      setAssignments((prevAssignments) => {
        const validUnitIds = new Set(nextUnits.map((unit) => unit.id));
        const nextAssignments: Record<string, string[]> = {};
        Object.entries(prevAssignments).forEach(([unitId, names]) => {
          if (validUnitIds.has(unitId)) {
            nextAssignments[unitId] = names;
          }
        });
        return nextAssignments;
      });
      return nextReceipt;
    });
  }

  function jumpToItemRow(rowIndex: number, enableEdit = false) {
    const unitIndex = firstUnitIndexByRow.get(rowIndex);
    if (unitIndex === undefined) {
      return;
    }
    setAssignMode("byItem");
    setCurrentUnitIndex(unitIndex);
    if (enableEdit) {
      setEditingItemRowIndex(rowIndex);
    }
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

  return (
    <Container maxWidth="lg" sx={{ minHeight: "100vh", py: { xs: 4, sm: 6 } }}>
      <ProgressHeader step={step} setStep={setStep} />

      <Paper className="surface-panel" sx={{ borderRadius: 4, p: { xs: 3, sm: 4 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {step === "setup" && (
          <SetupStep
            state={{
              file,
              selectedImageUrl,
              isParsing,
              people,
              newPerson,
              receipt,
              units,
              overallSubtotal,
              taxCents,
              tipCents,
              editingItemRowIndex,
            }}
            refs={{
              fileInputRef,
              newPersonInputRef,
            }}
            actions={{
              onFileChange,
              removeSelectedFile,
              parseReceipt,
              onAddPersonSubmit,
              setNewPerson,
              removePerson,
              setTaxCents,
              setTipCents,
              updateReceiptItem,
              setEditingItemRowIndex,
              openImagePreview: () => setIsImagePreviewOpen(true),
            }}
            goToClaims={() => setStep("claims")}
          />
        )}
        {step === "claims" && (
          <ClaimsStep
            receiptReady={!!receipt && units.length > 0}
            peopleCount={people.length}
            units={units}
            chatScreenshots={chatScreenshots}
            chatScreenshotPreviewUrls={chatScreenshotPreviewUrls}
            chatClaimsContext={chatClaimsContext}
            isParsingChatClaims={isParsingChatClaims}
            chatClaimsPrefill={chatClaimsPrefill}
            assignmentSuggestions={assignmentSuggestions}
            filteredAssignmentSuggestions={filteredAssignmentSuggestions}
            missingContextAssignments={missingContextAssignments}
            keptConfidenceLevels={keptConfidenceLevels}
            chatFollowUpDraft={chatFollowUpDraft}
            lastAppliedClaimCount={lastAppliedClaimCount}
            goToSetup={() => setStep("setup")}
            goToAssign={() => setStep("assign")}
            onChatScreenshotsChange={onChatScreenshotsChange}
            setChatClaimsContext={setChatClaimsContext}
            removeChatScreenshot={removeChatScreenshot}
            parseChatClaims={() => parseChatClaims()}
            toggleConfidenceLevel={toggleConfidenceLevel}
            setChatFollowUpDraft={setChatFollowUpDraft}
            submitFollowUpAnswers={submitFollowUpAnswers}
            applyChatClaimPrefill={applyChatClaimPrefill}
          />
        )}
        {step === "assign" && (
          <AssignStep
            state={{
              receipt,
              units,
              people,
              assignments,
              assignMode,
              currentUnitIndex,
              currentPersonIndex,
              currentUnit,
              currentPerson,
              currentAssignedPeople,
              currentSourceRowIndex,
              currentSourceItem,
              currentUnitAIPrefill,
              currentPersonAIPrefills,
              editingItemRowIndex,
              allItemsAssigned,
              assignPanelHeight,
            }}
            actions={{
              setAssignMode,
              setCurrentUnitIndex,
              setCurrentPersonIndex,
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
              openAiReasoning: () => setIsAiReasoningOpen(true),
            }}
            navigation={{
              goToSetup: () => setStep("setup"),
              goToResults: () => setStep("results"),
            }}
            assignContentPanelRef={assignContentPanelRef}
          />
        )}
        {step === "results" && (
          <ResultsStep
            overallSubtotal={overallSubtotal}
            taxCents={taxCents}
            tipCents={tipCents}
            totals={totals}
            openHtmlReportPreview={openHtmlReportPreview}
          />
        )}
      </Paper>

      <AiPrefillDialog
        open={isAiReasoningOpen && step === "assign"}
        assignMode={assignMode}
        currentUnit={currentUnit}
        currentPerson={currentPerson}
        currentUnitAIPrefill={currentUnitAIPrefill}
        currentPersonAIPrefills={currentPersonAIPrefills}
        onClose={() => setIsAiReasoningOpen(false)}
      />
      <ReportPreviewDialog
        reportHtmlPreview={reportHtmlPreview}
        onPrint={printHtmlReport}
        onClose={() => setReportHtmlPreview(null)}
      />
      <ImagePreviewDialog
        open={isImagePreviewOpen && !!selectedImageUrl && !!file}
        selectedImageUrl={selectedImageUrl}
        file={file}
        onClose={() => setIsImagePreviewOpen(false)}
      />
    </Container>
  );
}
