import { redirect } from "next/navigation";
import { LedgerApp } from "@/components/LedgerApp";
import { KilitEkrani } from "@/components/KilitEkrani";
import { getInitData } from "@/lib/data";
import { getAuthContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { tenantDb } from "@/lib/data-tenant";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const ctx = await getAuthContext();

  // Tek-kullanıcı modu (Supabase bağlı değil): eski davranış
  if (ctx.mode === "local") {
    const initial = await getInitData();
    return <LedgerApp initial={initial} />;
  }

  if (!ctx.user || !ctx.business) redirect("/giris");

  // Trial bitti + free plan → full kilit
  if (!ctx.canUse) {
    return <KilitEkrani trialLeft={ctx.trialLeft} email={ctx.user.email} businessName={ctx.business.name} />;
  }

  const supa = await createClient();
  const db = tenantDb(supa, ctx.business.id, ctx.business.name);
  const initial = await db.getInitData();
  const trial =
    ctx.business.plan === "pro"
      ? undefined
      : { gun: ctx.trialLeft, email: ctx.user.email };
  const sub = { plan: ctx.business.plan, gun: ctx.trialLeft, email: ctx.user.email };
  return <LedgerApp initial={initial} trial={trial} sub={sub} />;
}
