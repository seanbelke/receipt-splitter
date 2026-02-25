export type ParsedReceiptItem = {
  name: string;
  quantity: number;
  totalPriceCents: number;
};

export type ParsedReceipt = {
  restaurantName?: string | null;
  currency: string;
  items: ParsedReceiptItem[];
  taxCents: number;
  tipCents: number;
};

export type AssignableUnit = {
  id: string;
  label: string;
  amountCents: number;
  sourceItemName: string;
  sourceRowIndex: number;
  unitIndex: number;
};

export type PersonTotal = {
  name: string;
  subtotalCents: number;
  taxShareCents: number;
  tipShareCents: number;
  totalCents: number;
};

export type NamedCents = {
  name: string;
  amountCents: number;
};

export type UnitAllocationBreakdown = {
  unitId: string;
  label: string;
  amountCents: number;
  assignedPeople: string[];
  perPersonShares: NamedCents[];
};

export type SplitBreakdown = {
  personTotals: PersonTotal[];
  unitAllocations: UnitAllocationBreakdown[];
  subtotalShares: NamedCents[];
  taxShares: NamedCents[];
  tipShares: NamedCents[];
};

export type ClaimConfidence = "high" | "medium" | "low";

export type ClaimAssignmentStatus = "suggested" | "missing_context";

export type ClaimAssignment = {
  person: string | null;
  confidence: ClaimConfidence;
  status: ClaimAssignmentStatus;
  reason: string;
};

export type ClaimSuggestion = {
  unitId: string;
  assignments: ClaimAssignment[];
  reason: string;
};

export type ChatClaimFollowUpQuestion = {
  id: string;
  question: string;
  why: string;
};

export type ChatClaimsPrefill = {
  suggestions: ClaimSuggestion[];
  unmatchedNotes: string[];
  followUpQuestions: ChatClaimFollowUpQuestion[];
  isComplete: boolean;
  stopReason: string;
  round: number;
  maxRounds: number;
};
