/**
 * Streaming reasoning panel — the spectator view.
 * Append-only. NEVER parsed. This is the product differentiator.
 */
interface Props {
  text: string;
  isStreaming: boolean;
}

export function ReasoningPanel({ text, isStreaming }: Props) {
  return (
    <div className="p-4 h-full">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>Agent Reasoning</span>
        {isStreaming && <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />}
      </div>
      <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
        {text}
        {isStreaming && <span className="animate-pulse">▊</span>}
      </pre>
    </div>
  );
}
