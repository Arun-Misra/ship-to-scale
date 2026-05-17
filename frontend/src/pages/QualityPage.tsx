import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getQualityReport, getConnections } from "@/api/client";
import type { QualityReport, QualityIssue, Connection } from "@/types";

const REFRESH_MS = 15 * 60 * 1000;

const severityStyles = {
  high: "border-red-500/30 text-red-400 bg-red-500/5",
  medium: "border-amber-500/30 text-amber-400 bg-amber-500/5",
  low: "border-blue-500/30 text-blue-400 bg-blue-500/5",
} as const;

function SeverityIcon({ severity }: { severity: QualityIssue["severity"] }) {
  if (severity === "high") return <AlertTriangle className="h-4 w-4 text-red-400" />;
  if (severity === "medium") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
  return <Info className="h-4 w-4 text-blue-400" />;
}

export default function QualityPage() {
  const { connectionId } = useParams<{ connectionId: string }>();
  const { session } = useAppwrite();
  const navigate = useNavigate();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [connsLoading, setConnsLoading] = useState(true);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Load connections, then redirect to first if no connectionId in URL
  useEffect(() => {
    if (!session) return;
    getConnections(session.jwt)
      .then(({ connections: conns }) => {
        setConnections(conns);
        if (!connectionId && conns.length > 0) {
          navigate(`/data-quality/${conns[0].id}`, { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => setConnsLoading(false));
  }, [session]); // only once on mount — navigate/connectionId excluded intentionally

  const fetchReport = useCallback(
    (isManual = false) => {
      if (!session || !connectionId) return;
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);
      getQualityReport(session.jwt, connectionId)
        .then((r) => {
          setReport(r);
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
    setReport(null);
    fetchReport();
    const id = setInterval(() => fetchReport(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchReport, connectionId]);

  // No connectionId and connections have loaded but list is empty
  if (!connectionId && !connsLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-950 px-8 text-center">
        <Database className="mb-4 h-12 w-12 text-gray-700" />
        <h2 className="mb-2 text-lg font-medium text-gray-200">No databases connected</h2>
        <p className="mb-6 text-sm text-gray-500">
          Connect a database to run data quality scans.
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
  const scannedAt = report?.scanned_at
    ? new Date(report.scanned_at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour12: true,
      })
    : null;
  const refreshedAt = lastRefreshed
    ? lastRefreshed.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true })
    : null;

  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-6 border-b border-gray-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-gray-500">
            <Database className="h-4 w-4" />
            Read-only diagnostic surface
          </div>
          <h1 className="mt-3 text-xl font-medium text-gray-100">Data Quality Scan Report</h1>
          {scannedAt && (
            <p className="mt-2 text-sm text-gray-500">Scanned at: {scannedAt} IST</p>
          )}
        </div>

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
                        navigate(`/data-quality/${c.id}`);
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
            onClick={() => fetchReport(true)}
            disabled={refreshing}
            title="Refresh now"
            className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Auto-refresh notice */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 flex-1 transition-colors hover:border-sky-500/30">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-100">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Diagnostic Isolation Mode
          </div>
          <p className="text-sm leading-6 text-gray-400">
            This report is strictly read-only. Viriya operates on an isolated data replica layer and never modifies, overwrites, or alters your raw production database schemas.
          </p>
        </div>
        {refreshedAt && (
          <div className="shrink-0 rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-right text-[11px] text-gray-500">
            <div className="text-gray-600 mb-0.5">Last refreshed</div>
            <div>{refreshedAt} IST</div>
            <div className="mt-1 text-[10px] text-gray-700">Auto-refreshes every 15 min</div>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running quality scan…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-sky-500/30 hover:bg-gray-900/80">
              <div className="text-xs uppercase tracking-wide text-gray-500">Issues Flagged</div>
              <div className="mt-3 font-mono text-2xl text-gray-100">{report.issues.length}</div>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-gray-900 p-5 transition-colors hover:bg-gray-900/80">
              <div className="text-xs uppercase tracking-wide text-gray-500">High Severity</div>
              <div className="mt-3 font-mono text-2xl text-red-400">{report.summary.high}</div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-gray-900 p-5 transition-colors hover:bg-gray-900/80">
              <div className="text-xs uppercase tracking-wide text-gray-500">Medium / Low</div>
              <div className="mt-3 font-mono text-2xl text-amber-400">
                {report.summary.medium} / {report.summary.low}
              </div>
            </div>
          </div>

          <div className="mt-8 mb-4 flex items-center gap-2 text-sm text-gray-100">
            <Activity className="h-4 w-4 text-gray-500" />
            Anomaly Inventory
          </div>

          {report.issues.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 p-6 text-sm text-gray-500">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              No issues found. Your data looks clean.
            </div>
          ) : (
            <div className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
              {report.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={`p-4 transition-colors hover:bg-gray-900/80 ${severityStyles[issue.severity]}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1 h-full w-1 rounded bg-current" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                        <SeverityIcon severity={issue.severity} />
                        <span>{issue.severity} severity</span>
                        <span className="text-gray-600">•</span>
                        <span>
                          {issue.table}.{issue.column}
                        </span>
                      </div>
                      <p className="text-sm leading-6 text-gray-300">{issue.message}</p>
                      {issue.examples.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {issue.examples.slice(0, 4).map((ex, i) => (
                            <span
                              key={i}
                              className="rounded border border-gray-700 bg-gray-950 px-1.5 py-0.5 font-mono text-xs text-gray-400"
                            >
                              {ex}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <CheckCircle2 className="mt-1 h-4 w-4 text-gray-600 transition-colors hover:text-gray-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
