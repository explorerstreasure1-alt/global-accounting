"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { I, type IconName } from "./ui-icon";

const SAYFA_SAYISI = 3;

const IKON_SATIRLARI: Array<{ icon: IconName; key: string }> = [
  { icon: "calendar", key: "g2_calendar" },
  { icon: "day", key: "g2_day" },
  { icon: "month", key: "g2_month" },
  { icon: "report", key: "g2_z" },
  { icon: "excel", key: "g2_excel" },
  { icon: "report", key: "g2_word" },
  { icon: "report", key: "g2_pdf" },
  { icon: "print", key: "g2_print" },
  { icon: "backup", key: "g2_backup" },
  { icon: "phone", key: "g2_phone" },
  { icon: "settings", key: "g2_settings" },
];

export function KlavuzPaneli() {
  const { t } = useT();
  const [sayfa, setSayfa] = useState(0);

  return (
    <aside className="no-print flex min-h-0 flex-col overflow-hidden rounded-[28px] bg-black/25 text-amber-50 backdrop-blur-md xl:sticky xl:top-3 xl:max-h-[calc(100dvh-180px)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <I name="book" size={18} className="text-teal-200" />
        <p className="font-hand text-2xl leading-none text-teal-100">{t("guide_title")}</p>
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {sayfa === 0 ? (
          <>
            <p className="text-sm font-semibold text-amber-100">{t("guide_p1t")}</p>
            {t("guide_p1b").split("\n").map((satir, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-amber-50/90">
                {satir}
              </p>
            ))}
          </>
        ) : sayfa === 1 ? (
          <>
            <p className="text-sm font-semibold text-amber-100">{t("guide_p2t")}</p>
            <p className="text-[13px] leading-relaxed text-amber-50/90">{t("guide_p2b")}</p>
            <div className="space-y-1.5 pt-1">
              {IKON_SATIRLARI.map((s) => (
                <div key={s.key} className="flex items-start gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 ring-1 ring-white/10">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-teal-300/15 text-teal-200">
                    <I name={s.icon} size={15} />
                  </span>
                  <p className="text-[12.5px] leading-snug text-amber-50/90">{t(s.key)}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-amber-100">{t("guide_p3t")}</p>
            {t("guide_p3b").split("\n").map((satir, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-amber-50/90">
                {satir}
              </p>
            ))}
          </>
        )}
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <button
          onClick={() => setSayfa((s) => (s + SAYFA_SAYISI - 1) % SAYFA_SAYISI)}
          className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm hover:bg-white/20"
          aria-label="←"
        >
          ‹
        </button>
        {Array.from({ length: SAYFA_SAYISI }).map((_, i) => (
          <button
            key={i}
            onClick={() => setSayfa(i)}
            aria-label={`${i + 1}`}
            className={`h-2.5 rounded-full transition-all ${
              i === sayfa ? "w-6 bg-teal-300" : "w-2.5 bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
        <button
          onClick={() => setSayfa((s) => (s + 1) % SAYFA_SAYISI)}
          className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm hover:bg-white/20"
          aria-label="→"
        >
          ›
        </button>
      </div>
    </aside>
  );
}
