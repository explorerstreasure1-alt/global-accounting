/**
 * Ülke tespiti (sunucu tarafı) — Vercel başlığı → ücretsiz API yedeki.
 * ip-api.com ücretsiz kota sınırı IP başına dakikada ~45 istek olduğu için
 * sonuç IP başına 1 saat önbelleklenir; tüm uçlar (geo, takip) burayı kullanır.
 */

export function vercelUlke(req: Request): string {
  return (req.headers.get("x-vercel-ip-country") || "").toUpperCase();
}

const onbellek = new Map<string, { ulke: string; t: number }>();
const ONBELLEK_MS = 60 * 60 * 1000; // 1 saat

export async function ulkeTespit(req: Request): Promise<string> {
  const baskan = vercelUlke(req);
  if (baskan) return baskan;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  if (!ip) return "";

  const sorgu = ip.split(":")[0]; // IPv6 pool varyasyonlarını azalt
  const kayit = onbellek.get(sorgu);
  if (kayit && Date.now() - kayit.t < ONBELLEK_MS) return kayit.ulke;

  const kaynaklar: (() => Promise<string>)[] = [
    async () => {
      const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(sorgu)}?fields=countryCode`, { cache: "no-store" });
      if (!r.ok) return "";
      const j = (await r.json()) as { countryCode?: string };
      return (j.countryCode || "").toUpperCase();
    },
    async () => {
      const r = await fetch(`https://ipinfo.io/${encodeURIComponent(sorgu)}/json`, { cache: "no-store" });
      if (!r.ok) return "";
      const j = (await r.json()) as { country?: string };
      return (j.country || "").toUpperCase();
    },
  ];
  for (const k of kaynaklar) {
    try {
      const kod = await k();
      if (kod) {
        onbellek.set(sorgu, { ulke: kod, t: Date.now() });
        return kod;
      }
    } catch {
      /* sıradaki kaynağa geç */
    }
  }
  return "";
}
