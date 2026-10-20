"use client";

import { useT } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useT();
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <div className="text-center">
        <p className="text-6xl font-extrabold text-slate-300">404</p>
        <h1 className="mt-4 text-2xl font-bold text-slate-800">{t("notfound_title") || "Sayfa bulunamadı"}</h1>
        <p className="mt-2 text-sm text-slate-500">{t("notfound_sub") || "Aradığınız sayfa mevcut değil veya taşınmış."}</p>
        <a href="/" className="mt-6 inline-block rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700">
          {t("notfound_home") || "Ana sayfaya dön"}
        </a>
      </div>
    </div>
  );
}