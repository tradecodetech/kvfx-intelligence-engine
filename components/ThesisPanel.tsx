"use client";

import React, { useState, useEffect } from "react";
import { type ThesisContext, EMPTY_THESIS } from "@/lib/tradingLogic";

const THESIS_STORAGE_KEY = "kvfx-thesis-context";

// ── Field component ──────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  const inputCls =
    "w-full bg-[#07090f] border border-[#1a2540] rounded-lg px-3 py-2 text-xs text-[#e4eaf5] placeholder-[#2a3a52] focus:outline-none focus:border-[#c9a84c]/40 focus:bg-[#0a0e16] transition-all duration-150 resize-none font-mono";

  return (
    <div>
      <label className="block text-[9px] font-mono uppercase tracking-[0.14em] text-[#4a5a78] mb-1.5">
        {label}
      </label>
      {multiline ? (
        <textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
      )}
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-[#1a2540]" />
        <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-[#4a5a78] px-1">
          {title}
        </span>
        <div className="h-px flex-1 bg-[#1a2540]" />
      </div>
      {children}
    </div>
  );
}

// ── ThesisPanel ──────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onThesisChange: (thesis: ThesisContext | null) => void;
}

export default function ThesisPanel({ open, onClose, onThesisChange }: Props) {
  const [thesis, setThesis] = useState<ThesisContext>(EMPTY_THESIS);
  const [saved, setSaved] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THESIS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ThesisContext;
        setThesis(parsed);
        onThesisChange(parsed);
        setHasContent(Object.values(parsed).some((v) => v !== ""));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: keyof ThesisContext, value: string) => {
    setThesis((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(THESIS_STORAGE_KEY, JSON.stringify(thesis));
      onThesisChange(thesis);
      setHasContent(Object.values(thesis).some((v) => v !== ""));
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch {
      /* ignore */
    }
  };

  const handleClear = () => {
    setThesis(EMPTY_THESIS);
    localStorage.removeItem(THESIS_STORAGE_KEY);
    onThesisChange(null);
    setHasContent(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-[#07090f]/80 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[340px] bg-[#0b1018] border-l border-[#1a2540] z-50 flex flex-col transition-transform duration-250 ease-out`}
        style={{ transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a2540] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-violet-500/10 border border-violet-500/25 flex items-center justify-center">
              <svg className="w-3 h-3 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#e4eaf5] tracking-tight">KVFX Thesis</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${hasContent ? "bg-violet-400" : "bg-[#253650]"}`} />
                <p className="text-[9px] font-mono text-[#4a5a78] uppercase tracking-wider">
                  {hasContent ? "Active" : "Not set"}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#4a5a78] hover:text-[#8898b8] hover:bg-[#141e2e] transition-all duration-150"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Active banner */}
        {hasContent && (
          <div className="px-5 py-2 bg-violet-500/8 border-b border-violet-500/15 flex items-center gap-2 flex-shrink-0">
            <div className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
            <p className="text-[9px] text-violet-300/70 font-mono uppercase tracking-wider">
              Thesis active — injected in Chart, Trade Review, and Thesis modes
            </p>
          </div>
        )}

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Macro section */}
          <Section title="Macro">
            <Field
              label="Regime"
              value={thesis.macroRegime}
              onChange={(v) => update("macroRegime", v)}
              placeholder="e.g. DXY strengthening, risk-off cycle"
            />
            <Field
              label="Directional Bias"
              value={thesis.directionalBias}
              onChange={(v) => update("directionalBias", v)}
              placeholder="e.g. Bearish DXY, Bullish Gold short-term"
            />
          </Section>

          {/* Market Conditions */}
          <Section title="Market Conditions">
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Strong"
                value={thesis.strongCurrencies}
                onChange={(v) => update("strongCurrencies", v)}
                placeholder="CHF, Gold, JPY"
              />
              <Field
                label="Weak"
                value={thesis.weakCurrencies}
                onChange={(v) => update("weakCurrencies", v)}
                placeholder="GBP, NASDAQ"
              />
            </div>

            <div>
              <label className="block text-[9px] font-mono uppercase tracking-[0.14em] text-[#4a5a78] mb-1.5">
                Risk Environment
              </label>
              <div className="flex gap-1.5">
                {(["risk-on", "neutral", "risk-off"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => update("riskEnvironment", opt)}
                    className={`flex-1 py-1.5 rounded-md text-[9px] font-semibold uppercase tracking-wider border transition-all duration-150 ${
                      thesis.riskEnvironment === opt
                        ? opt === "risk-on"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : opt === "risk-off"
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : "bg-transparent text-[#4a5a78] border-[#1a2540] hover:border-[#253650] hover:text-[#8898b8]"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Themes & Levels */}
          <Section title="Themes & Levels">
            <Field
              label="Key Market Themes"
              value={thesis.keyThemes}
              onChange={(v) => update("keyThemes", v)}
              placeholder="Rate divergence, geopolitical tension..."
              multiline
            />
            <Field
              label="Important Levels"
              value={thesis.importantLevels}
              onChange={(v) => update("importantLevels", v)}
              placeholder="DXY 104.20 resistance, Gold 2350 HTF demand..."
              multiline
            />
          </Section>

          {/* Focus */}
          <Section title="Focus">
            <Field
              label="Session Focus"
              value={thesis.sessionFocus}
              onChange={(v) => update("sessionFocus", v)}
              placeholder="London open setups, NY killzone only"
            />
            <Field
              label="Notes"
              value={thesis.notes}
              onChange={(v) => update("notes", v)}
              placeholder="Additional context for the assistant..."
              multiline
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#1a2540] flex gap-2 flex-shrink-0">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-xs text-[#4a5a78] border border-[#1a2540] rounded-lg hover:border-[#253650] hover:text-[#8898b8] transition-all duration-150 font-medium"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              saved
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/25 hover:bg-[#c9a84c]/22 hover:border-[#c9a84c]/40"
            }`}
          >
            {saved ? (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </>
            ) : (
              "Save Thesis"
            )}
          </button>
        </div>
      </div>
    </>
  );
}
