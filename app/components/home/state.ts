import { expandItemsToUnits } from "@/lib/split";
import { AssignableUnit, ChatClaimsPrefill, ClaimConfidence, ParsedReceipt } from "@/lib/types";
import { AIPrefillDetail, AssignMode, FollowUpAnswer, Step } from "./types";

type StateSetter<T> = T | ((prev: T) => T);

function resolveNext<T>(value: StateSetter<T>, prev: T): T {
  return typeof value === "function" ? (value as (current: T) => T)(prev) : value;
}

function defaultConfidenceLevels(): Record<ClaimConfidence, boolean> {
  return {
    high: true,
    medium: true,
    low: true,
  };
}

export type HomeState = {
  usageId: string | null;
  isHydratingUsage: boolean;
  step: Step;
  maxUnlockedStep: Step;
  file: File | null;
  receipt: ParsedReceipt | null;
  units: AssignableUnit[];
  people: string[];
  newPerson: string;
  currentUnitIndex: number;
  currentPersonIndex: number;
  assignMode: AssignMode;
  assignments: Record<string, string[]>;
  taxCents: number;
  tipCents: number;
  isParsing: boolean;
  isParsingChatClaims: boolean;
  error: string | null;
  selectedImageUrl: string | null;
  isImagePreviewOpen: boolean;
  chatScreenshots: File[];
  chatClaimsContext: string;
  isVoiceContextSupported: boolean;
  isVoiceContextListening: boolean;
  voiceContextError: string | null;
  chatScreenshotPreviewUrls: string[];
  chatClaimsPrefill: ChatClaimsPrefill | null;
  chatFollowUpDraft: Record<string, string>;
  chatFollowUpHistory: FollowUpAnswer[];
  keptConfidenceLevels: Record<ClaimConfidence, boolean>;
  aiPrefillByUnit: Record<string, AIPrefillDetail>;
  isAiReasoningOpen: boolean;
  lastAppliedClaimCount: number;
  reportHtmlPreview: string | null;
  assignPanelHeight: number | null;
  editingItemRowIndex: number | null;
};

export const initialHomeState: HomeState = {
  usageId: null,
  isHydratingUsage: false,
  step: "setup",
  maxUnlockedStep: "setup",
  file: null,
  receipt: null,
  units: [],
  people: [],
  newPerson: "",
  currentUnitIndex: 0,
  currentPersonIndex: 0,
  assignMode: "byItem",
  assignments: {},
  taxCents: 0,
  tipCents: 0,
  isParsing: false,
  isParsingChatClaims: false,
  error: null,
  selectedImageUrl: null,
  isImagePreviewOpen: false,
  chatScreenshots: [],
  chatClaimsContext: "",
  isVoiceContextSupported: false,
  isVoiceContextListening: false,
  voiceContextError: null,
  chatScreenshotPreviewUrls: [],
  chatClaimsPrefill: null,
  chatFollowUpDraft: {},
  chatFollowUpHistory: [],
  keptConfidenceLevels: defaultConfidenceLevels(),
  aiPrefillByUnit: {},
  isAiReasoningOpen: false,
  lastAppliedClaimCount: 0,
  reportHtmlPreview: null,
  assignPanelHeight: null,
  editingItemRowIndex: null,
};

type SetFieldAction = {
  [K in keyof HomeState]: {
    type: "SET_FIELD";
    key: K;
    value: StateSetter<HomeState[K]>;
  };
}[keyof HomeState];

type ReceiptParseStartedAction = {
  type: "RECEIPT_PARSE_STARTED";
};

type ReceiptParseSucceededAction = {
  type: "RECEIPT_PARSE_SUCCEEDED";
  receipt: ParsedReceipt;
  units: AssignableUnit[];
};

type ReceiptParseFailedAction = {
  type: "RECEIPT_PARSE_FAILED";
  error: string;
};

type ResetChatPrefillAction = {
  type: "RESET_CHAT_PREFILL";
};

type ClearReceiptDataAction = {
  type: "CLEAR_RECEIPT_DATA";
};

type ClearChatClaimInputsAction = {
  type: "CLEAR_CHAT_CLAIM_INPUTS";
};

type ClearAiClaimMetadataAction = {
  type: "CLEAR_AI_CLAIM_METADATA";
};

type LoadUsageSnapshotAction = {
  type: "LOAD_USAGE_SNAPSHOT";
  usageId: string;
  snapshot: {
    receipt: ParsedReceipt;
    people: string[];
    assignments: Record<string, string[]>;
    taxCents: number;
    tipCents: number;
  };
};

export type HomeAction =
  | SetFieldAction
  | ReceiptParseStartedAction
  | ReceiptParseSucceededAction
  | ReceiptParseFailedAction
  | ResetChatPrefillAction
  | ClearReceiptDataAction
  | ClearChatClaimInputsAction
  | ClearAiClaimMetadataAction
  | LoadUsageSnapshotAction;

export function setHomeField<K extends keyof HomeState>(
  key: K,
  value: StateSetter<HomeState[K]>,
): SetFieldAction {
  return {
    type: "SET_FIELD",
    key,
    value,
  } as SetFieldAction;
}

function withResetChatPrefill(state: HomeState): HomeState {
  return {
    ...state,
    chatClaimsPrefill: null,
    chatFollowUpDraft: {},
    chatFollowUpHistory: [],
    keptConfidenceLevels: defaultConfidenceLevels(),
    lastAppliedClaimCount: 0,
  };
}

function withClearReceiptData(state: HomeState): HomeState {
  return {
    ...state,
    usageId: state.usageId,
    maxUnlockedStep: "setup",
    receipt: null,
    units: [],
    assignments: {},
    taxCents: 0,
    tipCents: 0,
    editingItemRowIndex: null,
  };
}

function withClearChatClaimInputs(state: HomeState): HomeState {
  return {
    ...state,
    chatScreenshots: [],
    chatClaimsContext: "",
    isVoiceContextListening: false,
    voiceContextError: null,
  };
}

function getMaxUnlockedStep(snapshot: LoadUsageSnapshotAction["snapshot"]): Step {
  if (snapshot.people.length === 0) {
    return "setup";
  }

  const allAssigned = expandItemsToUnits(snapshot.receipt).every(
    (unit) => (snapshot.assignments[unit.id] ?? []).length > 0,
  );
  if (allAssigned) {
    return "results";
  }

  return "assign";
}

function withClearAiClaimMetadata(state: HomeState): HomeState {
  return {
    ...withResetChatPrefill(state),
    aiPrefillByUnit: {},
  };
}

export function homeReducer(state: HomeState, action: HomeAction): HomeState {
  switch (action.type) {
    case "SET_FIELD": {
      const key = action.key as keyof HomeState;
      const value = action.value as StateSetter<HomeState[typeof key]>;
      return {
        ...state,
        [key]: resolveNext(value, state[key]),
      };
    }
    case "RECEIPT_PARSE_STARTED":
      return {
        ...withClearAiClaimMetadata(withClearReceiptData(state)),
        isParsing: true,
        error: null,
        step: "setup",
        maxUnlockedStep: "setup",
        chatClaimsContext: "",
        currentUnitIndex: 0,
        currentPersonIndex: 0,
        assignMode: "byItem",
      };
    case "RECEIPT_PARSE_SUCCEEDED":
      return {
        ...state,
        isParsing: false,
        receipt: action.receipt,
        units: action.units,
        taxCents: action.receipt.taxCents,
        tipCents: action.receipt.tipCents,
      };
    case "RECEIPT_PARSE_FAILED":
      return {
        ...state,
        isParsing: false,
        error: action.error,
      };
    case "RESET_CHAT_PREFILL":
      return withResetChatPrefill(state);
    case "CLEAR_RECEIPT_DATA":
      return withClearReceiptData(state);
    case "CLEAR_CHAT_CLAIM_INPUTS":
      return withClearChatClaimInputs(state);
    case "CLEAR_AI_CLAIM_METADATA":
      return withClearAiClaimMetadata(state);
    case "LOAD_USAGE_SNAPSHOT": {
      const units = expandItemsToUnits(action.snapshot.receipt);
      const validUnitIds = new Set(units.map((unit) => unit.id));
      const assignments = Object.fromEntries(
        Object.entries(action.snapshot.assignments).map(([unitId, names]) => [
          unitId,
          validUnitIds.has(unitId)
            ? Array.from(new Set(names.filter((name) => action.snapshot.people.includes(name))))
            : [],
        ]),
      );
      const maxUnlockedStep = getMaxUnlockedStep({
        ...action.snapshot,
        assignments,
      });

      return {
        ...initialHomeState,
        usageId: action.usageId,
        receipt: action.snapshot.receipt,
        units,
        people: action.snapshot.people,
        assignments,
        taxCents: action.snapshot.taxCents,
        tipCents: action.snapshot.tipCents,
        step: "setup",
        maxUnlockedStep,
      };
    }
    default:
      return state;
  }
}
