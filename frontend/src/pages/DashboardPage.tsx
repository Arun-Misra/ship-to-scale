import { useEffect, useState } from "react";
import { ArrowUpRight, CheckCircle2, Database, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getDashboard } from "@/api/client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import type { DashboardSummary, Verdict } from "@/types";

function verdictClasses(verdict: Verdict | null) {
  if (verdict === "confirmed") return "border-red-500/30 text-red-400 bg-red-500/5";
  if (verdict === "refuted") return "border-emerald-500/30 text-emerald-400 bg-emerald-500/5";
  return "border-gray-700 text-gray-400 bg-gray-900";
}

export default function DashboardPage() {
  const { session } = useAppwrite();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    getDashboard(session.jwt)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, [session]);

  if (loading) return <LoadingSpinner />;

  const connectedSources = summary?.connected_sources ?? 0;
  const recentInvestigations = summary?.recent_investigations ?? [];

  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Workspace Overview</div>
          <div className="mt-2 text-sm text-gray-500">
            {connectedSources > 0
              ? `${connectedSources} data source${connectedSources !== 1 ? "s" : ""} connected`
              : "No data sources connected yet"}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-gray-400 font-mono">
          <Terminal className="h-4 w-4 text-gray-500" />
          Read-only workspace
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-gray-400">Connected Sources</div>
              <div className="mt-2 font-mono text-3xl tracking-tight text-gray-100">
                {connectedSources}
              </div>
            </div>
            <div className="rounded-md border border-gray-800 bg-gray-950 p-2 text-gray-500">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {connectedSources === 0 ? "Connect a database to start" : "Read-only, schema crawled"}
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-gray-400">Investigations Run</div>
              <div className="mt-2 font-mono text-3xl tracking-tight text-gray-100">
                {recentInvestigations.length}
              </div>
            </div>
            <div className="rounded-md border border-gray-800 bg-gray-950 p-2 text-gray-500">
              <Terminal className="h-4 w-4" />
            </div>
          </div>
          <div className="text-sm text-gray-500">This session</div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-gray-400">Confirmed Anomalies</div>
              <div className="mt-2 font-mono text-3xl tracking-tight text-amber-500">
                {recentInvestigations.filter((i) => i.verdict === "confirmed").length}
              </div>
            </div>
            <div className="rounded-md border border-gray-800 bg-gray-950 p-2 text-gray-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-sm text-gray-500">Require follow-up action</div>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-gray-100">Recent Investigations</h2>
          <Link to="/investigate" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
            Start new →
          </Link>
        </div>

        {recentInvestigations.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-500 text-sm">
            No investigations yet.{" "}
            <Link to="/investigate" className="text-sky-400 hover:text-sky-300">
              Ask a question
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
            <div className="grid grid-cols-[1.5fr_160px_1.8fr_44px] border-b border-gray-800 px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
              <div>Query</div>
              <div>Verdict</div>
              <div>Conclusion</div>
              <div />
            </div>
            <div className="divide-y divide-gray-800">
              {recentInvestigations.map((inv) => (
                <div key={inv.id} className="grid grid-cols-[1.5fr_160px_1.8fr_44px] items-center px-4 py-4 transition-colors hover:bg-gray-950/60">
                  <div className="text-sm text-gray-100 pr-4">{inv.question}</div>
                  <div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${verdictClasses(inv.verdict)}`}>
                      {inv.verdict ?? inv.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 pr-4">{inv.conclusion ?? "—"}</div>
                  <div className="flex justify-end">
                    <Link
                      to="/investigate"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-800 text-gray-400 transition-colors hover:border-gray-700 hover:bg-gray-950 hover:text-gray-100"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
