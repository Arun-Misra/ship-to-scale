import { useEffect, useState } from "react";
import { Database, Plus, BarChart3, Loader2, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getConnections, registerConnection, deleteConnection } from "@/api/client";
import type { Connection } from "@/types";

function KindBadge({ kind }: { kind: string }) {
  const cls =
    kind === "postgres"
      ? "border-violet-500/30 text-violet-400 bg-violet-500/[0.05]"
      : "border-sky-500/30 text-sky-400 bg-sky-500/[0.05]";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-mono ${cls}`}>
      {kind}
    </span>
  );
}

export default function ConnectionsPage() {
  const { session } = useAppwrite();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<"demo" | "postgres">("demo");
  const [label, setLabel] = useState("");
  const [dsn, setDsn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadConnections = () => {
    if (!session) return;
    setLoading(true);
    getConnections(session.jwt)
      .then((res) => setConnections(res.connections))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadConnections, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!label.trim()) { setFormError("Label is required."); return; }
    if (kind === "postgres" && !dsn.trim()) { setFormError("DSN is required for Postgres."); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      await registerConnection(session.jwt, {
        kind,
        label: label.trim(),
        dsn: kind === "postgres" ? dsn.trim() : undefined,
      });
      setLabel(""); setDsn(""); setKind("demo"); setShowForm(false);
      loadConnections();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to register connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!session) return;
    setDeletingId(connectionId);
    setDeleteError(null);
    try {
      await deleteConnection(session.jwt, connectionId);
      setConnections((prev) => prev.filter((c) => c.id !== connectionId));
      setConfirmDeleteId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete connection.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-100">Connections</div>
          <div className="mt-1 text-sm text-zinc-500">
            Manage data sources. All connections are read-only.
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all hover:bg-sky-400 hover:shadow-[0_0_28px_rgba(14,165,233,0.45)]"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Connection"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-6 space-y-4 backdrop-blur-sm"
          style={{ boxShadow: "0 0 40px rgba(14,165,233,0.05)" }}
        >
          <div className="text-sm font-medium text-zinc-200">Register new connection</div>

          <div className="flex gap-3">
            {(["demo", "postgres"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                  kind === k
                    ? "border-sky-500/40 bg-sky-500/[0.08] text-sky-300"
                    : "border-white/[0.07] bg-white/[0.02] text-zinc-500 hover:border-white/[0.14] hover:text-zinc-300"
                }`}
              >
                {k === "demo" ? "Demo dataset" : "PostgreSQL"}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={kind === "demo" ? "Demo DB" : "Production Postgres"}
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 focus:border-sky-500/40 focus:bg-sky-500/[0.04] focus:outline-none transition-colors"
            />
          </div>

          {kind === "postgres" && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">Postgres DSN</label>
              <input
                value={dsn}
                onChange={(e) => setDsn(e.target.value)}
                placeholder="postgresql://user:pass@host:5432/db"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 font-mono focus:border-sky-500/40 focus:bg-sky-500/[0.04] focus:outline-none transition-colors"
              />
              <p className="mt-1.5 text-xs text-zinc-600">Requires a read-only role (SELECT only).</p>
            </div>
          )}

          {formError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-sm text-red-400">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-medium text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all hover:bg-sky-400 hover:shadow-[0_0_28px_rgba(14,165,233,0.45)] disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? "Registering..." : "Register Connection"}
          </button>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {deleteError && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-400 flex items-center justify-between gap-3">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError(null)} className="shrink-0 text-red-500 hover:text-red-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connections...
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] p-10 text-center">
          <Database className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
          <div className="text-sm text-zinc-500">No connections registered yet.</div>
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-sky-400 hover:text-sky-300"
          >
            Add your first connection →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm transition-colors hover:border-white/[0.10]"
            >
              {/* Main row */}
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="rounded-xl border border-white/[0.07] bg-black/30 p-2 shrink-0">
                    <Database className="h-4 w-4 text-zinc-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-100">{conn.label}</div>
                    <div className="mt-0.5 font-mono text-xs text-zinc-600">{conn.id.slice(0, 8)}…</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <KindBadge kind={conn.kind} />
                  <Link
                    to={`/data-quality/${conn.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-sky-500/40 hover:text-sky-400"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    Quality
                  </Link>
                  {confirmDeleteId === conn.id ? (
                    // Inline confirm row
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(conn.id)}
                        disabled={deletingId === conn.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/[0.08] px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/[0.14] disabled:opacity-50"
                      >
                        {deletingId === conn.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {deletingId === conn.id ? "Deleting…" : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-xl border border-white/[0.07] px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-white/[0.14] hover:text-zinc-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setConfirmDeleteId(conn.id); setDeleteError(null); }}
                      className="rounded-xl border border-white/[0.07] p-1.5 text-zinc-600 transition-colors hover:border-red-500/30 hover:text-red-400"
                      title="Delete connection"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Confirm warning banner */}
              {confirmDeleteId === conn.id && (
                <div className="border-t border-red-500/10 bg-red-500/[0.04] px-5 py-3 rounded-b-2xl">
                  <p className="text-xs text-red-400">
                    This will permanently remove the connection and delete all associated conversations and signals from your workspace.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
