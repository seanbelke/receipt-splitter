"use client";

import Image from "next/image";
import {
  CSSProperties,
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
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

type Step = "setup" | "claims" | "assign" | "results";
type AssignMode = "byItem" | "byPerson";
type AIPrefillDetail = {
  assignments: Array<{
    person: string;
    confidence: ClaimConfidence;
    reason: string;
  }>;
  missingContext: string[];
  reason: string;
};
type FollowUpAnswer = {
  id: string;
  question: string;
  answer: string;
};

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

function stepIndex(step: Step): number {
  return { setup: 1, claims: 2, assign: 3, results: 4 }[step];
}

const STEP_ORDER: Step[] = ["setup", "claims", "assign", "results"];

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

function ChatIcon({ className = "h-4 w-4" }: IconProps) {
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
        d="M6.5 17.5H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2.5"
      />
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 20v-2.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2V22l-4-2H10a2 2 0 0 1-2-2.5Z"
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

function EditIcon({ className = "h-4 w-4" }: IconProps) {
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
        d="M4 20h4l10-10a2 2 0 0 0-4-4L4 16v4Z"
      />
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 8 4 4"
      />
    </svg>
  );
}

function CheckIcon({ className = "h-4 w-4" }: IconProps) {
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
        d="m5 13 4 4L19 7"
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
      setEditingItemRowIndex(null);
      setChatScreenshots([]);
      setChatClaimsContext("");
      resetChatPrefillState();
      setAiPrefillByUnit({});
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
    setEditingItemRowIndex(null);
    setChatScreenshots([]);
    setChatClaimsContext("");
    resetChatPrefillState();
    setAiPrefillByUnit({});
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
      setReceipt(null);
      setUnits([]);
      setAssignments({});
      setTaxCents(0);
      setTipCents(0);
      setEditingItemRowIndex(null);
      resetChatPrefillState();
      setAiPrefillByUnit({});
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

  function toCents(value: string): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }
    return Math.round(numeric * 100);
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
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-slate-900">
              Upload a receipt
            </h3>
            <hr className="border-slate-200/90" />
          </div>

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
              <Button
                type="button"
                onClick={() => setIsImagePreviewOpen(true)}
                className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 text-left transition hover:bg-slate-100/80"
                sx={{
                  minWidth: 0,
                  justifyContent: "flex-start",
                  textTransform: "none",
                }}
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
              </Button>
              <Button
                type="button"
                onClick={removeSelectedFile}
                aria-label="Remove selected image"
                title="Remove selected image"
                className="secondary-btn shrink-0 p-2.5 text-slate-600"
                sx={{ minWidth: 0 }}
              >
                <TrashIcon />
              </Button>
            </div>
          )}

          <Button
            type="submit"
            disabled={!file || isParsing}
            aria-busy={isParsing}
            className="primary-btn parse-receipt-btn inline-flex items-center gap-2 px-5 py-3"
          >
            {isParsing ? (
              <>
                <CircularProgress color="inherit" size={16} />
                <span className="inline-flex items-center">
                  Parsing receipt
                </span>
              </>
            ) : (
              <>
                <UploadIcon />
                Parse receipt
              </>
            )}
          </Button>
        </form>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">
            Add everyone&apos;s names
          </h3>
          <hr className="border-slate-200/90" />
        </div>

        <div className="soft-card rounded-2xl p-5">
          <p className="mb-3 text-sm text-slate-700">
            People involved (names must be unique):
          </p>
          <div className="flex flex-wrap gap-2">
            {people.map((person) => (
              <Button
                key={person}
                onClick={() => removePerson(person)}
                className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-900 transition hover:bg-rose-50 hover:text-rose-900"
              >
                {person} ×
              </Button>
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
            <Button
              type="submit"
              className="secondary-btn inline-flex items-center gap-2 px-4 py-2"
            >
              <UsersIcon />
              Add person
            </Button>
          </form>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">
            Preview parsed receipt
          </h3>
          <hr className="border-slate-200/90" />
        </div>

        <section className="space-y-3">
          {receipt ? (
            <>
              <p className="text-sm text-slate-700">
                Parsed {receipt.items.length} rows into {units.length}{" "}
                assignable units. Currency: {receipt.currency}.
              </p>
              <div className="space-y-1 text-sm text-slate-600">
                <p>Subtotal: ${moneyFromCents(overallSubtotal)}</p>
                <p>Tax: ${moneyFromCents(taxCents)}</p>
                <p>Tip: ${moneyFromCents(tipCents)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-300">
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Item
                      </th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">
                        Qty
                      </th>
                      <th className="px-3 py-2 text-right font-semibold text-slate-700">
                        Row total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((item, index) => {
                      const isEditing = editingItemRowIndex === index;
                      return (
                        <tr
                          key={`${item.name}-${index}`}
                          className="border-b border-slate-200"
                        >
                          <td className="px-3 py-2 text-slate-800">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.name}
                                readOnly={!isEditing}
                                onChange={(event) =>
                                  updateReceiptItem(index, {
                                    name: event.target.value,
                                  })
                                }
                                className={`w-full rounded-md border px-2 py-1 ${
                                  isEditing
                                    ? "border-slate-300 bg-white"
                                    : "border-transparent bg-transparent"
                                }`}
                              />
                              <Button
                                type="button"
                                onClick={() =>
                                  setEditingItemRowIndex(isEditing ? null : index)
                                }
                                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                                aria-label={
                                  isEditing ? "Done editing item" : "Edit item"
                                }
                                title={isEditing ? "Done" : "Edit name/price"}
                              >
                                {isEditing ? <CheckIcon /> : <EditIcon />}
                              </Button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {item.quantity}
                          </td>
                          <td className="mono px-3 py-2 text-right text-slate-700">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={(item.totalPriceCents / 100).toFixed(2)}
                              readOnly={!isEditing}
                              onChange={(event) =>
                                updateReceiptItem(index, {
                                  totalPriceCents: toCents(event.target.value),
                                })
                              }
                              className={`mono w-28 rounded-md border px-2 py-1 text-right ${
                                isEditing
                                  ? "border-slate-300 bg-white"
                                  : "border-transparent bg-transparent"
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-700">
              {isParsing
                ? "Parsing receipt in the background. You can add everyone's names now."
                : "Receipt has not been parsed yet. Choose a photo and parse when ready."}
            </p>
          )}
        </section>

        <Button
          onClick={() => setStep("claims")}
          disabled={people.length === 0 || !receipt || isParsing}
          className="primary-btn inline-flex items-center gap-2 px-5 py-3"
        >
          <ChatIcon />
          {receipt ? "Continue to chat claims pre-fill" : "Waiting for parsed receipt"}
        </Button>
      </div>
    );
  }

  function renderClaimsStep() {
    if (!receipt || units.length === 0) {
      return (
        <div className="space-y-4">
          <p className="step-kicker flex items-center gap-2">
            <span className="icon-badge">
              <ChatIcon />
            </span>
            Step 2
          </p>
          <h2 className="text-3xl font-semibold">Pre-fill from chat claims.</h2>
          <p className="text-sm text-slate-700">
            Parse your receipt first so chat screenshots can map to real receipt items.
          </p>
          <Button
            onClick={() => setStep("setup")}
            className="secondary-btn px-4 py-2"
          >
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
              <ChatIcon />
            </span>
            Step 2
          </p>
          <h2 className="text-3xl font-semibold">Pre-fill from chat claims.</h2>
          <p className="text-sm text-slate-700">
            Add at least one person before pre-filling from chat screenshots.
          </p>
          <Button
            onClick={() => setStep("setup")}
            className="secondary-btn px-4 py-2"
          >
            Back to setup
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-7">
        <div>
          <p className="step-kicker flex items-center gap-2">
            <span className="icon-badge">
              <ChatIcon />
            </span>
            Step 2
          </p>
          <h2 className="mt-2 text-3xl font-semibold">
            Pre-fill from group chat screenshots.
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Optional: upload screenshots where people claimed items. We&apos;ll suggest
            assignments you can apply before manual review.
          </p>
        </div>

        <label className="block rounded-2xl border border-dashed border-slate-400/70 bg-white/90 p-6">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Group chat screenshots
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onChatScreenshotsChange}
            className="sr-only"
            id="chat-screenshots-input"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label
              htmlFor="chat-screenshots-input"
              className="file-picker-btn inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              <UploadIcon />
              {chatScreenshots.length > 0 ? "Replace screenshots" : "Choose screenshots"}
            </label>
            <span className="text-sm text-slate-500">
              {chatScreenshots.length > 0
                ? `${chatScreenshots.length} selected`
                : "No screenshots selected"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Include messages where people claimed specific items or shares.
          </p>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">
            Extra context for the AI (optional)
          </span>
          <textarea
            value={chatClaimsContext}
            onChange={(event) => setChatClaimsContext(event.target.value)}
            rows={4}
            placeholder={`Examples:\n- I am [name]\n- '[nickname]' is [full name]\n- [name] got [item]`}
            className="input-field min-h-28 resize-y"
          />
          <p className="text-xs text-slate-500">
            Use this to clarify identities, nicknames, or extra item claims not obvious from screenshots.
          </p>
        </label>

        {chatScreenshots.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {chatScreenshots.map((screenshot, index) => (
              <div
                key={`${screenshot.name}-${index}`}
                className="soft-card flex items-center gap-3 rounded-xl p-2"
              >
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {chatScreenshotPreviewUrls[index] ? (
                    <Image
                      src={chatScreenshotPreviewUrls[index]}
                      alt={`Chat screenshot ${index + 1}`}
                      width={56}
                      height={56}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {screenshot.name}
                  </p>
                  <p className="mono text-xs text-slate-500">
                    {Math.round(screenshot.size / 1024)} KB
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => removeChatScreenshot(index)}
                  className="secondary-btn p-2 text-slate-600"
                  aria-label="Remove screenshot"
                  title="Remove screenshot"
                >
                  <TrashIcon />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              void parseChatClaims();
            }}
            disabled={chatScreenshots.length === 0 || isParsingChatClaims}
            aria-busy={isParsingChatClaims}
            className={`inline-flex items-center gap-2 px-4 py-2 ${
              isParsingChatClaims ? "primary-btn analyze-chat-btn" : "secondary-btn"
            }`}
          >
            {isParsingChatClaims ? (
              <>
                <CircularProgress color="inherit" size={16} />
                <span>Analyzing screenshots</span>
              </>
            ) : (
              <>
                <ChatIcon />
                Analyze screenshots
              </>
            )}
          </Button>
          <Button
            type="button"
            onClick={() => setStep("assign")}
            className="secondary-btn px-4 py-2"
          >
            Skip for now
          </Button>
        </div>

        {chatClaimsPrefill && (
          <div className="space-y-3">
            <div className="soft-card rounded-2xl p-4">
              <p className="text-sm text-slate-700">
                Suggested assignments: {assignmentSuggestions.length} total,{" "}
                {filteredAssignmentSuggestions.length} selected to apply.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Clarification round {chatClaimsPrefill.round} of {chatClaimsPrefill.maxRounds}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["high", "medium", "low"] as const).map((level) => {
                  const selected = keptConfidenceLevels[level];
                  return (
                    <Button
                      key={level}
                      type="button"
                      onClick={() => toggleConfidenceLevel(level)}
                      className={`rounded-full px-3 py-1 text-xs font-medium uppercase transition ${
                        selected
                          ? "bg-teal-700 text-white"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      {selected ? "Keep" : "Drop"} {level}
                    </Button>
                  );
                })}
              </div>
              {chatClaimsPrefill.unmatchedNotes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {chatClaimsPrefill.unmatchedNotes.map((note, index) => (
                    <li key={`${note}-${index}`}>{note}</li>
                  ))}
                </ul>
              )}
              {missingContextAssignments.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {missingContextAssignments.map((entry, index) => {
                    const unit = units.find((candidate) => candidate.id === entry.unitId);
                    const unitLabel = unit
                      ? `${unit.label} ($${moneyFromCents(unit.amountCents)})`
                      : entry.unitId;
                    const subject = entry.person ? `${entry.person} @ ${unitLabel}` : unitLabel;
                    return <li key={`${subject}-${index}`}>{subject}: {entry.reason}</li>;
                  })}
                </ul>
              )}
            </div>

            {chatClaimsPrefill.followUpQuestions.length > 0 && (
              <div className="soft-card rounded-2xl p-4">
                <p className="text-sm font-medium text-slate-800">
                  Answer these follow-up questions to improve assignment quality.
                </p>
                <div className="mt-3 space-y-3">
                  {chatClaimsPrefill.followUpQuestions.map((entry) => (
                    <label key={entry.id} className="block space-y-1">
                      <span className="text-sm font-medium text-slate-800">
                        {entry.question}
                      </span>
                      <span className="block text-xs text-slate-500">{entry.why}</span>
                      <textarea
                        rows={2}
                        value={chatFollowUpDraft[entry.id] ?? ""}
                        onChange={(event) =>
                          setChatFollowUpDraft((prev) => ({
                            ...prev,
                            [entry.id]: event.target.value,
                          }))
                        }
                        className="input-field min-h-20 resize-y"
                        placeholder="Type your answer"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={submitFollowUpAnswers}
                    disabled={isParsingChatClaims}
                    className="secondary-btn px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Submit answers and rerun AI
                  </Button>
                  <p className="text-xs text-slate-500">
                    {chatClaimsPrefill.maxRounds - chatClaimsPrefill.round} follow-up round
                    {chatClaimsPrefill.maxRounds - chatClaimsPrefill.round === 1 ? "" : "s"} remaining.
                  </p>
                </div>
              </div>
            )}

            {filteredAssignmentSuggestions.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-300">
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Unit
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Suggested assignment
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Confidence
                        </th>
                        <th className="px-3 py-2 text-left font-semibold text-slate-700">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssignmentSuggestions.map((suggestion, index) => {
                        const unit = units.find((candidate) => candidate.id === suggestion.unitId);
                        return (
                          <tr
                            key={`${suggestion.unitId}-${suggestion.person}-${index}`}
                            className="border-b border-slate-200"
                          >
                            <td className="px-3 py-2 text-slate-800">
                              {unit
                                ? `${unit.label} ($${moneyFromCents(unit.amountCents)})`
                                : suggestion.unitId}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{suggestion.person}</td>
                            <td className="px-3 py-2 text-slate-700 capitalize">
                              {suggestion.confidence}
                            </td>
                            <td className="px-3 py-2 text-slate-600">{suggestion.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={applyChatClaimPrefill}
                    disabled={filteredAssignmentSuggestions.length === 0}
                    className="primary-btn px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Apply suggestions
                  </Button>
                  {lastAppliedClaimCount > 0 && (
                    <p className="text-sm text-slate-700">
                      Applied {lastAppliedClaimCount} assignment
                      {lastAppliedClaimCount === 1 ? "" : "s"}.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-700">
                No assignment suggestions match your selected confidence levels.
              </p>
            )}
            <p className="text-xs text-slate-500">{chatClaimsPrefill.stopReason}</p>
          </div>
        )}

        <Button
          onClick={() => setStep("assign")}
          className="primary-btn inline-flex items-center gap-2 px-5 py-3"
        >
          <AssignIcon />
          Continue to assignment
        </Button>
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
          <Button
            onClick={() => setStep("setup")}
            className="secondary-btn px-4 py-2"
          >
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
          <p className="text-sm text-slate-700">
            Add at least one person before assigning items.
          </p>
          <Button
            onClick={() => setStep("setup")}
            className="secondary-btn px-4 py-2"
          >
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
    const unassignedUnitCount = units.filter(
      (unit) => (assignments[unit.id] ?? []).length === 0,
    ).length;
    const isByItem = assignMode === "byItem";
    const hasAiPrefillInCurrentContext = isByItem
      ? !!currentUnitAIPrefill
      : currentPersonAIPrefills.length > 0;
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
            <Button
              onClick={() => setAssignMode("byItem")}
              className={`rounded-lg px-4 py-2 text-sm transition ${
                assignMode === "byItem"
                  ? "bg-teal-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200"
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
              onClick={() => setIsAiReasoningOpen(true)}
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
                <Button
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
                </Button>
              ))}
            </div>
          </aside>

          {isByItem ? (
            <div
              ref={assignContentPanelRef}
              className="soft-card rounded-2xl p-6 lg:min-h-[32rem] lg:self-start"
            >
              <p className="text-sm text-slate-500">Current item</p>
              {currentSourceItem ? (
                <div className="mt-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={currentSourceItem.name}
                      readOnly={editingItemRowIndex !== currentSourceRowIndex}
                      onChange={(event) =>
                        updateReceiptItem(currentSourceRowIndex, {
                          name: event.target.value,
                        })
                      }
                      className={`w-full rounded-md border px-2 py-1 text-2xl font-semibold ${
                        editingItemRowIndex === currentSourceRowIndex
                          ? "border-slate-300 bg-white"
                          : "border-transparent bg-transparent"
                      }`}
                    />
                    <Button
                      type="button"
                      onClick={() =>
                        setEditingItemRowIndex(
                          editingItemRowIndex === currentSourceRowIndex
                            ? null
                            : currentSourceRowIndex,
                        )
                      }
                      className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={
                        editingItemRowIndex === currentSourceRowIndex
                          ? "Done editing item"
                          : "Edit item"
                      }
                      title="Edit name/price"
                    >
                      {editingItemRowIndex === currentSourceRowIndex ? (
                        <CheckIcon />
                      ) : (
                        <EditIcon />
                      )}
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
                          updateReceiptItem(currentSourceRowIndex, {
                            totalPriceCents: toCents(event.target.value),
                          })
                        }
                        className={`mono ml-2 w-28 rounded-md border px-2 py-1 text-right ${
                          editingItemRowIndex === currentSourceRowIndex
                            ? "border-slate-300 bg-white"
                            : "border-transparent bg-transparent"
                        }`}
                      />
                    </label>
                    <p className="text-sm text-slate-600">
                      Qty: {currentSourceItem.quantity}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="mt-1 text-2xl font-semibold">
                    {currentUnit.label}
                  </h3>
                  <p className="mono mt-1 text-lg">
                    ${moneyFromCents(currentUnit.amountCents)}
                  </p>
                </>
              )}
              <p className="mono mt-1 text-lg">
                Unit amount: ${moneyFromCents(currentUnit.amountCents)}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {people.map((person) => {
                  const selected = currentAssignedPeople.includes(person);
                  return (
                    <Button
                      key={person}
                      onClick={() => togglePersonForCurrentUnit(person)}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        selected
                          ? "bg-teal-700 text-white"
                          : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                      }`}
                    >
                      {person}
                    </Button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={selectAllForCurrentUnit}
                  className="secondary-btn px-3 py-2 text-sm text-teal-900"
                >
                  Select all
                </Button>
                <Button
                  onClick={clearForCurrentUnit}
                  className="secondary-btn px-3 py-2 text-sm text-slate-700"
                >
                  Clear
                </Button>
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
              <p className="mt-1 text-sm text-slate-700">
                Unassigned units remaining: {unassignedUnitCount}
              </p>

              <div className="mt-5 grid gap-2">
                {units.map((unit) => {
                  const assignedPeopleForUnit = assignments[unit.id] ?? [];
                  const selected = assignedPeopleForUnit.includes(currentPerson);
                  const assignedCount = assignedPeopleForUnit.length;
                  const claimedByOthers = !selected && assignedCount > 0;
                  const coverageTone = getAssignmentCoverageTone(
                    assignedCount,
                    people.length,
                  );
                  const statusLabel =
                    assignedCount === 0
                      ? "Unassigned"
                      : `Assigned to ${assignedCount}: ${assignedPeopleForUnit.join(", ")}`;
                  return (
                    <div
                      key={unit.id}
                      className="flex items-center gap-2"
                    >
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
                          <span className="mono">
                            ${moneyFromCents(unit.amountCents)}
                          </span>
                        </span>
                        <span
                          style={
                            selected
                              ? undefined
                              : claimedByOthers
                                ? coverageTone.statusStyle
                                : undefined
                          }
                          className={`mt-1 text-xs ${
                            selected
                              ? "text-teal-50"
                              : claimedByOthers
                                ? coverageTone.statusClass
                                : "text-slate-500"
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
                <Button
                  onClick={selectAllItemsForCurrentPerson}
                  className="secondary-btn px-3 py-2 text-sm text-teal-900"
                >
                  Select all items
                </Button>
                <Button
                  onClick={clearAllItemsForCurrentPerson}
                  className="secondary-btn px-3 py-2 text-sm text-slate-700"
                >
                  Clear all items
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
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
          </Button>
          <Button
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
          </Button>
          <Button
            onClick={() => setStep("results")}
            disabled={!allItemsAssigned}
            className="primary-btn inline-flex items-center gap-2 px-4 py-2"
          >
            <ResultIcon />
            See results
          </Button>
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
            <Button
              onClick={openHtmlReportPreview}
              className="secondary-btn px-4 py-2"
            >
              View HTML report
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="px-3 py-2 text-left font-semibold text-slate-700">
                  Person
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                  Food subtotal
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                  Tax share
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                  Tip share
                </th>
                <th className="px-3 py-2 text-right font-semibold text-slate-700">
                  Total owed
                </th>
              </tr>
            </thead>
            <tbody>
              {totals.map((person) => (
                <tr key={person.name} className="border-b border-slate-200">
                  <td className="px-3 py-2 text-slate-800">{person.name}</td>
                  <td className="mono px-3 py-2 text-right text-slate-700">
                    ${moneyFromCents(person.subtotalCents)}
                  </td>
                  <td className="mono px-3 py-2 text-right text-slate-700">
                    ${moneyFromCents(person.taxShareCents)}
                  </td>
                  <td className="mono px-3 py-2 text-right text-slate-700">
                    ${moneyFromCents(person.tipShareCents)}
                  </td>
                  <td className="mono px-3 py-2 text-right font-semibold text-slate-900">
                    ${moneyFromCents(person.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ minHeight: "100vh", py: { xs: 4, sm: 6 } }}>
      <Stack spacing={3} sx={{ mb: 4 }}>
        <Typography className="mono" variant="overline" color="text.secondary" sx={{ letterSpacing: "0.18em" }}>
          Receipt Splitter
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Progress: Step {stepIndex(step)} of 4
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {STEP_ORDER.map((stepName) => {
            const isCurrent = stepName === step;
            const isDone = stepIndex(stepName) < stepIndex(step);
            const canGoToStep = isDone;
            return (
              <Chip
                key={stepName}
                label={stepName}
                onClick={
                  canGoToStep
                    ? () => {
                        setStep(stepName);
                      }
                    : undefined
                }
                clickable={canGoToStep}
                aria-current={isCurrent ? "step" : undefined}
                sx={{
                  textTransform: "capitalize",
                  fontWeight: 600,
                  ...(isCurrent
                    ? {
                        bgcolor: "primary.main",
                        color: "common.white",
                      }
                    : isDone
                      ? {
                          bgcolor: "primary.50",
                          color: "primary.dark",
                        }
                      : {
                          bgcolor: "grey.200",
                          color: "text.secondary",
                        }),
                }}
              />
            );
          })}
        </Stack>
      </Stack>

      <Paper className="surface-panel" sx={{ borderRadius: 4, p: { xs: 3, sm: 4 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {step === "setup" && renderSetupStep()}
        {step === "claims" && renderClaimsStep()}
        {step === "assign" && renderAssignStep()}
        {step === "results" && renderResultsStep()}
      </Paper>

      <Dialog
        open={isAiReasoningOpen && step === "assign"}
        onClose={() => setIsAiReasoningOpen(false)}
        fullWidth
        maxWidth="md"
      >
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
                            {assignment.person}{" "}
                            <span className="capitalize text-slate-500">
                              ({assignment.confidence})
                            </span>
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
                <p className="text-sm text-slate-700">
                  No AI prefill details for the current item.
                </p>
              )
            ) : currentPerson ? (
              currentPersonAIPrefills.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-800">
                    AI prefill entries for <span className="font-medium">{currentPerson}</span>
                  </p>
                  <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                    {currentPersonAIPrefills.map(({ unit, detail }) => (
                      detail.assignments
                        .filter((assignment) => assignment.person === currentPerson)
                        .map((assignment) => (
                          <div
                            key={`${unit.id}-${assignment.reason}`}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                          >
                            <p className="font-medium text-slate-900">
                              {unit.label} (${moneyFromCents(unit.amountCents)})
                            </p>
                            <p className="mt-1 capitalize text-slate-700">
                              Confidence: {assignment.confidence}
                            </p>
                            <p className="mt-1 text-slate-600">{assignment.reason}</p>
                          </div>
                        ))
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-700">
                  No AI prefill details for the current person.
                </p>
              )
            ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAiReasoningOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!reportHtmlPreview}
        onClose={() => setReportHtmlPreview(null)}
        fullWidth
        maxWidth="xl"
      >
        <DialogTitle>HTML report preview</DialogTitle>
        <DialogContent dividers>
            <iframe
              title="Receipt split report preview"
              srcDoc={reportHtmlPreview ?? undefined}
              className="h-[72vh] w-full rounded-xl border border-slate-200 bg-white"
            />
        </DialogContent>
        <DialogActions>
          <Button onClick={printHtmlReport}>Print</Button>
          <Button onClick={() => setReportHtmlPreview(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isImagePreviewOpen && !!selectedImageUrl && !!file}
        onClose={() => setIsImagePreviewOpen(false)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ pr: 10 }}>
          <Typography variant="subtitle2" noWrap>
            {file?.name}
          </Typography>
        </DialogTitle>
        <DialogActions sx={{ px: 3, pt: 0 }}>
          <Button onClick={() => setIsImagePreviewOpen(false)}>Close</Button>
        </DialogActions>
        <DialogContent>
          {selectedImageUrl && file ? (
            <Image
              src={selectedImageUrl}
              alt={`Full-size selected receipt image: ${file.name}`}
              width={1600}
              height={2200}
              unoptimized
              className="max-h-[78vh] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
