import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import BentoGridSection from "@/components/landing/BentoGridSection";
import FooterConversion from "@/components/landing/FooterConversion";

type TimelineState = "idle" | "step" | "warning" | "resolved" | "final";

interface CursorStep {
  id: string;
  title: string;
  sql: string;
}

const chartData = [
  { week: "Week 11", revenue: 78 },
  { week: "Week 12", revenue: 83 },
  { week: "Week 13", revenue: 80 },
  { week: "Week 14", revenue: 28 },
  { week: "Week 15", revenue: 82 },
];

const mockStep: CursorStep = {
  id: "trend-verification",
  title: "Step 01 // Trend Verification",
  sql: "SELECT date_trunc('week', created_at), sum(amount) FROM orders GROUP BY 1;",
};

function StepCard() {
  return (
    <div className="animate-in slide-in-from-bottom-2 duration-300 rounded-xl border border-white/[0.06] bg-[#111113] p-4 shadow-2xl">
      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-sky-400">
          Step 01
        </span>
        <span className="text-sm font-medium text-zinc-100">Trend Verification</span>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-white/[0.05] bg-[#0A0A0A] px-4 py-3 font-mono text-[13px] tracking-tight text-sky-400">
        {mockStep.sql}
      </pre>
    </div>
  );
}

function WarningNode({ resolved }: { resolved: boolean }) {
  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-300 ${
        resolved
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-red-500/20 bg-red-500/5"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
            resolved
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}
        >
          {resolved ? "✓" : "!"}
        </span>
        <div>
          <div className={`text-sm font-medium ${resolved ? "text-emerald-300" : "text-red-300"}`}>
            {resolved ? "Self-correction complete" : "⚠️ Execution Warning: Relation ambiguous"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {resolved ? "Schema resolution succeeded." : "Retrying with an explicit relation path."}
          </div>
        </div>
      </div>
    </div>
  );
}

function FinalResultCard() {
  return (
    <div className="animate-in fade-in duration-300 rounded-xl border border-white/[0.06] bg-[#111113] p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-zinc-100">Final Snapshot</div>
          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-zinc-500">Week-over-week revenue compaction</div>
        </div>
        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-sky-400">
          computed
        </span>
      </div>
      <div className="h-[220px] rounded-xl border border-white/[0.05] bg-[#0A0A0A] p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} stroke="#71717a" fontSize={11} />
            <YAxis tickLine={false} axisLine={false} stroke="#71717a" fontSize={11} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.02)" }}
              contentStyle={{
                backgroundColor: "#0A0A0A",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                color: "#f4f4f5",
                boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
              }}
            />
            <Bar dataKey="revenue" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 font-mono text-[12px] tracking-tight text-zinc-400">
        Metric Definition: Revenue = SUM(order_total) EXCL. refunds, INCL. shipping.
      </div>
    </div>
  );
}

export default function HomePage() {
  const [reasoningText, setReasoningText] = useState(
    "> Initializing Viriya Engine...\n> Target node verified.\n"
  );
  const [timelineState, setTimelineState] = useState<TimelineState>("idle");
  const [cursorVisible, setCursorVisible] = useState(true);
  const [showStep, setShowStep] = useState(false);
  const [warningResolved, setWarningResolved] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showFinal, setShowFinal] = useState(false);

  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof window.setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof window.setInterval>[]>([]);

  useEffect(() => {
    const container = terminalContainerRef.current;
    if (!container) return;

    // If the user is near the bottom, auto-scroll; otherwise respect user's position.
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldAutoScroll = distanceFromBottom < 64; // threshold in px

    if (shouldAutoScroll) {
      // Smooth scroll the container to its bottom without affecting document scroll.
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  }, [reasoningText]);

  useEffect(() => {
    const cursorInterval = window.setInterval(() => {
      setCursorVisible((current) => !current);
    }, 520);

    intervalsRef.current.push(cursorInterval);

    const pushTimeout = (delay: number, callback: () => void) => {
      const timer = window.setTimeout(callback, delay);
      timeoutsRef.current.push(timer);
    };

    pushTimeout(1200, () => {
      setReasoningText((current) => current + "> Scanning metrics...\n> Trend delta located.\n");
      setTimelineState("step");
    });

    pushTimeout(1500, () => {
      setShowStep(true);
    });

    pushTimeout(2800, () => {
      setReasoningText((current) => current + "> Warning: DB syntax exception.\n> Triggering auto-fix model...\n");
      setTimelineState("warning");
    });

    pushTimeout(3200, () => {
      setShowWarning(true);
    });

    pushTimeout(3650, () => {
      setWarningResolved(true);
      setTimelineState("resolved");
    });

    pushTimeout(4200, () => {
      setReasoningText((current) => current + "> Self-correction complete.\n> Pulling final snapshot...\n");
      setTimelineState("resolved");
    });

    pushTimeout(5000, () => {
      setTimelineState("final");
      setShowFinal(true);
      setShowStep(false);
      setShowWarning(false);
    });

    return () => {
      timeoutsRef.current.forEach((timer) => window.clearTimeout(timer));
      intervalsRef.current.forEach((timer) => window.clearInterval(timer));
      timeoutsRef.current = [];
      intervalsRef.current = [];
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100">
      <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-white/[0.06] bg-[#0A0A0A]/70 px-8 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <img src="/viriya-logo.png" alt="viriya" className="h-6 w-auto max-w-full object-contain select-none" />
          <span className="relative top-[1px] inline-block h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]" />
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          {[
            { label: "Platform", href: "#platform" },
            { label: "Engine Specs", href: "#engine-specs" },
            { label: "Pricing", href: "#pricing" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-base font-medium text-zinc-400 transition-colors hover:text-zinc-100"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Link
          to="/chat"
          className="rounded-md bg-zinc-100 px-4 py-2 text-base font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
        >
          Launch App
        </Link>
      </header>

      <main>
        <section
          className="w-full max-w-5xl mx-auto pt-36 pb-12 px-8 flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-top-4 duration-500"
          id="platform"
        >
          <div id="engine-specs" className="flex flex-col items-center space-y-6">
            <div className="font-mono text-sm uppercase tracking-widest text-sky-400 font-medium">
                Layer 3 // The Autonomous Data Analyst Engine
            </div>

            <h1 className="landing-display-font text-[clamp(4.25rem,11vw,7.5rem)] italic font-medium leading-none tracking-[-0.06em] text-zinc-100">
              viriya
            </h1>

            <p className="max-w-2xl text-base text-zinc-400 font-light leading-relaxed">
              The AI Data Team for your whole enterprise. Connect read-only to your production systems, ask in plain English, and watch an autonomous analyst map, compile, and isolate root causes on its own. We eliminate the ad-hoc reporting backlog entirely.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                to="/chat"
                className="rounded-md bg-sky-500 px-6 py-3 text-base font-medium text-white shadow-[0_0_24px_rgba(14,165,233,0.25)] transition-all duration-300 hover:bg-sky-400 hover:shadow-[0_0_28px_rgba(14,165,233,0.35)]"
              >
                Deploy Workspace
              </Link>
              <a
                href="#spectator-ui"
                className="rounded-md border border-white/[0.08] bg-[#0B0B0C] px-6 py-3 text-base font-medium text-zinc-300 transition-colors hover:border-white/[0.14] hover:bg-white/[0.03]"
              >
                Watch Architecture
              </a>
            </div>
          </div>

          <div className="w-full max-w-5xl mx-auto mt-8 bg-[#0B0B0C] border border-white/[0.06] rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-[480px] animate-in fade-in slide-in-from-bottom-4 duration-700" id="spectator-shell">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-800" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-800" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-800" />
              </div>

              <div className="mx-auto flex w-64 items-center gap-1.5 rounded-md border border-white/[0.04] bg-[#0A0A0A] px-3 py-1.5 font-mono text-sm text-zinc-500">
                  <Lock className="h-3 w-3 shrink-0" />
                <span className="truncate">viriya.internal/engine-stream</span>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden" id="spectator-ui">
              <div className="flex w-[35%] flex-col justify-between overflow-hidden border-r border-white/[0.06] bg-[#020202] p-4 font-mono text-sm text-zinc-300">
                    <div ref={terminalContainerRef} className="space-y-1 overflow-y-auto pr-2 leading-6">
                      <pre className="whitespace-pre-wrap tracking-tight">{reasoningText}</pre>
                    </div>

                <div className="mt-4 flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-zinc-500">
                  <span className={`inline-block h-4 w-2 rounded-sm bg-sky-500 transition-opacity ${cursorVisible ? "opacity-100" : "opacity-0"}`} />
                  <span>{timelineState}</span>
                </div>
              </div>

              <div className="flex w-[65%] flex-col gap-4 overflow-y-auto bg-[#0B0B0C]/50 p-6">
                {showStep && <StepCard />}

                {showWarning && <WarningNode resolved={warningResolved} />}

                {showFinal && <FinalResultCard />}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-sm font-mono tracking-widest text-zinc-500 uppercase">
              <span className="h-px w-8 bg-white/[0.1]" />
            — LIVE SPECTATOR MODE →
          </div>
        </section>
      </main>
      <BentoGridSection />
      <FooterConversion />
    </div>
  );
}