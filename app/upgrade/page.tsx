"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const FEATURES = [
  { label: "All forex pairs", desc: "EURUSD, GBPUSD, USDJPY + 10 more" },
  { label: "Indices & Commodities", desc: "NASDAQ, SPX, US30, GOLD, SILVER, OIL" },
  { label: "Crypto analysis", desc: "BTCUSD, ETHUSD" },
  { label: "Full market scans", desc: "Ranked A–D setups across all pairs" },
  { label: "Unlimited AI sessions", desc: "No daily limits or cooldowns" },
  { label: "WhisperZonez + KVFX v3", desc: "Full engine — bias, zones, structure" },
];

export default function UpgradePage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#c9a84c 1px, transparent 1px), linear-gradient(90deg, #c9a84c 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1d3461] to-[#2a1f5f] border border-slate-500 flex items-center justify-center shadow-lg shadow-black/40">
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
        </div>

        {/* Card */}
        <div className="bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
          {/* Status banner */}
          <div className="flex items-center gap-2 px-5 py-3.5 bg-red-500/10 border-b border-red-500/20">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-red-400 font-semibold">
              Beta Access Expired
            </span>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Headline */}
            <div>
              <h1 className="text-xl font-bold text-gray-100 leading-tight">
                Your Beta Access Has Ended
              </h1>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Thank you for testing the KVFX Intelligence Engine. Upgrade to continue with full access — no pair limits, no restrictions.
              </p>
            </div>

            {/* Feature list */}
            <div className="rounded-xl border border-slate-600 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-900/50 border-b border-slate-600">
                <span className="text-[9px] font-mono uppercase tracking-widest text-gray-400">
                  Full Engine Includes
                </span>
              </div>
              <div className="divide-y divide-slate-700">
                {FEATURES.map(({ label, desc }) => (
                  <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-400 text-[9px] font-bold">✓</span>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-gray-200">{label}</p>
                      <p className="text-[9px] text-gray-500 font-mono">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-2.5">
              <button
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#c9a84c]/20 hover:bg-[#c9a84c]/30 text-[#c9a84c] border border-[#c9a84c]/35 text-sm font-semibold tracking-wide transition-all duration-150"
                onClick={() => {
                  // Placeholder — wire to payment provider when ready
                  alert("Upgrade flow coming soon. Contact admin to upgrade your account.");
                }}
              >
                Upgrade to Full Access
              </button>
              <button
                onClick={handleSignOut}
                className="w-full py-2 text-[11px] font-mono text-gray-500 hover:text-gray-400 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[9px] font-mono text-gray-700 mt-6 tracking-widest uppercase">
          KVFX Intelligence Engine — Private
        </p>
      </div>
    </div>
  );
}
