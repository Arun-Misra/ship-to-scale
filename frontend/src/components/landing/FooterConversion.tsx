import { useEffect, useRef, useState } from "react";
import { Check, Copy, ArrowRight } from "lucide-react";

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
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // Ignore clipboard failures and still provide the visual confirmation.
    }

    setCopied(true);
    setPulse(true);

    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    if (pulseTimerRef.current) window.clearTimeout(pulseTimerRef.current);

    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1400);
    pulseTimerRef.current = window.setTimeout(() => setPulse(false), 1100);
  };

  return (
    <section className="bg-[#0A0A0A] px-8 pb-8 pt-16 text-zinc-100" id="pricing">
      <div className="mb-8 text-center">
        <div className="text-base font-mono uppercase tracking-widest text-zinc-500">Value Alignment</div>
        <h2 className="landing-display-font mt-2 text-4xl font-medium text-zinc-100">Predictable, transparent tiers.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base font-light leading-relaxed text-zinc-400">
          Anchored against the price of an internal data team. Scale access seamlessly as your infrastructure expands.
        </p>
      </div>

      <div className="w-full max-w-5xl mx-auto overflow-hidden rounded-xl border border-white/[0.06] bg-[#111113]">
        <div className="grid grid-cols-1 divide-y divide-white/[0.06] md:grid-cols-3 md:divide-x md:divide-y-0">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`flex h-full flex-col p-6 ${tier.accent ? "border-sky-500/40 shadow-[0_0_0_1px_rgba(14,165,233,0.18),0_0_30px_rgba(14,165,233,0.08)]" : ""}`}
            >
              <div className="text-base font-mono uppercase tracking-widest text-zinc-500">{tier.name}</div>
              <div className="mt-2 text-[2.15rem] font-mono font-medium text-zinc-100">{tier.price}</div>
              <div className="mt-5 space-y-3">
                {tier.features.map((feature) => (
                  <div key={feature} className="text-base font-light leading-relaxed text-zinc-400">
                    {feature}
                  </div>
                ))}
              </div>

              <button
                type="button"
                className={`mt-6 inline-flex w-fit items-center justify-center rounded-md px-4 py-2.5 text-lg font-medium transition-colors ${
                  tier.accent ? "bg-sky-500 text-white hover:bg-sky-600" : "bg-zinc-100 text-zinc-950 hover:bg-zinc-200"
                }`}
              >
                Select Plan
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto flex flex-col items-center space-y-6 px-8 py-24 text-center">
        <div
          className={`relative w-full max-w-xl overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A0A0A] p-4 font-mono text-left text-base transition-shadow ${
            pulse ? "shadow-[0_0_0_1px_rgba(14,165,233,0.28),0_0_0_6px_rgba(14,165,233,0.06)]" : ""
          }`}
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-[#111113] px-3 py-1.5 text-zinc-400 transition-colors hover:text-zinc-100"
              aria-label="Copy Viriya init command"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <div className="rounded-lg border border-white/[0.04] bg-[#111113] px-4 py-4 text-lg text-zinc-300">
            <span className="text-zinc-500">$ </span>
            <span className="text-zinc-100">npm i -g @viriya/core &amp;&amp; viriya init --workspace=demo</span>
          </div>

          <div className="mt-3 min-h-[18px] text-base text-zinc-500 transition-colors">
            {copied ? "Copied snippet!" : "Ready to provision a workspace node."}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3" id="technical-docs">
          <a
            href="/investigate"
            className="rounded-md bg-sky-500 px-6 py-3 text-lg font-medium text-white transition-all hover:bg-sky-600"
          >
            Launch Workspace
          </a>
          <a
            href="#technical-docs"
            className="inline-flex items-center gap-1.5 text-lg font-medium text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Technical Documentation <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between border-t border-white/[0.04] pb-8 pt-12 font-mono text-base text-zinc-600 md:flex-row">
        <div>viriya © 2026</div>
        <div className="mt-3 flex items-center gap-2 md:mt-0">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.35)]" />
          <span>Engine Nodes: All Operational</span>
        </div>
      </div>
    </section>
  );
}