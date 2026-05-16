/**
 * P4 — Main investigation page. The product. The "wow" moment.
 * Owner: FE
 *
 * Layout: chat input at top, reasoning panel (streamed thought) on left, steps + final report on right.
 */
import { useState } from "react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { useInvestigationStream } from "@/hooks/useInvestigationStream";
import { startInvestigation } from "@/api/client";
import { ChatInput } from "@/components/investigation/ChatInput";
import { StepCard } from "@/components/investigation/StepCard";
import { FinalReport } from "@/components/investigation/FinalReport";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

const DEMO_CONNECTION_ID = "demo"; // TODO P3: load from workspace

export default function InvestigationPage() {
  const { session } = useAppwrite();
  const { state, startStream, stop } = useInvestigationStream();
  const [submitting, setSubmitting] = useState(false);

  const handleAsk = async (question: string) => {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      const { investigation_id } = await startInvestigation(session.jwt, {
        connection_id: DEMO_CONNECTION_ID,
        question,
      });
      await startStream(investigation_id, session.jwt, question);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const allReasoning = state.steps.map((s) => s.reasoning).join("\n\n");

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 p-4">
        <ChatInput onSubmit={handleAsk} disabled={state.isStreaming || submitting} />
      </div>

      {state.error && <ErrorBanner message={state.error} />}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[320px] bg-gray-900 border-r border-gray-800 p-4 font-mono text-sm text-gray-300 flex flex-col overflow-y-auto">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">Reasoning Stream</div>
          {allReasoning ? (
            <pre className="whitespace-pre-wrap text-xs leading-relaxed">{allReasoning}</pre>
          ) : (
            <div>
              &gt; Waiting for query...
              <span className="cursor-blink">▊</span>
            </div>
          )}
        </div>

        <div className="flex-1 bg-gray-950/50 p-8 flex items-center justify-center text-gray-500 overflow-y-auto">
          <div className="w-full max-w-4xl space-y-3">
          {state.steps.map((step) => (
            <StepCard key={step.step} step={step} />
          ))}
          {state.final && <FinalReport result={state.final} />}
          {!state.steps.length && !state.isStreaming && (
              <div className="text-center">
              Connected to production database. Ready to investigate.
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
