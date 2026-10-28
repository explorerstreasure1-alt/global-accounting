/**
 * Ham user-agent → okunur cihaz bilgisi.
 *
 * Bu modül hem sunucuda (özet tablolar) hem istemcide (panel etiketleri)
 * kullanılır; bu yüzden fs/db gibi sunucu bağımlılığı İÇERMEZ.
 */

export type CihazTuru = "Mobil" | "Tablet" | "Masaüstü" | "Bot" | "Bilinmiyor";

export type CihazBilgisi = {
  isletim: string;
  tarayici: string;
  tur: CihazTuru;
  uygulama: string;
};

const BOS: CihazBilgisi = { isletim: "", tarayici: "", tur: "Bilinmiyor", uygulama: "" };

/** Bot / otomatik araç trafiği mi? Panelde ayrı sayılır. */
export function botMu(ua?: string): boolean {
  if (!ua) return false;
  const s = ua.toLowerCase();
  return /bot|crawler|spider|headless|lighthouse|pagespeed|vercel-screenshot|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|discordbot|semrush|ahrefs|yandex/i.test(s);
}

/** UA'dan işletim sistemi, tarayıcı ve cihaz türünü çıkarır. */
export function cihazBilgisi(ua?: string): CihazBilgisi {
  if (!ua) return BOS;
  const s = ua.toLowerCase();

  const isletim = s.includes("windows phone")
    ? "Windows Phone"
    : s.includes("windows")
      ? "Windows"
      : s.includes("iphone") || s.includes("ipod")
        ? "iOS"
        : s.includes("ipad")
          ? "iPadOS"
          : s.includes("android")
            ? "Android"
            : s.includes("cros")
              ? "ChromeOS"
              : s.includes("mac os") || s.includes("macintosh")
                ? "macOS"
                : s.includes("freebsd")
                  ? "FreeBSD"
                  : s.includes("linux")
                    ? "Linux"
                    : "";

  const uygulama = s.includes("instagram")
    ? "Instagram"
    : s.includes("fbav") || s.includes("fban") || s.includes("fb_iab")
      ? "Facebook"
      : s.includes("linkedinapp")
        ? "LinkedIn"
        : s.includes("twitter")
          ? "X"
          : s.includes("tiktok")
            ? "TikTok"
            : s.includes("snapchat")
              ? "Snapchat"
              : "";

  const tarayici = s.includes("edg/") || s.includes("edgios") || s.includes("edga")
    ? "Edge"
    : s.includes("opr/") || s.includes("opios") || s.includes("opera")
      ? "Opera"
      : s.includes("samsungbrowser")
        ? "Samsung Internet"
        : s.includes("ucbrowser")
          ? "UC Browser"
          : s.includes("yabrowser")
            ? "Yandex"
            : s.includes("chrome") || s.includes("crios")
              ? "Chrome"
              : s.includes("firefox") || s.includes("fxios")
                ? "Firefox"
                : s.includes("safari")
                  ? "Safari"
                  : s.includes("msie") || s.includes("trident")
                    ? "Internet Explorer"
                    : "";

  let tur: CihazTuru = "Masaüstü";
  if (botMu(ua)) tur = "Bot";
  else if (s.includes("ipad") || (s.includes("android") && !s.includes("mobile"))) tur = "Tablet";
  else if (s.includes("iphone") || s.includes("ipod") || s.includes("android") || s.includes("mobile")) tur = "Mobil";
  else if (!isletim && !tarayici) tur = "Bilinmiyor";

  return { isletim, tarayici, tur, uygulama };
}

/** "Windows · Chrome" gibi kısa etiket. Bilinmeyen UA'da "Bilinmiyor". */
export function cihazEtiketi(ua?: string): string {
  const b = cihazBilgisi(ua);
  const parcalar = [b.isletim, b.tarayici, b.uygulama].filter(Boolean);
  return parcalar.join(" · ") || (ua ? "Diğer" : "Bilinmiyor");
}

export function isletimEtiketi(ua?: string): string {
  return cihazBilgisi(ua).isletim || "Bilinmiyor";
}

export function tarayiciEtiketi(ua?: string): string {
  return cihazBilgisi(ua).tarayici || "Bilinmiyor";
}

export function cihazTuru(ua?: string): CihazTuru {
  return cihazBilgisi(ua).tur;
}
