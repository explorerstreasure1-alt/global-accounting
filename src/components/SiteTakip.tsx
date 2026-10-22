"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Site ziyaret takibi: her rota sekme oturumu içinde 1 kez kaydedilir.
 * Yönetici paneli (/admin) günlük tabloları bu kayıtlardan kurar.
 */
export function SiteTakip() {
  const yol = usePathname();

  useEffect(() => {
    let iptal = false;
    try {
      const anahtar = "takip-rotalar";
      const ham = window.sessionStorage.getItem(anahtar);
      const rota = ham ? (JSON.parse(ham) as string[]) : [];
      if (rota.includes(yol)) return;
      // Yol sekme oturumunda ilk kez açılıyorsa kaydet
      fetch("/api/admin/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ olay: "ziyaret", yol }),
        keepalive: true,
      }).catch(() => {});
      rota.push(yol);
      try {
        window.sessionStorage.setItem(anahtar, JSON.stringify(rota.slice(-60)));
      } catch {
        /* yoksay */
      }
      if (iptal) return;
    } catch {
      /* sessionStorage kapalıysa sessiz geç */
    }
    return () => {
      iptal = true;
    };
  }, [yol]);

  return null;
}
