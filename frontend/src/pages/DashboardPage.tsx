import { ArrowUpRight, CheckCircle2, Database, Terminal } from "lucide-react";
import { Link } from "react-router-dom";
import type { Verdict } from "@/types";

interface MetricCardProps {
  label: string;
  value: string;
  caption: string;
  tone?: "default" | "warning";
}

interface RecentInvestigation {
  id: string;
  question: string;
  verdict: Verdict;
  conclusion: string;
}

const metrics: MetricCardProps[] = [
  {
    label: "Gross Revenue",
    value: "₹42.8L",
    caption: "+12.3% vs last week",
  },
  {
    label: "Returning Customer Rate",
    value: "68.4%",
    caption: "Healthy baseline stability",
  },
  {
    label: "Active Anomalies",
    value: "1 Detected",
    caption: "Requires manual investigation review",
    tone: "warning",
  },
];

const recentInvestigations: RecentInvestigation[] = [
  {
    id: "inv-001",
    question: "Why did revenue drop in week 14?",
    verdict: "confirmed",
    conclusion: "Mumbai enterprise churn drove a 23% decline in gross bookings.",
  },
  {
    id: "inv-002",
    question: "Are refunds concentrated on one SKU?",
    verdict: "refuted",
    conclusion: "Refund activity remained distributed across the long-tail catalog.",
  },
  {
    id: "inv-003",
    question: "Did paid acquisition degrade after the campaign switch?",
    verdict: "inconclusive",
    conclusion: "Signal overlaps with seasonality and a data freshness delay.",
  },
];

function MetricCard({ label, value, caption, tone = "default" }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-gray-400">{label}</div>
          <div className={`mt-2 font-mono text-3xl tracking-tight ${tone === "warning" ? "text-amber-500" : "text-gray-100"}`}>
            {value}
          </div>
        </div>
        <div className="rounded-md border border-gray-800 bg-gray-950 p-2 text-gray-500">
          <Database className="h-4 w-4" />
        </div>
      </div>
      <div className="text-sm text-gray-500">{caption}</div>
    </div>
  );
}

function verdictClasses(verdict: Verdict) {
  if (verdict === "confirmed") return "border-red-500/30 text-red-400 bg-red-500/5";
  if (verdict === "refuted") return "border-emerald-500/30 text-emerald-400 bg-emerald-500/5";
  return "border-gray-700 text-gray-400 bg-gray-900";
}

export default function DashboardPage() {
  return (
    <div className="h-full overflow-y-auto bg-gray-950 px-8 py-8 text-gray-100">
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Workspace Overview</div>
          <div className="mt-2 text-sm text-gray-500">Connected to production snapshot: postgres_replica_prod</div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 font-mono">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Syncing</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-xs text-gray-400 font-mono">
          <Terminal className="h-4 w-4 text-gray-500" />
          Read-only workspace
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium text-gray-100">Recent Investigations</h2>
          <div className="text-xs text-gray-500 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-gray-500" />
            Audit trail preserved
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
          <div className="grid grid-cols-[1.5fr_160px_1.8fr_44px] border-b border-gray-800 px-4 py-3 text-xs uppercase tracking-wide text-gray-500">
            <div>Query</div>
            <div>Status</div>
            <div>Verdict</div>
            <div />
          </div>

          <div className="divide-y divide-gray-800">
            {recentInvestigations.map((investigation) => (
              <div key={investigation.id} className="grid grid-cols-[1.5fr_160px_1.8fr_44px] items-center px-4 py-4 transition-colors hover:bg-gray-950/60">
                <div>
                  <div className="text-sm text-gray-100">{investigation.question}</div>
                </div>
                <div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${verdictClasses(investigation.verdict)}`}>
                    {investigation.verdict}
                  </span>
                </div>
                <div className="text-sm text-gray-400">{investigation.conclusion}</div>
                <div className="flex justify-end">
                  <Link
                    to="/investigate"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-800 text-gray-400 transition-colors hover:border-gray-700 hover:bg-gray-950 hover:text-gray-100"
                    aria-label={`Deep dive into ${investigation.question}`}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
