/**
 * P5 — Dashboard: connected sources count, key metrics, recent investigations.
 * Owner: FE
 */
import { useEffect, useState } from "react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getDashboard } from "@/api/client";
import type { DashboardSummary } from "@/types";
import { SourceCard } from "@/components/dashboard/SourceCard";
import { MetricSnapshot } from "@/components/dashboard/MetricSnapshot";
import { formatDate } from "@/lib/utils";

export default function DashboardPage() {
  const { session } = useAppwrite();
  const [data, setData] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    if (session) getDashboard(session.jwt).then(setData).catch(() => {});
  }, [session]);

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SourceCard count={data?.connected_sources ?? 0} lastQuery={data?.last_query_at ?? null} />
        {(data?.key_metrics ?? []).map((m) => (
          <MetricSnapshot key={m.label} label={m.label} value={m.value} trend={m.trend} />
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Investigations</h2>
        <div className="space-y-2">
          {(data?.recent_investigations ?? []).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg border border-gray-800">
              <span className="text-sm text-gray-200">{inv.question}</span>
              <div className="flex items-center gap-3">
                {inv.verdict && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${inv.verdict === "confirmed" ? "bg-red-900 text-red-300" : inv.verdict === "refuted" ? "bg-green-900 text-green-300" : "bg-gray-700 text-gray-400"}`}>
                    {inv.verdict}
                  </span>
                )}
                <span className="text-xs text-gray-500">{formatDate(inv.created_at)}</span>
              </div>
            </div>
          ))}
          {!data?.recent_investigations?.length && (
            <p className="text-sm text-gray-500">No investigations yet. Ask your first question.</p>
          )}
        </div>
      </section>
    </div>
  );
}
