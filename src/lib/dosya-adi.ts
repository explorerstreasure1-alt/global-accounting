/**
 * HTTP `Content-Disposition` başlığı üretir.
 *
 * Başlık değerleri yalnızca ASCII/Latin-1 taşıyabilir; Arapça, Kiril, İbranice
 * veya Türkçe özel karakterler doğrudan yazılırsa `NextResponse` hata fırlatır
 * ve indirme 500 döner. Bu yardımcı, RFC 6266 uyumlu iki parçalı biçim üretir:
 *   filename="ascii-yedek"; filename*=UTF-8''yuzde-kodlanmis-orijinal
 */
const TR_HARF: Record<string, string> = {
  ç: "c",
  Ç: "C",
  ğ: "g",
  Ğ: "G",
  ı: "i",
  İ: "I",
  ö: "o",
  Ö: "O",
  ş: "s",
  Ş: "S",
  ü: "u",
  Ü: "U",
};

export function icerikYerlesimi(ad: string): string {
  const ascii = ad
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (h) => TR_HARF[h] ?? h)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  const yedek = ascii || "rapor";
  const orijinal = encodeURIComponent(ad).replace(/'/g, "%27");
  return `attachment; filename="${yedek}"; filename*=UTF-8''${orijinal}`;
}
