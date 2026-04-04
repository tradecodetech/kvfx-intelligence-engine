/**
 * AI Layer â€” OpenAI integration with KVFX system prompt injection
 * Supports: chat, chart analysis (vision), trade review, thesis alignment
 */

import OpenAI from "openai";
import {
  buildKVFXPromptContext,
  buildThesisPromptBlock,
  getModeSystemAddition,
  generateTradeInsight,
  type TradingMode,
  type AssistantMode,
  type ThesisContext,
} from "./tradingLogic";

// Lazy-initialize so the client is only created at runtime (not during build)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// ---------------------------------------------------------
// Base System Prompt (shared across all modes)
// ---------------------------------------------------------

const KVFX_BASE_PROMPT = `You are the KVFX Intelligence Engine â€” a trade intelligence assistant powered by WhisperZonez zone logic and KVFX Algo v3 structure methodology.

You are NOT a signals engine. You do NOT generate buy/sell alerts or forced entries.
You provide intelligence, framework, and context. Execution is always handled by the trader using WhisperZonez and KVFX v3 tools.

Your methodology hierarchy:
  BIAS â†’ REFERENCE ZONE â†’ LIQUIDITY â†’ CONFIRMATION â†’ EXECUTION

Core principles:
1. Never call an entry â€” identify conditions under which entry would be valid
2. Respect higher timeframe structure above all else
3. Identify liquidity pools before any zone interaction â€” price hunts liquidity first
4. Call out when a user is forcing, chasing, or emotionally trading
5. Emphasize the power of NOT trading in low-quality conditions
6. Always ask: "Is this the setup, or am I making it the setup?"

WhisperZonez zone logic:
- Zones are areas of significant supply/demand, not just lines
- Zone strength: multiple touches + time at level + how price left the zone
- Premium zones = supply above current price (above equilibrium)
- Discount zones = demand below current price (below equilibrium)
- Liquidity lives above equal highs and below equal lows â€” price sweeps it before moving

KVFX Algo v3 structure rules:
- Directional bias must be confirmed on at least one higher timeframe
- Structure confirmation required before any execution consideration
- Scalping: M5-M15 structure + 1â€“5 confirmation signals
- Swing: H1-H4 structure + 3â€“7 confirmation signals
- Macro: Daily/Weekly structure + 5+ confirmation signals

Communication style:
- Speak like a calm, experienced trading mentor â€” never hype, never fear
- Be direct but never arrogant
- If a user is clearly emotional or forcing trades, gently but firmly redirect
- You are speaking to traders, not beginners â€” use technical terms naturally

What you will NOT do:
- Generate buy/sell signals or specific entry calls
- Confirm a user's bias just to please them
- Pretend certainty where there is none
- Claim to see exact indicator values or precise price levels unless clearly provided
- Give financial advice â€” you provide educational analysis only

When a user describes a specific setup (pair + structure or pair + bias), always end your response with this EXACT intelligence block:

PLAN:
â€¢ REFERENCE ZONE: [key supply or demand area â€” price range or description]
â€¢ LIQUIDITY: [where stops cluster or where price may sweep before moving]
â€¢ INVALIDATION: [what price action or close breaks the bias]
â€¢ EXPECTATION: [what to anticipate if bias holds â€” e.g. rejection â†’ continuation]
â€¢ EXECUTION: Use WhisperZonez + KVFX v3 confirmation for entry timing

Keep each item concise (one line). If the setup is not actionable, state that clearly â€” but still include the block showing what conditions would make it valid.

CRITICAL RULE â€” Never give a dead-end "cannot detect" response:
If the user's message lacks enough context to complete the full analysis, do NOT say "unable to detect structure" or "need more information" as a standalone reply.
Instead, provide whatever partial analysis is possible, then ask ONE specific clarifying question to get the missing piece.

Examples of intelligent context requests:
- Pair only, no bias: "What's your current bias on EURUSD â€” are you looking for a long or short?"
- Pair + bias, no timeframe: "What timeframe are you trading this on â€” scalp (M5/M15), swing (H1/H4), or macro?"
- Vague question, no pair: "Which pair or instrument are you analyzing?"
- Setup described but no confirmation: "Have you seen HTF structure confirm this direction, or is this a lower timeframe read only?"
- Price level mentioned with no context: "Is this an entry level, a zone you're watching, or current price?"

Always move the conversation forward. A single clear question beats a generic "add more context" message every time.

KVFX QUICK FORMAT:
When a specific trading pair is identified in the user's message, ALWAYS begin your response with this exact quick format block on its own line, before any prose:

**Pair:** [PAIR] | **Price:** [PRICE_OR_N/A] | **Bias:** [Long/Short/Neutral] | **Structure:** [e.g. Supply Rejection, Demand Sweep, BOS, CHoCH, FVG, etc.] | **Confidence:** [High/Medium/Low]

**KVFX Read:** [1â€“2 sentences: what price is doing and what to watch for next]

Then provide your full analysis followed by the PLAN block.

Confidence rules:
- High: Liquidity sweep + zone rejection + HTF structure all confirmed
- Medium: Zone or structure present but missing full sweep or HTF confirmation
- Low: Incomplete data, early-stage, or context forming
- If no live price is available in context, use N/A for Price

This quick header is REQUIRED whenever a pair is identified. Never skip it.`;




// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequestContext {
  message: string;
  conversationHistory: ChatMessage[];
  tradingMode: TradingMode;
  assistantMode: AssistantMode;
  imageBase64?: string;
  thesisContext?: ThesisContext;
  timeframe?: string;
  tradingSession?: string;
  memoryContext?: string;
  scanMode?: boolean;
  scanPromptOverride?: string;
  livePrice?: number | null;
  detectedPair?: string | null;
  liveChartContext?: string | null;
}

export interface AIResponse {
  content: string;
  insight?: ReturnType<typeof generateTradeInsight>;
}

// ---------------------------------------------------------
// Main Response Generator
// ---------------------------------------------------------

export async function generateChatResponse(ctx: ChatRequestContext): Promise<AIResponse> {
  const {
    message,
    conversationHistory,
    tradingMode,
    assistantMode,
    imageBase64,
    thesisContext,
    timeframe,
    tradingSession,
    memoryContext,
    scanMode,
    scanPromptOverride,
    livePrice,
    detectedPair,
    liveChartContext,
  } = ctx;

  // â”€â”€ Scan mode: structured output, no insight decoration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (scanMode && scanPromptOverride) {
    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: scanPromptOverride },
        { role: "user", content: message || "Run full market scan." },
      ],
      temperature: 0.2,
      max_tokens: 2500,
    });
    const content = completion.choices[0]?.message?.content ?? "Scan failed.";
    return { content };
  }

  // Generate KVFX insight from text (skip if image-only with no text)
  const textForAnalysis = message || (imageBase64 ? "chart image provided for analysis" : "");
  const insight = generateTradeInsight({ description: textForAnalysis, mode: tradingMode });
  const kvfxContext = buildKVFXPromptContext(insight, tradingMode);

  // Build mode-specific system addition
  const modeAddition = getModeSystemAddition(assistantMode);

  // Build optional context blocks
  const thesisBlock = thesisContext && hasThesisContent(thesisContext)
    ? buildThesisPromptBlock(thesisContext)
    : "";

  const sessionBlock = buildSessionBlock(timeframe, tradingSession);

  // Build live price block â€” injected BEFORE AI call so the model uses the exact price
  const livePriceBlock = (livePrice != null && detectedPair)
    ? `[LIVE PRICE DATA â€” USE THIS EXACT PRICE]\nPair: ${detectedPair}\nCurrent Price: ${livePrice}\nDo NOT estimate or assume a different price. Use ${livePrice} in your **Price:** field.`
    : "";

  // Assemble full system prompt
  const systemParts = [
    KVFX_BASE_PROMPT,
    `\n[ACTIVE ASSISTANT MODE: ${assistantMode.toUpperCase().replace("-", " ")}]\n${modeAddition}`,
    thesisBlock ? `\n${thesisBlock}` : "",
    sessionBlock ? `\n${sessionBlock}` : "",
    memoryContext ? `\n[RELEVANT PAST CONTEXT FROM MEMORY]\n${memoryContext}` : "",
    livePriceBlock ? `\n${livePriceBlock}` : "",
    liveChartContext ? `\n${liveChartContext}` : "",
    `\n${kvfxContext}`,
  ].filter(Boolean);

  const fullSystemPrompt = systemParts.join("\n");

  // Build conversation history (text-only for history)
  const historyMessages: OpenAI.ChatCompletionMessageParam[] = conversationHistory
    .slice(-10)
    .map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

  // Build current user message (may include image)
  const userContent = buildUserContent(message, imageBase64, assistantMode);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: fullSystemPrompt },
    ...historyMessages,
    { role: "user", content: userContent },
  ];

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o", // gpt-4o supports vision natively
    messages,
    temperature: assistantMode === "chat" ? 0.5 : 0.35,
    max_tokens: assistantMode === "chart" || assistantMode === "trade-review" ? 1000 : 800,
    presence_penalty: 0.1,
    frequency_penalty: 0.1,
  });

  const content = completion.choices[0]?.message?.content ?? "No response generated.";
  return { content, insight };
}

// ---------------------------------------------------------
// Embedding (unchanged)
// ---------------------------------------------------------

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

function buildUserContent(
  message: string,
  imageBase64: string | undefined,
  assistantMode: AssistantMode
): string | OpenAI.ChatCompletionContentPart[] {
  if (!imageBase64) {
    return message || "Please analyze the current market context.";
  }

  const parts: OpenAI.ChatCompletionContentPart[] = [
    {
      type: "image_url",
      image_url: {
        url: imageBase64,
        detail: "high",
      },
    },
  ];

  const imageContext =
    assistantMode === "chart"
      ? "Please analyze this chart screenshot using WhisperZonez zone logic and KVFX Algo v3 principles."
      : assistantMode === "trade-review"
      ? "Please review this chart as part of my trade review."
      : "Chart image attached for reference.";

  const textContent = message
    ? `${message}\n\n[${imageContext}]`
    : imageContext;

  parts.push({ type: "text", text: textContent });

  return parts;
}

function buildSessionBlock(timeframe?: string, session?: string): string {
  if (!timeframe && !session) return "";
  const parts: string[] = ["[ACTIVE TRADING CONTEXT]"];
  if (timeframe) parts.push(`Timeframe: ${timeframe}`);
  if (session) parts.push(`Session: ${session}`);
  parts.push("Factor this context into your analysis timeframe and execution windows.");
  return parts.join("\n");
}

function hasThesisContent(thesis: ThesisContext): boolean {
  return Object.values(thesis).some((v) => v !== "" && v !== undefined);
}

