import { createHash, timingSafeEqual } from "crypto";

/**
 * Yönetici paneli oturum yardımcıları.
 * - Şifre: env ADMIN_PASSWORD (yoksa yerel geliştirme varsayılanı)
 * - Çerez: "admin-ses" = sha256(admin oturum imzasu) — httpOnly, 8 saat
 */

export function adminSifre(): string {
  return process.env.ADMIN_PASSWORD || "defterdar-admin";
}

export const ADMIN_COOKIE = "admin-ses";

export function oturumToken(): string {
  return createHash("sha256").update(`admin::${adminSifre()}::oturum`).digest("hex");
}

export function adminOturumGecerli(cookieDegeri: string | undefined | null): boolean {
  if (!cookieDegeri) return false;
  const a = Buffer.from(cookieDegeri, "hex");
  const b = Buffer.from(oturumToken(), "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Şifre karşılaştırması (zaman-güvenli). */
export function sifreDogru(gelen: string): boolean {
  const a = createHash("sha256").update(gelen ?? "").digest();
  const b = createHash("sha256").update(adminSifre()).digest();
  return timingSafeEqual(a, b);
}
