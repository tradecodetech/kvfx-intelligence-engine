/**
 * KVFX Tier Configuration
 *
 * Controls pair access for beta vs full engine.
 * Beta = focused testing with EURUSD + NAS100.
 * Full engine = all markets (internal / upgraded users).
 *
 * DO NOT remove full engine pairs — restriction is applied at the route layer only.
 */

// ── Tier Mode ─────────────────────────────────────────────────────────────────

/**
 * Set to "beta" for soft launch. Change to "full" to unlock all markets.
 * Can be driven by env var for future per-user tier logic.
 */
export const ENGINE_TIER: "beta" | "full" =
  (process.env.ENGINE_TIER as "beta" | "full") ?? "beta";

// ── Beta Tier ─────────────────────────────────────────────────────────────────

/** Pairs available in the beta tier (NAS100 and NASDAQ are the same instrument). */
export const BETA_PAIRS = new Set(["EURUSD", "NAS100", "NASDAQ"]);

/** Ordered list used for scan prompts and UI display. */
export const BETA_SCAN_PAIRS = ["EURUSD", "NAS100"];

/** Display label shown in UI. */
export const TIER_LABEL = "Beta";

// ── Full Engine Pairs ─────────────────────────────────────────────────────────
// Kept here for documentation and future unlock logic.

export const FULL_ENGINE_PAIRS = [
  // Major Forex
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
  // Crosses
  "GBPJPY", "EURJPY", "AUDJPY", "CADJPY", "CHFJPY", "EURAUD", "EURGBP",
  // Commodities
  "GOLD", "XAUUSD", "SILVER", "OIL",
  // Indices
  "NASDAQ", "NAS100", "SPX", "US30", "DXY",
  // Crypto
  "BTCUSD", "ETHUSD",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the pair is accessible in the current (global) tier.
 * Used when there is no per-user session (e.g., env-driven mode).
 */
export function isPairAllowed(pair: string): boolean {
  if (ENGINE_TIER === "full") return true;
  return BETA_PAIRS.has(pair.toUpperCase());
}

/**
 * Per-user tier check — used in authenticated API routes.
 * tier: "beta" | "pro"
 */
export function isPairAllowedForTier(pair: string, tier: string): boolean {
  if (tier === "pro") return true;
  return BETA_PAIRS.has(pair.toUpperCase());
}

/**
 * Returns scan pairs allowed for a given user tier.
 */
export function getScanPairsForTier(tier: string): string[] {
  if (tier === "pro") return ["EURUSD", "GBPUSD", "USDJPY", "GOLD", "NASDAQ", "SPX", "DXY"];
  return BETA_SCAN_PAIRS;
}

/**
 * Builds the soft upsell message shown when a locked pair is requested.
 * Tone: informative, not aggressive.
 */
export function buildLockedPairMessage(pair: string): string {
  return `**${pair}** is not available in the Beta tier.

Current focus pairs:
• EURUSD
• NAS100

Additional markets — GBPUSD, USDJPY, GOLD, SPX, DXY, and all forex/indices — are available in the full engine.`;
}

/**
 * Given a list of requested pairs, returns only those allowed in the current tier.
 * Falls back to BETA_SCAN_PAIRS if nothing passes the filter.
 */
export function filterAllowedPairs(requested: string[]): string[] {
  if (ENGINE_TIER === "full") return requested;
  const filtered = requested.filter((p) => BETA_PAIRS.has(p.toUpperCase()));
  return filtered.length > 0 ? filtered : BETA_SCAN_PAIRS;
}
