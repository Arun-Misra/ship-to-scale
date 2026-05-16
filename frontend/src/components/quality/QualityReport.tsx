import type { QualityReport } from "@/types";
import { IssueCard } from "./IssueCard";

interface Props {
  report: QualityReport;
}

export function QualityReportView({ report }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {(["high", "medium", "low"] as const).map((sev) => (
          <div key={sev} className="px-4 py-2 bg-gray-900 rounded-lg border border-gray-800">
            <span className={`text-lg font-bold ${sev === "high" ? "text-red-400" : sev === "medium" ? "text-yellow-400" : "text-gray-400"}`}>
              {report.summary[sev]}
            </span>
            <span className="text-xs text-gray-500 ml-1">{sev}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {report.issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
        {!report.issues.length && <p className="text-sm text-green-400">No issues found in the sampled data.</p>}
      </div>
    </div>
  );
}
