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
import { ReasoningPanel } from "@/components/investigation/ReasoningPanel";
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
      <div className="p-4 border-b border-gray-800">
        <ChatInput onSubmit={handleAsk} disabled={state.isStreaming || submitting} />
      </div>

      {state.error && <ErrorBanner message={state.error} />}

      <div className="flex-1 overflow-hidden flex gap-0">
        {/* Left: streamed reasoning — the spectator view */}
        {(allReasoning || state.isStreaming) && (
          <div className="w-80 border-r border-gray-800 overflow-y-auto">
            <ReasoningPanel text={allReasoning} isStreaming={state.isStreaming} />
          </div>
        )}

        {/* Right: steps + final */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {state.steps.map((step) => (
            <StepCard key={step.step} step={step} />
          ))}
          {state.final && <FinalReport result={state.final} />}
          {!state.steps.length && !state.isStreaming && (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Ask a question to start an investigation.
              <br />Try: "Why did revenue drop last week?"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
