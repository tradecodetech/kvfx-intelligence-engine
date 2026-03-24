"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/assistant";
  const urlError = searchParams.get("error");

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError === "auth_failed" ? "Authentication failed. Please try again." : null
  );
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  // Redirect if already signed in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace("/assistant");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setSuccess("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#c9a84c 1px, transparent 1px), linear-gradient(90deg, #c9a84c 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-sm">

        {/* Logo + wordmark */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d3461] to-[#2a1f5f] border border-[#253650] flex items-center justify-center shadow-lg shadow-black/40">
              <span className="text-[#c9a84c] text-sm font-black tracking-tight">KV</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-300 tracking-wide leading-tight">
                KVFX Intelligence Engine
              </p>
              <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">
                Powered by WhisperZonez × KVFX v3
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#c9a84c]/10 border border-[#c9a84c]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]/60" />
            <span className="text-[9px] font-mono text-[#c9a84c]/70 uppercase tracking-widest">
              Beta Access
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">

          {/* Mode tabs */}
          <div className="flex border-b border-slate-600">
            {(["signin", "signup"] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                className={`flex-1 py-3 text-xs font-mono uppercase tracking-widest transition-colors duration-150 ${
                  mode === m
                    ? "text-[#c9a84c] bg-[#c9a84c]/5 border-b-2 border-[#c9a84c]/40"
                    : "text-gray-400 hover:text-gray-300 bg-transparent border-b-2 border-transparent"
                }`}
              >
                {m === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Success */}
            {success && (
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                <svg className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-[11px] text-emerald-400/90 font-mono leading-relaxed">{success}</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/8 border border-red-500/20">
                <svg className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <p className="text-[11px] text-red-400/90 font-mono leading-relaxed">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="trader@example.com"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 font-mono focus:outline-none focus:border-[#c9a84c]/60 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[9px] font-mono uppercase tracking-widest text-gray-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="••••••••"
                minLength={6}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 font-mono focus:outline-none focus:border-[#c9a84c]/60 transition-colors"
              />
              {mode === "signup" && (
                <p className="text-[9px] font-mono text-gray-500 mt-1 pl-0.5">
                  Minimum 6 characters
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#c9a84c]/15 hover:bg-[#c9a84c]/25 disabled:bg-[#0f1520] text-[#c9a84c] disabled:text-gray-500 border border-[#c9a84c]/25 disabled:border-[#1a2540] text-xs font-mono uppercase tracking-widest transition-all duration-150 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border border-[#c9a84c]/30 border-t-[#c9a84c] rounded-full animate-spin" />
                  {mode === "signin" ? "Signing in…" : "Creating account…"}
                </>
              ) : (
                mode === "signin" ? "Sign In" : "Create Account"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[9px] font-mono text-[#1a2540] mt-6 tracking-widest uppercase">
          Private Beta — Not for public distribution
        </p>
      </div>
    </div>
  );
}
