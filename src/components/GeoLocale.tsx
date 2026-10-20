"use client";

import { useEffect } from "react";
import { getLocale, setLocale, type LocaleCode } from "@/lib/i18n";

/**
 * İlk ziyarette (kullanıcı dil seçmemişse) IP/ülke tespitine göre dil seçer.
 * Kullanıcı elle dil seçerse (tailor-locale localStorage'da) bu etki çalışmaz.
 */
export function GeoLocale() {
  useEffect(() => {
    try {
      const mevcut = window.localStorage.getItem("tailor-locale");
      // Kullanıcı elle seçmişse (en değilse) ezme. "en" varsayılan ise ülke
      // tespitiyle değiştirilebilir — böylece ilk ziyarette doğru dile geçer.
      if (mevcut && mevcut !== "en") return;
    } catch {
      return;
    }
    let iptal = false;
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