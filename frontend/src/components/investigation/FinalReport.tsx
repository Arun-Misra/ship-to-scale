import type { FinalResult } from "@/types";
import { ChartRenderer } from "./ChartRenderer";
import { DefinitionReceipt } from "./DefinitionReceipt";

interface Props {
  result: FinalResult;
}

const verdictStyles: Record<string, string> = {
  confirmed: "bg-red-950 border-red-800 text-red-300",
  refuted: "bg-green-950 border-green-800 text-green-300",
  inconclusive: "bg-gray-800 border-gray-700 text-gray-300",
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
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Definitions used</p>
          {result.definition_receipts.map((r) => (
            <DefinitionReceipt key={r.term} receipt={r} />
          ))}
        </div>
      )}
    </div>
  );
}
