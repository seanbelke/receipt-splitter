import Image from "next/image";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { ChangeEvent } from "react";
import { AssignableUnit, ChatClaimsPrefill, ClaimConfidence } from "@/lib/types";
import { moneyFromCents } from "@/lib/split";
import { AssignIcon, ChatIcon, TrashIcon, UploadIcon } from "./icons";

type Suggestion = {
  unitId: string;
  person: string;
  confidence: ClaimConfidence;
  reason: string;
};

type MissingContextAssignment = {
  unitId: string;
  person?: string | null;
  reason: string;
};

type ClaimsStepState = {
  receiptReady: boolean;
  peopleCount: number;
  units: AssignableUnit[];
  chatScreenshots: File[];
  chatScreenshotPreviewUrls: string[];
  chatClaimsContext: string;
  isParsingChatClaims: boolean;
  chatClaimsPrefill: ChatClaimsPrefill | null;
  assignmentSuggestions: Suggestion[];
  filteredAssignmentSuggestions: Suggestion[];
  missingContextAssignments: MissingContextAssignment[];
  keptConfidenceLevels: Record<ClaimConfidence, boolean>;
  chatFollowUpDraft: Record<string, string>;
  lastAppliedClaimCount: number;
};

type ClaimsStepActions = {
  onChatScreenshotsChange: (event: ChangeEvent<HTMLInputElement>) => void;
  setChatClaimsContext: (value: string) => void;
  removeChatScreenshot: (index: number) => void;
  parseChatClaims: () => Promise<void>;
  toggleConfidenceLevel: (level: ClaimConfidence) => void;
  setChatFollowUpDraft: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  submitFollowUpAnswers: () => Promise<void>;
  applyChatClaimPrefill: () => void;
};

type ClaimsStepNavigation = {
  goToSetup: () => void;
  goToAssign: () => void;
};

export type ClaimsStepProps = {
  state: ClaimsStepState;
  actions: ClaimsStepActions;
  navigation: ClaimsStepNavigation;
};

export function ClaimsStep(props: ClaimsStepProps) {
  const { state, actions, navigation } = props;
  const {
    receiptReady,
    peopleCount,
    units,
    chatScreenshots,
    chatScreenshotPreviewUrls,
    chatClaimsContext,
    isParsingChatClaims,
    chatClaimsPrefill,
    assignmentSuggestions,
    filteredAssignmentSuggestions,
    missingContextAssignments,
    keptConfidenceLevels,
    chatFollowUpDraft,
    lastAppliedClaimCount,
  } = state;
  const {
    onChatScreenshotsChange,
    setChatClaimsContext,
    removeChatScreenshot,
    parseChatClaims,
    toggleConfidenceLevel,
    setChatFollowUpDraft,
    submitFollowUpAnswers,
    applyChatClaimPrefill,
  } = actions;
  const { goToSetup, goToAssign } = navigation;

  if (!receiptReady) {
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
        <Button onClick={goToSetup} className="secondary-btn px-4 py-2">
          Back to setup
        </Button>
      </div>
    );
  }

  if (peopleCount === 0) {
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
        <Button onClick={goToSetup} className="secondary-btn px-4 py-2">
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
        <h2 className="mt-2 text-3xl font-semibold">Pre-fill from group chat screenshots.</h2>
        <p className="mt-2 text-sm text-slate-700">
          Optional: upload screenshots where people claimed items. We&apos;ll suggest assignments you can apply before
          manual review.
        </p>
      </div>

      <label className="block rounded-2xl border border-dashed border-slate-400/70 bg-white/90 p-6">
        <span className="mb-2 block text-sm font-medium text-slate-700">Group chat screenshots</span>
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
            {chatScreenshots.length > 0 ? `${chatScreenshots.length} selected` : "No screenshots selected"}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">Include messages where people claimed specific items or shares.</p>
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Extra context for the AI (optional)</span>
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
            <div key={`${screenshot.name}-${index}`} className="soft-card flex items-center gap-3 rounded-xl p-2">
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
                <p className="truncate text-sm font-medium text-slate-900">{screenshot.name}</p>
                <p className="mono text-xs text-slate-500">{Math.round(screenshot.size / 1024)} KB</p>
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
        <Button type="button" onClick={goToAssign} className="secondary-btn px-4 py-2">
          Skip for now
        </Button>
      </div>

      {chatClaimsPrefill && (
        <div className="space-y-3">
          <div className="soft-card rounded-2xl p-4">
            <p className="text-sm text-slate-700">
              Suggested assignments: {assignmentSuggestions.length} total, {filteredAssignmentSuggestions.length} selected
              to apply.
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
                      selected ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
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
                  const unitLabel = unit ? `${unit.label} ($${moneyFromCents(unit.amountCents)})` : entry.unitId;
                  const subject = entry.person ? `${entry.person} @ ${unitLabel}` : unitLabel;
                  return (
                    <li key={`${subject}-${index}`}>
                      {subject}: {entry.reason}
                    </li>
                  );
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
                    <span className="text-sm font-medium text-slate-800">{entry.question}</span>
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
                  onClick={() => {
                    void submitFollowUpAnswers();
                  }}
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
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Unit</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Suggested assignment</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Confidence</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignmentSuggestions.map((suggestion, index) => {
                      const unit = units.find((candidate) => candidate.id === suggestion.unitId);
                      return (
                        <tr key={`${suggestion.unitId}-${suggestion.person}-${index}`} className="border-b border-slate-200">
                          <td className="px-3 py-2 text-slate-800">
                            {unit ? `${unit.label} ($${moneyFromCents(unit.amountCents)})` : suggestion.unitId}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{suggestion.person}</td>
                          <td className="px-3 py-2 text-slate-700 capitalize">{suggestion.confidence}</td>
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
                    Applied {lastAppliedClaimCount} assignment{lastAppliedClaimCount === 1 ? "" : "s"}.
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-700">No assignment suggestions match your selected confidence levels.</p>
          )}
          <p className="text-xs text-slate-500">{chatClaimsPrefill.stopReason}</p>
        </div>
      )}

      <Button onClick={goToAssign} className="primary-btn inline-flex items-center gap-2 px-5 py-3">
        <AssignIcon />
        Continue to assignment
      </Button>
    </div>
  );
}
