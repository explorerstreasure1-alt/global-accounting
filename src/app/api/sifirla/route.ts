import { NextResponse } from "next/server";
import { resolveDb } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// POST: TÜM veriyi sıfırla (kayıtlar + açılış bakiyesi + kira + sohbet)
export async function POST() {
  const { db, gate } = await resolveDb();
  if (gate) return gate;
  try {
    const data = await db.sifirlaTumu();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
