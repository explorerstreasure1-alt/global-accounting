import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supa = await createClient();
    await supa.auth.signOut();
  } catch { /* ignore */ }
  redirect("/giris");
}
