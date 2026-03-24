/**
 * KVFX Price Engine
 *
 * Detects price from user messages and computes entry/stop/target levels
 * relative to the provided price and directional bias.
 *
 * Stop  = price ± (price × 0.0015)   → ~0.15% distance
 * TP1   = price ± (price × 0.003)    → ~0.30% distance  (2R)
 * TP2   = price ± (price × 0.005)    → ~0.50% distance  (3.3R)
 */

// ── Instrument Decimal Configuration ─────────────────────────────────────────

const JPY_PAIRS = new Set([
  "USDJPY", "GBPJPY", "EURJPY", "AUDJPY", "CADJPY", "CHFJPY", "NZDJPY",
]);
const INDEX_INSTRUMENTS = new Set([
  "NASDAQ", "NAS100", "SPX", "SP500", "US500", "US30", "DOW",
]);
const METAL_INSTRUMENTS = new Set(["GOLD", "XAUUSD", "SILVER", "XAGUSD"]);
const CRYPTO_INSTRUMENTS = new Set(["BTCUSD", "BTC", "ETHUSD", "ETH"]);
const DXY_INSTRUMENTS = new Set(["DXY"]);

/** Number of decimal places to display for a given instrument. */
export function getDecimalPlaces(pair: string): number {
  if (JPY_PAIRS.has(pair))        return 3;
  if (INDEX_INSTRUMENTS.has(pair)) return 1;
  if (METAL_INSTRUMENTS.has(pair)) return 2;
  if (CRYPTO_INSTRUMENTS.has(pair)) return 2;
  if (DXY_INSTRUMENTS.has(pair))  return 3;
  return 5; // Standard FX (EURUSD, GBPUSD, etc.)
}

/** Format a price to the correct number of decimal places for the instrument. */
export function formatPrice(price: number, pair: string): string {
  return price.toFixed(getDecimalPlaces(pair));
}

// ── Plausible Price Range Per Instrument ──────────────────────────────────────

const PRICE_RANGES: Record<string, [number, number]> = {
  EURUSD:  [0.80, 1.60],
  GBPUSD:  [1.00, 2.20],
  USDJPY:  [80,   180 ],
  AUDUSD:  [0.50, 1.10],
  USDCAD:  [1.00, 1.70],
  USDCHF:  [0.70, 1.30],
  NZDUSD:  [0.40, 0.95],
  GBPJPY:  [120,  230 ],
  EURJPY:  [100,  200 ],
  AUDJPY:  [60,   130 ],
  EURAUD:  [1.30, 2.10],
  EURGBP:  [0.70, 1.20],
  CADJPY:  [80,   130 ],
  CHFJPY:  [100,  190 ],
  GOLD:    [1500, 3500 ],
  XAUUSD:  [1500, 3500 ],
  SILVER:  [10,   60   ],
  XAGUSD:  [10,   60   ],
  NASDAQ:  [8000, 25000],
  NAS100:  [8000, 25000],
  SPX:     [3000, 7000 ],
  SP500:   [3000, 7000 ],
  US500:   [3000, 7000 ],
  US30:    [25000,50000],
  DOW:     [25000,50000],
  DXY:     [85,   115  ],
  BTCUSD:  [5000, 200000],
  BTC:     [5000, 200000],
  ETHUSD:  [500,  15000 ],
  ETH:     [500,  15000 ],
  OIL:     [30,   200  ],
  WTI:     [30,   200  ],
  USOIL:   [30,   200  ],
};

/** Return true if the number is in a plausible price range for this instrument. */
function isPlausiblePrice(value: number, pair: string): boolean {
  const range = PRICE_RANGES[pair];
  if (!range) return value > 0 && value < 200000;
  return value >= range[0] && value <= range[1];
}

// ── Price Detection ───────────────────────────────────────────────────────────

/**
 * Extract a price number from user text, validating it against the
 * instrument's known range to avoid false matches with RR ratios etc.
 *
 * Supports patterns like:
 *   "EURUSD 1.0840 bearish"
 *   "NASDAQ at 19240 rejecting"
 *   "Gold is 2340.50"
 *   "1.2750 GBPUSD long"
 */
export function detectPrice(text: string, pair: string | null): number | null {
  if (!pair) return null;

  // Broad numeric pattern: integers or decimals, commas allowed as thousands sep
  // Examples: 1.0840, 19240, 19,240, 2340.50
  const NUM = /(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d{4,})/g;

  // Remove commas for parsing
  const normalised = text.replace(/(\d),(\d)/g, "$1$2");

  const candidates: number[] = [];
  let m: RegExpExecArray | null;
  const rx = new RegExp(NUM.source, "g");
  while ((m = rx.exec(normalised)) !== null) {
    const n = parseFloat(m[0]);
    if (!isNaN(n) && isPlausiblePrice(n, pair)) {
      candidates.push(n);
    }
  }

  // Return the candidate closest to the pair token in the original text
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Prefer the number that appears nearest to the pair name in the text
  const upperText = normalised.toUpperCase();
  const pairIdx = upperText.indexOf(pair);
  if (pairIdx === -1) return candidates[0];

  // Find positions of each candidate in the text
  let bestVal = candidates[0];
  let bestDist = Infinity;
  for (const val of candidates) {
    const str = String(val);
    const idx = normalised.indexOf(str, 0);
    if (idx !== -1) {
      const dist = Math.abs(idx - pairIdx);
      if (dist < bestDist) { bestDist = dist; bestVal = val; }
    }
  }
  return bestVal;
}

// ── Level Calculation ─────────────────────────────────────────────────────────

export interface PriceLevels {
  price:      number;
  entry:      number;
  stop:       number;
  tp1:        number;
  tp2:        number;
  rr1:        number;
  rr2:        number;
  direction:  "bullish" | "bearish";
  pair:       string;
  formatted: {
    entry: string;
    stop:  string;
    tp1:   string;
    tp2:   string;
  };
}

const STOP_PCT   = 0.0015; // 0.15 %
const TP1_PCT    = 0.0030; // 0.30 %  → RR 2.0
const TP2_PCT    = 0.0050; // 0.50 %  → RR 3.33

/**
 * Calculate entry, stop, and target levels relative to price.
 * Direction drives which side stop and targets sit on.
 */
export function calculateLevels(
  price: number,
  bias: string,
  pair: string
): PriceLevels {
  const dir: "bullish" | "bearish" =
    bias.toLowerCase() === "bullish" ? "bullish" : "bearish";

  const stopDist = price * STOP_PCT;
  const tp1Dist  = price * TP1_PCT;
  const tp2Dist  = price * TP2_PCT;

  const entry = price;
  const stop  = dir === "bullish" ? price - stopDist : price + stopDist;
  const tp1   = dir === "bullish" ? price + tp1Dist  : price - tp1Dist;
  const tp2   = dir === "bullish" ? price + tp2Dist  : price - tp2Dist;

  const rr1 = parseFloat((tp1Dist / stopDist).toFixed(2));
  const rr2 = parseFloat((tp2Dist / stopDist).toFixed(2));

  const fmt = (n: number) => formatPrice(n, pair);

  return {
    price,
    entry,
    stop,
    tp1,
    tp2,
    rr1,
    rr2,
    direction: dir,
    pair,
    formatted: {
      entry: fmt(entry),
      stop:  fmt(stop),
      tp1:   fmt(tp1),
      tp2:   fmt(tp2),
    },
  };
}
