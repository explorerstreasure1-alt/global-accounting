import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/tenant";
import { KilitEkrani } from "@/components/KilitEkrani";
import { MusteriSayfasi } from "@/components/MusteriSayfasi";

export const dynamic = "force-dynamic";

export default async function MusterilerPage() {
  const ctx = await getAuthContext();
  if (ctx.mode === "local") return <MusteriSayfasi />;
  if (!ctx.user || !ctx.business) redirect("/giris");
  if (!ctx.canUse) {
    return <KilitEkrani trialLeft={ctx.trialLeft} email={ctx.user.email} businessName={ctx.business.name} />;
  }
  return <MusteriSayfasi />;
}
