import type { FinalResult } from "@/types";
import { ChartRenderer } from "./ChartRenderer";
import { DefinitionReceipt } from "./DefinitionReceipt";

interface Props {
  result: FinalResult;
}

const verdictStyles: Record<string, string> = {
  confirmed: "bg-red-500/[0.08] border-red-500/30 text-red-300",
  refuted: "bg-emerald-500/[0.08] border-emerald-500/30 text-emerald-300",
  inconclusive: "bg-white/[0.03] border-white/[0.08] text-zinc-300",
};

export function FinalReport({ result }: Props) {
  return (
    <div className="space-y-4">
      <div className={`p-4 rounded-lg border ${verdictStyles[result.verdict] ?? verdictStyles.inconclusive}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold uppercase">{result.verdict}</span>
          <span className="text-xs opacity-60">confidence: {result.confidence}</span>
        </div>
        <p className="text-sm leading-relaxed">{result.root_cause}</p>
        {result.recommended_action && (
          <p className="text-sm mt-2 opacity-80">
            <strong>Recommended:</strong> {result.recommended_action}
          </p>
        )}
      </div>

      {result.chart && result.data.length > 0 && (
        <ChartRenderer config={result.chart} data={result.data} />
      )}

      {result.definition_receipts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest">Definitions used</p>
          {result.definition_receipts.map((r) => (
            <DefinitionReceipt key={r.term} receipt={r} />
          ))}
        </div>
      )}
    </div>
  );
}
