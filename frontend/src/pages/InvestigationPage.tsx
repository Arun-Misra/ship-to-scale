import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Play,
  Search,
  Terminal,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Step {
  id: number;
  title: string;
  sql: string;
  status: "pending" | "success" | "error";
}

interface FinalReport {
  summary: string;
  chartData: any[];
  receipts: string[];
}

export default function InvestigationPage() {
  const [query, setQuery] = useState("");
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [reasoningStream, setReasoningStream] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reasoningStream]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      timersRef.current = [];
    };
  }, []);

  const clearTimers = () => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current = [];
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || isInvestigating) return;

    clearTimers();

    setIsInvestigating(true);
    setSteps([]);
    setFinalReport(null);
    setReasoningStream(
      "> Initializing Viriya Agent Loop...\n> Parsing user intent...\n"
    );

    const timer1 = window.setTimeout(() => {
      setReasoningStream((current) => current + "> Generating SQL to check overall baseline trends...\n");
      setSteps([
        {
          id: 1,
          title: "Aggregate weekly revenue",
          sql: "SELECT date_trunc('week', created_at), sum(amount) FROM orders GROUP BY 1",
          status: "success",
        },
      ]);
    }, 1000);

    const timer2 = window.setTimeout(() => {
      setReasoningStream((current) => current + "> Anomaly detected: 23% drop variance. Slicing dimensions by region...\n");
      setSteps((currentSteps) => [
        ...currentSteps,
        {
          id: 2,
          title: "Isolate by region",
          sql: "SELECT region, sum(amount) FROM orders WHERE date > '2024-04-01' GROUP BY region",
          status: "error",
        },
      ]);
    }, 2500);

    const timer3 = window.setTimeout(() => {
      setReasoningStream(
        (current) =>
          current +
          "> Error: 'region' column ambiguous. Self-correcting schema map via EXPLAIN...\n> Retrying with explicit joins...\n"
      );
      setSteps((currentSteps) =>
        currentSteps.map((step) =>
          step.id === 2
            ? {
                ...step,
                status: "success",
                sql: "SELECT o.region, sum(o.amount) FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.date > '2024-04-01' GROUP BY o.region",
              }
            : step
        )
      );
    }, 4000);

    const timer4 = window.setTimeout(() => {
      setReasoningStream((current) => current + "> Root cause isolated to Mumbai region (4 enterprise churns). Synthesizing narrative...\n");
    }, 5500);

    const timer5 = window.setTimeout(() => {
      setFinalReport({
        summary: "Revenue dropped 23% driven by 4 enterprise accounts in Mumbai",
        chartData: [
          { quarter: "Q1", revenue: 120000 },
          { quarter: "Q2", revenue: 135000 },
          { quarter: "Q3", revenue: 98000 },
        ],
        receipts: ["Revenue = SUM(order_total) excl. refunds"],
      });
      setIsInvestigating(false);
    }, 6500);

    timersRef.current = [timer1, timer2, timer3, timer4, timer5];
  };

  const statusIcon = (status: Step["status"]) => {
    if (status === "success") return <CheckCircle2 className="h-4 w-4 text-sky-500" />;
    if (status === "error") return <AlertCircle className="h-4 w-4 text-gray-400" />;
    return <Play className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">
      <div className="sticky top-0 z-10 bg-gray-950 border-b border-gray-800 p-4">
        <form onSubmit={handleAsk} className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask a question about your data in plain English..."
              className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-500 outline-none"
              disabled={isInvestigating}
            />
          </div>
          <button
            type="submit"
            disabled={isInvestigating || !query.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Terminal className="h-4 w-4" />
            {isInvestigating ? "Investigating" : "Ask"}
          </button>
        </form>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[320px] bg-gray-900 border-r border-gray-800 p-4 font-mono text-sm text-gray-300 flex flex-col overflow-hidden">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
            <Database className="h-4 w-4 text-gray-500" />
            Reasoning
          </div>
          <pre className="font-mono text-sm text-gray-400 whitespace-pre-wrap flex-1 overflow-y-auto leading-relaxed">
            {reasoningStream || "> Waiting for query..."}
            <span className="animate-pulse bg-sky-500 w-2 h-4 inline-block ml-1 align-middle" />
          </pre>
          <div ref={messagesEndRef} />
        </div>

        <div className="flex-1 bg-gray-950/50 p-8 overflow-y-auto text-gray-500">
          {!isInvestigating && steps.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-gray-500">
              Connected to production database. Ready to investigate.
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl">
              {steps.map((step) => (
                <div key={step.id} className="mb-4 rounded-lg border border-gray-800 bg-gray-950 p-4">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-gray-100">
                      {statusIcon(step.status)}
                      <span className="text-sm font-medium">{step.title}</span>
                    </div>
                    <span className="text-xs uppercase tracking-wide text-gray-500">{step.status}</span>
                  </div>
                  <code className="block whitespace-pre-wrap font-mono text-sm text-sky-400">
                    {step.sql}
                  </code>
                </div>
              ))}

              {finalReport && (
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                  <div className="mb-4 text-sm text-gray-100">{finalReport.summary}</div>

                  <div className="h-[300px] rounded-md border border-gray-800 bg-[#0A0A0A] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={finalReport.chartData}>
                        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                        <XAxis dataKey="quarter" stroke="#6b7280" />
                        <YAxis stroke="#6b7280" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0A0A0A",
                            border: "1px solid #1f2937",
                            color: "#f3f4f6",
                          }}
                        />
                        <Bar dataKey="revenue" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-3 border-t border-gray-800 pt-3 text-xs text-gray-500">
                    {finalReport.receipts.map((receipt) => (
                      <div key={receipt}>Definition receipt: {receipt}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
