import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatUI from "@/components/ChatUI";

export const metadata: Metadata = {
  title: "KVFX Intelligence Engine — Beta",
  description:
    "AI-powered trade intelligence using WhisperZonez zones and KVFX Algo v3. Bias, zones, liquidity, invalidation.",
};

export default async function AssistantPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware handles the redirect — this is a safety net
  if (!user) {
    redirect("/login");
  }

  // Read user tier from profile (defaults to "beta" if no profile yet)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  const tier = (profile?.tier as "beta" | "pro") ?? "beta";

  return (
    <ChatUI
      userEmail={user.email ?? ""}
      userId={user.id}
      userTier={tier}
    />
  );
}
