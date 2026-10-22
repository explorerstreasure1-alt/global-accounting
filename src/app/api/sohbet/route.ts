import { NextResponse } from "next/server";
import { handleChat } from "@/lib/ai";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  const data = await db.getInitData();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  let body: { message?: string; locale?: string; currency?: string };
  try {
    body = (await request.json()) as { message?: string; locale?: string; currency?: string };
  } catch {
    return NextResponse.json({ error: "Message could not be read" }, { status: 400 });
  }
  const message = String(body.message || "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }
  const locale = typeof body.locale === "string" ? body.locale : "en";
  const currency = typeof body.currency === "string" ? body.currency : undefined;
  const result = await handleChat(message, { locale, currency, db });
  return NextResponse.json(result);
}

// DELETE: sohbeti temizle (kayıtlara dokunmaz)
export async function DELETE(request: Request) {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  let locale = "en";
  try {
    const url = new URL(request.url);
    locale = url.searchParams.get("locale") || locale;
    const text = await request.text();
    if (text) {
      const body = JSON.parse(text) as { locale?: string };
      if (typeof body.locale === "string" && body.locale) locale = body.locale;
    }
  } catch { /* ignore */ }
  await db.temizleSohbet(locale);
  const data = await db.getInitData();
  return NextResponse.json({ ok: true, data });
}
