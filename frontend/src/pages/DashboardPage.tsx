import { useEffect, useState } from "react";
import { BarChart3, Database, MessageSquare, Plus, Terminal, Bot, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getDashboard, getSlackStatus, activateSlack } from "@/api/client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import type { DashboardSummary } from "@/types";

export default function DashboardPage() {
  const { session } = useAppwrite();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [slackStatus, setSlackStatus] = useState<{ configured: boolean; activated: boolean; team: string } | null>(null);
  const [slackActivating, setSlackActivating] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    getDashboard(session.jwt)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard."))
      .finally(() => setLoading(false));
    getSlackStatus(session.jwt)
      .then(setSlackStatus)
      .catch(() => {});
  }, [session]);

  const handleSlackActivate = async () => {
    if (!session) return;
    setSlackActivating(true);
    setSlackError(null);
    try {
      const res = await activateSlack(session.jwt);
      setSlackStatus({ configured: true, activated: true, team: res.team });
    } catch (err) {
      setSlackError(err instanceof Error ? err.message : "Activation failed.");
    } finally {
      setSlackActivating(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const connectedSources = summary?.connected_sources ?? 0;
  const connections = summary?.connections ?? [];
  const recentConversations = summary?.recent_conversations ?? [];

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-100">Workspace Overview</div>
          <div className="mt-2 text-sm text-zinc-500">
            {connectedSources > 0
              ? `${connectedSources} data source${connectedSources !== 1 ? "s" : ""} connected`
              : "No data sources connected yet"}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] animate-pulse" />
            <span>Live</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-500 font-mono backdrop-blur-sm">
          <Terminal className="h-4 w-4 text-zinc-600" />
          Read-only workspace
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 backdrop-blur-sm transition-colors hover:border-white/[0.12] hover:bg-white/[0.05]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-500">Connected Sources</div>
              <div className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">
                {connectedSources}
              </div>
            </div>
            <div className="rounded-md border border-white/[0.07] bg-black/30 p-2 text-zinc-500">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <div className="text-sm text-zinc-600">
            {connectedSources === 0 ? (
              <Link to="/connections" className="text-sky-400 hover:text-sky-300">
                Connect a database →
              </Link>
            ) : (
              "Read-only, schema crawled"
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 backdrop-blur-sm transition-colors hover:border-white/[0.12] hover:bg-white/[0.05]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-500">Conversations</div>
              <div className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">
                {recentConversations.length}
              </div>
            </div>
            <div className="rounded-md border border-white/[0.07] bg-black/30 p-2 text-zinc-500">
              <MessageSquare className="h-4 w-4" />
            </div>
          </div>
          <div className="text-sm text-zinc-600">
            {recentConversations.length === 0 ? (
              <Link to="/chat" className="text-sky-400 hover:text-sky-300">
                Start your first chat →
              </Link>
            ) : (
              "Stored in Appwrite"
            )}
          </div>
        </div>

        {/* Slack card */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 backdrop-blur-sm transition-colors hover:border-white/[0.12] hover:bg-white/[0.05]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-zinc-500">Slack Bot</div>
              <div className="mt-2 flex items-center gap-2">
                {slackStatus?.activated ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="font-medium text-zinc-100 text-sm">{slackStatus.team || "Active"}</span>
                  </>
                ) : (
                  <span className="font-mono text-lg tracking-tight text-zinc-500">—</span>
                )}
              </div>
            </div>
            <div className="rounded-md border border-white/[0.07] bg-black/30 p-2 text-zinc-500">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          {slackError && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-400">
              {slackError}
            </div>
          )}
          {slackStatus?.activated ? (
            <div className="text-sm text-zinc-600">
              Mention the bot in any channel to query your data
            </div>
          ) : (
            <button
              onClick={handleSlackActivate}
              disabled={slackActivating || !slackStatus?.configured}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white shadow-[0_0_16px_rgba(14,165,233,0.25)] transition-all hover:bg-sky-400 disabled:opacity-50 disabled:shadow-none"
            >
              {slackActivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
              {slackActivating ? "Activating…" : slackStatus?.configured ? "Activate Bot" : "Token not configured"}
            </button>
          )}
        </div>
      </div>

      {/* Data Sources */}
      {connections.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium text-zinc-100">Data Sources</h2>
            <Link to="/connections" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
              Manage →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 backdrop-blur-sm transition-colors hover:border-white/[0.12]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-md border border-white/[0.07] bg-black/30 p-1.5">
                    <Database className="h-3.5 w-3.5 text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-100">{conn.label}</div>
                    <div className="font-mono text-xs text-zinc-600">{conn.kind}</div>
                  </div>
                </div>
                <Link
                  to={`/data-quality/${conn.id}`}
                  className="shrink-0 rounded-md border border-white/[0.08] p-1.5 text-zinc-500 transition-colors hover:border-sky-500/40 hover:text-sky-400"
                  title="Quality report"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
            <Link
              to="/connections"
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-zinc-600 transition-colors hover:border-sky-500/30 hover:text-sky-400"
            >
              <Plus className="h-4 w-4" />
              Add connection
            </Link>
          </div>
        </section>
      )}

      {/* Recent Conversations */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-zinc-100">Recent Conversations</h2>
          <Link to="/chat" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
            New chat →
          </Link>
        </div>

        {recentConversations.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-8 text-center text-zinc-600 text-sm backdrop-blur-sm">
            No conversations yet.{" "}
            <Link to="/chat" className="text-sky-400 hover:text-sky-300">
              Ask your first question
            </Link>{" "}
            to get started.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm">
            <div className="grid grid-cols-[1fr_80px_44px] border-b border-white/[0.06] px-4 py-3 text-xs uppercase tracking-wide text-zinc-600">
              <div>Conversation</div>
              <div>Messages</div>
              <div />
            </div>
            <div className="divide-y divide-white/[0.05]">
              {recentConversations.map((conv) => (
                <Link
                  key={conv.id}
                  to={`/chat?c=${conv.id}`}
                  className="grid grid-cols-[1fr_80px_44px] items-center px-4 py-4 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <MessageSquare className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                    <span className="text-sm text-zinc-100 truncate">{conv.title}</span>
                  </div>
                  <div className="font-mono text-xs text-zinc-600">{conv.message_count}</div>
                  <div className="flex justify-end">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.07] text-zinc-600 hover:text-zinc-100 hover:border-white/[0.14]">
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
