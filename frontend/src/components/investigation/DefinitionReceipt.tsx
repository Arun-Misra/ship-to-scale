import type { DefinitionReceipt as Receipt } from "@/types";

interface Props {
  receipt: Receipt;
}

export function DefinitionReceipt({ receipt }: Props) {
  return (
    <div className="flex items-start gap-2 text-xs text-gray-400 py-1">
      <span className="font-mono text-brand-500 shrink-0">{receipt.term}</span>
      <span>=</span>
      <span className="text-gray-300">{receipt.definition}</span>
      <span className="ml-auto text-gray-600 shrink-0">{receipt.source}</span>
    </div>
  );
}
