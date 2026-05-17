import React, { useEffect, useRef, useState } from "react";
import { Lock, Mail, User, ShieldAlert } from "lucide-react";
import { useAppwrite } from "@/hooks/useAppwrite";

export default function AuthPage(): JSX.Element {
  const { login, signup } = useAppwrite();
  // Redirect is handled by PublicRoute in App.tsx — no navigate needed here

  // Responsive VH fix for mobile browsers
  useEffect(() => {
    const setVh = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight / 100}px`);
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
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
    // Reset errors and fields cleanly when switching modes
    setError(null);
    setLoading(false);
    if (isSignUp) {
      setFullName("");
      setPassword("");
      setSubdomain("");
      setEmail("");
      setTimeout(() => emailRef.current?.focus(), 120);
    } else {
      setPassword("");
      setFullName("");
      setSubdomain("");
      setEmail("");
      setTimeout(() => emailRef.current?.focus(), 120);
    }
  }, [isSignUp]);

  const validateEmail = (e: string) => /\S+@\S+\.\S+/.test(e);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError("Please provide a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (isSignUp && subdomain.trim().length === 0) {
      setError("Choose a workspace subdomain.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signup(email, password, fullName || undefined);
      } else {
        await login(email, password);
      }
      // redirect is handled by PublicRoute in App.tsx
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 min-h-screen bg-[#050505] text-gray-100 overflow-hidden" style={{ minHeight: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Column 1 — Auth form engine */}
      <div className="lg:col-span-5 flex flex-col justify-center px-8 md:px-16 lg:px-12 h-full py-12 max-w-md mx-auto w-full">
        <div className="mx-auto w-full max-w-md">
          <div className="flex flex-col items-center text-center mb-6">
            <img src="/viriya-logo.png" alt="viriya" className="h-12 w-auto object-contain mb-3 drop-shadow-[0_0_15px_rgba(14,165,233,0.15)]" />
            <div className="text-3xl md:text-4xl font-serif font-bold italic tracking-tight text-zinc-50">viriya</div>
            <div className="mt-3 text-sm text-zinc-400">
              {isSignUp ? "Initialize a new workspace node." : "Welcome back. Access your data team."}
            </div>

            <button
              type="button"
              onClick={() => setIsSignUp((s) => !s)}
              className="mt-3 text-xs text-sky-400 hover:underline"
            >
              {isSignUp ? "Already have a workspace? Sign In" : "Need a new instance? Create Account"}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="block text-xs text-zinc-400 mb-1">Full name</label>
                <div className="flex items-center gap-3 bg-[#0B0B0C] border border-white/[0.06] rounded-md px-3 py-2">
                  <User className="h-4 w-4 text-zinc-400" />
                  <input
                    value={fullName}
                    onChange={(ev) => setFullName(ev.target.value)}
                    placeholder="Jane Example"
                    className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Email address</label>
              <div className="flex items-center gap-3 bg-[#050505] border border-white/[0.06] focus-within:border-sky-500 rounded-md px-3 py-2">
                <Mail className="h-4 w-4 text-zinc-400" />
                <input
                  ref={emailRef}
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Password</label>
              <div className="flex items-center gap-3 bg-[#050505] border border-white/[0.06] rounded-md px-3 py-2">
                <Lock className="h-4 w-4 text-zinc-400" />
                <input
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder="••••••••"
                  type="password"
                  className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Workspace subdomain</label>
                <div className="flex items-center gap-3 bg-[#0B0B0C] border border-white/[0.06] rounded-md px-3 py-2">
                  <input
                    value={subdomain}
                    onChange={(ev) => setSubdomain(ev.target.value)}
                    placeholder="your-company"
                    className="w-full bg-transparent text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none font-mono"
                  />
                  <span className="text-xs text-zinc-500 font-mono">.viriya.internal</span>
                </div>
              </div>
            )}

            {!isSignUp && (
              <div className="bg-[#020202] border border-white/[0.04] p-3 rounded font-mono text-[11px] text-zinc-500 space-y-1 mt-2">
                <div className="text-xs text-zinc-400">Seeded Demo Node</div>
                <div className="break-all">Use your Appwrite account credentials to sign in.</div>
              </div>
            )}

            {error && <div className="text-sm text-red-400 mt-1">{error}</div>}

            <div>
              <button
                disabled={loading}
                className="w-full bg-sky-500 text-white font-medium text-sm py-2.5 rounded-md hover:bg-sky-600 transition-all text-center font-sans mt-4 flex items-center justify-center gap-2"
                type="submit"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.2" />
                      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <span>Initializing Session...</span>
                  </>
                ) : (
                  <span>{isSignUp ? "Create Workspace Node" : "Connect to Node"}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Column 2 — Interactive preview (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-center items-center bg-[#020202] border-l border-white/[0.05] p-12 h-full relative overflow-hidden lg:col-span-7">
        {/* Dim glowing structural background */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="g1" x1="0" x2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            <rect x="40" y="40" width="720" height="520" rx="18" fill="url(#g1)" />
          </svg>
        </div>

        <div className="relative z-10 w-full max-w-md">
          <div className="w-full max-w-md bg-[#0B0B0C] border border-white/[0.06] rounded-xl p-5 font-mono text-[11px] text-zinc-400 space-y-3 shadow-2xl animate-pulse duration-[4000ms]">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-300">viriya-engine</div>
              <div className="text-xs text-zinc-500">core_boot: <span className="text-emerald-400">successful</span></div>
            </div>

            <div className="text-[11px] text-zinc-400">active_sessions // <span className="text-zinc-200">1_active_workspace</span></div>
            <div className="text-[11px] text-zinc-400">semantic_moat_depth // <span className="text-zinc-200">42_verified_contracts</span></div>

            <div className="mt-3 h-2 w-full bg-white/[0.04] rounded overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: '56%' }} />
            </div>

            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-emerald-400" />
              <div className="text-xs text-zinc-500">Operational capacity</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

