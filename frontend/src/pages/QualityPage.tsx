import { Activity, AlertTriangle, CheckCircle2, Database, Info, ShieldAlert } from "lucide-react";

interface DataIssue {
  id: string;
  severity: "high" | "medium" | "low";
  table: string;
  column: string;
  message: string;
}

const issues: DataIssue[] = [
  {
    id: "issue-date-format",
    severity: "high",
    table: "orders",
    column: "date",
    message:
      "⚠️ 412 rows: 'date' column contains mixed structural string formats (e.g., '12/01/24' vs 'Jan-1-2024') preventing uniform schema parsing.",
  },
  {
    id: "issue-revenue-text",
    severity: "medium",
    table: "orders",
    column: "revenue",
    message:
      "⚠️ 87 rows: 'revenue' field stored as string/text values (e.g., '1,200', 'N/A') instead of numeric floating points.",
  },
  {
    id: "issue-duplicates",
    severity: "low",
    table: "customers",
    column: "email",
    message:
      "⚠️ 156 records identified as likely duplicate consumer entity profiles based on overlapping email strings.",
  },
];

const severityStyles = {
  high: "border-red-500/30 text-red-400 bg-red-500/5",
  medium: "border-amber-500/30 text-amber-400 bg-amber-500/5",
  low: "border-blue-500/30 text-blue-400 bg-blue-500/5",
} as const;

export default function QualityPage() {
  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      <div className="mb-8 flex items-start justify-between gap-6 border-b border-gray-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-gray-500">
            <Database className="h-4 w-4 text-gray-500" />
            Read-only diagnostic surface
          </div>
          <h1 className="mt-3 text-xl font-medium text-gray-100">Data Quality Scan Report</h1>
          <p className="mt-2 text-sm text-gray-500">Source: sales_export_unclean.csv</p>
        </div>
        <div className="rounded-md border border-gray-800 bg-gray-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-gray-500">
          scan_id: dq-0941
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-sky-500/30 hover:bg-gray-900/80">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total Rows Scanned</div>
          <div className="mt-3 font-mono text-2xl text-gray-100">12,450</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-sky-500/30 hover:bg-gray-900/80">
          <div className="text-xs uppercase tracking-wide text-gray-500">Issues Flagged</div>
          <div className="mt-3 font-mono text-2xl text-gray-100">3</div>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-sky-500/30 hover:bg-gray-900/80">
          <div className="text-xs uppercase tracking-wide text-gray-500">Health Score</div>
          <div className="mt-3 font-mono text-2xl text-gray-100">92.4%</div>
        </div>
      </div>

      <div className="mt-8 mb-4 flex items-center gap-2 text-sm text-gray-100">
        <Activity className="h-4 w-4 text-gray-500" />
        Anomaly Inventory
      </div>

      <div className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        {issues.map((issue) => (
          <div key={issue.id} className={`p-4 transition-colors hover:bg-gray-900/80 ${severityStyles[issue.severity]}`}>
            <div className="flex items-start gap-4">
              <div className="mt-1 h-full w-1 rounded bg-current" />
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                  {issue.severity === "high" ? <AlertTriangle className="h-4 w-4 text-red-400" /> : issue.severity === "medium" ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <Info className="h-4 w-4 text-blue-400" />}
                  <span>{issue.severity} severity</span>
                  <span className="text-gray-600">•</span>
                  <span>{issue.table}.{issue.column}</span>
                </div>
                <p className="text-sm leading-6 text-gray-300">{issue.message}</p>
              </div>
              <CheckCircle2 className="mt-1 h-4 w-4 text-gray-600 transition-colors hover:text-gray-300" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
