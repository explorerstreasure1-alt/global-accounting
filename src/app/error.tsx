"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <div className="text-center">
        <p className="text-6xl font-extrabold text-rose-300">!</p>
        <h1 className="mt-4 text-2xl font-bold text-slate-800">{t("error_title") || "Bir hata oluştu"}</h1>
        <p className="mt-2 text-sm text-slate-500">{t("error_sub") || "Beklenmedik bir sorun oluştu. Tekrar deneyin."}</p>
        <button
          onClick={() => reset()}
          className="mt-6 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {t("error_retry") || "Tekrar dene"}
        </button>
      </div>
    </div>
  );
}