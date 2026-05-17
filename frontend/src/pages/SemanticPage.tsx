import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getSemanticDefs, createSemanticDef, deleteSemanticDef } from "@/api/client";
import type { SemanticDef } from "@/types";

function originClass(source: string) {
  if (source === "harvested") return "border-white/[0.08] text-zinc-400 bg-white/[0.03]";
  if (source === "jit_capture") return "border-sky-500/30 text-sky-400 bg-sky-500/[0.05]";
  if (source === "manual") return "border-emerald-500/30 text-emerald-400 bg-emerald-500/[0.05]";
  return "border-white/[0.07] text-zinc-500 bg-white/[0.02]";
}

export default function SemanticPage() {
  const { session } = useAppwrite();
  const [defs, setDefs] = useState<SemanticDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [term, setTerm] = useState("");
  const [naturalLanguage, setNaturalLanguage] = useState("");
  const [definitionSql, setDefinitionSql] = useState("");
  const [materiality, setMateriailty] = useState("material");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDefs = () => {
    if (!session) return;
    setLoading(true);
    getSemanticDefs(session.jwt)
      .then((res) => setDefs(res.definitions))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadDefs, [session]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (!term.trim() || !naturalLanguage.trim() || !definitionSql.trim()) {
      setFormError("Term, natural language description, and SQL definition are required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createSemanticDef(session.jwt, {
        term: term.trim(),
        natural_language: naturalLanguage.trim(),
        definition_sql: definitionSql.trim(),
        materiality,
        source: "manual",
      });
      setTerm(""); setNaturalLanguage(""); setDefinitionSql(""); setShowForm(false);
      loadDefs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create definition.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!session) return;
    setDeletingId(id);
    try {
      await deleteSemanticDef(session.jwt, id);
      setDefs((prev) => prev.filter((d) => d.$id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-8">
      <div className="mb-8 border-b border-white/[0.06] pb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xl font-medium text-zinc-100">Semantic Knowledge Base</div>
            <div className="mt-1 text-xs font-mono uppercase tracking-[0.28em] text-zinc-600">
              definition graph / query compiler
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-600 backdrop-blur-sm">
              {loading ? "…" : `${defs.length} terms`}
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-sm font-medium text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all hover:bg-sky-400 hover:shadow-[0_0_28px_rgba(14,165,233,0.45)]"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Cancel" : "Add Definition"}
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-6 space-y-4 backdrop-blur-sm"
          style={{ boxShadow: "0 0 40px rgba(14,165,233,0.05)" }}
        >
          <div className="text-sm font-medium text-zinc-200">Add a new semantic definition</div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">Term *</label>
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="monthly_recurring_revenue"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-700 focus:border-sky-500/40 focus:bg-sky-500/[0.04] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">Materiality</label>
              <select
                value={materiality}
                onChange={(e) => setMateriailty(e.target.value)}
                className="w-full rounded-xl border border-white/[0.07] bg-black/30 px-3 py-2.5 text-sm text-zinc-100 focus:border-sky-500/40 focus:outline-none transition-colors"
              >
                <option value="material">material</option>
                <option value="informational">informational</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">Natural language description *</label>
            <input
              value={naturalLanguage}
              onChange={(e) => setNaturalLanguage(e.target.value)}
              placeholder="Total recurring revenue from active subscriptions in a given month"
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 focus:border-sky-500/40 focus:bg-sky-500/[0.04] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">SQL definition *</label>
            <textarea
              value={definitionSql}
              onChange={(e) => setDefinitionSql(e.target.value)}
              placeholder="SELECT SUM(order_total) FROM orders WHERE status = 'active'"
              rows={3}
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm font-mono text-zinc-100 placeholder-zinc-700 focus:border-sky-500/40 focus:bg-sky-500/[0.04] focus:outline-none transition-colors resize-none"
            />
          </div>

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
            {submitting ? "Saving..." : "Save Definition"}
          </button>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading semantic definitions...
        </div>
      )}

      {!loading && !error && defs.length === 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 text-sm text-zinc-500 backdrop-blur-sm">
          No semantic definitions yet.{" "}
          <button onClick={() => setShowForm(true)} className="text-sky-400 hover:text-sky-300">
            Add one manually
          </button>{" "}
          or run an investigation — the agent captures definitions automatically.
        </div>
      )}

      {defs.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm">
          {defs.map((def) => (
            <div
              key={def.$id}
              className="border-b border-white/[0.05] p-4 transition-colors last:border-b-0 hover:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-sky-400">
                    {def.term}
                  </div>
                  {def.natural_language && (
                    <div className="mt-1 text-sm text-zinc-500">{def.natural_language}</div>
                  )}
                  <div className="mt-2 font-mono text-sm text-zinc-300">{def.definition_sql}</div>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs text-zinc-600">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono transition-colors ${originClass(def.source)}`}>
                      {def.source}
                    </span>
                    <button
                      onClick={() => handleDelete(def.$id)}
                      disabled={deletingId === def.$id}
                      className="rounded-md border border-white/[0.07] p-1.5 text-zinc-600 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
                      title="Delete definition"
                    >
                      {deletingId === def.$id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {def.materiality && (
                    <span className="font-mono">Materiality: {def.materiality}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
