import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("ENV CHECK → URL:", url ? "✅ Loaded" : "❌ Missing");
console.log("ENV CHECK → KEY:", key ? "✅ Loaded" : "❌ Missing");

if (!url || !key) {
  console.error("❌ Supabase env missing — DB operations will fail at runtime");
}

// Creates a properly-typed client. If env vars are missing, all operations
// will return API errors (caught by the try/catch blocks in each route).
export const supabase = createClient(
  url ?? "http://localhost:54321",
  key ?? "placeholder-key-not-configured"
);
