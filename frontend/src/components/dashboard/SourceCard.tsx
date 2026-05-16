import { formatDate } from "@/lib/utils";

interface Props {
  count: number;
  lastQuery: string | null;
}

export function SourceCard({ count, lastQuery }: Props) {
  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <p className="text-xs text-gray-500 mb-1">Connected Sources</p>
      <p className="text-3xl font-bold text-white">{count}</p>
      {lastQuery && <p className="text-xs text-gray-600 mt-1">Last query {formatDate(lastQuery)}</p>}
    </div>
  );
}
