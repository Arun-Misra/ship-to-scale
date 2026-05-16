import type { StepState } from "@/types";

interface Props {
  step: StepState;
}

const statusColors: Record<string, string> = {
  ok: "text-green-400",
  explain_error: "text-yellow-400",
  exec_error: "text-red-400",
  validation_error: "text-orange-400",
  timeout: "text-red-400",
  row_cap: "text-yellow-400",
};

export function StepCard({ step }: Props) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 bg-gray-800 flex items-center gap-2">
        <span className="text-xs font-mono text-gray-400">Step {step.step}</span>
        {step.observation && (
          <span className={`text-xs font-mono ${statusColors[step.observation.status] ?? "text-gray-400"}`}>
            {step.observation.status}
          </span>
        )}
      </div>

      {step.action?.type === "sql_query" && (
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-xs text-gray-500 mb-1">{step.action.intent}</p>
          <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap overflow-x-auto">{step.action.sql}</pre>
        </div>
      )}

      {step.observation && (
        <div className="px-4 py-3">
          {step.observation.error && <p className="text-xs text-red-400 font-mono">{step.observation.error}</p>}
          {step.observation.preview && (
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr>
                    {(step.observation.columns ?? []).map((c) => (
                      <th key={c} className="text-left text-gray-500 pr-4 pb-1">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {step.observation.preview.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="text-gray-300 pr-4 py-0.5">{String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {step.observation.truncated && <p className="text-xs text-gray-600 mt-1">Row cap reached — agent will aggregate.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
