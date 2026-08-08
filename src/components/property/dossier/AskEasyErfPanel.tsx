import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, MessageCircle, Send, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { askEasyErfViaEdgeFunction } from "@/lib/reports/askEasyErfClient";
import {
  ASK_EASY_ERF_MAX_QUESTION_CHARACTERS,
  buildAskEasyErfSelectedEvidencePayload,
  calibrateAskEasyErfAnswerConfidence,
  hasAskEasyErfPackEvidence,
  hasEnoughAskEasyErfSelectedEvidence,
  suggestedAskEasyErfQuestions,
  type AskEasyErfAnswer,
  type AskEasyErfEvidencePayload,
  type AskEasyErfEvidenceSourceType,
} from "@/lib/reports/askEasyErf";
import type { PropertyEvidencePack } from "@/lib/evidence/propertyEvidenceTypes";
import type { ReportDecisionMode } from "@/lib/reports/reportDecisionMode";
import type { ReportAction } from "@/lib/reports/reportFindings";
import { canonicalActionNavigation } from "@/lib/investigation/canonicalNextAction";
import type { DossierView } from "./reportViews";

/**
 * Shared Ask Easy Erf panel.
 *
 * The report and the Investigation Home render the same component so both use
 * the same grounded browser -> Edge Function contract and the same parcel
 * scoping. `compact` only changes presentation.
 */

export function AskEasyErfPanel({
  suggestionPayload,
  evidencePack,
  canonicalNextAction,
  decisionMode,
  onSelectView,
  compact = false,
  maxSuggestions,
}: {
  suggestionPayload: AskEasyErfEvidencePayload;
  evidencePack: PropertyEvidencePack | null;
  canonicalNextAction?: ReportAction | null;
  decisionMode?: ReportDecisionMode;
  onSelectView?: (view: DossierView, options?: { anchorId?: string }) => void;
  /** Compact layout for the Investigation Home; behaviour is unchanged. */
  compact?: boolean;
  maxSuggestions?: number;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskEasyErfAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const currentParcelIdRef = useRef(suggestionPayload.parcelId);
  const currentFingerprintRef = useRef(evidencePack?.fingerprint ?? "");
  const requestGenerationRef = useRef(0);
  const renderedParcelIdRef = useRef(suggestionPayload.parcelId);
  const renderedFingerprintRef = useRef(evidencePack?.fingerprint ?? "");
  const evidenceFingerprint = evidencePack?.fingerprint ?? "";
  if (
    renderedParcelIdRef.current !== suggestionPayload.parcelId ||
    renderedFingerprintRef.current !== evidenceFingerprint
  ) {
    renderedParcelIdRef.current = suggestionPayload.parcelId;
    renderedFingerprintRef.current = evidenceFingerprint;
    requestGenerationRef.current += 1;
  }
  currentParcelIdRef.current = suggestionPayload.parcelId;
  currentFingerprintRef.current = evidenceFingerprint;
  const allSuggestions = suggestedAskEasyErfQuestions(suggestionPayload, decisionMode);
  const suggestions =
    typeof maxSuggestions === "number" ? allSuggestions.slice(0, maxSuggestions) : allSuggestions;
  const hasCanonicalPackEvidence = hasAskEasyErfPackEvidence(
    evidencePack,
    suggestionPayload.parcelId,
  );

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setQuestion("");
    setAnswer(null);
    setError(null);
    setLoading(false);
  }, [suggestionPayload.parcelId, evidenceFingerprint]);

  const askQuestion = async (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    if (question.length > ASK_EASY_ERF_MAX_QUESTION_CHARACTERS) {
      setAnswer(null);
      setError("Questions must be 1,000 characters or fewer.");
      return;
    }
    if (!hasCanonicalPackEvidence) {
      setAnswer(null);
      setError(
        "More saved evidence is required before Ask Easy Erf can answer this property question.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const requestParcelId = suggestionPayload.parcelId;
    const requestFingerprint = evidenceFingerprint;
    const requestGeneration = requestGenerationRef.current;
    const isCurrentRequest = () =>
      currentParcelIdRef.current === requestParcelId &&
      currentFingerprintRef.current === requestFingerprint &&
      requestGenerationRef.current === requestGeneration;
    const timeout = window.setTimeout(() => controller.abort(), 25_000);
    try {
      const { data } = await supabase.auth.getSession();
      if (!isCurrentRequest()) return;
      const token = data.session?.access_token;
      if (!token) {
        setAnswer(null);
        setError("Sign in is required before Ask Easy Erf can answer.");
        return;
      }
      if (!evidencePack || evidencePack.parcelId !== requestParcelId) {
        setAnswer(null);
        setError("The selected property evidence changed. Ask again from the current report.");
        return;
      }
      const selectedEvidence = buildAskEasyErfSelectedEvidencePayload({
        pack: evidencePack,
        question: trimmed,
      });
      if (!hasEnoughAskEasyErfSelectedEvidence(selectedEvidence)) {
        setAnswer(null);
        setError("No relevant saved evidence was found for that question yet.");
        return;
      }
      const result = await askEasyErfViaEdgeFunction({
        parcelId: suggestionPayload.parcelId,
        question: trimmed,
        evidence: selectedEvidence,
        accessToken: token,
        signal: controller.signal,
      });
      if (!isCurrentRequest()) return;
      if (result.success) {
        setAnswer(
          calibrateAskEasyErfAnswerConfidence({
            answer: result.answer,
            selectedEvidence,
            readinessPercent: suggestionPayload.decision.confidencePercent,
          }),
        );
        setError(null);
      } else {
        setAnswer(null);
        setError(result.error);
      }
    } catch (requestError) {
      if (!isCurrentRequest()) return;
      setAnswer(null);
      setError(
        requestError instanceof DOMException && requestError.name === "AbortError"
          ? "Ask Easy Erf request cancelled."
          : "Ask Easy Erf is temporarily unavailable.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (abortRef.current === controller) abortRef.current = null;
      if (isCurrentRequest()) setLoading(false);
    }
  };

  const cancelRequest = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  return (
    <section
      id={compact ? undefined : "report-ask-easy-erf"}
      className={cn(
        "report-section rounded-[1.75rem] border border-[#0D1B2A]/10 bg-[#F7FBFF] shadow-[0_18px_45px_-36px_rgba(13,27,42,0.42)] scroll-mt-24",
        compact ? "p-4" : "p-6",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#0D1B2A] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">
            <MessageCircle className="h-3.5 w-3.5 text-[#FFB86B]" />
            Ask Easy Erf
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-[#0D1B2A]">
            Ask questions about this property
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#0D1B2A]/70">
            Ask questions about this property using only the evidence saved in this Easy Erf
            workspace.
          </p>
        </div>
        <span className="rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1 text-xs font-semibold text-[#0D1B2A]/70">
          Parcel scoped: {suggestionPayload.parcelId}
        </span>
      </div>

      {!hasCanonicalPackEvidence && (
        <div className="mt-5 rounded-[1.25rem] border border-[#F59E0B]/35 bg-[#fffbeb] p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
            <div>
              <p className="text-sm font-semibold text-[#0D1B2A]">
                More saved evidence is required first.
              </p>
              <p className="mt-1 text-xs leading-5 text-[#0D1B2A]/66">
                Ask Easy Erf will not fabricate a fallback answer. Add official source reviews,
                market evidence, uploaded documents, notes, or strategy assumptions before asking.
              </p>
              <div className="report-no-print mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSelectView?.("research")}
                  className="rounded-full bg-[#0D1B2A] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Open Sources
                </button>
                <button
                  type="button"
                  onClick={() => onSelectView?.("listings")}
                  className="rounded-full border border-[#0D1B2A]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
                >
                  Open Market
                </button>
                <button
                  type="button"
                  onClick={() => onSelectView?.("reports")}
                  className="rounded-full border border-[#0D1B2A]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A]"
                >
                  Open Report Documents
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="report-no-print mt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
          Suggested questions
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuestion(suggestion)}
              className="rounded-full border border-[#0D1B2A]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#0D1B2A] transition hover:border-[#FF6A00]/40 hover:bg-[#fff8ec]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={(event) => void askQuestion(event)} className="report-no-print mt-5">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
            Your question
          </span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={ASK_EASY_ERF_MAX_QUESTION_CHARACTERS}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void askQuestion();
              }
            }}
            rows={3}
            placeholder="Example: What information is missing before I make an offer?"
            className="mt-2 w-full rounded-2xl border border-[#D9E6F2] bg-white px-4 py-3 text-sm text-[#0D1B2A] outline-none transition focus:border-[#FF6A00]"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!question.trim() || loading || !hasCanonicalPackEvidence}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
              !question.trim() || loading || !hasCanonicalPackEvidence
                ? "cursor-not-allowed bg-[#0D1B2A]/10 text-[#0D1B2A]/40"
                : "bg-[#FF6A00] text-white hover:bg-[#ff7a1a]",
            )}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? "Asking..." : "Ask"}
          </button>
          {loading && (
            <button
              type="button"
              onClick={cancelRequest}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-sm font-semibold text-[#0D1B2A]"
            >
              Cancel
            </button>
          )}
          {(answer || error) && (
            <button
              type="button"
              onClick={() => {
                setAnswer(null);
                setError(null);
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#0D1B2A]/15 bg-white px-4 py-2 text-sm font-semibold text-[#0D1B2A]"
            >
              Clear previous answer
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-[1.25rem] border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#7F1D1D]">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {answer && <AskEasyErfAnswerCard answer={answer} />}

      {canonicalNextAction && (
        <AskEasyErfCanonicalActionCard
          action={canonicalNextAction}
          onSelectView={onSelectView}
        />
      )}

      <p className="mt-5 rounded-2xl border border-[#D9E6F2] bg-white px-4 py-3 text-xs leading-5 text-[#0D1B2A]/62">
        Ask Easy Erf answers are limited to the evidence saved for this property. Missing evidence
        may change the conclusion. Verify legal, planning, engineering and valuation matters with
        the relevant professional.
      </p>
    </section>
  );
}

function AskEasyErfAnswerCard({ answer }: { answer: AskEasyErfAnswer }) {
  return (
    <article className="mt-5 rounded-[1.5rem] border border-[#0D1B2A]/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FF6A00]">
          Evidence-limited answer
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
            answer.confidence === "high"
              ? "bg-[#DCFCE7] text-[#166534]"
              : answer.confidence === "medium"
                ? "bg-[#FFFBEB] text-[#92400E]"
                : "bg-[#D9E6F2] text-[#0D1B2A]",
          )}
        >
          {answer.confidence} confidence
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#0D1B2A]/78">
        {answer.answer}
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">
            Evidence references
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {answer.evidenceReferences.map((reference) => (
              <span
                key={`${reference.ref ?? reference.sourceType}-${reference.label}`}
                className="rounded-full border border-[#D9E6F2] bg-[#F7FBFF] px-3 py-1 text-xs font-semibold text-[#0D1B2A]"
              >
                {reference.ref ? `[${reference.ref}] ` : ""}
                {sourceTypeLabel(reference.sourceType)} - {reference.label}
                {reference.locator ? ` (${reference.locator})` : ""}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748B]">
            Unknowns
          </h4>
          {answer.unknowns.length ? (
            <ul className="mt-2 space-y-1 text-sm text-[#0D1B2A]/70">
              {answer.unknowns.map((unknown) => (
                <li key={unknown}>- {unknown}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#0D1B2A]/60">No unknowns returned.</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function AskEasyErfCanonicalActionCard({
  action,
  onSelectView,
}: {
  action: ReportAction;
  onSelectView?: (view: DossierView, options?: { anchorId?: string }) => void;
}) {
  const target = canonicalActionNavigation(action);
  return (
    <article className="mt-5 rounded-[1.5rem] border border-[#FF6A00]/25 bg-[#FFF7ED] p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#C2410C]">
        Next best step
      </div>
      <h4 className="mt-2 text-base font-semibold text-[#0D1B2A]">{action.title}</h4>
      <p className="mt-2 text-sm leading-6 text-[#0D1B2A]/70">{action.reason}</p>
      {action.afterCompletion && (
        <p className="mt-2 text-xs leading-5 text-[#0D1B2A]/58">
          After completion: {action.afterCompletion}
        </p>
      )}
      {onSelectView && (
        <button
          type="button"
          onClick={() =>
            onSelectView(target.targetTab as DossierView, {
              anchorId: target.targetAnchorId,
            })
          }
          className="report-no-print mt-4 inline-flex min-h-10 items-center rounded-full bg-[#0D1B2A] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#142941]"
        >
          {action.actionLabel}
        </button>
      )}
    </article>
  );
}

function sourceTypeLabel(type: AskEasyErfEvidenceSourceType) {
  switch (type) {
    case "official":
      return "Official";
    case "uploaded":
      return "Uploaded";
    case "market":
      return "Market";
    case "user_confirmed":
      return "User-confirmed";
    case "calculation":
      return "Calculation";
    case "ai_interpretation":
      return "AI interpretation";
    case "missing":
      return "Missing";
  }
}

export default AskEasyErfPanel;
