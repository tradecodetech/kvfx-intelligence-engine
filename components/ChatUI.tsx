"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { TradingMode, AssistantMode, ThesisContext } from "@/lib/tradingLogic";
import type { IntelligenceCard } from "@/lib/intelligenceEngine";
import type { ScanResults } from "@/lib/scanEngine";
import Sidebar, { type SidebarView } from "./Sidebar";
import ThesisPanel from "./ThesisPanel";
import TradePlanForm from "./TradePlanForm";
import TradeIntelligenceCard from "./TradeIntelligenceCard";
import ScanResultsCard from "./ScanResultsCard";
import LiveChartBadge from "./LiveChartBadge";
import { createClient } from "@/lib/supabase/client";
import { getLiveChartContext } from "@/lib/liveChart";

// ── Types ─────────────────────────────────────────────────

interface InsightData {
  bias: "bullish" | "bearish" | "neutral";
  alignmentScore: number;
  action: "wait" | "prepare" | "execute";
  zones: { type: string; priceLevel: string; strength: string; description: string }[];
  notes: string;
  riskWarnings: string;
  timeframe: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imagePreviewUrl?: string;
  insight?: InsightData | null;
  intelligenceCard?: IntelligenceCard | null;
  scanResults?: ScanResults | null;
  assistantMode?: AssistantMode;
  timestamp: Date;
}

interface SavedAnalysis {
  id: string;
  content: string;
  mode: AssistantMode;
  tradingMode: TradingMode;
  timestamp: number;
}

// ── Constants ─────────────────────────────────────────────

const SAVED_KEY = "kvfx-saved-analyses";

const TRADING_MODE_CONFIG: Record<
  TradingMode,
  { label: string; color: string; activeBg: string; activeBorder: string; activeText: string }
> = {
  scalping: {
    label: "Scalp",
    color: "text-gray-400",
    activeBg: "bg-amber-500/10",
    activeBorder: "border-amber-500/30",
    activeText: "text-amber-400",
  },
  swing: {
    label: "Swing",
    color: "text-gray-400",
    activeBg: "bg-sky-500/10",
    activeBorder: "border-sky-500/30",
    activeText: "text-sky-400",
  },
  macro: {
    label: "Macro",
    color: "text-gray-400",
    activeBg: "bg-violet-500/10",
    activeBorder: "border-violet-500/30",
    activeText: "text-violet-400",
  },
};

const ASSISTANT_MODE_CONFIG: Record<
  AssistantMode,
  { label: string; hint: string; activeBg: string; activeBorder: string; activeText: string }
> = {
  chat: {
    label: "Chat",
    hint: "Ask anything about trading process, methodology, or market context.",
    activeBg: "bg-[#c9a84c]/8",
    activeBorder: "border-[#c9a84c]/22",
    activeText: "text-[#c9a84c]",
  },
  chart: {
    label: "Chart",
    hint: "Upload a screenshot or describe price action for KVFX zone analysis.",
    activeBg: "bg-sky-500/10",
    activeBorder: "border-sky-500/25",
    activeText: "text-sky-400",
  },
  "trade-review": {
    label: "Trade Review",
    hint: "Paste a trade idea for execution coaching and risk evaluation.",
    activeBg: "bg-amber-500/10",
    activeBorder: "border-amber-500/25",
    activeText: "text-amber-400",
  },
  thesis: {
    label: "Thesis",
    hint: "Align setups with your active KVFX macro thesis.",
    activeBg: "bg-violet-500/10",
    activeBorder: "border-violet-500/25",
    activeText: "text-violet-400",
  },
  "macro-engine": {
    label: "Macro Engine",
    hint: "Run the KVFX Macro Engine for live regime scoring and operator brief.",
    activeBg: "bg-emerald-500/10",
    activeBorder: "border-emerald-500/25",
    activeText: "text-emerald-400",
  },
};

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "Daily", "Weekly"];
const SESSIONS = [
  { value: "london", label: "London" },
  { value: "new-york", label: "New York" },
  { value: "asia", label: "Asia" },
  { value: "swing-macro", label: "Swing/Macro" },
];

// ── Utilities ─────────────────────────────────────────────

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1280;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadSaved(): SavedAnalysis[] {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]"); } catch { return []; }
}
function persistSaved(a: SavedAnalysis[]) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

// ── Sub-components ────────────────────────────────────────

function AlignmentMeter({ score }: { score: number }) {
  const label = score >= 70 ? "Strong" : score >= 50 ? "Moderate" : "Weak";
  const fill = score >= 70 ? "bg-emerald-400" : score >= 50 ? "bg-[#c9a84c]" : "bg-red-400";
  const text = score >= 70 ? "text-emerald-400" : score >= 50 ? "text-[#c9a84c]" : "text-red-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-400">Alignment</span>
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-mono font-semibold ${text}`}>{score}</span>
          <span className="text-gray-500 text-xs">/</span>
          <span className="text-gray-400 text-[10px]">100</span>
          <span className={`text-[9px] uppercase tracking-wide ${text} ml-1`}>— {label}</span>
        </div>
      </div>
      <div className="w-full h-1 bg-[#1a2540] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${fill}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function BiasChip({ bias }: { bias: "bullish" | "bearish" | "neutral" }) {
  const map = {
    bullish: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    bearish: "bg-red-500/15 text-red-400 border-red-500/25",
    neutral: "bg-slate-600/60 text-gray-300 border-slate-500",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-widest border uppercase ${map[bias]}`}>
      {bias}
    </span>
  );
}

function ActionChip({ action }: { action: "wait" | "prepare" | "execute" }) {
  const map = {
    wait:    "bg-slate-600/50 text-gray-300 border-slate-500",
    prepare: "bg-amber-500/12 text-amber-400 border-amber-500/25",
    execute: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-widest border uppercase ${map[action]}`}>
      {action}
    </span>
  );
}

function InsightCard({ insight }: { insight: InsightData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-slate-600 bg-slate-900">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-800 transition-colors duration-150"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-400 mr-1">KVFX</span>
          <BiasChip bias={insight.bias} />
          <ActionChip action={insight.action} />
          <div className="flex items-center gap-1 ml-1">
            <div
              className={`h-1 rounded-full ${
                insight.alignmentScore >= 70 ? "bg-emerald-400" :
                insight.alignmentScore >= 50 ? "bg-[#c9a84c]" : "bg-red-400"
              }`}
              style={{ width: `${Math.max(16, insight.alignmentScore * 0.48)}px` }}
            />
            <span className="text-[9px] font-mono text-gray-400">{insight.alignmentScore}</span>
          </div>
        </div>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform duration-150 flex-shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-slate-600">
          <AlignmentMeter score={insight.alignmentScore} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-400 mb-1.5">Timeframe</p>
              <p className="text-xs text-gray-300 font-mono">{insight.timeframe}</p>
            </div>
            {insight.zones.length > 0 && (
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-400 mb-1.5">Key Zones</p>
                <div className="space-y-1">
                  {insight.zones.map((z, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className={`text-[8px] font-mono font-bold uppercase px-1 py-0 rounded ${
                        z.type === "demand" ? "bg-emerald-900/50 text-emerald-400/80" :
                        z.type === "supply" ? "bg-red-900/50 text-red-400/80" :
                        "bg-amber-900/50 text-amber-400/80"
                      }`}>
                        {z.type}
                      </span>
                      <span className="text-[10px] text-gray-300 font-mono truncate">{z.priceLevel}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {insight.notes && (
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-400 mb-1.5">Notes</p>
              <p className="text-xs text-gray-300 leading-relaxed">{insight.notes}</p>
            </div>
          )}
          {insight.riskWarnings && (
            <div className="border-l-2 border-amber-500/30 pl-2.5">
              <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-amber-500/50 mb-1">Risk</p>
              <p className="text-xs text-amber-400/70 leading-relaxed">{insight.riskWarnings}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── KVFX Quick Format Parser + Card ───────────────────────

interface KVFXQuickData {
  pair: string;
  price: string;
  bias: string;
  structure: string;
  confidence: string;
  kvfxRead: string;
}

function parseKVFXQuickFormat(content: string): { data: KVFXQuickData; rest: string } | null {
  const quickLineRegex =
    /\*\*Pair:\*\*\s*([^|]+?)\s*\|\s*\*\*Price:\*\*\s*([^|]+?)\s*\|\s*\*\*Bias:\*\*\s*([^|]+?)\s*\|\s*\*\*Structure:\*\*\s*([^|]+?)\s*\|\s*\*\*Confidence:\*\*\s*([^\n]+)/i;
  const quickMatch = content.match(quickLineRegex);
  if (!quickMatch) return null;

  const readRegex = /\*\*KVFX Read:\*\*\s*([^\n]+(?:\n(?!\n)[^\n]+)*)/i;
  const readMatch = content.match(readRegex);

  const rest = content
    .replace(quickMatch[0], "")
    .replace(readMatch ? readMatch[0] : "", "")
    .replace(/^\n+/, "")
    .trim();

  return {
    data: {
      pair: quickMatch[1].trim(),
      price: quickMatch[2].trim(),
      bias: quickMatch[3].trim(),
      structure: quickMatch[4].trim(),
      confidence: quickMatch[5].trim(),
      kvfxRead: readMatch ? readMatch[1].trim() : "",
    },
    rest,
  };
}

function KVFXQuickCard({ data, rest }: { data: KVFXQuickData; rest: string }) {
  const biasLower = data.bias.toLowerCase();
  const biasStyle =
    biasLower.includes("long") || biasLower.includes("bull")
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
      : biasLower.includes("short") || biasLower.includes("bear")
      ? "text-red-400 bg-red-500/10 border-red-500/30"
      : "text-gray-300 bg-slate-700/60 border-slate-500";

  const confLower = data.confidence.toLowerCase();
  const confStyle =
    confLower.includes("high")
      ? "text-emerald-400"
      : confLower.includes("medium")
      ? "text-[#c9a84c]"
      : "text-gray-400";

  const priceValid = data.price && data.price.toLowerCase() !== "n/a" && data.price !== "";

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-900 border border-slate-600 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-gray-100 tracking-widest font-mono">
              {data.pair}
            </span>
            {priceValid && (
              <span className="text-xs font-mono text-gray-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-600">
                {data.price}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${biasStyle}`}>
              {data.bias}
            </span>
            <span className={`text-[9px] font-mono uppercase tracking-wider font-semibold ${confStyle}`}>
              {data.confidence}
            </span>
          </div>
        </div>
        {data.structure && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-700/60">
            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500 flex-shrink-0">Structure</span>
            <span className="text-[10px] text-gray-300 font-mono">{data.structure}</span>
          </div>
        )}
        {data.kvfxRead && (
          <div className="px-4 py-3 bg-slate-800/50">
            <p className="text-xs text-gray-200 leading-relaxed">{data.kvfxRead}</p>
          </div>
        )}
      </div>
      {rest && <MarkdownText text={rest} />}
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-0.5">
      {text.split("\n").map((line, i) => {
        const hm = line.match(/^\*\*([^*]+)\*\*:?\s*(.*)/);
        if (hm) {
          return (
            <div key={i} className="flex items-start gap-2 mt-3 first:mt-0">
              <span className="flex-shrink-0 text-[9px] font-mono font-semibold uppercase tracking-[0.14em] text-[#c9a84c] mt-0.5 min-w-[90px]">
                {hm[1]}
              </span>
              {hm[2] && <span className="text-sm text-gray-100 leading-relaxed">{hm[2]}</span>}
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1.5" />;
        return <p key={i} className="text-sm text-gray-200 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// MacroEngineCard — structured renderer for macro-engine mode
// ──────────────────────────────────────────────────────────────

function macroScoreColor(n: number) {
  if (n >= 7) return "text-emerald-400";
  if (n >= 5) return "text-[#c9a84c]";
  return "text-red-400";
}
function macroScoreBadge(n: number) {
  if (n >= 7) return "bg-emerald-500/10 border-emerald-500/25 text-emerald-400";
  if (n >= 5) return "bg-[#c9a84c]/10 border-[#c9a84c]/25 text-[#c9a84c]";
  return "bg-red-500/10 border-red-500/25 text-red-400";
}
function macroRegimeColor(regime: string) {
  const r = regime.toUpperCase();
  if (r.includes("LATE-CYCLE") || r.startsWith("A.")) return "text-[#c9a84c]";
  if (r.includes("RISK-ON")    || r.startsWith("B.")) return "text-emerald-400";
  if (r.includes("RECESSION")  || r.startsWith("C.")) return "text-red-400";
  if (r.includes("COMMODITY")  || r.startsWith("D.")) return "text-orange-400";
  if (r.includes("SOFT LANDING") || r.startsWith("E.")) return "text-sky-400";
  return "text-violet-400";
}
function macroPairBiasColor(header: string) {
  const h = header.toUpperCase();
  if (h.startsWith("BULLISH")) return "text-emerald-400";
  if (h.startsWith("BEARISH")) return "text-red-400";
  if (h.startsWith("NEUTRAL")) return "text-gray-400";
  return "text-[#c9a84c]";
}

type MacroScoreRow = { label: string; score: number; notes: string[] };
type MacroSnapRow  = { label: string; value: string };
type MacroPairRow  = { pair: string; header: string; notes: string[] };
type MacroTradeRow = { num: number; title: string; lines: string[] };

function parseMacroOutput(raw: string) {
  const header = { date: "", regime: "", confidence: "" };
  const secs: Record<string, string[]> = {
    growth: [], inflation: [], policy: [], snapshot: [],
    pairbias: [], trades: [], changed: [], invalidation: [],
    operator: [], war: [], memory: [], sources: [],
  };

  for (const line of raw.split("\n")) {
    const t = line.trim();
    const dm = t.match(/^Date:\s*(.+)/i);       if (dm) { header.date = dm[1]; }
    const rm = t.match(/^Regime:\s*(.+)/i);     if (rm) { header.regime = rm[1]; }
    const cm = t.match(/^Confidence:\s*(.+)/i); if (cm) { header.confidence = cm[1]; }
  }

  let cur = "";
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || /^[═─]+$/.test(t))                 continue;
    if (/^KVFX MACRO ENGINE UPDATE/i.test(t))    continue;
    if (/^SCORECARD/i.test(t))                   continue;
    if (/^(Date|Regime|Confidence):/i.test(t))   continue;
    if (/^GROWTH:/i.test(t))                     { cur = "growth";       continue; }
    if (/^INFLATION:/i.test(t))                  { cur = "inflation";    continue; }
    if (/^POLICY STRESS:/i.test(t))              { cur = "policy";       continue; }
    if (/^MARKET SNAPSHOT:/i.test(t))            { cur = "snapshot";     continue; }
    if (/^FX LEVELS:/i.test(t))                  { cur = "snapshot";     continue; }
    if (/^PAIR BIAS:/i.test(t))                  { cur = "pairbias";     continue; }
    if (/^BEST 3 TRADES/i.test(t))               { cur = "trades";       continue; }
    if (/^WHAT CHANGED/i.test(t))                { cur = "changed";      continue; }
    if (/^INVALIDATION RISKS/i.test(t))          { cur = "invalidation"; continue; }
    if (/^OPERATOR NOTE/i.test(t))               { cur = "operator";     continue; }
    if (/^WAR\s*\/\s*ENERGY/i.test(t))           { cur = "war";          continue; }
    if (/^MEMORY UPDATE/i.test(t))               { cur = "memory";       continue; }
    if (/^Sources:/i.test(t))                    { cur = "sources";      continue; }
    if (cur) secs[cur].push(line);
  }

  return { header, secs };
}

function parseMacroScoreRows(lines: string[]): MacroScoreRow[] {
  const RE = /^\s*(US|EU|UK|JP|AU|CA|Fed|ECB|BOE|BOJ|RBA|BOC)\s+(\d+)\s*[—\-–]\s*(.*)/;
  const rows: MacroScoreRow[] = [];
  let cur: MacroScoreRow | null = null;
  for (const line of lines) {
    const m = line.match(RE);
    if (m) { cur = { label: m[1], score: parseInt(m[2], 10), notes: m[3] ? [m[3].trim()] : [] }; rows.push(cur); }
    else if (cur && line.trim()) cur.notes.push(line.trim());
  }
  return rows;
}

function parseMacroSnapRows(lines: string[]): MacroSnapRow[] {
  return lines.filter(l => l.trim().includes(":")).map(l => {
    const t = l.trim(); const idx = t.indexOf(":");
    return { label: t.slice(0, idx).trim(), value: t.slice(idx + 1).trim() };
  });
}

function parseMacroPairRows(lines: string[]): MacroPairRow[] {
  const RE = /^\s*(EURUSD|GBPUSD|USDJPY|AUDUSD|USDCAD|USDCHF|NZDUSD):\s*(.*)/i;
  const rows: MacroPairRow[] = [];
  let cur: MacroPairRow | null = null;
  for (const line of lines) {
    const m = line.match(RE);
    if (m) { cur = { pair: m[1].toUpperCase(), header: m[2].trim(), notes: [] }; rows.push(cur); }
    else if (cur && line.trim()) cur.notes.push(line.trim());
  }
  return rows;
}

function parseMacroTradeRows(lines: string[]): MacroTradeRow[] {
  const RE = /^\s*(\d+)\.\s+(.*)/;
  const rows: MacroTradeRow[] = [];
  let cur: MacroTradeRow | null = null;
  for (const line of lines) {
    const m = line.match(RE);
    if (m) { cur = { num: parseInt(m[1], 10), title: m[2].trim(), lines: [] }; rows.push(cur); }
    else if (cur && line.trim()) cur.lines.push(line.trim());
  }
  return rows;
}

function MacroTextSection({ title, lines, accent = "gray" }: {
  title: string; lines: string[]; accent?: "gray" | "red" | "orange";
}) {
  const titleCls  = accent === "red" ? "text-red-400" : accent === "orange" ? "text-orange-400" : "text-gray-400";
  const borderCls = accent === "red" ? "border-red-500/20" : accent === "orange" ? "border-orange-500/20" : "border-slate-700";
  return (
    <div className={`bg-slate-900 border ${borderCls} rounded-xl overflow-hidden`}>
      <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/60">
        <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${titleCls}`}>{title}</span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        {lines.map((line, i) => {
          const t = line.trim();
          if (!t) return null;
          const isBullet = t.startsWith("- ") || t.startsWith("• ");
          return (
            <div key={i} className="flex gap-2 items-start">
              {isBullet && <span className="flex-shrink-0 text-gray-600 mt-0.5">·</span>}
              <p className="text-[10px] text-gray-300 leading-relaxed">{isBullet ? t.replace(/^[-•]\s*/, "") : t}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MacroEngineCard({ content }: { content: string }) {
  const { header, secs } = parseMacroOutput(content);
  const growthRows  = parseMacroScoreRows(secs.growth);
  const inflRows    = parseMacroScoreRows(secs.inflation);
  const policyRows  = parseMacroScoreRows(secs.policy);
  const snapRows    = parseMacroSnapRows(secs.snapshot);
  const pairRows    = parseMacroPairRows(secs.pairbias);
  const tradeRows   = parseMacroTradeRows(secs.trades);
  const confNum     = parseInt(header.confidence.match(/\d+/)?.[0] ?? "5", 10);
  const confBarCls  = confNum >= 7 ? "bg-emerald-500" : confNum >= 5 ? "bg-[#c9a84c]" : "bg-red-500";

  return (
    <div className="space-y-2.5 font-mono text-xs">

      {/* Header */}
      <div className="bg-slate-900 border border-emerald-500/20 rounded-xl overflow-hidden">
        <div className="px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/15 flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400">KVFX MACRO ENGINE UPDATE</span>
          {header.date && <span className="text-[9px] text-gray-400">{header.date}</span>}
        </div>
        <div className="px-4 py-3 space-y-2">
          {header.regime && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 w-20 flex-shrink-0">Regime</span>
              <span className={`text-[10px] font-semibold ${macroRegimeColor(header.regime)}`}>{header.regime}</span>
            </div>
          )}
          {header.confidence && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase tracking-wider text-gray-500 w-20 flex-shrink-0">Confidence</span>
              <span className={`text-[10px] font-bold mr-2 ${macroScoreColor(confNum)}`}>{header.confidence}</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className={`w-2 h-1.5 rounded-sm ${i < confNum ? confBarCls : "bg-slate-700"}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scorecard */}
      {(growthRows.length > 0 || inflRows.length > 0 || policyRows.length > 0) && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/60">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">SCORECARD</span>
          </div>
          {[
            { label: "GROWTH",        rows: growthRows },
            { label: "INFLATION",     rows: inflRows   },
            { label: "POLICY STRESS", rows: policyRows },
          ].filter(s => s.rows.length > 0).map((sub, si) => (
            <div key={sub.label} className={si > 0 ? "border-t border-slate-800" : ""}>
              <div className="px-4 pt-2.5 pb-1">
                <span className="text-[8px] uppercase tracking-[0.18em] text-gray-600">{sub.label}</span>
              </div>
              <div className="px-4 pb-3 space-y-2">
                {sub.rows.map(row => (
                  <div key={row.label} className="flex gap-3 items-start">
                    <span className={`flex-shrink-0 text-[10px] font-bold w-8 ${macroScoreColor(row.score)}`}>{row.label}</span>
                    <span className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center text-[9px] font-bold ${macroScoreBadge(row.score)}`}>{row.score}</span>
                    <p className="text-[9px] text-gray-300 leading-relaxed">{row.notes.join(" ")}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Market Snapshot */}
      {snapRows.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/60">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">MARKET SNAPSHOT</span>
          </div>
          <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {snapRows.map(row => (
              <div key={row.label} className="flex items-baseline gap-2">
                <span className="text-[9px] uppercase tracking-wider text-gray-500 w-14 flex-shrink-0">{row.label}</span>
                <span className="text-[9px] text-gray-200">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pair Bias */}
      {pairRows.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/60">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">PAIR BIAS</span>
          </div>
          <div className="divide-y divide-slate-800">
            {pairRows.map(row => (
              <div key={row.pair} className="px-4 py-2.5">
                <div className="flex items-start gap-3 mb-0.5">
                  <span className="text-[10px] font-bold text-gray-100 w-16 flex-shrink-0">{row.pair}</span>
                  <span className={`text-[9px] font-semibold ${macroPairBiasColor(row.header)}`}>{row.header}</span>
                </div>
                {row.notes.length > 0 && (
                  <p className="text-[9px] text-gray-400 leading-relaxed pl-[76px]">{row.notes.join(" ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best 3 Trades */}
      {tradeRows.length > 0 && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700 bg-slate-800/60">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">BEST 3 TRADES</span>
          </div>
          <div className="divide-y divide-slate-800">
            {tradeRows.map(trade => (
              <div key={trade.num} className="px-4 py-3 flex gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mt-0.5">
                  <span className="text-[9px] font-bold text-emerald-400">{trade.num}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-gray-100 mb-1">{trade.title}</p>
                  {trade.lines.map((l, i) => <p key={i} className="text-[9px] text-gray-400 leading-relaxed">{l}</p>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {secs.changed.length     > 0 && <MacroTextSection title="WHAT CHANGED THIS WEEK" lines={secs.changed} />}
      {secs.invalidation.length > 0 && <MacroTextSection title="INVALIDATION RISKS" lines={secs.invalidation} accent="red" />}

      {/* Operator Note */}
      {secs.operator.length > 0 && (
        <div className="bg-[#c9a84c]/5 border border-[#c9a84c]/20 rounded-xl px-4 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#c9a84c] mb-2">OPERATOR NOTE</div>
          <p className="text-[10px] text-gray-200 leading-relaxed">{secs.operator.map(l => l.trim()).filter(Boolean).join(" ")}</p>
        </div>
      )}

      {secs.war.length    > 0 && <MacroTextSection title="WAR / ENERGY IMPACT" lines={secs.war} accent="orange" />}
      {secs.memory.length > 0 && <MacroTextSection title="MEMORY UPDATE" lines={secs.memory} />}

      {/* Sources */}
      {secs.sources.length > 0 && (
        <div className="border-t border-slate-800 pt-2.5">
          <div className="text-[8px] uppercase tracking-wider text-gray-600 mb-1.5">Sources</div>
          <div className="space-y-0.5">
            {secs.sources.map((s, i) => (
              <p key={i} className="text-[8px] text-gray-500 break-all leading-relaxed">{s.trim().replace(/^-\s*/, "")}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  onCopy,
  onSave,
  copied,
}: {
  message: Message;
  onCopy: () => void;
  onSave: () => void;
  copied: boolean;
}) {
  const isUser = message.role === "user";
  const kvfxParsed = !isUser ? parseKVFXQuickFormat(message.content) : null;
  const isMacroEngine = !isUser && message.assistantMode === "macro-engine";
  const isStructured =
    !isUser &&
    !kvfxParsed &&
    !isMacroEngine &&
    message.assistantMode &&
    ["chart", "trade-review", "thesis"].includes(message.assistantMode) &&
    message.content.includes("**");

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        {message.imagePreviewUrl && (
          <div className="rounded-xl overflow-hidden border border-slate-600 max-w-[220px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={message.imagePreviewUrl} alt="Chart" className="w-full object-cover" />
            <div className="px-2.5 py-1 bg-slate-800 text-[9px] text-gray-400 font-mono uppercase tracking-wider">
              Chart Image
            </div>
          </div>
        )}
        {message.content && (
          <div className="max-w-[68%] px-4 py-2.5 bg-slate-700 border border-slate-500 rounded-2xl rounded-br-sm shadow-sm">
            <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
        )}
        <span className="text-[9px] text-gray-500 font-mono pr-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start group">
      <div className="w-full bg-slate-800/80 backdrop-blur-sm border border-slate-600 rounded-2xl rounded-tl-sm overflow-hidden hover:border-slate-500 shadow-lg transition-colors duration-150">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-600 bg-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-[#1d3461]/80 to-[#2a1f5f]/80 border border-slate-500 flex items-center justify-center">
              <span className="text-[#c9a84c] text-[8px] font-black">KV</span>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-400">KVFX Engine</span>
            {message.assistantMode && message.assistantMode !== "chat" && (
              <span className={`text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                message.assistantMode === "chart" ? "bg-sky-500/10 text-sky-400/70 border-sky-500/20" :
                message.assistantMode === "trade-review" ? "bg-amber-500/10 text-amber-400/70 border-amber-500/20" :
                message.assistantMode === "macro-engine" ? "bg-emerald-500/10 text-emerald-400/70 border-emerald-500/20" :
                "bg-violet-500/10 text-violet-400/70 border-violet-500/20"
              }`}>
                {message.assistantMode === "trade-review" ? "Trade Review" :
                 message.assistantMode === "macro-engine" ? "Macro Engine" :
                 message.assistantMode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              onClick={onCopy}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono text-gray-400 hover:text-gray-200 hover:bg-slate-700 transition-all duration-150 border border-transparent hover:border-slate-600"
            >
              {copied ? (
                <>
                  <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={onSave}
              className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono text-gray-400 hover:text-gray-200 hover:bg-slate-700 transition-all duration-150 border border-transparent hover:border-slate-600"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Save
            </button>
          </div>
        </div>

        <div className="px-4 py-3.5">
          {isMacroEngine ? (
            <MacroEngineCard content={message.content} />
          ) : kvfxParsed ? (
            <KVFXQuickCard data={kvfxParsed.data} rest={kvfxParsed.rest} />
          ) : isStructured ? (
            <MarkdownText text={message.content} />
          ) : (
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {message.scanResults ? (
          <div className="px-4 pb-3.5">
            <ScanResultsCard results={message.scanResults} />
          </div>
        ) : message.intelligenceCard ? (
          <div className="px-4 pb-3.5">
            <TradeIntelligenceCard card={message.intelligenceCard} />
          </div>
        ) : message.insight ? (
          <div className="px-4 pb-3.5">
            <InsightCard insight={message.insight} />
          </div>
        ) : null}
      </div>

      <span className="text-[9px] text-gray-500 font-mono pl-1 mt-1.5">
        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex flex-col items-start">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 bg-[#c9a84c]/50 rounded-full"
              style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 200}ms infinite` }}
            />
          ))}
        </div>
        <span className="text-[10px] font-mono text-gray-400 tracking-wide">Analyzing structure…</span>
      </div>
    </div>
  );
}

function EmptyState({ assistantMode }: { assistantMode: AssistantMode }) {
  if (assistantMode === "chat") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 select-none">
        <div className="mb-7 text-center">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1d3461]/90 to-[#2a1f5f]/90 border border-slate-500 flex items-center justify-center">
              <span className="text-[#c9a84c] text-[11px] font-black tracking-tight">KV</span>
            </div>
            <span className="text-base font-bold text-gray-300 tracking-wide">KVFX Intelligence Engine</span>
            <span className="text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#c9a84c]/10 border border-[#c9a84c]/20 text-[#c9a84c]/70">
              Beta
            </span>
          </div>
          <p className="text-[10px] font-mono text-gray-500 tracking-widest uppercase">
            Powered by WhisperZonez × KVFX v3
          </p>
        </div>

        <div className="w-full max-w-md space-y-4">
          <div className="rounded-xl border border-[#c9a84c]/15 bg-slate-800 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c]/60 animate-pulse" />
              <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-[#c9a84c]/60">Full Engine Active</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-600">
              {[
                { label: "Forex", desc: "EURUSD · GBPUSD · USDJPY + more" },
                { label: "Indices", desc: "NASDAQ · SPX · US30 · DXY" },
                { label: "Metals", desc: "GOLD · SILVER · OIL" },
                { label: "Crypto", desc: "BTCUSD · ETHUSD" },
              ].map(({ label, desc }) => (
                <div key={label} className="px-4 py-2.5">
                  <p className="text-xs font-bold font-mono text-gray-200 tracking-wide mb-0.5">{label}</p>
                  <p className="text-[9px] text-gray-500 font-mono">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-gray-500 mb-2 pl-1">Scan Commands</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { cmd: "engine scan", desc: "bias + zones for EURUSD & NAS100" },
                { cmd: "best setup", desc: "highest-grade opportunity" },
                { cmd: "liquidity scan", desc: "sweep + zone targets" },
                { cmd: "bias board", desc: "directional read across pairs" },
              ].map(({ cmd, desc }) => (
                <div key={cmd} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600">
                  <p className="text-[10px] font-mono text-[#c9a84c]/80 mb-0.5">{cmd}</p>
                  <p className="text-[9px] text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-gray-500 mb-2 pl-1">Intelligence Queries</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { cmd: "EURUSD rejecting supply", desc: "reference zone + expectation" },
                { cmd: "NAS100 sweep highs", desc: "liquidity + invalidation" },
                { cmd: "Should I short here", desc: "yes / wait / no decision" },
                { cmd: "Is this chasing", desc: "risk assessment" },
              ].map(({ cmd, desc }) => (
                <div key={cmd} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600">
                  <p className="text-[10px] font-mono text-gray-300/70 mb-0.5">{cmd}</p>
                  <p className="text-[9px] text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-600 px-3 py-2.5 bg-slate-900">
            <p className="text-[9px] font-mono text-gray-500 leading-relaxed">
              <span className="text-gray-400">Not a signal engine.</span>{" "}
              Provides bias, reference zones, liquidity areas, and invalidation levels.
              Execution via WhisperZonez + KVFX v3 confirmation.
            </p>
          </div>
        </div>

        <p className="mt-6 text-[9px] font-mono text-[#1a2540] tracking-widest uppercase">
          Private Beta — Not for public distribution
        </p>
      </div>
    );
  }

  const hints: Record<Exclude<AssistantMode, "chat">, { icon: string; title: string; subs: string[] }> = {
    chart: {
      icon: "◈",
      title: "Chart Analysis Mode",
      subs: ["Upload a chart screenshot", "Describe price action", "Get KVFX zone analysis + plan"],
    },
    "trade-review": {
      icon: "⟁",
      title: "Trade Review Mode",
      subs: ["Use the Plan form below", "Or paste your trade setup", "Get execution coaching + risk verdict"],
    },
    thesis: {
      icon: "◉",
      title: "Thesis Mode",
      subs: ["Set your macro thesis first", "Then describe a setup", "Get thesis-aligned analysis"],
    },
    "macro-engine": {
      icon: "◎",
      title: "Macro Engine Mode",
      subs: ["Run live regime scoring across all regions", "Get scorecard + pair bias map", "Receive operator brief with best 3 trades"],
    },
  };
  const h = hints[assistantMode as Exclude<AssistantMode, "chat">];
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
      <div className="text-3xl text-[#1a2540] mb-4 select-none">{h.icon}</div>
      <p className="text-sm font-semibold text-gray-400 mb-3">{h.title}</p>
      <div className="space-y-1.5">
        {h.subs.map((s, i) => (
          <p key={i} className="text-xs text-gray-500 font-mono">{s}</p>
        ))}
      </div>
    </div>
  );
}

function ThesisSummaryColumn({ thesis, onEdit }: { thesis: ThesisContext | null; onEdit: () => void }) {
  const hasData = thesis && Object.values(thesis).some((v) => v !== "");

  return (
    <div className="hidden xl:flex w-[272px] flex-shrink-0 flex-col border-l border-slate-600 bg-slate-800">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-600">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${hasData ? "bg-violet-400 animate-pulse" : "bg-[#253650]"}`} />
          <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-gray-400">KVFX Thesis</span>
        </div>
        <button
          onClick={onEdit}
          className="text-[9px] font-mono text-[#c9a84c]/70 hover:text-[#c9a84c] transition-colors px-2 py-1 rounded border border-[#c9a84c]/15 hover:border-[#c9a84c]/30 bg-[#c9a84c]/5 hover:bg-[#c9a84c]/10"
        >
          {hasData ? "Edit" : "Set Thesis"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!hasData ? (
          <div className="text-center py-8">
            <div className="text-xl text-[#1a2540] mb-3 select-none">◉</div>
            <p className="text-xs text-gray-500 font-mono leading-relaxed">
              Set your macro thesis to align AI responses with your KVFX worldview.
            </p>
            <button onClick={onEdit} className="mt-4 px-3 py-1.5 text-[10px] text-[#c9a84c]/70 border border-[#c9a84c]/20 rounded-lg hover:bg-[#c9a84c]/8 transition-colors">
              Set Thesis →
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {[
              { label: "Macro Regime", value: thesis.macroRegime },
              { label: "Directional Bias", value: thesis.directionalBias },
              { label: "Risk Env", value: thesis.riskEnvironment },
              { label: "Strong", value: thesis.strongCurrencies },
              { label: "Weak", value: thesis.weakCurrencies },
              { label: "Session", value: thesis.sessionFocus },
              { label: "Key Themes", value: thesis.keyThemes },
              { label: "Levels", value: thesis.importantLevels },
              { label: "Notes", value: thesis.notes },
            ]
              .filter((f) => f.value)
              .map((f) => (
                <div key={f.label}>
                  <p className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-500 mb-1">{f.label}</p>
                  <p className="text-xs text-gray-300 leading-relaxed font-mono">{f.value}</p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SavedPanel({ analyses, onClose, onDelete }: { analyses: SavedAnalysis[]; onClose: () => void; onDelete: (id: string) => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 w-full max-w-[360px] bg-slate-800 border-r border-slate-600 z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-600">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Saved Analyses</h2>
            <p className="text-[9px] font-mono text-gray-400 uppercase tracking-wider mt-0.5">
              {analyses.length} {analyses.length === 1 ? "item" : "items"}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-200 hover:bg-slate-700 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {analyses.length === 0 && (
            <div className="text-center py-12">
              <p className="text-xs text-gray-500 font-mono">No saved analyses yet.</p>
              <p className="text-[10px] text-[#1a2540] font-mono mt-1">Hover an assistant response to save it.</p>
            </div>
          )}
          {analyses.map((a) => (
            <div key={a.id} className="group bg-slate-800 border border-slate-600 rounded-xl p-3.5 hover:border-slate-500 transition-colors duration-150">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    a.mode === "chart" ? "text-sky-400/80 bg-sky-500/10 border-sky-500/20" :
                    a.mode === "trade-review" ? "text-amber-400/80 bg-amber-500/10 border-amber-500/20" :
                    a.mode === "thesis" ? "text-violet-400/80 bg-violet-500/10 border-violet-500/20" :
                    a.mode === "macro-engine" ? "text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20" :
                    "text-gray-400 bg-slate-700 border-slate-600"
                  }`}>{a.mode}</span>
                  <span className="text-[8px] text-gray-500 font-mono uppercase">{a.tradingMode}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => navigator.clipboard.writeText(a.content)} className="text-[9px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded hover:bg-slate-700 transition-all">Copy</button>
                  <button onClick={() => onDelete(a.id)} className="text-[9px] text-gray-400 hover:text-red-400/70 px-1.5 py-0.5 rounded hover:bg-slate-700 transition-all">✕</button>
                </div>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">{a.content}</p>
              <p className="text-[9px] text-gray-500 font-mono mt-2">
                {new Date(a.timestamp).toLocaleDateString()} · {new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Beta Helpers ──────────────────────────────────────────

function getBetaDaysRemaining(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function BetaBanner({ daysRemaining }: { daysRemaining: number }) {
  const urgent = daysRemaining <= 3;
  const bg   = urgent ? "bg-red-500/15 border-red-500/30" : "bg-[#c9a84c]/10 border-[#c9a84c]/25";
  const text = urgent ? "text-red-300" : "text-[#c9a84c]";
  const dot  = urgent ? "bg-red-400 animate-pulse" : "bg-[#c9a84c]/60";
  return (
    <div className={`flex items-center justify-between px-4 py-2 border-b text-[10px] font-mono ${bg}`}>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className={`uppercase tracking-widest font-semibold ${text}`}>BETA ACCESS</span>
        <span className="text-gray-400">—</span>
        <span className={text}>{daysRemaining === 1 ? "1 day remaining" : `${daysRemaining} days remaining`}</span>
      </div>
      <span className="text-gray-500 tracking-wide">Full engine · All pairs · All markets</span>
    </div>
  );
}

function BetaExpiredModal() {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-slate-600">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1d3461] to-[#2a1f5f] border border-slate-500 flex items-center justify-center">
              <span className="text-[#c9a84c] text-xs font-black">KV</span>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-300 tracking-wide">KVFX Intelligence Engine</p>
              <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Beta Access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-red-400">Access Expired</span>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-100 leading-tight">Your Beta Access Has Ended</h2>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">Upgrade to continue using the KVFX Intelligence Engine.</p>
          </div>
          <div className="space-y-2 text-[10px] font-mono text-gray-400">
            {["All forex, indices, metals, crypto", "Unlimited AI analysis sessions", "Market scans across all pairs", "Full KVFX v3 + WhisperZonez engine"].map((f) => (
              <div key={f} className="flex items-center gap-2">
                <span className="text-emerald-400">✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push("/upgrade")} className="w-full py-3 rounded-xl bg-[#c9a84c]/20 hover:bg-[#c9a84c]/30 text-[#c9a84c] border border-[#c9a84c]/35 text-sm font-semibold tracking-wide transition-all duration-150">
            Upgrade Access →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ChatUI ───────────────────────────────────────────

interface ChatUIProps {
  userEmail?: string;
  userId?: string;
  userTier?: "beta" | "pro";
  betaExpiresAt?: string | null;
}

export default function ChatUI({ userEmail = "", userId: _userId = "", userTier = "beta", betaExpiresAt = null }: ChatUIProps) {
  const router = useRouter();

  const betaDaysRemaining = userTier === "beta" ? getBetaDaysRemaining(betaExpiresAt) : null;
  const isBetaExpired = betaDaysRemaining !== null && betaDaysRemaining <= 0;

  const handleSignOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  // ── State ──
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      content: "KVFX Intelligence Engine — online.\n\nDescribe a setup and I'll return a full Intelligence Card: bias, structure, confidence score, trade plan, risk flags, and a verdict.\n\nExamples:\n• EURUSD rejecting supply zone on H1\n• Should I short NAS100? London open, bearish\n• Gold BOS bullish, 5m sweeping lows\n\nBias → Zone → Confirmation → Execution. No chasing. No guessing.",
      assistantMode: "chat",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tradingMode, setTradingMode] = useState<TradingMode>("swing");
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("chat");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("");
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; previewUrl: string } | null>(null);
  const [isThesisPanelOpen, setIsThesisPanelOpen] = useState(false);
  const [isTradePlanOpen, setIsTradePlanOpen] = useState(false);
  const [thesisContext, setThesisContext] = useState<ThesisContext | null>(null);
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [sidebarView, setSidebarView] = useState<SidebarView>("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestInputRef = useRef("");

  // ── Effects ──
  useEffect(() => { setSavedAnalyses(loadSaved()); }, []);
  useEffect(() => {
    if (sidebarView === "chat") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, sidebarView]);
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
  }, [input]);

  // ── Handlers ──
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const dataUrl = await compressImage(file);
      setPendingImage({ dataUrl, previewUrl: dataUrl });
      if (assistantMode === "chat") setAssistantMode("chart");
    } catch (err) { console.error(err); }
  };

  const handleCopy = useCallback((content: string, id: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  }, []);

  const handleSave = useCallback((msg: Message) => {
    const a: SavedAnalysis = {
      id: Date.now().toString(),
      content: msg.content,
      mode: msg.assistantMode ?? "chat",
      tradingMode,
      timestamp: Date.now(),
    };
    const updated = [a, ...savedAnalyses].slice(0, 50);
    setSavedAnalyses(updated);
    persistSaved(updated);
  }, [savedAnalyses, tradingMode]);

  const handleDeleteSaved = useCallback((id: string) => {
    const updated = savedAnalyses.filter((a) => a.id !== id);
    setSavedAnalyses(updated);
    persistSaved(updated);
  }, [savedAnalyses]);

  const sendMessage = useCallback(async (textOverride?: string) => {
    const text = (textOverride !== undefined ? textOverride : latestInputRef.current).trim();
    if ((!text && !pendingImage) || isLoading) return;

    const imgToSend = pendingImage?.dataUrl;

    const effectiveMode: AssistantMode = imgToSend
      ? "chart"
      : assistantMode === "chart"
      ? "chat"
      : assistantMode;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      imagePreviewUrl: pendingImage?.previewUrl,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    latestInputRef.current = "";
    setInput("");
    setPendingImage(null);
    setIsTradePlanOpen(false);
    setIsLoading(true);

    if (assistantMode === "chart") setAssistantMode("chat");

    try {
      // ── Fetch live chart context from MCP bridge ──────────────
      let liveChartContext = "";
      try {
        const chart = await getLiveChartContext();
        if (chart.isLive) liveChartContext = chart.mcpContext;
      } catch { /* MCP bridge offline — continue without it */ }

      const _cn = (t: string) =>
        t.toLowerCase().replace(/[^\S\x20]/g, " ").replace(/\s+/g, " ").trim();
      const _cl = [
        "scan market","kvfx scan","whisper scan","engine scan","best setup",
        "best setups","scan pairs","full scan","market scan","run scan","scan now",
        "give me a scan","what's the best","what is the best","bias board",
        "liquidity scan","risk environment","show me setups","any setups",
        "what's setting up",
      ];
      const commandHint = _cl.some((c) => _cn(text).includes(c));

      const payload = {
        message:          text,
        sessionId:        sessionId ?? null,
        tradingMode,
        assistantMode:    effectiveMode,
        image:            imgToSend ?? null,
        thesisContext:    thesisContext ?? null,
        timeframe:        selectedTimeframe || null,
        tradingSession:   selectedSession  || null,
        isTradeInsight:   effectiveMode === "trade-review" || effectiveMode === "chart",
        commandHint,
        liveChartContext: liveChartContext || null,   // ← injected MCP data
      };

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      const data = await res.json();
      if (data.sessionId && !sessionId) setSessionId(data.sessionId);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.content,
          insight: data.insight,
          intelligenceCard: data.intelligenceCard ?? null,
          scanResults: data.scanResults ?? null,
          assistantMode: effectiveMode,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Error: ${errMsg}`,
          assistantMode: "chat",
          timestamp: new Date(),
        },
      ]);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, pendingImage, sessionId, tradingMode, assistantMode, thesisContext, selectedTimeframe, selectedSession]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const clearChat = () => {
    setMessages([{
      id: "clear",
      role: "assistant",
      content: "Session cleared. Ready for new analysis. What's the setup?",
      assistantMode: "chat",
      timestamp: new Date(),
    }]);
    setSessionId(null);
    setPendingImage(null);
  };

  const handleViewChange = (view: SidebarView) => setSidebarView(view);
  const activeThesis = !!(thesisContext && Object.values(thesisContext).some((v) => v !== ""));
  const amc = ASSISTANT_MODE_CONFIG[assistantMode];

  // ── Render ──
  return (
    <div className="flex h-screen bg-slate-900 text-gray-100 overflow-hidden">
      {isBetaExpired && <BetaExpiredModal />}
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleImageSelect} />
      <ThesisPanel open={isThesisPanelOpen} onClose={() => setIsThesisPanelOpen(false)} onThesisChange={(t) => setThesisContext(t)} />
      {sidebarView === "saved" && (
        <SavedPanel analyses={savedAnalyses} onClose={() => setSidebarView("chat")} onDelete={handleDeleteSaved} />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeView={sidebarView}
        onViewChange={handleViewChange}
        onThesisOpen={() => setIsThesisPanelOpen(true)}
        savedCount={savedAnalyses.length}
        hasThesis={activeThesis}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ─ Top bar ─ */}
        <div className="flex-shrink-0 border-b border-slate-600 bg-slate-800">
          {userTier === "beta" && betaDaysRemaining !== null && betaDaysRemaining > 0 && (
            <BetaBanner daysRemaining={betaDaysRemaining} />
          )}

          {/* Row 1 — assistant mode tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-slate-600">
            {(Object.keys(ASSISTANT_MODE_CONFIG) as AssistantMode[]).map((m) => {
              const cfg = ASSISTANT_MODE_CONFIG[m];
              const active = assistantMode === m;
              return (
                <button
                  key={m}
                  onClick={() => setAssistantMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium tracking-wide transition-all duration-150 border ${
                    active ? `${cfg.activeBg} ${cfg.activeText} ${cfg.activeBorder}` : "text-gray-400 border-transparent hover:text-gray-200 hover:bg-slate-800"
                  }`}
                >
                  {m === "chart" && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  {cfg.label}
                  {m === "thesis" && activeThesis && (
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}

            {/* Right side controls */}
            <div className="ml-auto flex items-center gap-2">
              {/* ── LIVE CHART BADGE — MCP integration ── */}
              <LiveChartBadge />

              {userTier === "pro" ? (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400/70 text-[8px] font-mono uppercase tracking-widest">Pro</span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#c9a84c]/10 border border-[#c9a84c]/20 text-[#c9a84c]/70 text-[8px] font-mono uppercase tracking-widest">Beta</span>
              )}
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/8 border border-emerald-500/15">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400/60">Live</span>
              </div>
              {userEmail && (
                <span className="hidden md:block text-[9px] font-mono text-gray-500 max-w-[130px] truncate">{userEmail}</span>
              )}
              <button onClick={handleSignOut} className="text-[10px] text-gray-400 hover:text-red-400/70 px-2.5 py-1 rounded border border-slate-600 hover:border-red-500/20 bg-transparent transition-all duration-150">
                Sign Out
              </button>
              <button onClick={clearChat} className="text-[10px] text-gray-400 hover:text-gray-200 px-2.5 py-1 rounded border border-slate-600 hover:border-slate-500 bg-transparent transition-all duration-150">
                Clear
              </button>
            </div>
          </div>

          {/* Row 2 — trading context */}
          <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-500 mr-1.5">Mode</span>
              {(Object.keys(TRADING_MODE_CONFIG) as TradingMode[]).map((m) => {
                const cfg = TRADING_MODE_CONFIG[m];
                const active = tradingMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setTradingMode(m)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border transition-all duration-150 ${
                      active ? `${cfg.activeBg} ${cfg.activeText} ${cfg.activeBorder}` : "text-gray-500 border-slate-600 hover:border-slate-500 hover:text-gray-400 bg-transparent"
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <div className="w-px h-3.5 bg-[#1a2540] hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-500">TF</span>
              <select value={selectedTimeframe} onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-md text-[10px] text-gray-400 px-2 py-0.5 focus:outline-none focus:border-slate-500 cursor-pointer hover:border-slate-500 transition-colors appearance-none pr-5"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234a5a78'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 4px center", backgroundSize: "10px" }}>
                <option value="">Any</option>
                {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-gray-500">Session</span>
              <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded-md text-[10px] text-gray-400 px-2 py-0.5 focus:outline-none focus:border-slate-500 cursor-pointer hover:border-slate-500 transition-colors appearance-none pr-5"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234a5a78'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 4px center", backgroundSize: "10px" }}>
                <option value="">Any</option>
                {SESSIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            <div className="ml-auto hidden md:block">
              <span className={`text-[9px] font-mono ${amc.activeText} opacity-50`}>{amc.hint}</span>
            </div>
          </div>
        </div>

        {/* ─ Content area ─ */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {messages.length <= 1 && !isLoading ? (
                <EmptyState assistantMode={assistantMode} />
              ) : (
                <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      onCopy={() => handleCopy(msg.content, msg.id)}
                      onSave={() => handleSave(msg)}
                      copied={copiedId === msg.id}
                    />
                  ))}
                  {isLoading && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* ─ Input area ─ */}
            <div className="flex-shrink-0 border-t border-slate-600 bg-slate-800 px-4 py-3">
              <div className="max-w-3xl mx-auto space-y-2">
                {isTradePlanOpen && (
                  <TradePlanForm
                    onSubmit={(text) => { latestInputRef.current = text; setInput(text); setAssistantMode("trade-review"); }}
                    onClose={() => setIsTradePlanOpen(false)}
                  />
                )}

                {pendingImage && (
                  <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-xl">
                    <div className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={pendingImage.previewUrl} alt="Chart" className="w-14 h-14 object-cover rounded-lg border border-slate-600" />
                      <button onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center transition-colors">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div>
                      <p className="text-xs text-gray-300 font-medium">Chart ready for analysis</p>
                      <p className="text-[9px] text-gray-400 font-mono mt-0.5">{assistantMode === "chart" ? "Chart Analysis mode active" : "Add a note or send as-is"}</p>
                    </div>
                  </div>
                )}

                <div className="bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden focus-within:border-slate-400 shadow-md transition-colors duration-150">
                  <div className="px-4 pt-3 pb-1">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => { latestInputRef.current = e.target.value; setInput(e.target.value); }}
                      onKeyDown={handleKeyDown}
                      disabled={isBetaExpired}
                      placeholder={
                        isBetaExpired ? "Beta access has expired — upgrade to continue" :
                        pendingImage ? "Add context for this chart (optional)..." :
                        assistantMode === "chart" ? "Describe the chart, or upload an image above..." :
                        assistantMode === "trade-review" ? "Describe your trade setup, or use the Plan button..." :
                        assistantMode === "thesis" ? "Ask how your setup aligns with your active thesis..." :
                        assistantMode === "macro-engine" ? "Type 'run macro scan' or ask for regime update, scorecard, or pair bias..." :
                        "Describe your setup, ask a question, or analyze market context..."
                      }
                      rows={1}
                      className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none leading-relaxed min-h-[40px] max-h-[130px] font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1 border-t border-[#141e2e]">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono border transition-all duration-150 ${
                        pendingImage ? "bg-sky-500/12 text-sky-400 border-sky-500/25" : "text-gray-400 border-slate-600 hover:border-slate-500 hover:text-gray-200 hover:bg-slate-700"
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="hidden sm:inline">Chart</span>
                    </button>

                    <button
                      onClick={() => setIsTradePlanOpen(!isTradePlanOpen)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono border transition-all duration-150 ${
                        isTradePlanOpen ? "bg-[#c9a84c]/12 text-[#c9a84c] border-[#c9a84c]/25" : "text-gray-400 border-slate-600 hover:border-slate-500 hover:text-gray-200 hover:bg-slate-700"
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span className="hidden sm:inline">Plan</span>
                    </button>

                    <div className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider border ${amc.activeBg} ${amc.activeText} ${amc.activeBorder}`}>
                      {amc.label}
                    </div>

                    <div className="flex-1" />
                    <span className="hidden lg:block text-[9px] font-mono text-[#1a2540] mr-2">↵ send  ⇧↵ newline</span>

                    <button
                      onClick={() => sendMessage()}
                      disabled={isLoading || isBetaExpired}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-150 ${
                        isLoading || isBetaExpired ? "bg-slate-800 text-gray-500 border-slate-600 cursor-not-allowed" :
                        (!input.trim() && !pendingImage) ? "bg-slate-800 text-gray-500 border-slate-600" :
                        "bg-[#c9a84c]/15 hover:bg-[#c9a84c]/25 text-[#c9a84c] border-[#c9a84c]/25"
                      }`}
                    >
                      {isLoading ? (
                        <div className="w-3 h-3 border border-[#c9a84c]/30 border-t-[#c9a84c] rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {!input.trim() && !pendingImage && !isLoading && assistantMode === "chat" && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[8px] font-mono text-[#1a2540] uppercase tracking-widest mr-0.5">Try:</span>
                    {["engine scan", "EURUSD rejecting supply", "GOLD BOS bullish", "best setup"].map((cmd) => (
                      <button
                        key={cmd}
                        onClick={() => sendMessage(cmd)}
                        className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-gray-400 hover:text-gray-200 hover:border-slate-500 hover:bg-slate-700 transition-all duration-150"
                      >
                        {cmd}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <ThesisSummaryColumn thesis={thesisContext} onEdit={() => setIsThesisPanelOpen(true)} />
        </div>
      </div>
    </div>
  );
}
