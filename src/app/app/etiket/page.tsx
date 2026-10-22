import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/tenant";
import { KilitEkrani } from "@/components/KilitEkrani";
import { EtiketStudyosu } from "@/components/EtiketStudyosu";

export const dynamic = "force-dynamic";

export default async function EtiketPage() {
  const ctx = await getAuthContext();
  if (ctx.mode === "local") return <EtiketStudyosu />;
  if (!ctx.user || !ctx.business) redirect("/giris");
  if (!ctx.canUse) {
    return <KilitEkrani trialLeft={ctx.trialLeft} email={ctx.user.email} businessName={ctx.business.name} />;
  }
  return <EtiketStudyosu />;
}
