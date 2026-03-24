/**
 * /api/chat — KVFX Intelligence Engine API Route
 *
 * Routing architecture:
 *   COMMAND PATH  — keyword-triggered actions (scan, bias board, etc.)
 *                   Runs immediately after validation, before any async enrichment.
 *                   Bypasses: memory retrieval, pair detection, live price, structure
 *                   analysis, intelligence card, auto trade logging.
 *
 *   ANALYSIS PATH — descriptive inputs that contain pair / bias / structure context.
 *                   Runs the full pipeline: memory, pair+price, structure insight,
 *                   intelligence card, auto logging.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateChatResponse } from "@/lib/ai";
import {
  getSession,
  createSession,
  appendToSession,
  retrieveRelevantContext,
  processAndStore,
  saveTradeInsight,
} from "@/lib/memory";
import { supabase } from "@/lib/supabase";
import { parseTradeFromText, detectResultUpdate } from "@/lib/tradeParser";
import { buildIntelligenceCard } from "@/lib/intelligenceEngine";
import { isScanCommand, buildScanPrompt, parseScanResponse } from "@/lib/scanEngine";
import { fetchLivePrice, fetchLivePricesForScan } from "@/lib/priceApi";
import { getScanPairsForTier } from "@/lib/tierConfig";
import { detectPair } from "@/lib/tradeParser";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const VALID_TRADING_MODES = ["scalping", "swing", "macro"];
const VALID_ASSISTANT_MODES = ["chat", "chart", "trade-review", "thesis"];

export async function POST(req: NextRequest) {
  try {
    // ── AUTH ──────────────────────────────────────────────────────────────────
    const supabaseAuth = await createSupabaseServer();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to use the engine." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabaseAuth
      .from("user_profiles")
      .select("tier")
      .eq("id", user.id)
      .single();

    const userTier = (profile?.tier as "beta" | "pro") ?? "beta";
    const authedUserId = user.id;

    // ── BODY PARSING ──────────────────────────────────────────────────────────
    const body = await req.json();

    const {
      message = "",
      sessionId,
      tradingMode = "swing",
      assistantMode = "chat",
      image,
      thesisContext,
      timeframe,
      tradingSession,
      isTradeInsight = false,
      commandHint = false,
    } = body;

    // ── VALIDATION ────────────────────────────────────────────────────────────
    const hasMessage =
      message && typeof message === "string" && message.trim().length > 0;

    const hasImage =
      image && typeof image === "string" && image.startsWith("data:");

    if (!hasMessage && !hasImage) {
      return NextResponse.json(
        { error: "Either a message or image is required." },
        { status: 400 }
      );
    }

    if (!VALID_TRADING_MODES.includes(tradingMode)) {
      return NextResponse.json(
        { error: "Invalid trading mode." },
        { status: 400 }
      );
    }

    if (!VALID_ASSISTANT_MODES.includes(assistantMode)) {
      return NextResponse.json(
        { error: "Invalid assistant mode." },
        { status: 400 }
      );
    }

    if (hasImage && image.length > 11_000_000) {
      return NextResponse.json(
        { error: "Image too large. Please compress to under 8MB." },
        { status: 413 }
      );
    }

    // ── COMMAND DETECTION ─────────────────────────────────────────────────────
    // Runs immediately after validation — before session, memory, pair detection,
    // or any structure analysis. Commands are keyword-triggered actions that do
    // not carry pair / bias / timeframe context and must never be routed through
    // the structure pipeline (which would produce low-alignment noise responses).
    // commandHint = client-side pre-check that runs before JSON serialization.
    // Acts as a fallback when Unicode non-breaking spaces from mobile keyboards
    // cause isScanCommand to return false on the server-side string.
    const isCommand = hasMessage && (commandHint === true || isScanCommand(message));

    // Diagnostic log — visible in the Next.js terminal on every request.
    // Shows the raw message bytes so Unicode space issues become obvious.
    // Remove once mobile command routing is confirmed stable.
    console.log("[ROUTE] incoming:", JSON.stringify({
      message: message.slice(0, 80),
      messageBytes: [...message.slice(0,30)].map(c => c.charCodeAt(0).toString(16)).join(" "),
      commandHint,
      isScanResult: isScanCommand(message),
      isCommand,
      assistantMode,
    }));

    // ── SESSION ───────────────────────────────────────────────────────────────
    // Shared by both paths — maintains conversation continuity.
    let session = sessionId ? await getSession(sessionId) : null;
    if (!session) {
      session = await createSession(authedUserId, tradingMode);
    }

    // ═════════════════════════════════════════════════════════════════════════
    // COMMAND PATH
    // No memory retrieval. No pair detection. No structure analysis.
    // Dispatches directly to the scan engine with the appropriate prompt.
    // ═════════════════════════════════════════════════════════════════════════
    if (isCommand) {
      const scanPairs = getScanPairsForTier(userTier);

      // Fetch live prices for all scan pairs in parallel — no cache, no-store —
      // before building the prompt so the AI receives current price levels.
      let scanLivePrices: Record<string, number | null> = {};
      try {
        scanLivePrices = await fetchLivePricesForScan(scanPairs);
      } catch (err) {
        console.warn("⚠️ Scan price fetch failed — continuing without prices:", err);
      }

      const scanPrompt = buildScanPrompt(message, tradingMode, scanPairs, scanLivePrices);

      const { content } = await generateChatResponse({
        message: message.trim(),
        conversationHistory: session.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        tradingMode,
        assistantMode,
        scanMode: true,
        scanPromptOverride: scanPrompt,
      });

      // Parse structured scan output
      let scanResults = null;
      try {
        scanResults = parseScanResponse(content);
        if (scanResults) {
          console.log(
            `📡 SCAN COMPLETE: ${scanResults.pairsScanned.length} pairs — top: ${scanResults.topPair}`
          );
        }
      } catch (err) {
        console.warn("⚠️ Scan parse failed:", err);
      }

      const storedUserMessage = message.trim();

      // Session cache
      try {
        await Promise.all([
          appendToSession(session.sessionId, "user", storedUserMessage),
          appendToSession(session.sessionId, "assistant", content),
        ]);
      } catch (err) {
        console.warn("⚠️ Session cache skipped:", err);
      }

      // Chat log
      try {
        await supabase.from("chat_logs").insert([
          {
            session_id: session.sessionId,
            user_id: authedUserId,
            role: "user",
            content: storedUserMessage,
            mode: assistantMode,
          },
          {
            session_id: session.sessionId,
            user_id: authedUserId,
            role: "assistant",
            content,
            mode: assistantMode,
          },
        ]);
      } catch (err) {
        console.warn("⚠️ Chat logging failed:", err);
      }

      console.log("[COMMAND]", JSON.stringify({
        command: message.trim().slice(0, 60),
        tradingMode,
        pairs: scanResults?.pairsScanned ?? [],
      }));

      return NextResponse.json({
        content,
        sessionId: session.sessionId,
        scanResults: scanResults ?? null,
        livePrice: null,
        scanPrices: scanLivePrices,
        intelligenceCard: null,
        insight: null,
      });
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ANALYSIS PATH
    // Full pipeline for descriptive requests carrying pair / bias / structure.
    // ═════════════════════════════════════════════════════════════════════════

    // MEMORY CONTEXT
    let memoryContext = "";
    try {
      if (hasMessage) {
        memoryContext = await retrieveRelevantContext(message, authedUserId);
      }
    } catch (err) {
      console.warn("⚠️ Memory retrieval skipped:", err);
    }

    // PAIR DETECTION + LIVE PRICE (before AI call)
    // Fetch live price early so the AI receives the exact current price in context.
    const prePair = hasMessage ? detectPair(message) : null;
    let preLivePrice: number | null = null;
    if (prePair) {
      try {
        preLivePrice = await fetchLivePrice(prePair);
      } catch (err) {
        console.warn("⚠️ Pre-AI live price fetch failed:", err);
      }
    }

    // AI RESPONSE
    const { content, insight } = await generateChatResponse({
      message: message.trim(),
      conversationHistory: session.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tradingMode,
      assistantMode,
      imageBase64: hasImage ? image : undefined,
      thesisContext,
      timeframe,
      tradingSession,
      memoryContext,
      livePrice: preLivePrice,
      detectedPair: prePair,
    });

    // BETA LOGGING
    if (hasMessage) {
      const { detectBias } = await import("@/lib/tradeParser");
      const detectedBias = detectBias(message);
      console.log("[ANALYSIS]", JSON.stringify({
        message: message.trim().slice(0, 80),
        detectedPair: prePair ?? "—",
        detectedBias: detectedBias ?? "—",
        livePrice: preLivePrice ?? "—",
        confidence: insight?.alignmentScore ?? "—",
        mode: assistantMode,
        tradingMode,
      }));
    }

    // MESSAGE STORAGE
    const storedUserMessage = hasImage
      ? `[Chart Image]${hasMessage ? ` — ${message.trim()}` : ""}`
      : message.trim();

    // SESSION CACHE
    try {
      await Promise.all([
        appendToSession(session.sessionId, "user", storedUserMessage),
        appendToSession(session.sessionId, "assistant", content),
      ]);
    } catch (err) {
      console.warn("⚠️ Session cache skipped:", err);
    }

    // MEMORY PIPELINE
    try {
      await Promise.all([
        processAndStore(
          session.sessionId,
          authedUserId,
          "user",
          storedUserMessage,
          tradingMode,
          insight?.bias,
          insight?.alignmentScore
        ),
        processAndStore(
          session.sessionId,
          authedUserId,
          "assistant",
          content,
          tradingMode,
          insight?.bias,
          insight?.alignmentScore
        ),
      ]);
    } catch (err) {
      console.warn("⚠️ Memory pipeline skipped:", err);
    }

    // CHAT LOGGING
    try {
      const { error } = await supabase.from("chat_logs").insert([
        {
          session_id: session.sessionId,
          user_id: authedUserId,
          role: "user",
          content: storedUserMessage,
          mode: assistantMode,
        },
        {
          session_id: session.sessionId,
          user_id: authedUserId,
          role: "assistant",
          content,
          mode: assistantMode,
        },
      ]);
      if (error) {
        console.error("❌ FETCH ERROR (chat log):", error);
      } else {
        console.log("✅ FETCH SUCCESS: Chat logged");
      }
    } catch (err) {
      console.warn("⚠️ Chat logging failed:", err);
    }

    // AUTO RESULT UPDATE
    if (hasMessage) {
      try {
        const resultUpdate = detectResultUpdate(message);
        if (resultUpdate) {
          const { data: openTrades, error: fetchErr } = await supabase
            .from("kvfx_trades")
            .select("id")
            .eq("pair", resultUpdate.pair)
            .is("result", null)
            .order("created_at", { ascending: false })
            .limit(1);

          if (!fetchErr && openTrades && openTrades.length > 0) {
            const { error: updateErr } = await supabase
              .from("kvfx_trades")
              .update({ result: resultUpdate.result })
              .eq("id", openTrades[0].id);

            if (!updateErr) {
              console.log(
                `🎯 AUTO RESULT UPDATE: ${resultUpdate.pair} → ${resultUpdate.result}`
              );
            } else {
              console.error("❌ RESULT UPDATE ERROR:", updateErr);
            }
          }
        }
      } catch (err) {
        console.warn("⚠️ Auto result update failed:", err);
      }
    }

    // PARSE TRADE SIGNAL
    const parsed = hasMessage
      ? parseTradeFromText(message, content)
      : { pair: null, bias: null, rr: null, setup_type: null, session: null, timeframe: null, notes: content, isSignal: false };

    const livePrice = preLivePrice;

    // BUILD INTELLIGENCE CARD
    let intelligenceCard = null;
    try {
      intelligenceCard = buildIntelligenceCard(
        message,
        content,
        insight,
        parsed.pair ?? prePair,
        parsed.session || tradingSession || null,
        parsed.timeframe || timeframe || null,
        livePrice
      );
    } catch (err) {
      console.warn("⚠️ Intelligence card build failed:", err);
    }

    // AUTO TRADE LOGGING
    try {
      const shouldLog = insight != null || parsed.isSignal || intelligenceCard != null;

      if (shouldLog) {
        const pairFallback = (() => {
          const match = content.match(
            /\b(EURUSD|GBPUSD|USDJPY|AUDUSD|USDCAD|USDCHF|NZDUSD|GBPJPY|EURJPY|AUDJPY|NASDAQ|NAS100|SPX|DXY|GOLD|XAUUSD|SILVER)\b/i
          );
          return match ? match[0].toUpperCase() : null;
        })();

        const pair = (insight as any)?.pair || parsed.pair || pairFallback;
        const bias =
          insight?.bias ||
          parsed.bias ||
          (content.toLowerCase().includes("bull")
            ? "Bullish"
            : content.toLowerCase().includes("bear")
            ? "Bearish"
            : "Neutral");

        const tradePayload = {
          session_id: session.sessionId,
          user_id: authedUserId,
          pair: pair || "UNKNOWN",
          bias,
          structure: insight?.notes || null,
          supply_zone: insight?.zones?.find((z: { type: string }) => z.type === "supply")?.priceLevel || null,
          demand_zone: insight?.zones?.find((z: { type: string }) => z.type === "demand")?.priceLevel || null,
          entry: insight?.action || null,
          result: null,
          rr: parsed.rr,
          notes: content.slice(0, 1000),
          setup_type: parsed.setup_type,
          session: parsed.session || tradingSession || null,
          timeframe: parsed.timeframe || timeframe || null,
        };

        const { error: tradeErr } = await supabase
          .from("kvfx_trades")
          .insert([tradePayload]);

        if (tradeErr) {
          console.error("❌ FETCH ERROR (trade log):", tradeErr);
        } else {
          console.log(
            `✅ AUTO TRADE LOGGED: ${tradePayload.pair} | ${tradePayload.bias} | RR: ${tradePayload.rr ?? "—"}`
          );
        }
      }
    } catch (err) {
      console.warn("⚠️ KVFX trade logging failed:", err);
    }

    // FALLBACK TRADE MEMORY
    if (
      (isTradeInsight ||
        assistantMode === "trade-review" ||
        assistantMode === "chart") &&
      insight
    ) {
      try {
        await saveTradeInsight(
          session.sessionId,
          authedUserId,
          storedUserMessage,
          content,
          insight.bias,
          insight.alignmentScore,
          tradingMode
        );
      } catch (err) {
        console.warn("⚠️ Trade log fallback:", err);
      }
    }

    // RESPONSE
    return NextResponse.json({
      content,
      sessionId: session.sessionId,
      scanResults: null,
      livePrice,
      intelligenceCard,
      insight: insight
        ? {
            bias: insight.bias,
            alignmentScore: insight.alignmentScore,
            action: insight.action,
            zones: insight.zones,
            notes: insight.notes,
            riskWarnings: insight.riskWarnings,
            timeframe: insight.timeframe,
          }
        : null,
    });
  } catch (err) {
    console.error("[/api/chat] Error:", err);

    return NextResponse.json(
      { error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "KVFX Intelligence Engine — Online",
    version: "3.5.0",
    tradingModes: ["scalping", "swing", "macro"],
    assistantModes: ["chat", "chart", "trade-review", "thesis"],
    capabilities: [
      "text",
      "vision",
      "thesis-context",
      "session-metadata",
      "auto-trade-logging",
      "auto-result-update",
      "smart-trade-parsing",
      "market-scan",
    ],
  });
}
