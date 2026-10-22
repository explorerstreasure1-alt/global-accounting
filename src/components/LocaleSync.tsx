"use client";

import { useEffect } from "react";
import { getLocale, LOCALES } from "@/lib/i18n";

/**
 * Çok dilli klavye desteği:
 * - Seçili dile göre <html lang>/<html dir> ayarlanır (SSR'de sabit "en" kalmasın).
 * - Tüm giriş alanlarına (input/textarea/select) lang ve dir öznitelikleri verilir;
 *   böylece mobil klavyeler doğru alfabeyle (Kiril, Arapça, Latin) açılır.
 * - Dinamik olarak sonradan eklenen giriş alanları da MutationObserver ile yakalanır.
 */
export function LocaleSync() {
  useEffect(() => {
    const uygula = (code: string) => {
      const meta = LOCALES.find((l) => l.code === code);
      const dir = meta?.dir || "ltr";
      document.documentElement.lang = code;
      document.documentElement.dir = dir;
      document.querySelectorAll("input, textarea, select").forEach((el) => {
        el.setAttribute("lang", code);
        el.setAttribute("dir", dir);
      });
    };

    uygula(getLocale());

    const degisim = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      if (code) uygula(code);
    };
    window.addEventListener("tailor-locale-change", degisim);

    // Yeni eklenen giriş alanlarını da yakala
    const gozlemci = new MutationObserver(() => {
      uygula(getLocale());
    });
    gozlemci.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("tailor-locale-change", degisim);
      gozlemci.disconnect();
    };
  }, []);

  return null;
}