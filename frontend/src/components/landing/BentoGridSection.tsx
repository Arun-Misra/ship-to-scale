import { useMemo, useState } from "react";
import { PencilLine } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const normalizedRows = [
  { date: "2024-12-01", amount: "1200.00", region: "Mumbai", status: "clean" },
  { date: "2024-12-02", amount: "895.00", region: "Bengaluru", status: "clean" },
  { date: "2024-12-03", amount: "0.00", region: "Pune", status: "null" },
];

const uncleanRows = [
  { date: "'12/01/24'", amount: '"1,200"', region: "Mumbai", status: "alert" },
  { date: "'Jan-1-24'", amount: "'N/A'", region: "Bengaluru", status: "alert" },
  { date: "'03-12-24'", amount: '"895"', region: "Pune", status: "alert" },
];

const metricData = [
  { label: "W11", value: 74 },
  { label: "W12", value: 78 },
  { label: "W13", value: 76 },
  { label: "W14", value: 49 },
  { label: "W15", value: 75 },
];

export default function BentoGridSection() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isMetricHovered, setIsMetricHovered] = useState(false);

  const dividerLeft = useMemo(() => `${sliderPosition}%`, [sliderPosition]);

  return (
    <section className="w-full max-w-7xl mx-auto px-8 py-16">
      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-12">
        <article className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111113] md:col-span-12 lg:col-span-7">
          <div className="grid h-[280px] grid-cols-1 gap-4 p-6 md:grid-cols-2">
            <div className="flex flex-col justify-between">
              <div>
                <div className="text-base font-mono uppercase tracking-widest text-zinc-500">Layer 4: Logic Orchestration</div>
                <h2 className="landing-display-font mt-2 mb-1 text-2xl font-medium text-zinc-100">Rigid boundaries. Expressive execution.</h2>
                <p className="max-w-md text-base font-light leading-relaxed text-zinc-400">
                  The agent&apos;s control flow is locked down with strict, Pydantic-validated JSON action schemas. The model is free to think contextually, but execution parameters are sandboxed and completely safe by construction.
                </p>
              </div>

              <div className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.06] bg-[#0A0A0A] px-3 py-1.5 text-sm font-mono uppercase tracking-[0.24em] text-zinc-500">
                Safe by construction
              </div>
            </div>

            <div className="h-full overflow-hidden rounded-lg border border-white/[0.04] bg-[#0A0A0A] p-3 font-mono text-base">
              <div className="flex h-full flex-col gap-3 overflow-hidden">
                <div className="rounded-md border border-white/[0.04] bg-[#0F1114] p-3 text-teal-300">
                  {`{ "action": "execute_query", "params": { "target": "mumbai_sales" } }`}
                </div>
                <div className="flex-1 overflow-hidden rounded-md border border-white/[0.04] bg-[#0A0A0A] p-3 leading-relaxed text-zinc-400">
                  {'> "Analyzing local geographic markers to cross-reference payment pipeline latencies..."'}
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111113] md:col-span-6 lg:col-span-5">
          <div className="flex h-[280px] flex-col justify-between p-6">
            <div>
              <div className="text-base font-mono uppercase tracking-widest text-zinc-500">Layer 2: Trust Foundation</div>
              <h2 className="landing-display-font mt-2 mb-1 text-2xl font-medium text-zinc-100">Data Cleaning, Visualized.</h2>
              <p className="max-w-md text-base font-light leading-relaxed text-zinc-400">
                Viriya scans your raw connected database or files and maps a clean semantic view without mutating a single row of your production source.
              </p>
            </div>

            <div className="relative w-full h-32 bg-[#0A0A0A] border border-white/[0.04] rounded-lg overflow-hidden select-none">
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: dividerLeft }}>
                  <div className="h-full w-full bg-[#0A0A0A] p-3 font-mono text-sm text-zinc-300">
                    <div className="grid grid-cols-[1.1fr_0.9fr_0.9fr] gap-2 border-b border-red-500/15 pb-2 text-red-300/80">
                      <span>date</span>
                      <span>amount</span>
                      <span>status</span>
                    </div>
                    {uncleanRows.map((row) => (
                      <div key={row.date} className="grid grid-cols-[1.1fr_0.9fr_0.9fr] gap-2 border-b border-white/[0.04] py-2 text-zinc-400">
                        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-300">{row.date}</span>
                        <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-300">{row.amount}</span>
                        <span className="text-red-300/70">{row.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute inset-y-0 overflow-hidden bg-[#111113]" style={{ left: dividerLeft }}>
                  <div className="h-full w-full p-3 font-mono text-sm text-zinc-200">
                    <div className="grid grid-cols-[1.1fr_0.9fr_0.9fr] gap-2 border-b border-white/[0.05] pb-2 text-zinc-500 uppercase tracking-[0.22em]">
                      <span>date</span>
                      <span>amount</span>
                      <span>status</span>
                    </div>
                    {normalizedRows.map((row) => (
                      <div key={row.date} className="grid grid-cols-[1.1fr_0.9fr_0.9fr] gap-2 border-b border-white/[0.04] py-2 text-zinc-300">
                        <span>{row.date}</span>
                        <span>{row.amount}</span>
                        <span className={row.status === "null" ? "text-zinc-500" : "text-zinc-300"}>
                          {row.status === "null" ? "null" : row.region}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute inset-y-0 w-px bg-white/90" style={{ left: dividerLeft }}>
                  <div className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/[0.14] bg-[#161619] shadow-[0_0_20px_rgba(255,255,255,0.08)]">
                    <span className="text-[11px] leading-none text-zinc-300">↔</span>
                  </div>
                </div>
              </div>

              <input
                aria-label="Data normalization slider"
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={(event) => setSliderPosition(Number(event.target.value))}
                className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
              />
            </div>
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#111113] md:col-span-12 lg:col-span-12">
          <div className="grid min-h-[220px] grid-cols-1 gap-6 p-6 lg:grid-cols-3 lg:items-center">
            <div className="lg:col-span-2">
              <div className="relative rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4">
                <div className="mb-3 flex items-center justify-between gap-4 text-base font-mono uppercase tracking-widest text-zinc-500">
                  <span
                    onMouseEnter={() => setIsMetricHovered(true)}
                    onMouseLeave={() => setIsMetricHovered(false)}
                    className="relative inline-flex cursor-default items-center gap-2 text-zinc-100 transition-colors hover:text-sky-400"
                  >
                    Net Revenue
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />

                    {isMetricHovered && (
                      <div className="animate-in fade-in zoom-in-95 duration-150 absolute left-0 top-6 z-20 w-72 rounded-lg border border-white/[0.08] bg-[#161619]/90 p-3 shadow-xl backdrop-blur-md normal-case tracking-normal">
                        <div className="font-mono text-sm text-zinc-300">[metric_contract: revenue]</div>
                        <div className="mt-2 font-mono text-sm leading-relaxed text-zinc-400">
                          SUM(order_total) WHERE status = &apos;completed&apos; EXCLUDING refunds, INCREMENTING shipping_fees.
                        </div>
                        <button className="mt-3 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-200">
                          <PencilLine className="h-3 w-3" />
                          Not your definition? <span className="text-zinc-200">✎ Edit Contract</span>
                        </button>
                      </div>
                    )}
                  </span>
                  <span className="text-zinc-600">Compiling...</span>
                </div>

                <div className="h-[130px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metricData}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="#52525b" fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} stroke="#52525b" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111113",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "12px",
                          color: "#f4f4f5",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={{ r: 2, fill: "#0ea5e9" }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="text-base font-mono uppercase tracking-widest text-zinc-500">Layer 1: Compounding Assets</div>
              <h2 className="landing-display-font mt-2 mb-1 text-2xl font-medium text-zinc-100">The Owned Semantic Graph.</h2>
              <p className="text-base font-light leading-relaxed text-zinc-400">
                Every adjustment, clarity confirmation, and structural definition is saved to an immutable metadata workspace ledger. Viriya dynamically compiles natural language directly to these verified definitions, ensuring your answers are always aligned to your true business rules.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}