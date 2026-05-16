interface SemanticTerm {
  id: string;
  term: string;
  definition: string;
  origin: "harvested" | "jit_capture" | "dbt";
  updatedAt: string;
}

const semanticTerms: SemanticTerm[] = [
  {
    id: "term-revenue",
    term: "revenue",
    definition: "SUM(order_total) WHERE status = 'completed' EXCLUDING refunds, INCLUDING shipping_fees",
    origin: "dbt",
    updatedAt: "2026-05-17 08:42 UTC",
  },
  {
    id: "term-churn-rate",
    term: "churn_rate",
    definition: "COUNT(distinct lost_accounts) / COUNT(active_accounts) OVER trailing_30d",
    origin: "harvested",
    updatedAt: "2026-05-17 08:11 UTC",
  },
  {
    id: "term-net-profit",
    term: "net_profit",
    definition: "SUM(revenue) - SUM(cogs) - SUM(opex) AFTER tax_adjustments",
    origin: "jit_capture",
    updatedAt: "2026-05-16 23:58 UTC",
  },
];

function originClass(origin: SemanticTerm["origin"]) {
  if (origin === "harvested") return "border-gray-700 text-gray-300 bg-gray-900";
  if (origin === "jit_capture") return "border-sky-500/30 text-sky-400 bg-sky-500/5";
  return "border-gray-700 text-gray-400 bg-gray-900";
}

export default function SemanticPage() {
  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      <div className="mb-8 border-b border-gray-800 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xl font-medium text-gray-100">Semantic Knowledge Base</div>
            <div className="mt-1 text-xs uppercase tracking-[0.28em] text-gray-500">definition graph / query compiler</div>
          </div>
          <div className="rounded-md border border-gray-800 bg-gray-900 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.28em] text-gray-500">
            node: sem-17
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 font-mono text-sm text-gray-300 transition-colors hover:border-sky-500/30 hover:bg-gray-900/80">
          Viriya never asks the same structural definition question twice.
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-sky-500/30 hover:bg-gray-900/80">
        <p className="max-w-5xl text-sm leading-6 text-gray-400">
          The semantic layer serves as our compilation target. Natural language is mapped to these semantic blocks, which are dynamically translated to optimized engine SQL via an AST engine step.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
        {semanticTerms.map((term) => (
          <div key={term.id} className="border-b border-gray-800 p-4 transition-colors last:border-b-0 hover:bg-gray-900/80">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm font-semibold tracking-[0.18em] text-sky-400 uppercase">{term.term}</div>
                <div className="mt-2 font-mono text-sm text-gray-300">{term.definition}</div>
              </div>
              <div className="flex flex-col items-start gap-2 text-xs text-gray-500">
                <span className={`inline-flex rounded-full border px-2.5 py-1 font-mono transition-colors ${originClass(term.origin)}`}>
                  {term.origin}
                </span>
                <span className="font-mono">Last Updated: {term.updatedAt}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
