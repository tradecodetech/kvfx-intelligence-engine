-- ============================================================
-- WhisperZonez KVFX Intelligence Engine — Supabase Schema
-- Run this in your Supabase SQL Editor
-- Version: 3.4.0
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Chat Logs Table
-- Stores every message (user + assistant) with KVFX metadata
-- NOTE: mode accepts both assistant modes and trading modes
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  mode TEXT NOT NULL,
  bias TEXT CHECK (bias IN ('bullish', 'bearish', 'neutral', 'Bullish', 'Bearish', 'Neutral')),
  alignment_score INTEGER CHECK (alignment_score >= 0 AND alignment_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_logs_session_id ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at DESC);

-- ============================================================
-- Trade Logs Table (legacy — kept for compatibility)
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  trade_idea TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  bias TEXT NOT NULL,
  alignment_score INTEGER NOT NULL CHECK (alignment_score >= 0 AND alignment_score <= 100),
  mode TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_logs_user_id ON trade_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_logs_created_at ON trade_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_logs_bias ON trade_logs(bias);
CREATE INDEX IF NOT EXISTS idx_trade_logs_alignment ON trade_logs(alignment_score DESC);

-- ============================================================
-- KVFX Trades Table
-- Primary journal — auto-logged by AI and manual entry
-- ============================================================
CREATE TABLE IF NOT EXISTS kvfx_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Identity
  session_id UUID,
  user_id TEXT NOT NULL DEFAULT 'anonymous',

  -- Trade Core
  pair TEXT,
  bias TEXT CHECK (bias IN ('Bullish', 'Bearish', 'Neutral', NULL)),
  structure TEXT,
  supply_zone TEXT,
  demand_zone TEXT,
  entry TEXT,

  -- Outcome
  result TEXT CHECK (result IN ('Win', 'Loss', 'Breakeven', NULL)),
  rr NUMERIC(6, 2),

  -- Metadata
  notes TEXT,
  setup_type TEXT,
  session TEXT,
  timeframe TEXT
);

-- Indexes for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_kvfx_trades_user_id ON kvfx_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_kvfx_trades_created_at ON kvfx_trades(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kvfx_trades_pair ON kvfx_trades(pair);
CREATE INDEX IF NOT EXISTS idx_kvfx_trades_result ON kvfx_trades(result);
CREATE INDEX IF NOT EXISTS idx_kvfx_trades_session_id ON kvfx_trades(session_id);

-- ============================================================
-- User Profiles Table
-- Stores per-user tier (beta / pro). Auto-created on signup.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'beta' CHECK (tier IN ('beta', 'pro')),
  beta_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile row when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, tier, beta_expires_at)
  VALUES (NEW.id, 'beta', NOW() + INTERVAL '14 days')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Row Level Security
-- RLS disabled for development — re-enable with auth in prod
-- ============================================================
ALTER TABLE chat_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE trade_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE kvfx_trades DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- View: Trade Performance Summary
-- Aggregated stats from trade_logs (legacy)
-- ============================================================
CREATE OR REPLACE VIEW trade_performance_summary AS
SELECT
  user_id,
  mode,
  COUNT(*) AS total_insights,
  ROUND(AVG(alignment_score), 1) AS avg_alignment,
  COUNT(*) FILTER (WHERE bias = 'bullish') AS bullish_count,
  COUNT(*) FILTER (WHERE bias = 'bearish') AS bearish_count,
  COUNT(*) FILTER (WHERE bias = 'neutral') AS neutral_count,
  COUNT(*) FILTER (WHERE alignment_score >= 70) AS high_quality_setups,
  MIN(created_at) AS first_insight,
  MAX(created_at) AS last_insight
FROM trade_logs
GROUP BY user_id, mode;

-- ============================================================
-- View: KVFX Dashboard Stats
-- Aggregated stats from kvfx_trades (primary)
-- ============================================================
CREATE OR REPLACE VIEW kvfx_dashboard_stats AS
SELECT
  user_id,
  COUNT(*) AS total_trades,
  COUNT(*) FILTER (WHERE result = 'Win') AS wins,
  COUNT(*) FILTER (WHERE result = 'Loss') AS losses,
  COUNT(*) FILTER (WHERE result IS NULL) AS open_trades,
  ROUND(
    CASE
      WHEN COUNT(*) FILTER (WHERE result IN ('Win', 'Loss')) > 0
      THEN COUNT(*) FILTER (WHERE result = 'Win')::NUMERIC /
           COUNT(*) FILTER (WHERE result IN ('Win', 'Loss')) * 100
      ELSE 0
    END, 1
  ) AS win_rate_pct,
  ROUND(AVG(rr) FILTER (WHERE result = 'Win'), 2) AS avg_win_rr,
  COUNT(DISTINCT pair) AS unique_pairs,
  MIN(created_at) AS first_trade,
  MAX(created_at) AS last_trade
FROM kvfx_trades
GROUP BY user_id;
