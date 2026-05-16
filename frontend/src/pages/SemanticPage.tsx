/**
 * P5 — Semantic definitions page. Shows the workspace's captured company brain.
 * Read-only — one-click correction is roadmap.
 * Owner: FE
 */
import { useEffect, useState } from "react";
import { useAppwrite } from "@/hooks/useAppwrite";
import { getSemanticDefs } from "@/api/client";
import { formatDate } from "@/lib/utils";

interface SemanticDef {
  $id: string;
  term: string;
  natural_language: string;
  source: string;
  materiality: string;
  created_at: string;
}

export default function SemanticPage() {
  const { session } = useAppwrite();
  const [defs, setDefs] = useState<SemanticDef[]>([]);

  useEffect(() => {
    if (session) getSemanticDefs(session.jwt).then((d: { definitions: SemanticDef[] }) => setDefs(d.definitions)).catch(() => {});
  }, [session]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Company Brain</h1>
      <p className="text-sm text-gray-400 mb-6">Definitions DataPilot has learned about your business. It never asks the same question twice.</p>
      <div className="space-y-3">
        {defs.map((d) => (
          <div key={d.$id} className="p-4 bg-gray-900 rounded-lg border border-gray-800">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-brand-500 font-semibold">{d.term}</span>
              <span className="text-xs text-gray-500 px-1.5 py-0.5 bg-gray-800 rounded">{d.source}</span>
              {d.materiality === "material" && <span className="text-xs text-yellow-400">material</span>}
            </div>
            <p className="text-sm text-gray-300">{d.natural_language}</p>
            <p className="text-xs text-gray-600 mt-1">{formatDate(d.created_at)}</p>
          </div>
        ))}
        {!defs.length && <p className="text-gray-500 text-sm">No definitions captured yet. Ask questions to start building your company brain.</p>}
      </div>
    </div>
  );
}
