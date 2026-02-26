import { ClaimConfidence } from "@/lib/types";

export type Step = "setup" | "claims" | "assign" | "results";
export type AssignMode = "byItem" | "byPerson";

export type AIPrefillDetail = {
  assignments: Array<{
    person: string;
    confidence: ClaimConfidence;
    reason: string;
  }>;
  missingContext: string[];
  reason: string;
};

export type FollowUpAnswer = {
  id: string;
  question: string;
  answer: string;
};

export const STEP_ORDER: Step[] = ["setup", "claims", "assign", "results"];
