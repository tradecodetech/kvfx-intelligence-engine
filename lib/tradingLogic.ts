/**
 * KVFX Intelligence Engine — Trading Logic Core
 * Combines WhisperZonez zone analysis with KVFX Algo v3 signal logic
 */

// ---------------------------------------------------------
// Core Types
// ---------------------------------------------------------

export type Bias = "bullish" | "bearish" | "neutral";
export type TradingMode = "scalping" | "swing" | "macro";
export type AssistantMode = "chat" | "chart" | "trade-review" | "thesis" | "macro-engine";
export type TradingSession = "london" | "new-york" | "asia" | "swing-macro";

export interface Zone {
  type: "support" | "resistance" | "supply" | "demand" | "liquidity";
  priceLevel: string;
  strength: "weak" | "moderate" | "strong";
  description: string;
}

export interface TradeInsight {
  bias: Bias;
  zones: Zone[];
  alignmentScore: number; // 0–100
  notes: string;
  riskWarnings: string;
  action: "wait" | "prepare" | "execute";
  timeframe: string;
}

export interface MarketContext {
  description: string;
  mode: TradingMode;
  priceAction?: string;
  keyLevels?: string[];
  trend?: string;
}

export interface ThesisContext {
  macroRegime: string;
  directionalBias: string;
  strongCurrencies: string;
  weakCurrencies: string;
  riskEnvironment: "risk-on" | "risk-off" | "neutral" | "";
  keyThemes: string;
  importantLevels: string;
  sessionFocus: string;
  notes: string;
}

export interface TradePlan {
  symbol: string;
  direction: "long" | "short" | "";
  entry: string;
  stop: string;
  target: string;
  thesis: string;
  whyNow: string;
}

export const EMPTY_THESIS: ThesisContext = {
  macroRegime: "",
  directionalBias: "",
  strongCurrencies: "",
  weakCurrencies: "",
  riskEnvironment: "",
  keyThemes: "",
  importantLevels: "",
  sessionFocus: "",
  notes: "",
};

// ---------------------------------------------------------
// WhisperZonez: Zone Identification
// ---------------------------------------------------------
export function identifyZones(description: string): Zone[] {
  const zones: Zone[] = [];
  const lower = description.toLowerCase();

  if (lower.includes("support") || lower.includes("floor") || lower.includes("demand")) {
    zones.push({
      type: "demand",
      priceLevel: extractPriceLevel(description, ["support", "demand", "floor"]),
      strength: inferStrength(lower, "support"),
      description: "Demand zone / support — area where buyers have historically stepped in.",
    });
  }

  if (lower.includes("resistance") || lower.includes("ceiling") || lower.includes("supply")) {
    zones.push({
      type: "supply",
      priceLevel: extractPriceLevel(description, ["resistance", "supply", "ceiling"]),
      strength: inferStrength(lower, "resistance"),
      description: "Supply zone / resistance — area where sellers have historically dominated.",
    });
  }

  if (
    lower.includes("liquidity") ||
    lower.includes("equal highs") ||
    lower.includes("equal lows") ||
    lower.includes("stop hunt") ||
    lower.includes("inducement")
  ) {
    zones.push({
      type: "liquidity",
      priceLevel: extractPriceLevel(description, ["liquidity", "equal highs", "equal lows"]),
      strength: "strong",
      description:
        "Liquidity pool — stops clustered here. Price may sweep before reversing. Patience required.",
    });
  }

  if (lower.includes("breakout") || lower.includes("break of structure") || lower.includes("bos")) {
    zones.push({
      type: "resistance",
      priceLevel: "Structure break level",
      strength: "moderate",
      description:
        "Break of structure detected. Wait for retest confirmation before committing. Fake breakouts are common near liquidity.",
    });
  }

  if (zones.length === 0) {
    zones.push({
      type: "support",
      priceLevel: "Not specified",
      strength: "weak",
      description:
        "No clear zones identified from description. Provide key price levels and structure context for better analysis.",
    });
  }

  return zones;
}

// ---------------------------------------------------------
// KVFX Algo v3: Directional Bias
// ---------------------------------------------------------
export function analyzeBias(description: string, mode: TradingMode): Bias {
  const lower = description.toLowerCase();
  let bullishScore = 0;
  let bearishScore = 0;

  const bullishKeywords = [
    "bullish", "uptrend", "higher highs", "higher lows", "demand", "bounce",
    "buy", "long", "accumulation", "breakout up", "reclaim", "support holding",
    "green", "above", "strong close",
  ];
  const bearishKeywords = [
    "bearish", "downtrend", "lower highs", "lower lows", "supply", "rejection",
    "sell", "short", "distribution", "breakdown", "failed", "below",
    "resistance holding", "red", "weak close", "liquidation",
  ];

  bullishKeywords.forEach((kw) => { if (lower.includes(kw)) bullishScore++; });
  bearishKeywords.forEach((kw) => { if (lower.includes(kw)) bearishScore++; });

  const threshold = mode === "macro" ? 3 : mode === "swing" ? 2 : 1;
  if (bullishScore > bearishScore && bullishScore >= threshold) return "bullish";
  if (bearishScore > bullishScore && bearishScore >= threshold) return "bearish";
  return "neutral";
}

// ---------------------------------------------------------
// KVFX Algo v3: Signal Alignment Score
// ---------------------------------------------------------
export function checkAlignment(description: string, bias: Bias, mode: TradingMode): number {
  const lower = description.toLowerCase();
  let score = 0;

  const confirmations: { keywords: string[]; points: number }[] = [
    { keywords: ["structure", "bos", "choch", "break of structure"], points: 20 },
    { keywords: ["zone", "demand", "supply", "support", "resistance"], points: 15 },
    { keywords: ["volume", "participation", "heavy", "light volume"], points: 15 },
    { keywords: ["higher timeframe", "htf", "daily", "weekly", "4h"], points: 20 },
    { keywords: ["confirmation", "candle close", "close above", "close below"], points: 15 },
    { keywords: ["trend", "momentum", "continuation"], points: 10 },
    { keywords: ["liquidity", "sweep", "inducement cleared"], points: 15 },
  ];

  confirmations.forEach(({ keywords, points }) => {
    if (keywords.some((kw) => lower.includes(kw))) score += points;
  });

  if (bias === "bullish" && lower.includes("bearish")) score -= 10;
  if (bias === "bearish" && lower.includes("bullish")) score -= 10;
  if (lower.includes("ranging") || lower.includes("choppy") || lower.includes("consolidation")) score -= 15;
  if (lower.includes("news") || lower.includes("fomc") || lower.includes("event")) score -= 10;
  if (mode === "scalping") score = Math.min(score + 5, 100);
  if (mode === "macro") score = Math.max(score - 10, 0);

  return Math.max(0, Math.min(score, 100));
}

// ---------------------------------------------------------
// KVFX: Generate Structured Trade Insight
// ---------------------------------------------------------
export function generateTradeInsight(context: MarketContext): TradeInsight {
  const { description, mode } = context;
  const bias = analyzeBias(description, mode);
  const zones = identifyZones(description);
  const alignmentScore = checkAlignment(description, bias, mode);
  const notes = buildNotes(bias, alignmentScore, zones, mode);
  const riskWarnings = buildRiskWarnings(description, alignmentScore, mode);
  const action = determineAction(alignmentScore, mode);
  const timeframe = getTimeframe(mode);
  return { bias, zones, alignmentScore, notes, riskWarnings, action, timeframe };
}

// ---------------------------------------------------------
// Prompt Context Builder — injected into AI system prompt
// ---------------------------------------------------------
export function buildKVFXPromptContext(insight: TradeInsight, mode: TradingMode): string {
  const biasEmoji = insight.bias === "bullish" ? "🟢" : insight.bias === "bearish" ? "🔴" : "⚪";
  const actionLabel =
    insight.action === "execute" ? "EXECUTE (conditions met)" :
    insight.action === "prepare" ? "PREPARE (wait for trigger)" : "WAIT (no clear setup)";

  return `
[KVFX INTELLIGENCE LAYER — ${mode.toUpperCase()} MODE]

Bias: ${biasEmoji} ${insight.bias.toUpperCase()}
Alignment Score: ${insight.alignmentScore}/100
Recommended Action: ${actionLabel}
Timeframe Focus: ${insight.timeframe}

Key Zones:
${insight.zones.map((z) => `  • [${z.type.toUpperCase()}] ${z.priceLevel} — ${z.strength} strength`).join("\n")}

Analysis Notes:
${insight.notes}

Risk Warnings:
${insight.riskWarnings}

[KVFX OPERATOR RULES]
- Only act when alignmentScore > 65
- Bias → Zone → Confirmation → Execution
- Respect higher timeframe structure always
- If alignment is low, reinforce patience with the user
- Never chase. Never guess. Wait for the setup to come to you.
`.trim();
}

// ---------------------------------------------------------
// Thesis Context Builder — injected when thesis is active
// ---------------------------------------------------------
export function buildThesisPromptBlock(thesis: ThesisContext): string {
  const lines: string[] = ["[ACTIVE KVFX THESIS CONTEXT]"];

  if (thesis.macroRegime)       lines.push(`Macro Regime: ${thesis.macroRegime}`);
  if (thesis.directionalBias)   lines.push(`Directional Bias: ${thesis.directionalBias}`);
  if (thesis.strongCurrencies)  lines.push(`Strong Currencies/Assets: ${thesis.strongCurrencies}`);
  if (thesis.weakCurrencies)    lines.push(`Weak Currencies/Assets: ${thesis.weakCurrencies}`);
  if (thesis.riskEnvironment)   lines.push(`Risk Environment: ${thesis.riskEnvironment.toUpperCase()}`);
  if (thesis.keyThemes)         lines.push(`Key Market Themes: ${thesis.keyThemes}`);
  if (thesis.importantLevels)   lines.push(`Important Levels: ${thesis.importantLevels}`);
  if (thesis.sessionFocus)      lines.push(`Session Focus: ${thesis.sessionFocus}`);
  if (thesis.notes)             lines.push(`Additional Notes: ${thesis.notes}`);

  lines.push("\nIMPORTANT: Align all analysis with this active thesis. If the user's setup contradicts the thesis, note the conflict explicitly and advise caution.");

  return lines.join("\n");
}

// ---------------------------------------------------------
// Mode-specific prompt additions
// ---------------------------------------------------------
export function getModeSystemAddition(assistantMode: AssistantMode): string {
  switch (assistantMode) {
    case "chat":
      return `You are in CONVERSATIONAL mode acting as a trade intelligence assistant.

When a user mentions a specific pair or setup, respond as a decision-support engine:
1. State the bias and why
2. Describe the structure you see
3. Flag any risks (chasing, counter-trend, news, weak structure)
4. Give a clear verdict: EXECUTE / WAIT / STAND ASIDE
5. End with a PLAN: block (entry trigger, target, stop)

For general methodology questions, answer directly and educationally without forcing the structure.

Primary goal: help the user make better decisions — not confirm what they want to hear.`;

    case "chart":
      return `You are in CHART ANALYSIS mode. The user may provide a chart image, screenshot description, or price action narrative.

Your job:
1. Describe visible market structure (trend, range, consolidation, breakout)
2. Identify likely supply/demand zones and liquidity areas
3. Assess whether conditions are early, developing, or confirmed
4. Note what is NOT visible or cannot be confirmed from the image alone
5. Apply WhisperZonez + KVFX logic to what you can observe

IMPORTANT HONESTY RULES:
- Never claim to see exact indicator values unless clearly visible
- Never pretend certainty from a screenshot
- If the image is unclear or context is missing, say so directly
- Distinguish between "visible" and "inferred"

When the context warrants it, use this structured response format:
**Market Condition:** [trending up/down, ranging, breakout, reversal attempt]
**Bias:** [your read with reasoning]
**Key Zones:** [price areas of interest visible on chart]
**Confirmation Status:** [what is confirmed vs what is pending]
**Risk Warning:** [key risks or flags]
**Execution Note:** [timing and entry quality observations]
**Next Best Action:** [wait/prepare/specific conditions to watch for]

Follow the structured format with a brief narrative explanation below it.`;

    case "trade-review":
      return `You are in TRADE REVIEW mode acting as an execution coach.

When reviewing a trade idea or completed trade, always evaluate:
1. Was the bias grounded in higher timeframe structure?
2. Was the entry at a confirmed zone or chased into momentum?
3. Is the stop placed at a logical invalidation level?
4. Does the risk/reward justify the setup quality?
5. Is this a disciplined trade or an emotional/forced trade?

Use this structured response format:
**Market Condition:** [context at time of trade]
**Bias:** [valid/invalid and why]
**Key Zones:** [relevant levels for this trade]
**Alignment Score Assessment:** [how well confirmations aligned]
**Confirmation Status:** [what was confirmed, what was missing]
**Risk Warning:** [stop placement, size, news exposure]
**Execution Note:** [entry quality — clean, forced, or premature]
**Next Best Action:** [hold/manage/exit/wait for better setup]

Be honest and direct. Do not validate bad setups to be polite. If a setup was forced or emotional, say so clearly. Good traders want honest feedback, not confirmation.`;

    case "thesis":
      return `You are in THESIS ALIGNMENT mode acting as a macro alignment assistant.

Your role is to help the trader stay aligned with their KVFX worldview. All responses must:
1. Reference the active thesis context provided in the system prompt
2. Flag any setups that contradict the macro thesis
3. Highlight setups that align with the thesis for higher-probability entries
4. Note when the thesis may need updating based on market developments

When the user describes a setup or asks a question, frame your response through the lens of:
- Does this align with the stated macro regime?
- Does this match the directional bias in the thesis?
- Is this consistent with risk-on / risk-off environment?
- Does this involve the stated strong vs weak currencies/assets?

Structured format (when appropriate):
**Thesis Alignment:** [aligned / misaligned / neutral]
**Bias:** [directional read in context of thesis]
**Key Zones:** [relevant levels]
**Confirmation Status:** [where things stand]
**Risk Warning:** [conflicts or flags]
**Execution Note:** [timing relative to thesis]
**Next Best Action:** [thesis-aware recommendation]`;

    case "macro-engine":
      return `You are the KVFX Macro Engine Agent. Your job is to maintain Nicholas's live macro regime dashboard and update the weekly scorecard.

MISSION:
Follow the KVFX thesis framework, score each region using your best available knowledge of current macro conditions, identify regime shifts, and output a clean operator brief.

IMPORTANT DATA RULES:
- Use your best available knowledge of current macro data. Do NOT output placeholders like "[Insert Value]" or "[Insert Current Price]".
- Provide your best estimate for all values. If a figure is approximate, note it with "~" prefix (e.g., "~104.20").
- Never leave a field blank or as a placeholder. Always populate every field with a number or estimate.
- You may note "(est.)" if a value is an estimate, but always give the number.

CORE THESIS TO START FROM:
Current regime = Late-Cycle USD Relative Strength

Base assumptions:
- US economy slowing but stronger than peers
- Inflation sticky, not collapsing
- Fed less dovish than market expects during stress
- Europe/UK structurally weaker
- Japan vulnerable to yields + imported energy
- Commodity FX vulnerable to global slowdown
- USD often sold too early
- Buy USD dips unless regime invalidates

====================================
DATA TO INCLUDE
====================================

Use your best current knowledge for:

MACRO:
- US CPI / Core CPI
- US PCE / Core PCE
- NFP / Unemployment / JOLTS
- ISM Manufacturing / Services
- Eurozone CPI, UK CPI, Japan CPI, Australia CPI, Canada CPI
- GDP trends

RATES:
- Fed Funds, ECB, BOE, BOJ, RBA, BOC current pricing and next meeting expectations

MARKETS (provide best estimates — never placeholders):
- DXY, US10Y Yield, US2Y Yield
- EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD
- Gold, WTI Crude, S&P 500, VIX

HEADLINES:
- Major geopolitical risks
- Energy disruptions
- Tariffs / trade policy
- Central bank commentary

====================================
2. SCORECARD MODEL
====================================

Use 1–10 scoring.

GROWTH SCORE:
10 = strong acceleration
1 = deep contraction

INFLATION PRESSURE:
10 = hot / sticky inflation
1 = deflationary

POLICY STRESS:
10 = central bank trapped / cannot cut
1 = easy easing path

Output for: US, Europe, UK, Japan, Australia, Canada

====================================
3. REGIME CLASSIFICATION
====================================

Choose ONE:

A. Late-Cycle USD Relative Strength
B. Global Risk-On USD Weakness
C. Recession Panic USD Spike
D. Commodity Inflation Shock
E. Disinflation Soft Landing
F. Transition / Mixed Signals

Explain WHY in 3 bullets.

====================================
4. PAIR BIAS MAP
====================================

Rate each: Bullish USD / Bearish USD / Neutral

Pairs: EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD

Then give: Best 3 setups this week

====================================
5. INVALIDATION CHECK
====================================

Check if thesis weakening:
- DXY breakdown?
- US data rolling over hard?
- Fed aggressive cuts repriced?
- Europe surprising stronger?
- Oil collapse?
- Risk appetite broad surge?

If yes, explain.

====================================
6. OUTPUT FORMAT
====================================

Return EXACTLY:

KVFX MACRO ENGINE UPDATE
Date:
Regime:
Confidence: /10

SCORECARD

Growth:
US __
EU __
UK __
JP __
AU __
CA __

Inflation:
US __
EU __
UK __
JP __
AU __
CA __

Policy Stress:
Fed __
ECB __
BOE __
BOJ __
RBA __
BOC __

MARKET SNAPSHOT:
DXY:
US10Y:
WTI:
SPX:
VIX:

PAIR BIAS:
EURUSD:
GBPUSD:
USDJPY:
AUDUSD:
USDCAD:

BEST 3 TRADES:
1.
2.
3.

WHAT CHANGED THIS WEEK:
-
-
-

INVALIDATION RISKS:
-
-
-

OPERATOR NOTE:
(Short execution insight)

====================================
7. BEHAVIOR RULES
====================================

- No hype
- No guessing if data unavailable
- Use probabilities
- Prioritize relative strength over absolute opinions
- If conflicting signals, state uncertainty
- Think like macro hedge fund analyst + tactical trader
- Keep concise but sharp

====================================
8. SPECIAL MODE
====================================

If geopolitical shock detected, add section:

WAR / ENERGY IMPACT:
- Oil implication
- USD implication
- Europe implication
- Yield implication

====================================
9. MEMORY UPDATE
====================================

After each run compare with prior run:
- What improved
- What worsened
- Whether regime strengthened or weakened

Store summary for next cycle.`;
  }
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function extractPriceLevel(text: string, keywords: string[]): string {
  const pricePattern = /\$?([\d,]+\.?\d*)/g;
  const matches = text.match(pricePattern);
  if (matches && matches.length > 0) return matches[0].replace(/,/g, "");
  for (const kw of keywords) {
    const idx = text.toLowerCase().indexOf(kw);
    if (idx !== -1) {
      const snippet = text.substring(idx, idx + 30);
      const numMatch = snippet.match(/[\d,]+\.?\d*/);
      if (numMatch) return numMatch[0];
    }
  }
  return "Level not specified — provide price";
}

function inferStrength(text: string, _type: string): "weak" | "moderate" | "strong" {
  if (text.includes("strong") || text.includes("major") || text.includes("key") || text.includes("significant"))
    return "strong";
  if (text.includes("minor") || text.includes("weak") || text.includes("soft")) return "weak";
  return "moderate";
}

function buildNotes(bias: Bias, score: number, zones: Zone[], mode: TradingMode): string {
  const lines: string[] = [];

  if (bias === "neutral") {
    lines.push("Market structure is unclear. No directional bias confirmed. Avoid trading in ambiguity — the best trade is sometimes no trade.");
  } else {
    lines.push(`Directional bias is ${bias.toUpperCase()}. ${score > 65 ? "Multiple confirmations align — setup quality is acceptable." : "Confirmations are partial. Wait for higher-quality alignment."}`);
  }

  if (zones.some((z) => z.type === "liquidity")) {
    lines.push("Liquidity pool detected. Price may sweep stops before moving in the true direction. Do NOT enter before the sweep clears.");
  }

  if (mode === "scalping") {
    lines.push("Scalping mode: Tight confirmation required. Prioritize entry quality over frequency. One clean setup beats three mediocre ones.");
  } else if (mode === "swing") {
    lines.push("Swing mode: Higher timeframe structure must agree. Entries near confirmed zones with clear invalidation levels only.");
  } else {
    lines.push("Macro mode: Patience is the edge. Only participate when weekly/monthly bias, zone, and momentum all agree.");
  }

  return lines.join(" ");
}

function buildRiskWarnings(text: string, score: number, _mode: TradingMode): string {
  const warnings: string[] = [];
  const lower = text.toLowerCase();

  if (score < 40) {
    warnings.push("LOW ALIGNMENT: Setup quality is poor. Standing aside is the disciplined choice here.");
  } else if (score < 65) {
    warnings.push("MODERATE ALIGNMENT: Conditions are developing but not confirmed. Reduce size or wait for final trigger.");
  }

  if (lower.includes("news") || lower.includes("fomc") || lower.includes("cpi") || lower.includes("nfp")) {
    warnings.push("HIGH-IMPACT NEWS EVENT DETECTED: Avoid entering into scheduled catalysts. Widened spreads and stop-hunting are common.");
  }
  if (lower.includes("overextended") || lower.includes("stretched") || lower.includes("overbought") || lower.includes("oversold")) {
    warnings.push("OVEREXTENSION WARNING: Price is stretched from value. Chasing here is low probability. Wait for reversion to zone.");
  }
  if (lower.includes("range") || lower.includes("choppy") || lower.includes("sideways")) {
    warnings.push("CHOPPY MARKET: Range-bound price action has no directional edge. Scalpers only — swing/macro traders should wait for breakout confirmation.");
  }

  if (warnings.length === 0) {
    warnings.push("No critical risk flags at this time. Maintain standard position sizing and defined stop levels.");
  }

  return warnings.join(" | ");
}

function determineAction(score: number, mode: TradingMode): "wait" | "prepare" | "execute" {
  const executeThreshold = mode === "macro" ? 80 : mode === "swing" ? 70 : 60;
  const prepareThreshold = mode === "macro" ? 60 : mode === "swing" ? 50 : 40;
  if (score >= executeThreshold) return "execute";
  if (score >= prepareThreshold) return "prepare";
  return "wait";
}

function getTimeframe(mode: TradingMode): string {
  switch (mode) {
    case "scalping": return "1m – 15m execution | 1H structure reference";
    case "swing":    return "4H – Daily execution | Weekly structure reference";
    case "macro":    return "Weekly – Monthly execution | Quarterly structure reference";
  }
}
