# WhisperZonez KVFX Intelligence Engine — Setup Guide

## Prerequisites

- Node.js 18+
- OpenAI account (for GPT-4o)
- Supabase account (free tier works)
- Pinecone account (free tier: 1 index)
- Upstash account (free tier: Redis)

---

## 1. Install Dependencies

```bash
cd kvfx-app
npm install
```

---

## 2. Environment Variables

Copy the example file and fill in your keys:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```env
OPENAI_API_KEY=sk-...           # OpenAI platform.openai.com
SUPABASE_URL=https://...        # Supabase project URL
SUPABASE_ANON_KEY=eyJ...        # Supabase anon/public key
PINECONE_API_KEY=pcsk_...       # Pinecone API key
UPSTASH_REDIS_URL=https://...   # Upstash Redis REST URL
UPSTASH_REDIS_TOKEN=AX...       # Upstash Redis REST token
```

---

## 3. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project
2. Open the **SQL Editor**
3. Run the contents of `supabase/schema.sql`

This creates:
- `chat_logs` — all conversation messages
- `trade_logs` — trade insight requests
- `trade_performance_summary` — analytics view

---

## 4. Pinecone Setup

1. Go to [app.pinecone.io](https://app.pinecone.io) → Create Index
2. **Index name:** `kvfx-memory`
3. **Dimensions:** `1536` (for `text-embedding-3-small`)
4. **Metric:** `cosine`
5. **Serverless** (recommended, free tier)
6. Copy your API key to `.env.local`

---

## 5. Upstash Redis Setup

1. Go to [console.upstash.com](https://console.upstash.com) → Create Database
2. Choose **Redis** → Region (pick closest to your deployment)
3. Copy **REST URL** and **REST Token** to `.env.local`

---

## 6. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

- Landing page: `http://localhost:3000`
- Chat assistant: `http://localhost:3000/assistant`
- API health: `http://localhost:3000/api/chat` (GET)

---

## 7. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard:
# Project Settings → Environment Variables
# Add all vars from .env.local
```

Or connect your GitHub repo directly in the Vercel dashboard for automatic deployments.

---

## File Structure

```
kvfx-app/
├── app/
│   ├── assistant/
│   │   └── page.tsx          # Chat UI page
│   ├── api/
│   │   └── chat/
│   │       └── route.ts      # Main API route
│   ├── layout.tsx
│   └── page.tsx              # Landing page
├── components/
│   └── ChatUI.tsx            # Full chat interface component
├── lib/
│   ├── ai.ts                 # OpenAI integration + KVFX prompt
│   ├── memory.ts             # Pinecone + Supabase + Redis
│   └── tradingLogic.ts       # KVFX + WhisperZonez core logic
├── supabase/
│   └── schema.sql            # Database schema
├── .env.local.example
└── SETUP.md
```

---

## Architecture Overview

```
User Message
    ↓
[/api/chat route]
    ↓
[Redis] Load session cache
    ↓
[Pinecone] Retrieve relevant past context (vector search)
    ↓
[tradingLogic.ts] Generate KVFX insight
  - analyzeBias()       → bullish / bearish / neutral
  - identifyZones()     → supply, demand, liquidity zones
  - checkAlignment()    → 0-100 alignment score
  - generateTradeInsight() → full structured output
    ↓
[ai.ts] Build full system prompt:
  - KVFX operator rules
  - WhisperZonez methodology
  - KVFX insight context block
  - Past memory context
  - Conversation history
    ↓
[OpenAI GPT-4o] Generate disciplined response
    ↓
[Redis] Update session cache
[Supabase] Persist chat logs
[Pinecone] Embed + store message vector
    ↓
Return to client: { content, sessionId, insight }
```

---

## Future Integrations

The architecture supports these extensions:

### TradingView Alerts
- Add a `/api/webhook/tradingview` route
- Accept alert JSON from TradingView Pine Script
- Feed into `generateTradeInsight()` and push to chat

### Telegram Bot
- Use `node-telegram-bot-api`
- Forward messages to `/api/chat`
- Return formatted response via Telegram

### KVFX Indicator Signals
- Create `/api/signal` endpoint
- Accept signal data (symbol, timeframe, type)
- Run through full KVFX logic layer
- Store in `trade_logs` for tracking

---

## Trading Modes Reference

| Mode | Timeframe | Confirmation Signals | Risk Profile |
|------|-----------|---------------------|--------------|
| Scalping | 1m–15m | 1–5 | Tight |
| Swing | 4H–Daily | 3–7 | Moderate |
| Macro | Weekly–Monthly | 5+ | Conservative |

## Alignment Score Guide

| Score | Meaning | Action |
|-------|---------|--------|
| 0–39 | Poor alignment | WAIT — no trade |
| 40–64 | Developing setup | PREPARE — size down |
| 65–79 | Good alignment | EXECUTE — standard size |
| 80–100 | Strong alignment | EXECUTE — full conviction |
