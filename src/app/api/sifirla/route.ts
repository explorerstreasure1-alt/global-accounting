import { NextResponse } from "next/server";
import { sifirlaTumu } from "@/lib/data";

export const dynamic = "force-dynamic";

// POST: TÜM veriyi sıfırla (kayıtlar + açılış bakiyesi + kira + sohbet)
export async function POST() {
  try {
    const data = await sifirlaTumu();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
