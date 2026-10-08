import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { getInitData, restoreSnapshot } from "@/lib/data";
import { fileGetAll, getBackupDir, hafizaDurumu } from "@/lib/file-store";
import type { Ayarlar, Kayit, SohbetMesaji } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET: hafıza durumu + tam yedek JSON indir (?indir=1)
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("indir") === "1") {
    const data = await fileGetAll();
    const body = JSON.stringify(
      { uygulama: "Mgroq Defter", tarih: new Date().toISOString(), ...data },
      null,
      2,
    );
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mgroq-yedek-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }
  const durum = await hafizaDurumu();
  // yedek listesi (dış veri klasöründen)
  let yedekler: string[] = [];
  try {
    const files = await fs.readdir(getBackupDir());
    yedekler = files.filter((f) => f.startsWith("yedek-")).sort().reverse().slice(0, 30);
  } catch {
    yedekler = [];
  }
  return NextResponse.json({ ...durum, yedekler });
}

// POST: yedek geri yükle {kayitlar, ayarlar, mesajlar}
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      kayitlar?: unknown;
      ayarlar?: unknown;
      mesajlar?: unknown;
    };
    if (!Array.isArray(body.kayitlar) || typeof body.ayarlar !== "object" || !body.ayarlar) {
      return NextResponse.json({ error: "Geçersiz yedek dosyası" }, { status: 400 });
    }
    const mevcut = await getInitData();
    await restoreSnapshot({
      kayitlar: body.kayitlar as Kayit[],
      ayarlar: body.ayarlar as Ayarlar,
      mesajlar: Array.isArray(body.mesajlar) ? (body.mesajlar as SohbetMesaji[]) : mevcut.mesajlar,
    });
    const durum = await hafizaDurumu();
    return NextResponse.json({ ok: true, ...durum });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
