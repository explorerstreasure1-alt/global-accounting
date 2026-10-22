// Defterdar - Ultra hafif hazirlik sinyali.
// /api/health sunucu tarafinda veritabani, Ollama ve dosya deposunu taradigi icin
// 1-3 saniye surebiliyor. Masaustu ikonu yalnizca "sunucu ayakta mi?" diye soruyor,
// o yuzden burada hicbir sey okunmuyor: sadece HTTP 200 doner (~1-5 ms).
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response("ok", {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}