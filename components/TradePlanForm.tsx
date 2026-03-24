"use client";

import React, { useState, useMemo } from "react";

interface TradePlanFormProps {
  onSubmit: (formattedText: string) => void;
  onClose: () => void;
}

export default function TradePlanForm({ onSubmit, onClose }: TradePlanFormProps) {
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"long" | "short" | "">("");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [thesis, setThesis] = useState("");
  const [whyNow, setWhyNow] = useState("");

  // Calculate R:R in real time
  const rr = useMemo(() => {
    const e = parseFloat(entry.replace(/[^0-9.-]/g, ""));
    const s = parseFloat(stop.replace(/[^0-9.-]/g, ""));
    const t = parseFloat(target.replace(/[^0-9.-]/g, ""));
    if (!isNaN(e) && !isNaN(s) && !isNaN(t) && s !== e) {
      const risk = Math.abs(e - s);
      const reward = Math.abs(t - e);
      return parseFloat((reward / risk).toFixed(2));
    }
    return null;
  }, [entry, stop, target]);

  const rrColor =
    rr === null ? "text-[#4a5a78]"
    : rr >= 3 ? "text-emerald-400"
    : rr >= 2 ? "text-[#c9a84c]"
    : "text-[#8898b8]";

  const rrBg =
    rr === null ? "bg-[#0f1520] border-[#1a2540]"
    : rr >= 3 ? "bg-emerald-500/10 border-emerald-500/25"
    : rr >= 2 ? "bg-[#c9a84c]/10 border-[#c9a84c]/25"
    : "bg-[#0f1520] border-[#1a2540]";

  const handleSubmit = () => {
    const parts: string[] = ["[TRADE PLAN REVIEW REQUEST]", ""];
    if (symbol)    parts.push(`Symbol: ${symbol}`);
    if (direction) parts.push(`Direction: ${direction.toUpperCase()}`);
    if (entry)     parts.push(`Entry: ${entry}`);
    if (stop)      parts.push(`Stop Loss: ${stop}`);
    if (target)    parts.push(`Target: ${target}`);
    if (rr !== null) parts.push(`R:R — 1:${rr}`);
    if (thesis)    parts.push(`\nSetup Thesis:\n${thesis}`);
    if (whyNow)    parts.push(`\nWhy Now:\n${whyNow}`);
    parts.push("\nPlease review this trade plan using KVFX execution coaching principles.");
    onSubmit(parts.join("\n"));
    onClose();
  };

  const isValid = (symbol || thesis) && direction;

  const inputCls =
    "w-full bg-[#07090f] border border-[#1a2540] rounded-lg px-3 py-2 text-xs text-[#e4eaf5] placeholder-[#2a3a52] focus:outline-none focus:border-[#c9a84c]/40 transition-all duration-150 font-mono";

  return (
    <div className="mb-3 bg-[#0b1018] border border-[#1a2540] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2540]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full bg-[#c9a84c]/50" />
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#8898b8]">
            Trade Plan
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded flex items-center justify-center text-[#4a5a78] hover:text-[#8898b8] hover:bg-[#141e2e] transition-all duration-150"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Symbol + Direction row */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[9px] font-mono uppercase tracking-[0.14em] text-[#4a5a78] mb-1.5">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="EURUSD, XAUUSD"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[9px] font-mono uppercase tracking-[0.14em] text-[#4a5a78] mb-1.5">Direction</label>
            <div className="flex gap-1.5">
              {(["long", "short"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all duration-150 ${
                    direction === d
                      ? d === "long"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-red-500/15 text-red-400 border-red-500/30"
                      : "bg-transparent text-[#4a5a78] border-[#1a2540] hover:border-[#253650] hover:text-[#8898b8]"
                  }`}
                >
                  {d === "long" ? "▲ LONG" : "▼ SHORT"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Entry / Stop / Target + R:R */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Entry", value: entry, setter: setEntry },
            { label: "Stop Loss", value: stop, setter: setStop },
            { label: "Target", value: target, setter: setTarget },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label className="block text-[9px] font-mono uppercase tracking-[0.14em] text-[#4a5a78] mb-1.5">{label}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          ))}

          {/* R:R display */}
          <div>
            <label className="block text-[9px] font-mono uppercase tracking-[0.14em] text-[#4a5a78] mb-1.5">R : R</label>
            <div className={`h-[30px] flex items-center justify-center rounded-lg border text-xs font-mono font-bold ${rrBg} ${rrColor}`}>
              {rr !== null ? `1 : ${rr}` : "—"}
            </div>
          </div>
        </div>

        {/* Thesis */}
        <div>
          <label className="block text-[9px] font-mono uppercase tracking-[0.14em] text-[#4a5a78] mb-1.5">Setup Thesis</label>
          <textarea
            rows={2}
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            placeholder="What structural basis justifies this trade?"
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Why Now */}
        <div>
          <label className="block text-[9px] font-mono uppercase tracking-[0.14em] text-[#4a5a78] mb-1.5">Why Now?</label>
          <textarea
            rows={2}
            value={whyNow}
            onChange={(e) => setWhyNow(e.target.value)}
            placeholder="What triggered entry timing vs waiting?"
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-full py-2.5 text-xs font-semibold rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/25 hover:bg-[#c9a84c]/22 hover:border-[#c9a84c]/40 disabled:bg-[#0f1520] disabled:text-[#4a5a78] disabled:border-[#1a2540]"
        >
          Send for KVFX Review →
        </button>
      </div>
    </div>
  );
}
