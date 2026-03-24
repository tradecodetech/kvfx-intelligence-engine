/**
 * KVFX Trade Parser
 * Smart extraction of trade signals from user messages and AI responses.
 */

import { detectPrice as _detectPrice } from "./priceEngine";

const KNOWN_PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
  "GBPJPY", "EURJPY", "AUDJPY", "EURAUD", "EURGBP", "CADJPY", "CHFJPY",
  "NASDAQ", "NAS100", "SPX", "SP500", "US500", "US30", "DOW",
  "DXY", "GOLD", "XAUUSD", "SILVER", "XAGUSD", "OIL", "WTI", "USOIL",
  "BTCUSD", "BTC", "ETHUSD", "ETH",
];

const SESSION_MAP: Record<string, string[]> = {
  London: ["london", "ldn", "european", "europe", "london open", "london session"],
  NY: ["ny", "new york", "nyfx", "us session", "new york session", "american session"],
  Asia: ["asia", "asian", "tokyo", "sydney", "asian session", "tokyo open"],
};

const SETUP_MAP: Record<string, string[]> = {
  BOS: ["bos", "break of structure", "structure break", "broke structure"],
  Sweep: ["sweep", "liquidity sweep", "stop hunt", "swept", "stop sweep"],
  Breakout: ["breakout", "break out", "break above", "break below", "breakout play"],
  FVG: ["fvg", "fair value gap", "imbalance", "gap fill"],
  OB: ["ob ", " ob", "order block", "orderblock", "demand ob", "supply ob"],
  Continuation: ["continuation", "pullback", "retest", "continuation trade"],
  Reversal: ["reversal", "reverse", "flip", "rejection", "wick reject"],
};

const TIMEFRAME_MAP: Record<string, string[]> = {
  M1:  ["m1", " 1m ", "1-min", "1 min", "1 minute"],
  M5:  ["m5", " 5m ", "5-min", "5 min", "5 minute"],
  M15: ["m15", "15m", "15-min", "15 min", "15 minute"],
  M30: ["m30", "30m", "30-min", "30 min", "30 minute"],
  H1:  ["h1", " 1h ", "1-hour", "1 hour", "1hr"],
  H4:  ["h4", " 4h ", "4-hour", "4 hour", "4hr"],
  D1:  ["d1", " 1d ", "daily", "day chart"],
  W1:  ["w1", " 1w ", "weekly", "week chart"],
};

export interface ParsedTrade {
  pair: string | null;
  bias: string | null;
  price: number | null;
  rr: number | null;
  setup_type: string | null;
  session: string | null;
  timeframe: string | null;
  notes: string;
  isSignal: boolean;
}

export interface TradeResultUpdate {
  pair: string;
  result: "Win" | "Loss";
}

export function detectPair(text: string): string | null {
  const upper = text.toUpperCase();
  for (const pair of KNOWN_PAIRS) {
    // Word-boundary check using surrounding chars
    const idx = upper.indexOf(pair);
    if (idx === -1) continue;
    const before = idx > 0 ? upper[idx - 1] : " ";
    const after = idx + pair.length < upper.length ? upper[idx + pair.length] : " ";
    if (!/[A-Z0-9]/.test(before) && !/[A-Z0-9]/.test(after)) return pair;
  }
  return null;
}

export function detectBias(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(bullish|long|buy|bull|upside|bid|going up)\b/.test(lower)) return "Bullish";
  if (/\b(bearish|short|sell|bear|downside|offer|going down)\b/.test(lower)) return "Bearish";
  return null;
}

export function detectRR(text: string): number | null {
  // Match patterns like "RR 2", "R:R 2.5", "2R", "2:1", "rr2"
  const patterns = [
    /\br[r:]?\s*([0-9]+(?:\.[0-9]+)?)/i,
    /([0-9]+(?:\.[0-9]+)?)\s*r\b/i,
    /([0-9]+(?:\.[0-9]+)?)\s*(?:to|:)\s*1\b/i,
    /reward[:\s]+([0-9]+(?:\.[0-9]+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0 && val <= 50) return val; // sanity check
    }
  }
  return null;
}

export function detectSession(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [session, keywords] of Object.entries(SESSION_MAP)) {
    if (keywords.some((k) => lower.includes(k))) return session;
  }
  return null;
}

export function detectSetupType(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [setup, keywords] of Object.entries(SETUP_MAP)) {
    if (keywords.some((k) => lower.includes(k))) return setup;
  }
  return null;
}

export function detectTimeframe(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [tf, keywords] of Object.entries(TIMEFRAME_MAP)) {
    if (keywords.some((k) => lower.includes(k))) return tf;
  }
  return null;
}

/**
 * Detects TP hit / stop out messages and returns a result update instruction.
 * Examples: "EURUSD TP hit" → Win | "EURUSD stopped" → Loss
 */
export function detectResultUpdate(text: string): TradeResultUpdate | null {
  const pair = detectPair(text);
  if (!pair) return null;

  if (
    /\b(tp hit|take profit hit|target hit|tp1|tp2|hit tp|in profit|closed profit|won|win)\b/i.test(
      text
    )
  ) {
    return { pair, result: "Win" };
  }

  if (
    /\b(stopped|stop loss hit|sl hit|stopped out|loss|got stopped|hit sl|stoploss hit)\b/i.test(
      text
    )
  ) {
    return { pair, result: "Loss" };
  }

  return null;
}

/**
 * Main parser: combines user message + AI response to extract a trade signal.
 */
export function parseTradeFromText(
  userMessage: string,
  aiContent: string
): ParsedTrade {
  const combined = `${userMessage} ${aiContent}`;

  const pair = detectPair(userMessage) || detectPair(aiContent);
  const bias = detectBias(userMessage) || detectBias(aiContent);
  const price: number | null = _detectPrice(userMessage, pair);
  const rr = detectRR(userMessage) || detectRR(aiContent);
  const setup_type = detectSetupType(combined);
  const session = detectSession(combined);
  const timeframe = detectTimeframe(combined);

  // A signal requires at minimum: a known pair + bias OR pair + RR
  const isSignal = !!(pair && bias) || !!(pair && rr);

  return {
    pair,
    bias,
    price,
    rr,
    setup_type,
    session,
    timeframe,
    notes: aiContent.slice(0, 500),
    isSignal,
  };
}
