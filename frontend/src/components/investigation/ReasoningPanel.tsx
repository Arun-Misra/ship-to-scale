/**
 * Streaming reasoning panel — the spectator view.
 * Append-only. NEVER parsed. This is the product differentiator.
 */
interface Props {
  text: string;
  isStreaming: boolean;
}

export function ReasoningPanel({ text, isStreaming }: Props) {
  const hasText = text.trim().length > 0;

  return (
    <div className="h-full bg-gray-900 font-mono text-sm p-4 text-gray-300">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>Reasoning Stream</span>
        {isStreaming && <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />}
      </div>
      <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
        {hasText ? text : "> Waiting for query..."}
        <span className="cursor-blink">▊</span>
      </pre>
    </div>
  );
}
