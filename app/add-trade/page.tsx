"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
  "GBPJPY", "EURJPY", "AUDJPY", "EURAUD", "EURGBP",
  "NASDAQ", "NAS100", "SPX", "DXY", "GOLD", "SILVER", "OIL", "BTCUSD",
];

const SETUPS = ["BOS", "Sweep", "Breakout", "FVG", "OB", "Continuation", "Reversal", "Other"];
const SESSIONS = ["London", "NY", "Asia", "London/NY Overlap"];
const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"];

type FormState = {
  pair: string;
  bias: string;
  structure: string;
  entry: string;
  result: string;
  rr: string;
  setup_type: string;
  session: string;
  timeframe: string;
  notes: string;
};

const emptyForm: FormState = {
  pair: "",
  bias: "",
  structure: "",
  entry: "",
  result: "",
  rr: "",
  setup_type: "",
  session: "",
  timeframe: "",
  notes: "",
};

export default function AddTradePage() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.pair.trim()) {
      setError("Pair is required.");
      return;
    }

    setLoading(true);
    setSuccess(false);
    setError(null);

    const payload = {
      pair: form.pair.trim().toUpperCase(),
      bias: form.bias || null,
      structure: form.structure.trim() || null,
      entry: form.entry.trim() || null,
      result: form.result || null,
      rr: form.rr ? parseFloat(form.rr) : null,
      setup_type: form.setup_type || null,
      session: form.session || null,
      timeframe: form.timeframe || null,
      notes: form.notes.trim() || null,
      user_id: "anonymous",
    };

    const { error: insertError } = await supabase
      .from("kvfx_trades")
      .insert([payload]);

    if (insertError) {
      console.error("❌ INSERT ERROR:", insertError.message);
      setError(insertError.message || "Failed to save trade.");
    } else {
      console.log("✅ TRADE SAVED:", payload.pair);
      setSuccess(true);
      setForm(emptyForm);
      // Auto-clear success message
      setTimeout(() => setSuccess(false), 4000);
    }

    setLoading(false);
  }

  const labelClass = "block text-xs text-gray-500 uppercase tracking-wider mb-1.5";
  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border text-sm text-white focus:outline-none transition-colors";
  const inputStyle = {
    background: "#0d1117",
    borderColor: "#1a2540",
  };
  const focusStyle = "focus:border-[#c9a84c]";

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: "#07090f" }}
    >
      {/* Header */}
      <div
        className="border-b flex items-center justify-between px-6 py-4"
        style={{ borderColor: "#1a2540" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-bold tracking-widest"
            style={{ color: "#c9a84c" }}
          >
            KVFX
          </span>
          <span className="text-gray-600 text-sm">|</span>
          <h1 className="text-white font-semibold text-sm tracking-wide">
            Manual Trade Entry
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/logs"
            className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/assistant"
            className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            ← Assistant
          </Link>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-6 py-10">
        <div
          className="rounded-xl border p-6 md:p-8"
          style={{ background: "#0d1117", borderColor: "#1a2540" }}
        >
          <h2 className="text-lg font-semibold text-white mb-1">Log a Trade</h2>
          <p className="text-gray-500 text-sm mb-6">
            Manual override entry for your trade journal.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Pair + Timeframe */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Pair *</label>
                <input
                  name="pair"
                  list="pair-list"
                  placeholder="e.g. EURUSD"
                  value={form.pair}
                  onChange={handleChange}
                  className={`${inputClass} ${focusStyle}`}
                  style={inputStyle}
                  autoComplete="off"
                />
                <datalist id="pair-list">
                  {PAIRS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={labelClass}>Timeframe</label>
                <select
                  name="timeframe"
                  value={form.timeframe}
                  onChange={handleChange}
                  className={`${inputClass} ${focusStyle} cursor-pointer`}
                  style={inputStyle}
                >
                  <option value="">Select</option>
                  {TIMEFRAMES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Bias + Session */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Bias</label>
                <select
                  name="bias"
                  value={form.bias}
                  onChange={handleChange}
                  className={`${inputClass} ${focusStyle} cursor-pointer`}
                  style={inputStyle}
                >
                  <option value="">Select</option>
                  <option value="Bullish">Bullish</option>
                  <option value="Bearish">Bearish</option>
                  <option value="Neutral">Neutral</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Session</label>
                <select
                  name="session"
                  value={form.session}
                  onChange={handleChange}
                  className={`${inputClass} ${focusStyle} cursor-pointer`}
                  style={inputStyle}
                >
                  <option value="">Select</option>
                  {SESSIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Setup Type */}
            <div>
              <label className={labelClass}>Setup Type</label>
              <select
                name="setup_type"
                value={form.setup_type}
                onChange={handleChange}
                className={`${inputClass} ${focusStyle} cursor-pointer`}
                style={inputStyle}
              >
                <option value="">Select setup</option>
                {SETUPS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Structure */}
            <div>
              <label className={labelClass}>Structure / Context</label>
              <input
                name="structure"
                placeholder="e.g. BOS on H1, taking pullback into OB"
                value={form.structure}
                onChange={handleChange}
                className={`${inputClass} ${focusStyle}`}
                style={inputStyle}
              />
            </div>

            {/* Entry */}
            <div>
              <label className={labelClass}>Entry Level</label>
              <input
                name="entry"
                placeholder="e.g. 1.0845"
                value={form.entry}
                onChange={handleChange}
                className={`${inputClass} ${focusStyle}`}
                style={inputStyle}
              />
            </div>

            {/* Result + RR */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Result</label>
                <select
                  name="result"
                  value={form.result}
                  onChange={handleChange}
                  className={`${inputClass} ${focusStyle} cursor-pointer`}
                  style={inputStyle}
                >
                  <option value="">Open / Pending</option>
                  <option value="Win">Win</option>
                  <option value="Loss">Loss</option>
                  <option value="Breakeven">Breakeven</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>R:R</label>
                <input
                  name="rr"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 2.5"
                  value={form.rr}
                  onChange={handleChange}
                  className={`${inputClass} ${focusStyle}`}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                name="notes"
                placeholder="Trade rationale, what you saw, emotions, lessons..."
                value={form.notes}
                onChange={handleChange}
                rows={3}
                className={`${inputClass} ${focusStyle} resize-none`}
                style={inputStyle}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="text-green-400 text-sm bg-green-900/20 border border-green-800/50 rounded-lg px-3 py-2 flex items-center gap-2">
                <span>✓</span>
                <span>Trade saved successfully.</span>
                <Link href="/logs" className="ml-auto underline text-xs hover:text-green-300">
                  View Dashboard
                </Link>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-50"
              style={{
                background: loading ? "#374151" : "#c9a84c",
                color: loading ? "#9ca3af" : "#07090f",
              }}
            >
              {loading ? "Saving..." : "Save Trade"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
