import { NextResponse } from "next/server";
import { getInitData, temizleSohbet } from "@/lib/data";
import { handleChat } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getInitData();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  let body: { message?: string };
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "Mesaj okunamadı" }, { status: 400 });
  }
  const message = String(body.message || "").trim();
  if (!message) {
    return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });
  }
  const result = await handleChat(message);
  return NextResponse.json(result);
}

// DELETE: sohbeti temizle (kayıtlara dokunmaz)
export async function DELETE() {
  await temizleSohbet();
  const data = await getInitData();
  return NextResponse.json({ ok: true, data });
}
