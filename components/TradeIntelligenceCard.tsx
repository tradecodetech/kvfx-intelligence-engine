"use client";

import { useState } from "react";
import type { IntelligenceCard, PriceLevels, ConfidenceFactors } from "@/lib/intelligenceEngine";

// ── Confidence Meter ──────────────────────────────────────────────────────────

function ConfidenceMeter({ score }: { score: number }) {
  const filled = Math.round(score);
  const color =
    score >= 7 ? "#22c55e" : score >= 4.5 ? "#c9a84c" : "#ef4444";
  const label =
    score >= 7.5 ? "STRONG"
    : score >= 5.5 ? "MODERATE"
    : score >= 3.5 ? "WEAK"
    : "NO EDGE";

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold font-mono tabular-nums" style={{ color }}>
        {score.toFixed(1)}
      </span>
      <span className="text-[9px] text-gray-500 font-mono">/10</span>
      <div className="flex gap-0.5 ml-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-sm"
            style={{ background: i < filled ? color : "#334155", opacity: i < filled ? 1 : 0.6 }}
          />
        ))}
      </div>
      <span className="text-[9px] font-mono font-bold tracking-wider ml-1" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// ── Decision Badge ────────────────────────────────────────────────────────────

function DecisionBadge({ decision }: { decision: "yes" | "wait" | "no" }) {
  const config = {
    yes: {
      bg: "bg-emerald-500/20",
      border: "border-emerald-500/40",
      text: "text-emerald-300",
      label: "EXECUTE",
      dot: "bg-emerald-400",
    },
    wait: {
      bg: "bg-amber-500/20",
      border: "border-amber-500/40",
      text: "text-amber-300",
      label: "WAIT",
      dot: "bg-amber-400",
    },
    no: {
      bg: "bg-red-500/20",
      border: "border-red-500/40",
      text: "text-red-300",
      label: "STAND ASIDE",
      dot: "bg-red-400",
    },
  }[decision];

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${config.bg} ${config.border}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span className={`text-xs font-mono font-bold tracking-widest ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}

// ── Bias Chip ─────────────────────────────────────────────────────────────────

function BiasDisplay({ bias }: { bias: string }) {
  const lower = bias.toLowerCase();
  const cfg =
    lower === "bullish"
      ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/40"
      : lower === "bearish"
      ? "text-red-300 bg-red-500/20 border-red-500/40"
      : lower === "mixed"
      ? "text-amber-300 bg-amber-500/20 border-amber-500/40"
      : "text-gray-300 bg-slate-600/40 border-slate-500";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-widest border uppercase ${cfg}`}>
      {bias}
    </span>
  );
}

// ── Price Levels Display ──────────────────────────────────────────────────────

function PriceLevelsRow({
  levels,
  bias,
  source,
}: {
  levels: PriceLevels;
  bias: string;
  source: "user" | "live" | null;
}) {
  const cells: { label: string; value: string; color: string; sub?: string }[] = [
    { label: "ENTRY", value: levels.formatted.entry, color: "text-[#c9a84c]" },
    { label: "STOP",  value: levels.formatted.stop,  color: "text-red-400" },
    { label: "TP1",   value: levels.formatted.tp1,   color: "text-emerald-400", sub: `${levels.rr1}R` },
    { label: "TP2",   value: levels.formatted.tp2,   color: "text-emerald-300", sub: `${levels.rr2}R` },
  ];

  return (
    <div className="px-4 py-3 border-b border-slate-600 bg-slate-900">
      <div className="flex items-center gap-2 mb-2.5">
        <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-400">
          Price Levels
          <span className="ml-2 text-gray-500 normal-case tracking-normal">@ {levels.formatted.entry}</span>
        </p>
        {source === "live" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[8px] font-mono text-emerald-400 tracking-wider">
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
        {source === "user" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#c9a84c]/15 border border-[#c9a84c]/30 text-[8px] font-mono text-[#c9a84c]/80 tracking-wider">
            PROVIDED
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cells.map(({ label, value, color, sub }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg bg-slate-800 border border-slate-600 shadow-sm"
          >
            <span className="text-[8px] font-mono text-gray-500 uppercase tracking-widest">{label}</span>
            <span className={`text-[11px] font-bold font-mono tabular-nums ${color}`}>{value}</span>
            {sub && <span className="text-[8px] font-mono text-gray-400">{sub}</span>}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[9px] font-mono text-gray-500">
        <span>RR to TP1: <span className="text-[#c9a84c]/80">{levels.rr1}:1</span></span>
        <span>RR to TP2: <span className="text-[#c9a84c]/80">{levels.rr2}:1</span></span>
        <span className="ml-auto capitalize text-gray-400">{bias} levels</span>
      </div>
    </div>
  );
}

// ── Confidence Breakdown ──────────────────────────────────────────────────────

function ConfidenceBreakdown({ factors }: { factors: ConfidenceFactors }) {
  const rows: { label: string; score: number; max: number; barClass: string }[] = [
    { label: "Structure",  score: factors.structure, max: 3, barClass: "bg-purple-500" },
    { label: "Liquidity",  score: factors.liquidity, max: 2, barClass: "bg-blue-500" },
    { label: "Bias",       score: factors.bias,      max: 2, barClass: "bg-yellow-500" },
    { label: "Session",    score: factors.session,   max: 1, barClass: "bg-green-500" },
    { label: "Price data", score: factors.price,     max: 1, barClass: "bg-cyan-500" },
  ];

  return (
    <div className="px-4 py-3 border-b border-slate-600 bg-slate-900/50">
      <p className="text-[8px] font-mono uppercase tracking-[0.16em] text-gray-400 mb-3">
        Confidence Breakdown
      </p>
      <div className="space-y-2">
        {rows.map(({ label, score, max, barClass }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-gray-400 w-20 flex-shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barClass}`}
                style={{ width: `${(score / max) * 100}%`, opacity: score > 0 ? 1 : 0.2 }}
              />
            </div>
            <span className="text-[9px] font-mono text-gray-400 w-8 text-right tabular-nums">
              {score.toFixed(1)}/{max}
            </span>
          </div>
        ))}
        {factors.penalties < 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-red-400 w-20 flex-shrink-0">Penalties</span>
            <div className="flex-1" />
            <span className="text-[9px] font-mono text-red-400 w-8 text-right tabular-nums">
              {factors.penalties.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  card: IntelligenceCard;
}

export default function TradeIntelligenceCard({ card }: Props) {
  const [expanded, setExpanded] = useState(true);

  const hasRisks = card.risks.length > 0;
  const hasPlan = card.plan.length > 0;

  const outerBorderClass =
    card.decision === "yes" ? "border-emerald-600/50"
    : card.decision === "no" ? "border-red-600/50"
    : "border-slate-600";

  return (
    <div className={`mt-3 rounded-xl overflow-hidden border shadow-lg bg-slate-800/80 backdrop-blur-sm ${outerBorderClass}`}>

      {/* ── Header ─────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-700/50 transition-colors duration-150"
      >
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono font-black tracking-[0.2em] px-1.5 py-0.5 rounded bg-[#c9a84c]/15 border border-[#c9a84c]/30 text-[#c9a84c]">
            KVFX INTELLIGENCE
          </span>
          {card.multiTfConflict && (
            <span className="text-[8px] font-mono text-amber-300 border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 rounded tracking-wider">
              TF CONFLICT
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ConfidenceMeter score={card.confidence} />
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform duration-150 flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Expanded Body ───────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-slate-600">

          {/* Row 1: Pair + Bias + Session + Timeframe */}
          <div className="flex items-center flex-wrap gap-3 px-4 py-3 border-b border-slate-600 bg-slate-800">
            {card.pair && (
              <span className="text-base font-bold font-mono text-white tracking-wider">
                {card.pair}
              </span>
            )}
            <BiasDisplay bias={card.bias} />
            {card.session && (
              <span className="text-[10px] font-mono text-gray-300 bg-slate-700 px-2 py-0.5 rounded border border-slate-600">
                🕐 {card.session}
              </span>
            )}
            {card.timeframe && (
              <span className="text-[10px] font-mono text-gray-300 bg-slate-700 px-2 py-0.5 rounded border border-slate-600">
                📐 {card.timeframe}
              </span>
            )}
            {card.alignmentScore > 0 && (
              <span className="text-[9px] font-mono text-gray-400 ml-auto">
                Alignment {card.alignmentScore}/100
              </span>
            )}
          </div>

          {/* Row 2: Structure */}
          <div className="px-4 py-3 border-b border-slate-600 bg-slate-800/50">
            <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-400 mb-1.5">
              Structure Detected
            </p>
            <p className={`text-sm font-semibold font-mono ${
              card.structure === "No clear structure" ? "text-gray-500" : "text-gray-100"
            }`}>
              {card.structure}
            </p>
          </div>

          {/* Row 3: Price Levels */}
          {card.priceLevels ? (
            <PriceLevelsRow levels={card.priceLevels} bias={card.bias} source={card.priceSource} />
          ) : card.needsPrice ? (
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-600 bg-slate-900/50">
              <svg className="w-3 h-3 text-[#c9a84c]/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[10px] font-mono text-gray-400">
                Provide current price for accurate entry/stop/target levels
              </p>
            </div>
          ) : null}

          {/* Confidence breakdown */}
          {card.confidenceFactors && (
            <ConfidenceBreakdown factors={card.confidenceFactors} />
          )}

          {/* Plan */}
          {hasPlan && (
            <div className="px-4 py-3.5 border-b border-slate-600 bg-slate-800/50">
              <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-gray-400 mb-2.5">
                Trade Plan
              </p>
              <div className="space-y-2">
                {card.plan.map((step, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-400/30"
                  >
                    <span className="text-[#c9a84c] text-[10px] mt-0.5 flex-shrink-0 font-mono">→</span>
                    <p className="text-xs text-yellow-100 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risks */}
          {hasRisks && (
            <div className="px-4 py-3.5 border-b border-slate-600 bg-red-500/5">
              <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-red-400 mb-2.5">
                Risk Factors
              </p>
              <div className="flex flex-wrap gap-2">
                {card.risks.map((risk, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono text-red-200 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-md"
                  >
                    {risk}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Verdict */}
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-slate-800">
            <DecisionBadge decision={card.decision} />
            <p className="text-xs text-gray-300 font-mono leading-relaxed flex-1 text-right">
              {card.decisionReason}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
