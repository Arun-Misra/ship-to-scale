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
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] overflow-hidden backdrop-blur-sm">
      <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
        <span className="text-xs font-mono text-zinc-500">Step {step.step}</span>
        {step.observation && (
          <span className={`text-xs font-mono ${statusColors[step.observation.status] ?? "text-zinc-500"}`}>
            {step.observation.status}
          </span>
        )}
      </div>

      {step.action?.type === "sql_query" && (
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <p className="text-xs text-zinc-600 mb-1">{step.action.intent}</p>
          <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap overflow-x-auto">{step.action.sql}</pre>
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
                      <th key={c} className="text-left text-zinc-600 pr-4 pb-1">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {step.observation.preview.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="text-zinc-300 pr-4 py-0.5">{String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {step.observation.truncated && <p className="text-xs text-zinc-700 mt-1">Row cap reached — agent will aggregate.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
