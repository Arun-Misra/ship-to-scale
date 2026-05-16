import type { QualityIssue } from "@/types";

interface Props {
  issue: QualityIssue;
}

const sevBorder: Record<string, string> = {
  high: "border-red-800",
  medium: "border-yellow-800",
  low: "border-gray-700",
};

export function IssueCard({ issue }: Props) {
  return (
    <div className={`p-4 bg-gray-900 rounded-lg border ${sevBorder[issue.severity] ?? "border-gray-700"}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm text-gray-200">{issue.message}</p>
        <span className="text-xs text-gray-500 shrink-0">{issue.table}.{issue.column}</span>
      </div>
      {issue.examples.length > 0 && (
        <p className="text-xs text-gray-500 font-mono">
          e.g. {issue.examples.slice(0, 3).join(" · ")}
        </p>
      )}
    </div>
  );
}
