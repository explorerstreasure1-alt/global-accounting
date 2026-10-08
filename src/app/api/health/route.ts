import { db, hasDatabase } from "@/db";
import { sql } from "drizzle-orm";
import { hafizaDurumu } from "@/lib/file-store";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  if (hasDatabase && db) {
    try {
      await db.execute(sql`select 1`);
      dbOk = true;
    } catch {
      dbOk = false;
    }
  }
  const hafiza = await hafizaDurumu().catch(() => null);
  let ollama: { acik: boolean; model: string } = { acik: false, model: process.env.OLLAMA_MODEL || "gemma3:4b" };
  if (process.env.OLLAMA_ANLATIM !== "0") {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${process.env.OLLAMA_URL || "http://localhost:11434"}/api/tags`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const j = (await res.json()) as { models?: { name?: string }[] };
        const isimler = (j.models || []).map((m) => m.name || "");
        ollama = { acik: isimler.some((n) => n === ollama.model || n.startsWith(`${ollama.model}:`)), model: ollama.model };
      }
    } catch {
      ollama = { acik: false, model: ollama.model };
    }
  }
  return Response.json({
    ok: true,
    db: dbOk,
    mod: hasDatabase && dbOk ? "postgres" : "dosya",
    groq: Boolean(process.env.GROQ_API_KEY),
    ollama,
    hafiza,
  });
}
