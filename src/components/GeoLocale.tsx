"use client";

import { useEffect } from "react";
import { getLocale, setLocale, type LocaleCode } from "@/lib/i18n";

/**
 * İlk ziyarette (kullanıcı dil seçmemişse) IP/ülke tespitine göre dil seçer.
 * Kullanıcı elle dil seçerse (tailor-locale localStorage'da) bu etki çalışmaz.
 */
export function GeoLocale() {
  useEffect(() => {
    let iptal = false;
    try {
      // Kullanıcı dile elle dokunduysa (kilit) ülke tespiti karışmaz.
      if (window.localStorage.getItem("tailor-locale-lock") === "1") return;
    } catch {
      return;
    }
    // Kilitsizduyru: her ziyarette ülkeye göre dil yenilenir.
    fetch("/api/geo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { locale?: string } | null) => {
        if (iptal || !j?.locale) return;
        const code = j.locale as LocaleCode;
        setLocale(code);
      })
      .catch(() => {});
    return () => {
      iptal = true;
    };
  }, []);
  return null;
}