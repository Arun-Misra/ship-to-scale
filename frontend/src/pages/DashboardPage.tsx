import { useEffect, useState } from "react";
import { BarChart3, Database, MessageSquare, Plus, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getDashboard } from "@/api/client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import type { DashboardSummary } from "@/types";

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
  const connections = summary?.connections ?? [];
  const recentConversations = summary?.recent_conversations ?? [];

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

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-8">
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
            {connectedSources === 0 ? (
              <Link to="/connections" className="text-sky-400 hover:text-sky-300">Connect a database →</Link>
            ) : "Read-only, schema crawled"}
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-gray-400">Conversations</div>
              <div className="mt-2 font-mono text-3xl tracking-tight text-gray-100">
                {recentConversations.length}
              </div>
            </div>
            <div className="rounded-md border border-gray-800 bg-gray-950 p-2 text-gray-500">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="text-sm text-gray-500">
            {recentConversations.length === 0 ? (
              <Link to="/chat" className="text-sky-400 hover:text-sky-300">Start your first chat →</Link>
            ) : "Stored in Appwrite"}
          </div>
        </div>
      </div>

      {/* Data Sources */}
      {connections.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium text-gray-100">Data Sources</h2>
            <Link to="/connections" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
              Manage →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-md border border-gray-800 bg-gray-950 p-1.5">
                    <Database className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-100">{conn.label}</div>
                    <div className="font-mono text-xs text-gray-500">{conn.kind}</div>
                  </div>
                </div>
                <Link
                  to={`/data-quality/${conn.id}`}
                  className="shrink-0 rounded-md border border-gray-700 p-1.5 text-gray-400 transition-colors hover:border-sky-500/40 hover:text-sky-400"
                  title="Quality report"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
            <Link
              to="/connections"
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-700 bg-gray-900/40 px-4 py-3 text-sm text-gray-500 transition-colors hover:border-sky-500/30 hover:text-sky-400"
            >
              <Plus className="h-4 w-4" />
              Add connection
            </Link>
          </div>
        </section>
      )}

      {/* Recent Conversations — same data as sidebar */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-gray-100">Recent Conversations</h2>
          <Link to="/chat" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
            New chat →
          </Link>
        </div>

        {recentConversations.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-500 text-sm">
            No conversations yet.{" "}
            <Link to="/chat" className="text-sky-400 hover:text-sky-300">
              Ask your first question
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
            <div className="grid grid-cols-[1fr_80px_44px] border-b border-gray-800 px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
              <div>Conversation</div>
              <div>Messages</div>
              <div />
            </div>
            <div className="divide-y divide-gray-800">
              {recentConversations.map((conv) => (
                <Link
                  key={conv.id}
                  to={`/chat?c=${conv.id}`}
                  className="grid grid-cols-[1fr_80px_44px] items-center px-4 py-4 transition-colors hover:bg-gray-950/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MessageSquare className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                    <span className="text-sm text-gray-100 truncate">{conv.title}</span>
                  </div>
                  <div className="font-mono text-xs text-gray-500">{conv.message_count}</div>
                  <div className="flex justify-end">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-800 text-gray-500 hover:text-gray-100 hover:border-gray-700">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
