import { useEffect, useState } from "react";
import { AlertCircle, Play, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getSignals } from "@/api/client";
import type { Signal } from "@/types";

function priorityFrameClass(priority: Signal["priority"]) {
  if (priority === "critical") return "border-amber-500/30";
  return "border-gray-800";
}

function priorityIconColor(priority: Signal["priority"]) {
  if (priority === "critical") return "text-amber-500";
  if (priority === "warning") return "text-yellow-500";
  return "text-blue-500";
}

export default function SignalsPage() {
  const { session } = useAppwrite();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    getSignals(session.jwt)
      .then((res) => setSignals(res.signals))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      <div className="mb-8 rounded-lg border border-gray-800 bg-gray-900 p-6">
        <div className="mb-3 text-lg font-medium text-gray-100">Signals Engine</div>
        <p className="max-w-4xl text-sm leading-6 text-gray-400">
          Background mathematical monitoring executes cheap statistical checks against your isolated DuckDB database snapshot. This process is fully decoupled from your production database environment to protect operational capacity.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading signals...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
      )}

      {!loading && !error && signals.length === 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 text-sm text-gray-500">
          No signals detected. All metrics are within normal variance.
        </div>
      )}

      <div className="space-y-4">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className={`relative overflow-hidden rounded-lg border bg-gray-900 p-6 ${priorityFrameClass(signal.priority)}`}
          >
            {signal.priority === "critical" && (
              <div className="absolute left-0 top-0 h-full w-1 bg-amber-500" />
            )}
            <div className="flex items-start justify-between gap-6">
              <div className="max-w-5xl">
                <div className="mb-3 flex items-center gap-2 text-sm text-gray-100">
                  <AlertCircle className={`h-4 w-4 ${priorityIconColor(signal.priority)}`} />
                  <span>{signal.title}</span>
                </div>
                <p className="text-sm leading-6 text-gray-400">{signal.details}</p>
              </div>

              <div className="shrink-0 rounded-md border border-gray-800 bg-gray-950/70 px-3 py-1.5 text-xs font-mono text-gray-500">
                {signal.priority}
              </div>
            </div>

            {signal.investigation && (
              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-800 pt-4">
                <Link
                  to="/investigate"
                  className="inline-flex items-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-4 py-2 text-sm text-gray-100 transition-colors hover:border-amber-500/40 hover:bg-gray-900"
                >
                  <Play className="h-4 w-4 text-amber-500" />
                  Trigger Deep Agent Root-Cause Investigation
                </Link>
                <span className="text-xs font-mono text-gray-500">
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
