"use client";

import React, { useState } from "react";
import type { ScanResults, ScanSetup, WZSignalKey, KVFXSignalKey } from "@/lib/scanEngine";
import { WZ_SIGNALS, KVFX_SIGNALS } from "@/lib/scanEngine";

// ── Grade Badge ───────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: ScanSetup["grade"] }) {
  const cfg = {
    A: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    B: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    C: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    D: "bg-slate-700 text-gray-400 border-slate-500",
  }[grade];

  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-black border font-mono ${cfg}`}>
      {grade}
    </span>
  );
}

// ── Confidence Bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round((score / 10) * 100);
  const color =
    score >= 7.5 ? "bg-emerald-400" : score >= 5 ? "bg-[#c9a84c]" : score >= 3 ? "bg-amber-500" : "bg-slate-600";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-mono text-gray-400 w-6 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

// ── Signal Chip ───────────────────────────────────────────────────────────────

function SignalChip({ label, variant }: { label: string; variant: "wz" | "kvfx" }) {
  const cls =
    variant === "wz"
      ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
      : "bg-sky-500/15 text-sky-300 border-sky-500/30";

  return (
    <span className={`inline-block text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}

// ── Bias Dot ──────────────────────────────────────────────────────────────────

function BiasDot({ bias }: { bias: ScanSetup["bias"] }) {
  const dot =
    bias === "Bullish" ? "bg-emerald-400" : bias === "Bearish" ? "bg-red-400" : "bg-gray-500";
  const text =
    bias === "Bullish" ? "text-emerald-300" : bias === "Bearish" ? "text-red-300" : "text-gray-400";

  return (
    <span className={`flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {bias}
    </span>
  );
}

// ── Setup Card ────────────────────────────────────────────────────────────────

function SetupCard({ setup }: { setup: ScanSetup }) {
  const [open, setOpen] = useState(true);

  const borderClass =
    setup.grade === "A" ? "border-emerald-500/40"
    : setup.grade === "B" ? "border-sky-500/30"
    : setup.grade === "C" ? "border-amber-500/25"
    : "border-slate-600";

  const headerBgClass =
    setup.grade === "A" ? "bg-emerald-500/8"
    : setup.grade === "B" ? "bg-sky-500/8"
    : "bg-slate-800";

  return (
    <div className={`rounded-xl border ${borderClass} overflow-hidden shadow-sm`}>
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 ${headerBgClass} hover:bg-white/[0.03] transition-colors duration-100`}
      >
        <div className="flex items-center gap-2">
          <GradeBadge grade={setup.grade} />
          <span className="text-sm font-bold text-gray-100 font-mono tracking-wide">
            {setup.pair}
          </span>
          {setup.isBestSetup && (
            <span className="text-[7px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#c9a84c]/15 text-[#c9a84c] border border-[#c9a84c]/30">
              BEST
            </span>
          )}
          <BiasDot bias={setup.bias} />
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 hidden sm:block">
            <ConfidenceBar score={setup.confidence} />
          </div>
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="px-3 pb-3 pt-2 space-y-2.5 bg-slate-900/40">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 text-[8px] font-mono text-gray-400">
            {setup.timeframe && (
              <span className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-gray-300">
                {setup.timeframe}
              </span>
            )}
            {setup.session && (
              <span className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 text-gray-300">
                {setup.session}
              </span>
            )}
            <span className="text-gray-500">conf {setup.confidence.toFixed(1)}/10</span>
          </div>

          {/* Signals */}
          {(setup.wzSignals.length > 0 || setup.kvfxSignals.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {setup.wzSignals.map((k) => (
                <SignalChip key={k} label={WZ_SIGNALS[k as WZSignalKey].label} variant="wz" />
              ))}
              {setup.kvfxSignals.map((k) => (
                <SignalChip key={k} label={KVFX_SIGNALS[k as KVFXSignalKey].label} variant="kvfx" />
              ))}
            </div>
          )}

          {/* Alignment note */}
          {setup.alignmentNote && (
            <p className="text-[10px] text-gray-300 leading-relaxed border-l-2 border-slate-500 pl-2.5">
              {setup.alignmentNote}
            </p>
          )}

          {/* Plan */}
          {setup.plan.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[8px] font-mono uppercase tracking-widest text-gray-500 mb-1">Plan</div>
              {setup.plan.map((step, i) => (
                <div
                  key={i}
                  className="flex gap-1.5 px-2.5 py-1.5 rounded-md bg-yellow-500/10 border border-yellow-400/25"
                >
                  <span className="text-[#c9a84c]/70 mt-0.5 flex-shrink-0 text-[10px]">→</span>
                  <span className="text-[10px] text-yellow-100 leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Risks */}
          {setup.risks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {setup.risks.map((r, i) => (
                <span
                  key={i}
                  className="text-[8px] font-mono px-2 py-0.5 rounded-md bg-red-500/10 text-red-200 border border-red-500/25"
                >
                  ⚠ {r}
                </span>
              ))}
            </div>
          )}

          {/* Grade D stand-aside notice */}
          {setup.grade === "D" && (
            <div className="text-[9px] font-mono text-gray-400 border border-slate-600 rounded px-2.5 py-1.5 bg-slate-800">
              STAND ASIDE — No actionable setup. Wait for structure.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ScanResultsCard({ results }: { results: ScanResults }) {
  const gradeA = results.setups.filter((s) => s.grade === "A");
  const gradeB = results.setups.filter((s) => s.grade === "B");
  const actionable = gradeA.length + gradeB.length;

  return (
    <div className="rounded-xl border border-slate-600 overflow-hidden bg-slate-800/80 backdrop-blur-sm shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-600">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-600/40 to-sky-600/40 border border-violet-500/30 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <span className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-300">
            Market Scan
          </span>
          <span className="text-[8px] font-mono text-gray-500">
            {results.pairsScanned.length} pairs • {results.scanTime}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {actionable > 0 ? (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {actionable} actionable
            </span>
          ) : (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-gray-400 border border-slate-500">
              No setups
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-600/50 bg-slate-900/30">
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          WhisperZonez
        </div>
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
          KVFX v3
        </div>
        <div className="flex items-center gap-1.5 text-[8px] font-mono text-gray-500">
          <span className="text-[#c9a84c]/70">A</span>=both align
          <span className="ml-1">B</span>=partial
          <span className="ml-1">C</span>=single
          <span className="ml-1">D</span>=stand aside
        </div>
      </div>

      {/* Setups */}
      <div className="p-3 space-y-2">
        {results.setups.map((setup) => (
          <SetupCard key={setup.pair} setup={setup} />
        ))}
      </div>

      {/* Summary */}
      {results.summary && (
        <div className="px-4 py-3 border-t border-slate-600 bg-slate-800">
          <div className="text-[8px] font-mono uppercase tracking-widest text-gray-400 mb-1.5">
            Market Summary
          </div>
          <p className="text-[10px] text-gray-300 leading-relaxed">{results.summary}</p>
        </div>
      )}
    </div>
  );
}
