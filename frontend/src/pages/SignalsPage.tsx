import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AlertCircle, ChevronDown, Database, Loader2, Play, RefreshCw } from "lucide-react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getSignals, getConnections } from "@/api/client";
import type { Signal, Connection } from "@/types";

const REFRESH_MS = 15 * 60 * 1000;

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
  const { connectionId } = useParams<{ connectionId: string }>();
  const { session } = useAppwrite();
  const navigate = useNavigate();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [connsLoading, setConnsLoading] = useState(true);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load connections, redirect to first if no connectionId
  useEffect(() => {
    if (!session) return;
    getConnections(session.jwt)
      .then(({ connections: conns }) => {
        setConnections(conns);
        if (!connectionId && conns.length > 0) {
          navigate(`/signals/${conns[0].id}`, { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => setConnsLoading(false));
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSignals = useCallback(
    (isManual = false) => {
      if (!session || !connectionId) return;
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);
      getSignals(session.jwt, connectionId)
        .then((res) => {
          setSignals(res.signals);
          setLastRefreshed(new Date());
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
        });
    },
    [session, connectionId]
  );

  // Fetch on mount / connectionId change + auto-refresh every 15 min
  useEffect(() => {
    if (!connectionId) return;
    setSignals([]);
    fetchSignals();
    const id = setInterval(() => fetchSignals(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchSignals, connectionId]);

  // No connectionId and connections loaded but list is empty
  if (!connectionId && !connsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-950 px-8 text-center">
        <Database className="mb-4 h-12 w-12 text-gray-700" />
        <h2 className="mb-2 text-lg font-medium text-gray-200">No databases connected</h2>
        <p className="mb-6 text-sm text-gray-500">
          Connect a database to start monitoring signals.
        </p>
        <Link
          to="/connections"
          className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-5 py-2.5 text-sm text-sky-400 transition-colors hover:bg-sky-500/20"
        >
          Connect a database →
        </Link>
      </div>
    );
  }

  // Waiting for redirect
  if (!connectionId) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950">
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      </div>
    );
  }

  const activeConn = connections.find((c) => c.id === connectionId);
  const refreshedAt = lastRefreshed
    ? lastRefreshed.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true })
    : null;

  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 flex-1">
          <div className="mb-3 text-lg font-medium text-gray-100">Signals Engine</div>
          <p className="max-w-4xl text-sm leading-6 text-gray-400">
            Background statistical monitoring executes cheap checks against your isolated DuckDB snapshot.
            Fully decoupled from your production database to protect operational capacity.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3 pt-1">
          <div className="flex items-center gap-3">
            {/* Connection switcher */}
            {connections.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
                >
                  <Database className="h-3.5 w-3.5 text-gray-400" />
                  <span>{activeConn?.label ?? connectionId}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                    {connections.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate(`/signals/${c.id}`);
                        }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-800 ${
                          c.id === connectionId ? "text-sky-400" : "text-gray-300"
                        }`}
                      >
                        <Database className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                        <div className="min-w-0">
                          <div className="truncate">{c.label}</div>
                          <div className="font-mono text-[10px] text-gray-500">{c.kind}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Manual refresh */}
            <button
              onClick={() => fetchSignals(true)}
              disabled={refreshing}
              title="Refresh now"
              className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {refreshedAt && (
            <div className="text-right text-[11px] text-gray-600">
              <div>Last refreshed: {refreshedAt} IST</div>
              <div className="text-[10px] text-gray-700">Auto-refreshes every 15 min</div>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Computing signals…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
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
                <button
                  onClick={() => {
                    const prompt =
                      `Signal detected: ${signal.title}\n\n` +
                      `${signal.details}\n\n` +
                      `Please do a deep root-cause analysis of this issue. ` +
                      `Run the relevant SQL queries, explain what is driving this anomaly, ` +
                      `and give specific recommendations to address it.`;
                    const params = new URLSearchParams({ prompt });
                    if (connectionId) params.set("conn", connectionId);
                    navigate(`/chat?${params.toString()}`);
                  }}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-4 py-2 text-sm text-gray-100 transition-colors hover:border-amber-500/40 hover:bg-gray-900"
                >
                  <Play className="h-4 w-4 text-amber-500" />
                  Trigger Deep Agent Root-Cause Investigation
                </button>
                <span className="text-xs font-mono text-gray-500">
                  Direct handoff to the investigation surface
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
