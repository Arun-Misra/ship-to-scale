import { useRef, useState } from "react";
import { Database, Search, Terminal, X } from "lucide-react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { useInvestigationStream } from "@/hooks/useInvestigationStream";
import { startInvestigation } from "@/api/client";
import { StepCard } from "@/components/investigation/StepCard";
import { FinalReport } from "@/components/investigation/FinalReport";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

const DEFAULT_CONNECTION_ID = "demo";

export default function InvestigationPage() {
  const { session } = useAppwrite();
  const { state, startStream, stop } = useInvestigationStream();
  const [query, setQuery] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const latestReasoning = state.steps.length > 0
    ? state.steps[state.steps.length - 1].reasoning
    : "";

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = query.trim();
    if (!question || state.isStreaming || !session) return;

    setSubmitError(null);

    try {
      const { investigation_id } = await startInvestigation(session.jwt, {
        connection_id: DEFAULT_CONNECTION_ID,
        question,
      });
      await startStream(investigation_id, session.jwt, question);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to start investigation.");
    }
  };

  const handleStop = () => {
    stop();
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">
      <div className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 p-4">
        <form onSubmit={handleAsk} className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <Search className="h-4 w-4 text-gray-500 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your data in plain English..."
              className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none"
              disabled={state.isStreaming}
            />
          </div>
          {state.isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-600"
            >
              <X className="h-4 w-4" />
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!query.trim() || !session}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Terminal className="h-4 w-4" />
              Ask
            </button>
          )}
        </form>
        {submitError && <ErrorBanner message={submitError} />}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Reasoning panel */}
        <div className="w-[320px] bg-gray-900 border-r border-gray-800 p-4 font-mono text-sm text-gray-300 flex flex-col overflow-hidden">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Database className="h-4 w-4 text-gray-500" />
            Reasoning
          </div>
          <pre className="font-mono text-sm text-gray-400 whitespace-pre-wrap flex-1 overflow-y-auto leading-relaxed">
            {latestReasoning || "> Waiting for query..."}
            {state.isStreaming && (
              <span className="animate-pulse bg-sky-500 w-2 h-4 inline-block ml-1 align-middle" />
            )}
          </pre>
        </div>

        {/* Steps + final report */}
        <div className="flex-1 bg-gray-950/50 p-8 overflow-y-auto">
          {state.steps.length === 0 && !state.error ? (
            <div className="flex h-full items-center justify-center text-center text-gray-500">
              Connected to demo dataset. Ask a question to begin.
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl space-y-4">
              {state.error && <ErrorBanner message={state.error} />}
              {state.steps.map((step) => (
                <StepCard key={step.step} step={step} />
              ))}
              {state.final && <FinalReport result={state.final} />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
