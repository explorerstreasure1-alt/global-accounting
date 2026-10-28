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
const OTURUM_ANAHTARI = "takip-son-oturum";
const OTURUM_ARALIK_MS = 12 * 60 * 60 * 1000; // 12 saat

type SonGonderim = { yol: string; t: number };

/** Anonim ziyaretçide her sayfada ekstra istek atmayı engelleyen kısa bekleme. */
let sonOturumDenemesi = 0;

/**
 * Oturumu açık kullanıcıyı "giriş" olarak bildir.
 *
 * Kullanıcı çerezle günlerce içeride kalabildiği için /giris'i tekrar
 * görmüyor ve panelde "giriş yapan" listesi boş kalıyordu. Burada 12 saatte
 * bir bildirilir; anonim ziyaretçiyi sunucu reddeder (atlandi) ve işaret
 * konmaz, böylece kullanıcı giriş yapınca ilk sayfada kayıt düşer.
 */
async function oturumBildir(token: string): Promise<void> {
  try {
    const simdi = Date.now();
    if (simdi - sonOturumDenemesi < 5 * 60 * 1000) return;
    sonOturumDenemesi = simdi;
    try {
      const ham = window.localStorage.getItem(OTURUM_ANAHTARI);
      if (ham) {
        const onceki = JSON.parse(ham) as { t?: number };
        if (typeof onceki.t === "number" && simdi - onceki.t < OTURUM_ARALIK_MS) return;
      }
    } catch {
      /* localStorage kapalı */
    }
    const r = await fetch("/api/admin/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ olay: "giris", kaynak: "parola", token }),
      keepalive: true,
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; atlandi?: boolean } | null;
    if (j?.ok && !j.atlandi) {
      try {
        window.localStorage.setItem(OTURUM_ANAHTARI, JSON.stringify({ t: simdi }));
      } catch {
        /* yoksay */
      }
    }
  } catch {
    /* takip hatası kullanıcıyı bozmasın */
  }
}

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
        // Oturum kaydı ayrıca gitsin: panelde "giriş yapan" listesi dolsun.
        void oturumBildir(token);
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
