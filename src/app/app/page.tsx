import { LedgerApp } from "@/components/LedgerApp";
import { getInitData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const initial = await getInitData();
  return <LedgerApp initial={initial} />;
}
