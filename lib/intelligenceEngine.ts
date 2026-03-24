/**
 * KVFX Intelligence Engine — Decision Support Core
 * Transforms raw AI analysis into structured trade intelligence cards.
 *
 * Output: pair, bias, structure, plan, risks, confidence, decision
 */

import type { TradeInsight } from "./tradingLogic";
import {
  detectPrice,
  calculateLevels,
  type PriceLevels,
} from "./priceEngine";

export type { PriceLevels };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConfidenceFactors {
  structure:  number;   // 0 – 3
  liquidity:  number;   // 0 – 2
  bias:       number;   // 0 – 2
  session:    number;   // 0 – 1
  price:      number;   // 0 – 1 (bonus when price provided)
  penalties:  number;   // negative
  total:      number;   // clamped 0 – 10
}

export interface IntelligenceCard {
  pair: string | null;
  bias: string;                          // Bullish | Bearish | Neutral | Mixed
  structure: string;                     // BOS | CHoCH | Rejection | Sweep | etc.
  plan: string[];                        // Step-by-step trade plan bullets
  risks: string[];                       // Risk warning strings
  confidence: number;                    // 0 – 10 (one decimal)
  confidenceFactors: ConfidenceFactors;
  session: string | null;
  timeframe: string | null;
  decision: "yes" | "wait" | "no";
  decisionReason: string;
  multiTfConflict: boolean;
  alignmentScore: number;                // pass-through from TradeInsight
  priceLevels: PriceLevels | null;       // null when no price available
  needsPrice: boolean;                   // true when pair detected but no price from any source
  priceSource: "user" | "live" | null;  // where the price came from
}

// ── Structure Detection ───────────────────────────────────────────────────────

const STRUCTURE_PATTERNS: [string, RegExp][] = [
  ["BOS",              /\b(bos|break of structure|structure break|broke structure|breaking structure)\b/i],
  ["CHoCH",            /\b(choch|choc|change of character|character change|coc)\b/i],
  ["Supply Rejection", /\b(rejecting supply|supply rejection|rejected at supply|supply zone hold)\b/i],
  ["Demand Hold",      /\b(demand hold|holding demand|demand zone hold|holding at demand)\b/i],
  ["Liquidity Sweep",  /\b(liquidity sweep|swept liquidity|stop sweep|stop hunt|inducement cleared)\b/i],
  ["Rejection",        /\b(rejection|rejected|wick rejection|pin bar|shooting star|hammer|doji)\b/i],
  ["Sweep",            /\b(sweep|swept|price swept|swept the)\b/i],
  ["Higher High",      /\b(higher high|higher highs|hh formation)\b/i],
  ["Lower High",       /\b(lower high|lower highs|lh formed|lh forming)\b/i],
  ["Range",            /\b(ranging|range bound|consolidating|in a range|sideways|coiling)\b/i],
  ["Breakout",         /\b(breakout|breaking out|broke above|broke below|clean break)\b/i],
  ["FVG Fill",         /\b(fvg|fair value gap|imbalance fill|filling the gap)\b/i],
  ["OB Reaction",      /\b(order block reaction|ob reaction|reacting to ob|at the ob)\b/i],
];

export function detectStructure(text: string): string {
  for (const [label, pattern] of STRUCTURE_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return "No clear structure";
}

// ── Risk Detection ────────────────────────────────────────────────────────────

const RISK_PATTERNS: [string, RegExp][] = [
  ["⚠ Chasing entry",          /\b(chasing|chase|chased|chasing price)\b/i],
  ["⚠ Counter-trend setup",    /\b(counter.?trend|against the trend|fighting trend)\b/i],
  ["⚠ No structure confirm",   /\b(no structure|no confirm|unconfirmed|no clear structure)\b/i],
  ["⚠ Range middle entry",     /\b(range middle|mid.?range|middle of range|between levels)\b/i],
  ["⚠ High-impact news",       /\b(fomc|nfp|cpi|pmi|fed meeting|rate decision|high impact news)\b/i],
  ["⚠ Overextended move",      /\b(overextended|over extended|stretched|parabolic|extended run)\b/i],
  ["⚠ Late entry signal",      /\b(late entry|already moved|missed the move|already ran)\b/i],
  ["⚠ Post-breakout chase",    /\b(just broke|already broke|post.?break|after the break)\b/i],
  ["⚠ Weak / messy structure", /\b(weak structure|messy|choppy|unclear|no clear bias)\b/i],
  ["⚠ Liquidity above",        /\b(liquidity above|stops above|equal highs above)\b/i],
  ["⚠ Liquidity below",        /\b(liquidity below|stops below|equal lows below)\b/i],
];

export function detectRisks(text: string): string[] {
  return RISK_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
}

// ── Multi-Timeframe Conflict ──────────────────────────────────────────────────

export function detectMultiTfConflict(text: string): boolean {
  const lower = text.toLowerCase();

  // Look for conflicting bias across timeframes
  // Pattern: "Xm/Xh bullish ... Ym/Yh bearish" (or reversed)
  const hasBullishLTF = /\b(m5|5m|m15|15m|1m|m1)\b.{0,60}\b(bull|long|buy)\b/i.test(lower) ||
                        /\b(bull|long|buy)\b.{0,60}\b(m5|5m|m15|15m)\b/i.test(lower);
  const hasBearishHTF = /\b(h1|1h|h4|4h|daily|d1)\b.{0,60}\b(bear|short|sell)\b/i.test(lower) ||
                        /\b(bear|short|sell)\b.{0,60}\b(h1|1h|h4|4h|daily)\b/i.test(lower);

  const hasBearishLTF = /\b(m5|5m|m15|15m|1m|m1)\b.{0,60}\b(bear|short|sell)\b/i.test(lower) ||
                        /\b(bear|short|sell)\b.{0,60}\b(m5|5m|m15|15m)\b/i.test(lower);
  const hasBullishHTF = /\b(h1|1h|h4|4h|daily|d1)\b.{0,60}\b(bull|long|buy)\b/i.test(lower) ||
                        /\b(bull|long|buy)\b.{0,60}\b(h1|1h|h4|4h|daily)\b/i.test(lower);

  return (hasBullishLTF && hasBearishHTF) || (hasBearishLTF && hasBullishHTF);
}

// ── Confidence Scoring (0 – 10) ───────────────────────────────────────────────
//
// Factors:
//   Structure   0 – 3   (clear pattern detected)
//   Liquidity   0 – 2   (sweep / stop hunt / inducement)
//   Bias        0 – 2   (directional conviction + confirmation)
//   Session     0 – 1   (active trading session mentioned)
//   Price       0 – 1   (price provided → levels computable)
//   Penalties   negative (risk factors, TF conflict)

export function scoreConfidence(
  text: string,
  insight: TradeInsight | null | undefined,
  hasPrice = false
): { score: number; factors: ConfidenceFactors } {
  // ── Structure factor (0 – 3) ──────────────────────────────
  let structureScore = 0;
  const structure = detectStructure(text);
  if (structure !== "No clear structure") {
    structureScore =
      /\b(bos|choch|supply rejection|demand hold)\b/i.test(text) ? 3 :
      /\b(breakout|fvg fill|ob reaction|higher high|lower high)\b/i.test(text) ? 2 : 1.5;
  }
  if (/\b(confirmed|closed above|closed below|clean break)\b/i.test(text)) structureScore += 0.5;
  structureScore = Math.min(structureScore, 3);

  // ── Liquidity factor (0 – 2) ──────────────────────────────
  let liquidityScore = 0;
  if (/\b(liquidity sweep|stop hunt|stops hunted|swept liquidity|inducement cleared)\b/i.test(text)) {
    liquidityScore = 2;
  } else if (/\b(sweep|swept|liquidity|stop cluster|equal high|equal low)\b/i.test(text)) {
    liquidityScore = 1;
  }

  // ── Bias factor (0 – 2) ───────────────────────────────────
  let biasScore = 0;
  if (insight && insight.alignmentScore > 0) {
    biasScore = (insight.alignmentScore / 100) * 2;
  } else if (/\b(bullish|bearish)\b/i.test(text)) {
    biasScore = 1;
    if (/\b(htf|higher timeframe|4h|h4|daily|weekly)\b/i.test(text)) biasScore += 0.5;
    if (/\b(confirmed|aligns|agrees|aligned)\b/i.test(text)) biasScore += 0.5;
  }
  biasScore = Math.min(biasScore, 2);

  // ── Session factor (0 – 1) ────────────────────────────────
  const sessionScore =
    /\b(london|new york|ny session|asian session|tokyo|london open|new york open)\b/i.test(text)
      ? 1
      : 0;

  // ── Price factor (0 – 1) ──────────────────────────────────
  const priceScore = hasPrice ? 1 : 0;

  // ── Penalties ─────────────────────────────────────────────
  const risks = detectRisks(text);
  const riskPenalty = -(Math.min(risks.length * 0.6, 2.5));
  const tfPenalty   = detectMultiTfConflict(text) ? -1.5 : 0;
  const penalties   = parseFloat((riskPenalty + tfPenalty).toFixed(1));

  const raw = structureScore + liquidityScore + biasScore + sessionScore + priceScore + penalties;
  const total = parseFloat(Math.max(0, Math.min(10, raw)).toFixed(1));

  return {
    score: total,
    factors: {
      structure:  parseFloat(structureScore.toFixed(1)),
      liquidity:  parseFloat(liquidityScore.toFixed(1)),
      bias:       parseFloat(biasScore.toFixed(1)),
      session:    sessionScore,
      price:      priceScore,
      penalties,
      total,
    },
  };
}

// ── Plan Extraction ───────────────────────────────────────────────────────────

export function extractPlan(aiContent: string): string[] {
  // 1. Try to find an explicit PLAN: block
  const planBlockMatch = aiContent.match(
    /(?:PLAN|EXECUTION PLAN|TRADE PLAN|NEXT STEPS?|ACTION PLAN)[:\s\n]+([^]*?)(?:\n\n\*\*|\n\*\*[A-Z]|$)/i
  );
  if (planBlockMatch) {
    const bullets = planBlockMatch[1]
      .split("\n")
      .map((l) => l.replace(/^[-•→*▶\d.)\s]+/, "").trim())
      .filter((l) => l.length >= 8 && l.length <= 140);
    if (bullets.length >= 2) return bullets.slice(0, 5);
  }

  // 2. Try **Next Best Action:** header
  const nextActionMatch = aiContent.match(
    /\*\*Next Best Action[:\s]+\*\*\s*(.+?)(?:\n\n|\n\*\*|$)/i
  );
  if (nextActionMatch) {
    const text = nextActionMatch[1].trim();
    if (text.length > 10) return [text];
  }

  // 3. Extract action-oriented sentences from the AI response
  const actionPhrases = aiContent
    .split(/(?<=[.!])\s+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length >= 15 &&
        s.length <= 130 &&
        /\b(wait|short|long|enter|target|stop|watch|look for|hold|pull back|retrace|monitor)\b/i.test(s) &&
        !/\b(I |you must|you should|remember|always|never)\b/i.test(s)
    );

  if (actionPhrases.length >= 1) return actionPhrases.slice(0, 4);

  return ["Wait for confirmation before committing to entry"];
}

// ── Decision Verdict ──────────────────────────────────────────────────────────

export function buildDecision(
  confidence: number,
  risks: string[],
  bias: string,
  multiTfConflict: boolean
): { decision: "yes" | "wait" | "no"; reason: string } {
  const isNeutral = bias === "Neutral" || bias === "Mixed";
  const criticalRisks = risks.filter((r) =>
    r.includes("Chasing") || r.includes("Counter-trend")
  );

  // Hard NO conditions
  if (criticalRisks.length > 0) {
    return {
      decision: "no",
      reason: criticalRisks[0].replace("⚠ ", ""),
    };
  }
  if (risks.length >= 3) {
    return {
      decision: "no",
      reason: `${risks.length} risk factors — stand aside`,
    };
  }
  if (multiTfConflict) {
    return {
      decision: "wait",
      reason: "Timeframe conflict detected — wait for alignment",
    };
  }

  // YES conditions
  if (confidence >= 7.5 && !isNeutral && risks.length === 0) {
    return {
      decision: "yes",
      reason: "Strong confluence — conditions met for execution",
    };
  }
  if (confidence >= 6.5 && !isNeutral && risks.length <= 1) {
    return {
      decision: "yes",
      reason: "Good confluence — trigger confirmation only remaining",
    };
  }

  // WAIT conditions
  if (confidence >= 4 && !isNeutral) {
    return {
      decision: "wait",
      reason:
        confidence >= 5.5
          ? "Setup developing — await final confirmation trigger"
          : "Conditions partial — monitor for higher-quality entry",
    };
  }
  if (confidence >= 3) {
    return {
      decision: "wait",
      reason: "Early setup stage — no execution yet",
    };
  }

  // NO
  return {
    decision: "no",
    reason: isNeutral
      ? "No directional bias — no edge present"
      : "Insufficient confluence for execution",
  };
}

// ── Master Builder ────────────────────────────────────────────────────────────

export function buildIntelligenceCard(
  userMessage: string,
  aiContent: string,
  insight: TradeInsight | null | undefined,
  pair: string | null,
  session: string | null,
  timeframe: string | null,
  livePrice?: number | null
): IntelligenceCard | null {
  const combined = `${userMessage} ${aiContent}`;

  // Only produce a card when meaningful trading content is present
  const hasSignal =
    !!pair ||
    /\b(bullish|bearish|long|short|bos|choch|rejection|sweep|supply|demand|structure|liquidity)\b/i.test(
      combined
    );

  if (!hasSignal) return null;

  // ── Price resolution (user-typed > live API > none) ───────
  const userPrice    = detectPrice(userMessage, pair);
  const resolvedPrice: number | null = userPrice ?? livePrice ?? null;
  const priceSource: "user" | "live" | null =
    userPrice !== null ? "user" :
    livePrice != null  ? "live" :
    null;

  const hasPairSignal = !!pair;

  let bias = "Neutral";
  if (insight?.bias) {
    bias = insight.bias.charAt(0).toUpperCase() + insight.bias.slice(1);
  }

  const structure = detectStructure(combined);
  const risks = detectRisks(combined);
  const multiTfConflict = detectMultiTfConflict(combined);

  if (multiTfConflict) bias = "Mixed";

  const { score: confidence, factors: confidenceFactors } = scoreConfidence(
    combined,
    insight,
    resolvedPrice !== null
  );

  const plan = extractPlan(aiContent);

  // Compute price levels when price + directional bias available
  const priceLevels: PriceLevels | null =
    resolvedPrice !== null && pair && bias !== "Neutral" && bias !== "Mixed"
      ? calculateLevels(resolvedPrice, bias, pair)
      : null;

  // needsPrice = pair known but no price from any source
  const needsPrice = hasPairSignal && resolvedPrice === null;

  const { decision, reason: decisionReason } = buildDecision(
    confidence,
    risks,
    bias,
    multiTfConflict
  );

  return {
    pair,
    bias,
    structure,
    plan,
    risks,
    confidence,
    confidenceFactors,
    session,
    timeframe,
    decision,
    decisionReason,
    multiTfConflict,
    alignmentScore: insight?.alignmentScore ?? 0,
    priceLevels,
    needsPrice,
    priceSource,
  };
}
