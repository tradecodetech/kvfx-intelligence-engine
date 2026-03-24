/**
 * KVFX Tier Configuration
 *
 * Pair restrictions removed — all tiers have full engine access.
 * Access is now controlled by beta_expires_at (time-based), not pair whitelists.
 */

// ── Full Engine Pairs ─────────────────────────────────────────────────────────
// Used for scan prompts. All pairs available to all users.

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

/** Default scan pairs — returned for all tiers. */
export const DEFAULT_SCAN_PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "GOLD", "NASDAQ", "SPX", "DXY",
];

/**
 * Returns scan pairs for a given tier.
 * All tiers now get the same full set.
 */
export function getScanPairsForTier(_tier: string): string[] {
  return DEFAULT_SCAN_PAIRS;
}

/**
 * All pairs are allowed for all tiers.
 * Kept for API compatibility — always returns true.
 */
export function isPairAllowedForTier(_pair: string, _tier: string): boolean {
  return true;
}

/**
 * No-op filter — returns the full requested list unchanged.
 * Kept for API compatibility.
 */
export function filterAllowedPairs(requested: string[]): string[] {
  return requested;
}
