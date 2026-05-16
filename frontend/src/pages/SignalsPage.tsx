import { AlertCircle, Play } from "lucide-react";
import { Link } from "react-router-dom";

interface SignalCard {
  id: string;
  title: string;
  details: string;
  priority: "critical" | "warning" | "informational";
}

const signals: SignalCard[] = [
  {
    id: "signal-critical-refunds",
    title: "⚠️ High Materiality Anomaly: Refund rate spike on SKU-203",
    details:
      "Refund rate on Premium Wireless Earbuds jumped 3x past standard deviation moving averages over the last 24 hours. Estimated material impact: ₹1,42,000 at risk. 18 separate transaction refunds isolated exclusively to consumer orders processed between April 14–15.",
    priority: "critical",
  },
  {
    id: "signal-warning-conversion",
    title: "Conversion softness detected in paid traffic cohort",
    details:
      "Click-through remained steady while checkout completion dropped below the trailing seven-day baseline across the last 12 hours.",
    priority: "warning",
  },
  {
    id: "signal-info-latency",
    title: "Monitoring note: delayed warehouse refresh window",
    details:
      "Background math checks are still healthy; current alert cadence reflects a fresh snapshot arriving slightly behind normal batch latency.",
    priority: "informational",
  },
];

function signalFrameClass(priority: SignalCard["priority"]) {
  if (priority === "critical") return "border-amber-500/30";
  return "border-gray-800";
}

export default function SignalsPage() {
  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      <div className="mb-8 rounded-lg border border-gray-800 bg-gray-900 p-6">
        <div className="mb-3 text-lg font-medium text-gray-100">Signals Engine</div>
        <p className="max-w-4xl text-sm leading-6 text-gray-400">
          Background mathematical monitoring executes cheap statistical checks against your isolated DuckDB database snapshot. This process is fully decoupled from your production database environment to protect operational capacity.
        </p>
      </div>

      <div className="space-y-4">
        {signals.map((signal, index) => (
          <div
            key={signal.id}
            className={`relative overflow-hidden rounded-lg border bg-gray-900 p-6 ${signalFrameClass(signal.priority)}`}
          >
            {index === 0 && <div className="absolute left-0 top-0 h-full w-1 bg-amber-500" />}
            <div className="flex items-start justify-between gap-6">
              <div className="max-w-5xl">
                <div className="mb-3 flex items-center gap-2 text-sm text-gray-100">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span>{signal.title}</span>
                </div>
                <p className="text-sm leading-6 text-gray-400">{signal.details}</p>
              </div>

              <div className="shrink-0 rounded-md border border-gray-800 bg-gray-950/70 px-3 py-1.5 text-xs font-mono text-gray-500">
                {signal.priority}
              </div>
            </div>

            {index === 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-800 pt-4">
                <Link
                  to="/investigate"
                  className="inline-flex items-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-4 py-2 text-sm text-gray-100 transition-colors hover:border-amber-500/40 hover:bg-gray-900"
                >
                  <Play className="h-4 w-4 text-amber-500" />
                  Trigger Deep Agent Root-Cause Investigation
                </Link>
                <span className="text-xs text-gray-500 font-mono">
                  Direct handoff to the Spectator UI investigation surface
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900 p-5 text-xs leading-6 text-gray-500">
        Monitoring feed remains intentionally decoupled from the production database path. Alert generation favors low-cost statistical checks and presents only material changes requiring human review.
      </div>
    </div>
  );
}
