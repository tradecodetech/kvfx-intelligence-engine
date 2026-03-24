/**
 * /api/chat — KVFX Intelligence Engine API Route
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
import { fetchLivePrice } from "@/lib/priceApi";
import {
  isPairAllowedForTier,
  buildLockedPairMessage,
  filterAllowedPairs,
  getScanPairsForTier,
} from "@/lib/tierConfig";
import { detectPair } from "@/lib/tradeParser";
import { createClient as createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

const VALID_TRADING_MODES = ["scalping", "swing", "macro"];
const VALID_ASSISTANT_MODES = ["chat", "chart", "trade-review", "thesis"];

export async function POST(req: NextRequest) {
  try {
    // ------------------------
    // AUTH CHECK
    // ------------------------
    const supabaseAuth = await createSupabaseServer();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in to use the engine." },
        { status: 401 }
      );
    }

    // Fetch user tier (default to "beta" if no profile row yet)
    const { data: profile } = await supabaseAuth
      .from("user_profiles")
      .select("tier")
      .eq("id", user.id)
      .single();

    const userTier = (profile?.tier as "beta" | "pro") ?? "beta";
    const authedUserId = user.id;

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
    } = body;

    // ------------------------
    // VALIDATION
    // ------------------------
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

    // ------------------------
    // SESSION HANDLING
    // ------------------------
    let session = sessionId ? await getSession(sessionId) : null;

    if (!session) {
      session = await createSession(authedUserId, tradingMode);
    }

    // ------------------------
    // MEMORY CONTEXT
    // ------------------------
    let memoryContext = "";
    try {
      if (hasMessage) {
        memoryContext = await retrieveRelevantContext(message, authedUserId);
      }
    } catch (err) {
      console.warn("⚠️ Memory retrieval skipped:", err);
    }

    // ------------------------
    // SCAN DETECTION
    // ------------------------
    const isScan = hasMessage && isScanCommand(message);

    // ------------------------
    // TIER GATE
    // Non-scan messages: block locked pairs immediately (no AI call).
    // Scans: restrict pair list at prompt level.
    // ------------------------
    if (hasMessage && !isScan) {
      const requestedPair = detectPair(message);
      if (requestedPair && !isPairAllowedForTier(requestedPair, userTier)) {
        console.log(`🔒 TIER GATE: ${requestedPair} blocked — ${userTier} tier`);
        return NextResponse.json({
          content: buildLockedPairMessage(requestedPair),
          sessionId: session.sessionId,
          scanResults: null,
          livePrice: null,
          intelligenceCard: null,
          insight: null,
        });
      }
    }

    // Scan pairs for this user's tier
    const scanPairs = filterAllowedPairs(getScanPairsForTier(userTier));

    // ------------------------
    // AI RESPONSE
    // ------------------------
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
      ...(isScan && {
        scanMode: true,
        scanPromptOverride: buildScanPrompt(message, tradingMode, scanPairs),
      }),
    });

    // ------------------------
    // BETA TEST MODE LOGGING
    // ------------------------
    if (hasMessage) {
      const { detectPair, detectBias } = await import("@/lib/tradeParser");
      const detectedPair = detectPair(message);
      const detectedBias = detectBias(message);
      console.log("[BETA]", JSON.stringify({
        command: message.trim().slice(0, 80),
        isScan,
        detectedPair: detectedPair ?? "—",
        detectedBias: detectedBias ?? "—",
        confidence: insight?.alignmentScore ?? "—",
        mode: assistantMode,
        tradingMode,
      }));
    }

    // ------------------------
    // PARSE SCAN RESULTS
    // ------------------------
    let scanResults = null;
    if (isScan) {
      try {
        scanResults = parseScanResponse(content);
        if (scanResults) console.log(`📡 SCAN COMPLETE: ${scanResults.pairsScanned.length} pairs — top: ${scanResults.topPair}`);
      } catch (err) {
        console.warn("⚠️ Scan parse failed:", err);
      }
    }

    // ------------------------
    // MESSAGE STORAGE
    // ------------------------
    const storedUserMessage = hasImage
      ? `[Chart Image]${hasMessage ? ` — ${message.trim()}` : ""}`
      : message.trim();

    // ------------------------
    // SESSION CACHE
    // ------------------------
    try {
      await Promise.all([
        appendToSession(session.sessionId, "user", storedUserMessage),
        appendToSession(session.sessionId, "assistant", content),
      ]);
    } catch (err) {
      console.warn("⚠️ Session cache skipped:", err);
    }

    // ------------------------
    // MEMORY PIPELINE
    // ------------------------
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

    // ------------------------
    // CHAT LOGGING (SUPABASE)
    // ------------------------
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
          content: content,
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

    // ------------------------
    // AUTO RESULT UPDATE
    // Detects "EURUSD TP hit" / "EURUSD stopped" → updates most recent open trade
    // ------------------------
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

    // ------------------------
    // PARSE TRADE SIGNAL (shared for both logging + intelligence card)
    // Skip for scans — they are read-only analysis, not logged trades
    // ------------------------
    const parsed = hasMessage && !isScan
      ? parseTradeFromText(message, content)
      : { pair: null, bias: null, rr: null, setup_type: null, session: null, timeframe: null, notes: content, isSignal: false };

    // ------------------------
    // LIVE PRICE FETCH
    // Auto-fetch from TwelveData when pair detected but user gave no price.
    // Skipped for scans (multi-pair) and when user already typed a price.
    // ------------------------
    let livePrice: number | null = null;
    if (!isScan && parsed.pair && parsed.price === null) {
      try {
        livePrice = await fetchLivePrice(parsed.pair);
      } catch (err) {
        console.warn("⚠️ Live price fetch failed:", err);
      }
    }

    // ------------------------
    // BUILD INTELLIGENCE CARD (skip for scans — scan results take priority)
    // ------------------------
    let intelligenceCard = null;
    if (!isScan) {
      try {
        intelligenceCard = buildIntelligenceCard(
          message,
          content,
          insight,
          parsed.pair,
          parsed.session || tradingSession || null,
          parsed.timeframe || timeframe || null,
          livePrice
        );
      } catch (err) {
        console.warn("⚠️ Intelligence card build failed:", err);
      }
    }

    // ------------------------
    // AUTO TRADE LOGGING
    // Smart extraction: pair, bias, RR, setup_type, session, timeframe
    // Only logs when a meaningful signal is detected
    // ------------------------
    try {

      const shouldLog = !isScan && (insight != null || parsed.isSignal || intelligenceCard != null);

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

    // ------------------------
    // FALLBACK TRADE MEMORY
    // ------------------------
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

    // ------------------------
    // RESPONSE
    // ------------------------
    return NextResponse.json({
      content,
      sessionId: session.sessionId,
      scanResults: scanResults ?? null,
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
    version: "3.4.0",
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
