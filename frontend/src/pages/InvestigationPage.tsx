import { useEffect, useRef, useState } from "react";
import { ChevronDown, Database, Search, Terminal, X } from "lucide-react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { useInvestigationStream } from "@/hooks/useInvestigationStream";
import { startInvestigation, getConnections } from "@/api/client";
import { StepCard } from "@/components/investigation/StepCard";
import { FinalReport } from "@/components/investigation/FinalReport";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import type { Connection } from "@/types";

const DEMO_CONNECTION: Connection = { id: "demo", label: "Demo dataset", kind: "demo" };

export default function InvestigationPage() {
  const { session } = useAppwrite();
  const { state, startStream, stop } = useInvestigationStream();
  const [query, setQuery] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [connections, setConnections] = useState<Connection[]>([DEMO_CONNECTION]);
  const [selectedConn, setSelectedConn] = useState<Connection>(DEMO_CONNECTION);
  const [connOpen, setConnOpen] = useState(false);
  const connRef = useRef<HTMLDivElement>(null);

  const latestReasoning = state.steps.length > 0
    ? state.steps[state.steps.length - 1].reasoning
    : "";

  // Load connections from backend
  useEffect(() => {
    if (!session) return;
    getConnections(session.jwt)
      .then((res) => {
        const all: Connection[] = [DEMO_CONNECTION, ...res.connections.filter((c) => c.id !== "demo")];
        setConnections(all);
      })
      .catch(() => {/* keep default demo */});
  }, [session]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (connRef.current && !connRef.current.contains(e.target as Node)) {
        setConnOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = query.trim();
    if (!question || state.isStreaming || !session) return;

    setSubmitError(null);

    try {
      const { investigation_id } = await startInvestigation(session.jwt, {
        connection_id: selectedConn.id,
        question,
      });
      await startStream(investigation_id, session.jwt, question);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to start investigation.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">
      <div className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 p-4">
        <form onSubmit={handleAsk} className="flex items-center gap-3">
          {/* Connection selector */}
          <div className="relative" ref={connRef}>
            <button
              type="button"
              onClick={() => setConnOpen((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-3 text-sm text-gray-300 transition-colors hover:border-gray-600 whitespace-nowrap"
            >
              <Database className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="max-w-[120px] truncate">{selectedConn.label}</span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            </button>
            {connOpen && (
              <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-gray-700 bg-gray-900 shadow-xl z-20">
                {connections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setSelectedConn(c); setConnOpen(false); }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-800 first:rounded-t-lg last:rounded-b-lg ${
                      c.id === selectedConn.id ? "text-sky-400" : "text-gray-300"
                    }`}
                  >
                    <Database className="h-4 w-4 text-gray-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate">{c.label}</div>
                      <div className="font-mono text-xs text-gray-500">{c.kind}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Question input */}
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
              onClick={stop}
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
              Connected to <span className="mx-1 text-gray-300">{selectedConn.label}</span>. Ask a question to begin.
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl space-y-4">
              {state.error && <ErrorBanner message={state.error} />}
              {state.steps.map((step) => (
                <StepCard key={step.step} step={step} />
              ))}
              {state.final && <FinalReport result={state.final} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
