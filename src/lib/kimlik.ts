/**
 * İstemciden gelen Supabase erişim jetonunu SUNUCUDA doğrular.
 *
 * Neden: eskiden /api/admin/track gövdedeki `email` alanına güveniyordu;
 * herkes istediği e-postayla sahte "giriş" yazıp yönetici istatistiklerini
 * şişirebiliyordu. Artık e-posta yalnızca imzalı jetondan okunur.
 *
 * Her sayfa açılışında Supabase'e ayrı istek atmamak için jeton→kimlik
 * sonucu kısa süre (2 dk) bellekte tutulur. Anahtar jetonun SHA-256 özetidir;
 * ham jeton saklanmaz.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export type Kimlik = { email: string; kaynak: "google" | "parola"; yeni: boolean };

const ONBELLEK_MS = 2 * 60 * 1000;
const onbellek = new Map<string, { kimlik: Kimlik | null; t: number }>();

function onbellekAnahtari(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function onbellekYaz(anahtar: string, kimlik: Kimlik | null): void {
  if (onbellek.size > 2000) {
    const simdi = Date.now();
    for (const [k, v] of onbellek) {
      if (simdi - v.t > ONBELLEK_MS) onbellek.delete(k);
    }
  }
  if (onbellek.size > 4000) onbellek.clear();
  onbellek.set(anahtar, { kimlik, t: Date.now() });
}

export async function tokenSahibi(token?: string | null): Promise<Kimlik | null> {
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const anahtar = onbellekAnahtari(token);
  const kayit = onbellek.get(anahtar);
  if (kayit && Date.now() - kayit.t < ONBELLEK_MS) return kayit.kimlik;

  try {
    const supa = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data.user?.email) {
      onbellekYaz(anahtar, null);
      return null;
    }
    const saglayici = String(
      (data.user.app_metadata as { provider?: string } | undefined)?.provider || "",
    );
    const kimlik: Kimlik = {
      email: data.user.email.toLowerCase().slice(0, 200),
      kaynak: saglayici === "google" ? "google" : "parola",
      // Son 10 dakikada oluşturulmuş hesap → "yeni kayıt" olarak işaretlenebilir.
      yeni: Date.now() - new Date(data.user.created_at).getTime() < 10 * 60 * 1000,
    };
    onbellekYaz(anahtar, kimlik);
    return kimlik;
  } catch {
    // Ağ hatasını önbelleğe alma: geçici sorun 2 dakika boyunca sürmesin.
    return null;
  }
}
