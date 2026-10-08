import { NextResponse } from "next/server";
import { getAyarlar, updateAyarlar } from "@/lib/data";
import type { Ayarlar } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const ayarlar = await getAyarlar();
  return NextResponse.json({ ayarlar });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as Partial<Ayarlar>;
  const ayarlar = await updateAyarlar(body);
  return NextResponse.json({ ayarlar });
}
