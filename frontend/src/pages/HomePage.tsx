import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Shield, Eye, Zap } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import BentoGridSection from "@/components/landing/BentoGridSection";
import FooterConversion from "@/components/landing/FooterConversion";

type TimelineState = "idle" | "step" | "warning" | "resolved" | "final";

const chartData = [
  { week: "W11", revenue: 78 },
  { week: "W12", revenue: 83 },
  { week: "W13", revenue: 80 },
  { week: "W14", revenue: 28 },
  { week: "W15", revenue: 82 },
];

const mockSql =
  "SELECT date_trunc('week', created_at), sum(amount) FROM orders GROUP BY 1;";

const trustBadges = [
  { icon: Shield, label: "SOC 2 Ready" },
  { icon: Eye, label: "Read-Only" },
  { icon: Zap, label: "Zero Hallucination" },
];

function StepCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-4 shadow-2xl"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-300">
          Step 01
        </span>
        <span className="text-sm font-medium text-zinc-100">Trend Verification</span>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-white/[0.05] bg-black/40 px-4 py-3 font-mono text-[13px] tracking-tight text-zinc-300">
        {mockSql}
      </pre>
    </motion.div>
  );
}

function WarningNode({ resolved }: { resolved: boolean }) {
  return (
    <motion.div
      animate={{
        borderColor: resolved ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)",
        backgroundColor: resolved ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.01)",
      }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border p-4"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-all duration-300 ${
            resolved
              ? "border-white/20 bg-white/10 text-zinc-200"
              : "border-white/10 bg-white/5 text-zinc-400"
          }`}
        >
          {resolved ? "✓" : "!"}
        </span>
        <div>
          <div className={`text-sm font-medium transition-colors duration-300 ${resolved ? "text-zinc-100" : "text-zinc-400"}`}>
            {resolved ? "Self-correction complete" : "⚠ Execution Warning: Relation ambiguous"}
          </div>
          <div className="mt-1 text-xs text-zinc-600">
            {resolved ? "Schema resolution succeeded." : "Retrying with an explicit relation path."}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FinalResultCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-5 shadow-2xl"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-zinc-100">Final Snapshot</div>
          <div className="mt-1 text-xs uppercase tracking-[0.24em] text-zinc-500">Week-over-week revenue</div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-400">
          computed
        </span>
      </div>
      <div className="h-[200px] rounded-xl border border-white/[0.05] bg-black/40 p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} stroke="#52525b" fontSize={11} />
            <YAxis tickLine={false} axisLine={false} stroke="#52525b" fontSize={11} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.02)" }}
              contentStyle={{
                backgroundColor: "#0A0A0A",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                color: "#f4f4f5",
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
              }}
            />
            <Bar dataKey="revenue" fill="rgba(255,255,255,0.85)" radius={[5, 5, 0, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 font-mono text-[12px] tracking-tight text-zinc-600">
        Revenue = SUM(order_total) EXCL. refunds, INCL. shipping.
      </div>
    </motion.div>
  );
}

function BackgroundOrbs() {
  const { scrollYProgress } = useScroll();
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -220]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Dot grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
      {/* Fade the grid out at the edges */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, transparent 40%, #000 100%)",
        }}
      />

      {/* Main hero glow */}
      <motion.div
        style={{
          y: y1,
          position: "absolute",
          top: "-5%",
          left: "50%",
          x: "-50%",
          width: "900px",
          height: "900px",
          background: "radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 35%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(60px)",
        }}
      />

      {/* Secondary side orbs */}
      <motion.div
        style={{
          y: y2,
          position: "absolute",
          top: "35%",
          left: "-8%",
          width: "560px",
          height: "560px",
          background: "radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(70px)",
        }}
      />
      <motion.div
        style={{
          y: y3,
          position: "absolute",
          top: "55%",
          right: "-6%",
          width: "480px",
          height: "480px",
          background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(60px)",
        }}
      />
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

  const demoRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress: demoScrollProgress } = useScroll({
    target: demoRef,
    offset: ["start end", "end start"],
  });
  const demoY = useTransform(demoScrollProgress, [0, 1], [30, -30]);
  const demoRotateX = useTransform(demoScrollProgress, [0, 0.5, 1], [4, 0, -4]);
  const springY = useSpring(demoY, { stiffness: 80, damping: 20 });
  const springRotateX = useSpring(demoRotateX, { stiffness: 80, damping: 20 });

  useEffect(() => {
    const container = terminalContainerRef.current;
    if (!container) return;
    const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (dist < 64) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [reasoningText]);

  useEffect(() => {
    const cursorInterval = window.setInterval(() => {
      setCursorVisible((c) => !c);
    }, 520);
    intervalsRef.current.push(cursorInterval);

    const push = (delay: number, fn: () => void) => {
      const t = window.setTimeout(fn, delay);
      timeoutsRef.current.push(t);
    };

    push(1200, () => {
      setReasoningText((t) => t + "> Scanning metrics...\n> Trend delta located.\n");
      setTimelineState("step");
    });
    push(1500, () => setShowStep(true));
    push(2800, () => {
      setReasoningText((t) => t + "> Warning: DB syntax exception.\n> Triggering auto-fix model...\n");
      setTimelineState("warning");
    });
    push(3200, () => setShowWarning(true));
    push(3650, () => { setWarningResolved(true); setTimelineState("resolved"); });
    push(4200, () => setReasoningText((t) => t + "> Self-correction complete.\n> Pulling final snapshot...\n"));
    push(5000, () => {
      setTimelineState("final");
      setShowFinal(true);
      setShowStep(false);
      setShowWarning(false);
    });

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      intervalsRef.current.forEach(clearInterval);
      timeoutsRef.current = [];
      intervalsRef.current = [];
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[#030303] text-zinc-100">
      <BackgroundOrbs />

      {/* Glass nav */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between border-b border-white/[0.05] bg-black/40 px-8 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <img src="/viriya-logo.png" alt="viriya" className="h-6 w-auto max-w-full object-contain select-none" />
          <span className="relative top-[1px] inline-block h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
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
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-100"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Link
          to="/investigate"
          className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/20"
        >
          Launch App
        </Link>
      </header>

      <main className="relative z-10">
        <section
          className="w-full max-w-5xl mx-auto pt-36 pb-16 px-8 flex flex-col items-center text-center space-y-8"
          id="platform"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center space-y-6"
            id="engine-specs"
          >
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
              Layer 3 // The Autonomous Data Analyst Engine
            </div>

            <h1 className="landing-display-font text-[clamp(4.25rem,11vw,7.5rem)] italic font-medium leading-none tracking-[-0.06em] text-zinc-100">
              viriya
            </h1>

            <p className="max-w-2xl text-base text-zinc-500 font-light leading-relaxed">
              The AI Data Team for your whole enterprise. Connect read-only to your production systems, ask in plain English, and watch an autonomous analyst map, compile, and isolate root causes on its own.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {trustBadges.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-mono tracking-wider text-zinc-500 backdrop-blur-md"
                >
                  <Icon className="h-3 w-3 text-zinc-400" />
                  {label}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                to="/investigate"
                className="rounded-md bg-white px-6 py-3 text-sm font-medium text-black shadow-[0_0_32px_rgba(255,255,255,0.15)] transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:bg-zinc-100"
              >
                Deploy Workspace
              </Link>
              <a
                href="#spectator-ui"
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-6 py-3 text-sm font-medium text-zinc-400 backdrop-blur-md transition-all hover:border-white/[0.14] hover:bg-white/[0.06]"
              >
                Watch Architecture
              </a>
            </div>
          </motion.div>

          {/* Floating tilt demo */}
          <motion.div
            ref={demoRef}
            style={{
              y: springY,
              rotateX: springRotateX,
              transformPerspective: 1200,
            }}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-full max-w-5xl mt-4 rounded-2xl border border-white/[0.12] bg-white/[0.06] shadow-[0_40px_80px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] overflow-hidden flex flex-col h-[480px] backdrop-blur-xl"
            id="spectator-shell"
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3 bg-black/20">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/[0.08]" />
              </div>
              <div className="mx-auto flex w-64 items-center gap-1.5 rounded-md border border-white/[0.04] bg-black/30 px-3 py-1.5 font-mono text-xs text-zinc-600">
                <Lock className="h-3 w-3 shrink-0" />
                <span className="truncate">viriya.internal/engine-stream</span>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden" id="spectator-ui">
              {/* Terminal panel */}
              <div className="flex w-[35%] flex-col justify-between overflow-hidden border-r border-white/[0.04] bg-black/30 p-4 font-mono text-sm text-zinc-400">
                <div ref={terminalContainerRef} className="space-y-1 overflow-y-auto pr-2 leading-6">
                  <pre className="whitespace-pre-wrap tracking-tight">{reasoningText}</pre>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-zinc-600">
                  <span className={`inline-block h-4 w-2 rounded-sm bg-white transition-opacity ${cursorVisible ? "opacity-80" : "opacity-0"}`} />
                  <span>{timelineState}</span>
                </div>
              </div>

              {/* Output panel */}
              <div className="flex w-[65%] flex-col gap-4 overflow-y-auto bg-black/10 p-6">
                {showStep && <StepCard />}
                {showWarning && <WarningNode resolved={warningResolved} />}
                {showFinal && <FinalResultCard />}
              </div>
            </div>
          </motion.div>

          <div className="mt-2 flex items-center gap-2 text-xs font-mono tracking-widest text-zinc-700 uppercase">
            <span className="h-px w-8 bg-white/[0.06]" />
            — LIVE SPECTATOR MODE →
          </div>
        </section>
      </main>

      <div className="relative z-10">
        <BentoGridSection />
        <FooterConversion />
      </div>
    </div>
  );
}
