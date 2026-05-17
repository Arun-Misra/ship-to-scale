import { useEffect, useRef, useState } from "react";
import { Check, Copy, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const tiers = [
  {
    name: "Starter",
    price: "₹3,999/mo",
    features: [
      "1 Live Connection",
      "Read-only data quality scan report",
      "Core plain-English chat interface",
      "Basic definition receipts",
    ],
    accent: false,
  },
  {
    name: "Growth",
    price: "₹15,999/mo",
    features: [
      "Fully unlocked database and warehouse connectors",
      "Multi-step Autonomous Analyst Agent loop",
      "Two-way Slack integration bot",
      "Automated signals alerts",
    ],
    accent: true,
  },
  {
    name: "Scale",
    price: "₹79,999/mo",
    features: [
      "Multi-tenant workspace separation",
      "Scheduled proactive investigations",
      "Custom semantic owner roles",
      "Enterprise SSO support",
    ],
    accent: false,
  },
];

export default function FooterConversion() {
  const [copied, setCopied] = useState(false);
  const [pulse, setPulse] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    const snippet = "$ npm i -g @viriya/core && viriya init --workspace=demo";
    try { await navigator.clipboard.writeText(snippet); } catch {}
    setCopied(true);
    setPulse(true);
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1400);
    pulseTimerRef.current = window.setTimeout(() => setPulse(false), 1100);
  };

  return (
    <section className="relative px-8 pb-8 pt-16 text-zinc-100" id="pricing">
      <div className="mb-12 text-center">
        <div className="text-xs font-mono uppercase tracking-[0.3em] text-zinc-600">Value Alignment</div>
        <h2 className="landing-display-font mt-3 text-4xl font-medium text-zinc-100">Predictable, transparent tiers.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm font-light leading-relaxed text-zinc-500">
          Anchored against the price of an internal data team. Scale access seamlessly as your infrastructure expands.
        </p>
      </div>

      {/* Pricing cards */}
      <div className="w-full max-w-5xl mx-auto grid grid-cols-1 gap-4 md:grid-cols-3">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            whileHover={{ backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.16)" }}
            className={`flex flex-col rounded-2xl border p-6 transition-shadow duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.04)] ${
              tier.accent
                ? "border-white/20 bg-white/[0.07]"
                : "border-white/[0.07] bg-white/[0.03]"
            }`}
            style={{ backdropFilter: "blur(20px)" }}
          >
            <div className="text-xs font-mono uppercase tracking-[0.28em] text-zinc-600">{tier.name}</div>
            <div className="mt-3 font-mono text-3xl font-medium text-zinc-100">{tier.price}</div>

            <div className="mt-6 flex-1 space-y-3">
              {tier.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2.5 text-sm font-light leading-relaxed text-zinc-500">
                  <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                  {feature}
                </div>
              ))}
            </div>

            <button
              type="button"
              className={`mt-8 w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                tier.accent
                  ? "bg-white text-black hover:bg-zinc-100 shadow-[0_0_24px_rgba(255,255,255,0.12)]"
                  : "border border-white/[0.10] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:border-white/20"
              }`}
            >
              Select Plan
            </button>
          </motion.div>
        ))}
      </div>

      {/* CTA terminal block */}
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center space-y-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className={`relative w-full overflow-hidden rounded-2xl border p-5 font-mono text-left text-sm transition-all duration-300 ${
            pulse ? "border-white/30 shadow-[0_0_40px_rgba(255,255,255,0.08)]" : "border-white/[0.08]"
          }`}
          style={{ backdropFilter: "blur(20px)", backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-white/10" />
              <span className="h-2 w-2 rounded-full bg-white/10" />
              <span className="h-2 w-2 rounded-full bg-white/10" />
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-500 transition-all hover:text-zinc-200 hover:border-white/20"
              aria-label="Copy Viriya init command"
            >
              {copied ? <Check className="h-3 w-3 text-zinc-200" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <div className="rounded-xl border border-white/[0.05] bg-black/40 px-4 py-3 text-sm">
            <span className="text-zinc-600">$ </span>
            <span className="text-zinc-200">npm i -g @viriya/core &amp;&amp; viriya init --workspace=demo</span>
          </div>

          <div className="mt-3 text-xs text-zinc-600">
            {copied ? "Copied snippet!" : "Ready to provision a workspace node."}
          </div>
        </motion.div>

        <div className="flex flex-wrap items-center justify-center gap-3" id="technical-docs">
          <a
            href="/investigate"
            className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-black shadow-[0_0_28px_rgba(255,255,255,0.14)] transition-all hover:bg-zinc-100 hover:shadow-[0_0_36px_rgba(255,255,255,0.22)]"
          >
            Launch Workspace
          </a>
          <a
            href="#technical-docs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-200"
          >
            Technical Documentation <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between border-t border-white/[0.04] pb-8 pt-8 font-mono text-xs text-zinc-700 md:flex-row">
        <div>viriya © 2026</div>
        <div className="mt-3 flex items-center gap-2 md:mt-0">
          <span className="h-1.5 w-1.5 rounded-full bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
          <span>Engine Nodes: All Operational</span>
        </div>
      </div>
    </section>
  );
}
