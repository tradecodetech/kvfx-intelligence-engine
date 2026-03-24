/**
 * Memory Layer — Pinecone (vector search) + Supabase (persistent logs) + Upstash Redis (session cache)
 */

import { Pinecone } from "@pinecone-database/pinecone";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { generateEmbedding } from "./ai";
import { v4 as uuidv4 } from "uuid";

// ---------------------------------------------------------
// Clients
// ---------------------------------------------------------

function getPinecone(): Pinecone {
  return new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
  });
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
}

function getRedis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_URL!,
    token: process.env.UPSTASH_REDIS_TOKEN!,
  });
}

const PINECONE_INDEX = "kvfx-memory";
const SESSION_TTL = 60 * 60 * 24; // 24 hours

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

export interface ChatLog {
  id: string;
  session_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  mode: string;
  bias?: string;
  alignment_score?: number;
  created_at: string;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  mode: string;
  messages: { role: "user" | "assistant"; content: string }[];
  createdAt: number;
  lastActive: number;
}

// ---------------------------------------------------------
// Redis Session Management
// ---------------------------------------------------------

export async function getSession(sessionId: string): Promise<SessionData | null> {
  try {
    const redis = getRedis();
    const data = await redis.get<SessionData>(`session:${sessionId}`);
    return data;
  } catch (err) {
    console.error("[Redis] getSession error:", err);
    return null;
  }
}

export async function saveSession(sessionId: string, data: SessionData): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setex(`session:${sessionId}`, SESSION_TTL, JSON.stringify(data));
  } catch (err) {
    console.error("[Redis] saveSession error:", err);
  }
}

export async function createSession(userId: string, mode: string): Promise<SessionData> {
  const sessionId = uuidv4();
  const session: SessionData = {
    sessionId,
    userId,
    mode,
    messages: [],
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
  await saveSession(sessionId, session);
  return session;
}

export async function appendToSession(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) return;

  session.messages.push({ role, content });
  session.lastActive = Date.now();

  // Keep only last 20 messages in session cache
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20);
  }

  await saveSession(sessionId, session);
}

// ---------------------------------------------------------
// Supabase Persistent Logging
// ---------------------------------------------------------

export async function saveChatLog(
  sessionId: string,
  userId: string,
  role: "user" | "assistant",
  content: string,
  mode: string,
  bias?: string,
  alignmentScore?: number
): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from("chat_logs").insert({
      id: uuidv4(),
      session_id: sessionId,
      user_id: userId,
      role,
      content,
      mode,
      bias: bias ?? null,
      alignment_score: alignmentScore ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Supabase] saveChatLog error:", err);
  }
}

export async function saveTradeInsight(
  sessionId: string,
  userId: string,
  tradeIdea: string,
  aiResponse: string,
  bias: string,
  alignmentScore: number,
  mode: string
): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from("trade_logs").insert({
      id: uuidv4(),
      session_id: sessionId,
      user_id: userId,
      trade_idea: tradeIdea,
      ai_response: aiResponse,
      bias,
      alignment_score: alignmentScore,
      mode,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Supabase] saveTradeInsight error:", err);
  }
}

export async function getChatHistory(userId: string, limit = 50): Promise<ChatLog[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("chat_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as ChatLog[]) ?? [];
  } catch (err) {
    console.error("[Supabase] getChatHistory error:", err);
    return [];
  }
}

// ---------------------------------------------------------
// Pinecone Vector Memory
// ---------------------------------------------------------

export async function embedAndStore(
  text: string,
  metadata: {
    sessionId: string;
    userId: string;
    role: string;
    mode: string;
    timestamp: number;
  }
): Promise<void> {
  try {
    const pinecone = getPinecone();
    const index = pinecone.index(PINECONE_INDEX);

    const embedding = await generateEmbedding(text);
    const id = uuidv4();

    await index.upsert({
      records: [
        {
          id,
          values: embedding,
          metadata: {
            ...metadata,
            text: text.slice(0, 1000), // Pinecone metadata limit
          },
        },
      ],
    });
  } catch (err) {
    console.error("[Pinecone] embedAndStore error:", err);
  }
}

export async function retrieveRelevantContext(
  query: string,
  userId: string,
  topK = 5
): Promise<string> {
  try {
    const pinecone = getPinecone();
    const index = pinecone.index(PINECONE_INDEX);

    const embedding = await generateEmbedding(query);

    const results = await index.query({
      vector: embedding,
      topK,
      filter: { userId: { $eq: userId } },
      includeMetadata: true,
    });

    if (!results.matches || results.matches.length === 0) {
      return "";
    }

    const contextLines = results.matches
      .filter((m) => m.score && m.score > 0.75) // Only high-relevance matches
      .map((m) => {
        const meta = m.metadata as Record<string, string>;
        return `[${meta.role?.toUpperCase() ?? "MSG"} | ${meta.mode ?? ""}]: ${meta.text ?? ""}`;
      });

    if (contextLines.length === 0) return "";

    return `Relevant past conversations:\n${contextLines.join("\n")}`;
  } catch (err) {
    console.error("[Pinecone] retrieveRelevantContext error:", err);
    return "";
  }
}

// ---------------------------------------------------------
// Full Memory Pipeline (store + embed)
// ---------------------------------------------------------

export async function processAndStore(
  sessionId: string,
  userId: string,
  role: "user" | "assistant",
  content: string,
  mode: string,
  bias?: string,
  alignmentScore?: number
): Promise<void> {
  await Promise.allSettled([
    saveChatLog(sessionId, userId, role, content, mode, bias, alignmentScore),
    embedAndStore(content, {
      sessionId,
      userId,
      role,
      mode,
      timestamp: Date.now(),
    }),
  ]);
}
