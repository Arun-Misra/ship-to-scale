import { useEffect, useState } from "react";
import { Database, Plus, BarChart3, Loader2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getConnections, registerConnection } from "@/api/client";
import type { Connection } from "@/types";

function KindBadge({ kind }: { kind: string }) {
  const cls = kind === "postgres"
    ? "border-violet-500/30 text-violet-400 bg-violet-500/5"
    : "border-sky-500/30 text-sky-400 bg-sky-500/5";
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

  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Connections</div>
          <div className="mt-1 text-sm text-gray-500">
            Manage data sources. All connections are read-only.
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-400"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Connection"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-xl border border-sky-500/20 bg-gray-900 p-6 space-y-4"
        >
          <div className="text-sm font-medium text-gray-200">Register new connection</div>

          <div className="flex gap-3">
            {(["demo", "postgres"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  kind === k
                    ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                    : "border-gray-700 bg-gray-950 text-gray-400 hover:border-gray-600"
                }`}
              >
                {k === "demo" ? "Demo dataset" : "PostgreSQL"}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={kind === "demo" ? "Demo DB" : "Production Postgres"}
              className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-sky-500 focus:outline-none"
            />
          </div>

          {kind === "postgres" && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Postgres DSN</label>
              <input
                value={dsn}
                onChange={(e) => setDsn(e.target.value)}
                placeholder="postgresql://user:pass@host:5432/db"
                className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 font-mono focus:border-sky-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">Requires a read-only role (SELECT only).</p>
            </div>
          )}

          {formError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-sky-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
          >
            {submitting ? "Registering..." : "Register Connection"}
          </button>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading connections...
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-700 bg-gray-900/40 p-10 text-center">
          <Database className="mx-auto mb-3 h-8 w-8 text-gray-600" />
          <div className="text-sm text-gray-400">No connections registered yet.</div>
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
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900 px-5 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-md border border-gray-800 bg-gray-950 p-2">
                  <Database className="h-4 w-4 text-gray-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-100">{conn.label}</div>
                  <div className="mt-0.5 font-mono text-xs text-gray-500">{conn.id.slice(0, 8)}…</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <KindBadge kind={conn.kind} />
                <Link
                  to={`/data-quality/${conn.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-sky-500/40 hover:text-sky-300"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Quality
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
