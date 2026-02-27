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
  step: Step;
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
  step: "setup",
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

type SetFieldAction<K extends keyof HomeState = keyof HomeState> = {
  type: "SET_FIELD";
  key: K;
  value: StateSetter<HomeState[K]>;
};

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

export type HomeAction =
  | SetFieldAction
  | ReceiptParseStartedAction
  | ReceiptParseSucceededAction
  | ReceiptParseFailedAction
  | ResetChatPrefillAction
  | ClearReceiptDataAction
  | ClearChatClaimInputsAction
  | ClearAiClaimMetadataAction;

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
  };
}

function withClearAiClaimMetadata(state: HomeState): HomeState {
  return {
    ...withResetChatPrefill(state),
    aiPrefillByUnit: {},
  };
}

export function homeReducer(state: HomeState, action: HomeAction): HomeState {
  switch (action.type) {
    case "SET_FIELD":
      return {
        ...state,
        [action.key]: resolveNext(action.value, state[action.key]),
      };
    case "RECEIPT_PARSE_STARTED":
      return {
        ...withClearAiClaimMetadata(withClearReceiptData(state)),
        isParsing: true,
        error: null,
        step: "setup",
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
    default:
      return state;
  }
}
