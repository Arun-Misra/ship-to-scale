import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, Database, Info, Loader2, ShieldAlert } from "lucide-react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getQualityReport } from "@/api/client";
import type { QualityReport, QualityIssue } from "@/types";

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
  const [report, setReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !connectionId) return;
    getQualityReport(session.jwt, connectionId)
      .then(setReport)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session, connectionId]);

  const scannedAt = report?.scanned_at
    ? new Date(report.scanned_at).toLocaleString("en-IN", { timeZone: "UTC", hour12: false })
    : null;

  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      <div className="mb-8 flex items-start justify-between gap-6 border-b border-gray-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-gray-500">
            <Database className="h-4 w-4 text-gray-500" />
            Read-only diagnostic surface
          </div>
          <h1 className="mt-3 text-xl font-medium text-gray-100">Data Quality Scan Report</h1>
          {scannedAt && <p className="mt-2 text-sm text-gray-500">Scanned at: {scannedAt} UTC</p>}
        </div>
        <div className="rounded-md border border-gray-800 bg-gray-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-gray-500">
          {connectionId}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-sky-500/30 hover:bg-gray-900/80">
        <div className="mb-2 flex items-center gap-2 text-sm text-gray-100">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          Diagnostic Isolation Mode
        </div>
        <p className="max-w-5xl text-sm leading-6 text-gray-400">
          This report is strictly read-only. Viriya operates on an isolated data replica layer and never modifies, overwrites, or alters your raw production database schemas. Data integrity remains 100% immutable.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running quality scan...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">{error}</div>
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
