/**
 * Ülke / IP / cihaz tespiti (sunucu tarafı).
 * - Vercel başlığı (x-vercel-ip-country) varsa doğrudan kullanılır.
 * - Yoksa IP ücretsiz bir servisle çözülür; sonuç IP başına 1 saat önbelleklenir.
 * - IPv6 adresler kırpılmaz; özel/yerel IP'ler için dış servise gidilmez.
 * - Dış istekler 2,5 sn zaman aşımına sahiptir: takip ucu asla asılı kalmaz.
 */

export function ipTespit(req: Request): string {
  const ham =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  if (!ham) return "";
  // IPv4:port → portu at. IPv6'ya dokunma.
  const v4 = ham.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  const temiz = (v4 ? v4[1] : ham).replace(/^\[|\]$/g, "").trim();
  return temiz.slice(0, 64);
}

/** Panelde "Windows · Chrome" gibi gösterilmek üzere ham user-agent (kısaltılmış). */
export function cihazTespit(req: Request): string {
  return (req.headers.get("user-agent") || "").slice(0, 300);
}

export function vercelUlke(req: Request): string {
  const kod = (req.headers.get("x-vercel-ip-country") || "").toUpperCase();
  return /^[A-Z]{2}$/.test(kod) ? kod : "";
}

/** Özel / yerel IP: dış ülke servisine sormaya gerek yok. */
function ozelIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "::" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip.startsWith("169.254.") || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  return false;
}

async function zamanliFetch(url: string, ms = 2500): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const onbellek = new Map<string, { ulke: string; t: number }>();
const ONBELLEK_MS = 60 * 60 * 1000; // 1 saat

export async function ulkeTespit(req: Request): Promise<string> {
  const baskan = vercelUlke(req);
  if (baskan) return baskan;

  const ip = ipTespit(req);
  if (!ip || ozelIp(ip)) return "";

  const kayit = onbellek.get(ip);
  if (kayit && Date.now() - kayit.t < ONBELLEK_MS) return kayit.ulke;

  const kaynaklar: (() => Promise<string>)[] = [
    async () => {
      const r = await zamanliFetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=country_code`);
      if (!r.ok) return "";
      const j = (await r.json()) as { country_code?: string; success?: boolean };
      return j.success === false ? "" : (j.country_code || "").toUpperCase();
    },
    async () => {
      const r = await zamanliFetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json`);
      if (!r.ok) return "";
      const j = (await r.json()) as { country?: string };
      return (j.country || "").toUpperCase();
    },
  ];
  for (const k of kaynaklar) {
    try {
      const kod = await k();
      if (kod && /^[A-Z]{2}$/.test(kod)) {
        // Bellek sızmasın: 5.000'den fazla IP birikirse eski kayıtları temizle.
        if (onbellek.size > 5000) {
          const simdi = Date.now();
          for (const [anahtar, deger] of onbellek) {
            if (simdi - deger.t > ONBELLEK_MS) onbellek.delete(anahtar);
          }
          if (onbellek.size > 8000) onbellek.clear();
        }
        onbellek.set(ip, { ulke: kod, t: Date.now() });
        return kod;
      }
    } catch {
      /* sıradaki kaynağa geç */
    }
  }
  return "";
}
