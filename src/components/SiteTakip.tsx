"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

/**
 * Site ziyaret takibi: her sayfa görüntülemesi bir olaydır.
 *
 * Aynı rota 3 saniye içinde ikinci kez tetiklenirse (React StrictMode'un
 * effect'i iki kez çalıştırması, hızlı yeniden render) tekrar sayılmaz.
 * Böylece gerçek gezinmeler sayılır, yapay çift kayıt oluşmaz.
 *
 * Oturum açmış kullanıcıda Supabase jetonu da gönderilir; sunucu jetonu
 * doğrulayıp e-postayı olaya ekler → panelde "kim hangi sayfayı açtı"
 * görünür. Anonim ziyaretçide e-posta boş kalır, IP/cihaz yine kaydedilir.
 */
let supa: ReturnType<typeof createClient> | null = null;

const TEKRAR_MS = 3000;
const DEPO_ANAHTARI = "takip-son-gonderim";

type SonGonderim = { yol: string; t: number };

export function SiteTakip() {
  const yol = usePathname();

  useEffect(() => {
    // Yönetici paneli kendi ziyaretini saymasın: müşteri metrikleri şişmesin.
    if (yol.startsWith("/admin")) return;

    try {
      const simdi = Date.now();
      let onceki: SonGonderim | null = null;
      try {
        const ham = window.sessionStorage.getItem(DEPO_ANAHTARI);
        if (ham) onceki = JSON.parse(ham) as SonGonderim;
      } catch {
        /* sessionStorage kapalı */
      }
      if (onceki && onceki.yol === yol && simdi - onceki.t < TEKRAR_MS) return;
      try {
        window.sessionStorage.setItem(DEPO_ANAHTARI, JSON.stringify({ yol, t: simdi } satisfies SonGonderim));
      } catch {
        /* yoksay */
      }

      void (async () => {
        let token = "";
        try {
          if (supabaseConfigured()) {
            supa = supa ?? createClient();
            const { data } = await supa.auth.getSession();
            token = data.session?.access_token || "";
          }
        } catch {
          /* anonim olarak devam */
        }
        try {
          await fetch("/api/admin/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ olay: "ziyaret", yol, token }),
            keepalive: true,
          });
        } catch {
          /* takip hatası kullanıcıyı bozmasın */
        }
      })();
    } catch {
      /* sessionStorage kapalıysa sessiz geç */
    }
  }, [yol]);

  return null;
}
