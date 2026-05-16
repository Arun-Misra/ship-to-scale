/**
 * P3/P4 — Appwrite auth page (login + signup).
 * Owner: FE
 */
import { useState } from "react";
import { useAppwrite } from "@/hooks/useAppwrite";

export default function AuthPage() {
  const { login } = useAppwrite();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
    } catch {
      setError("Invalid credentials. Try demo@niriya.ai / demo1234");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-8 bg-gray-900 rounded-xl border border-gray-800">
        <h1 className="text-2xl font-bold text-white">Niriya</h1>
        <p className="text-sm text-gray-400">The AI Data Team</p>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input className="w-full px-3 py-2 bg-gray-800 rounded text-white" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full px-3 py-2 bg-gray-800 rounded text-white" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="w-full py-2 bg-brand-500 text-white rounded font-medium hover:bg-blue-500">
          Sign in
        </button>
      </form>
    </div>
  );
}
