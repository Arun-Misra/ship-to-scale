import React, { useEffect, useRef, useState } from "react";
import { Lock, Mail, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAppwrite } from "@/hooks/useAppwrite";

function BackgroundOrbs() {
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
      {/* Edge fade */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, transparent 40%, #000 100%)",
        }}
      />
      {/* Central sky-blue glow */}
      <div
        style={{
          position: "absolute",
          top: "-5%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "800px",
          background: "radial-gradient(circle, rgba(14,165,233,0.18) 0%, rgba(99,102,241,0.08) 40%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(70px)",
        }}
      />
      {/* Violet orb left */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "-8%",
          width: "500px",
          height: "500px",
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(80px)",
        }}
      />
      {/* Cyan orb right */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          right: "-6%",
          width: "420px",
          height: "420px",
          background: "radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 65%)",
          borderRadius: "50%",
          filter: "blur(70px)",
        }}
      />
    </div>
  );
}

export default function AuthPage(): JSX.Element {
  const { login, signup } = useAppwrite();

  useEffect(() => {
    const setVh = () =>
      document.documentElement.style.setProperty("--vh", `${window.innerHeight / 100}px`);
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subdomain, setSubdomain] = useState("");

  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setError(null);
    setLoading(false);
    setFullName(""); setPassword(""); setSubdomain(""); setEmail("");
    setTimeout(() => emailRef.current?.focus(), 120);
  }, [isSignUp]);

  const validateEmail = (e: string) => /\S+@\S+\.\S+/.test(e);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    if (!validateEmail(email)) { setError("Please provide a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (isSignUp && subdomain.trim().length === 0) { setError("Choose a workspace subdomain."); return; }
    setLoading(true);
    try {
      if (isSignUp) await signup(email, password, fullName || undefined);
      else await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen bg-[#030303] text-zinc-100 flex items-center justify-center px-4"
      style={{ minHeight: "calc(var(--vh, 1vh) * 100)" }}
    >
      <BackgroundOrbs />

      {/* Glass card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-sky-500/20 p-8 shadow-[0_0_60px_rgba(14,165,233,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]"
        style={{ backdropFilter: "blur(24px)", backgroundColor: "rgba(14,165,233,0.03)" }}
      >
        {/* Logo + heading */}
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/viriya-logo.png"
            alt="viriya"
            className="h-10 w-auto object-contain mb-3 select-none"
          />
          <h1 className="landing-display-font text-4xl italic font-medium tracking-tight text-zinc-100">
            viriya
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {isSignUp ? "Initialize a new workspace node." : "Welcome back. Access your data team."}
          </p>
          <button
            type="button"
            onClick={() => setIsSignUp((s) => !s)}
            className="mt-2 text-xs text-sky-500 underline underline-offset-2 transition-colors hover:text-sky-300"
          >
            {isSignUp ? "Already have a workspace? Sign in" : "Need a new instance? Create account"}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">Full name</label>
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 focus-within:border-sky-500/40 focus-within:bg-sky-500/[0.04] transition-colors">
                <User className="h-4 w-4 shrink-0 text-sky-500/60" />
                <input
                  value={fullName}
                  onChange={(ev) => setFullName(ev.target.value)}
                  placeholder="Jane Example"
                  className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none"
                />
              </div>
            </motion.div>
          )}

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">Email address</label>
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 focus-within:border-sky-500/40 focus-within:bg-sky-500/[0.04] transition-colors">
              <Mail className="h-4 w-4 shrink-0 text-sky-500/60" />
              <input
                ref={emailRef}
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">Password</label>
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 focus-within:border-sky-500/40 focus-within:bg-sky-500/[0.04] transition-colors">
              <Lock className="h-4 w-4 shrink-0 text-sky-500/60" />
              <input
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                placeholder="••••••••"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none"
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-sky-500/50 mb-1.5">Workspace subdomain</label>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 focus-within:border-white/20 transition-colors">
                <input
                  value={subdomain}
                  onChange={(ev) => setSubdomain(ev.target.value)}
                  placeholder="your-company"
                  className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none font-mono"
                />
                <span className="shrink-0 text-xs font-mono text-zinc-600">.viriya.internal</span>
              </div>
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-sm text-red-400"
            >
              <span className="text-red-500">!</span>
              {error}
            </motion.div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="mt-2 w-full rounded-xl bg-sky-500 py-3 text-sm font-medium text-white shadow-[0_0_28px_rgba(14,165,233,0.35)] transition-all hover:bg-sky-400 hover:shadow-[0_0_40px_rgba(14,165,233,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.2" />
                  <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
                Initializing Session...
              </>
            ) : (
              isSignUp ? "Create Workspace Node" : "Connect to Node"
            )}
          </button>
        </form>

        {/* Divider + footer */}
        <div className="mt-8 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.05]" />
          <span className="text-xs font-mono text-zinc-700">viriya engine</span>
          <div className="flex-1 h-px bg-white/[0.05]" />
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          <span className="text-xs font-mono text-zinc-700">Engine Nodes: All Operational</span>
        </div>
      </motion.div>
    </div>
  );
}
