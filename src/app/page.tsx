"use client";

import { GlobalBar } from "@/components/GlobalBar";
import { Pricing } from "@/components/Pricing";
import { AnimatedLedgerBg } from "@/components/AnimatedLedgerBg";
import { I } from "@/components/ui-icon";
import { useT } from "@/lib/i18n";

const IKONLAR = ["report", "excel", "globe"] as const;
const MESLEKLER = ["land_p1", "land_p2", "land_p3", "land_p4", "land_p5", "land_p6", "land_p7", "land_p8"] as const;

export default function Landing() {
  const { t } = useT();
  const ozellikler = [
    { icon: IKONLAR[0], baslik: t("land_f1t"), aciklama: t("land_f1d") },
    { icon: IKONLAR[1], baslik: t("land_f2t"), aciklama: t("land_f2d") },
    { icon: IKONLAR[2], baslik: t("land_f3t"), aciklama: t("land_f3d") },
  ];
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <AnimatedLedgerBg />
      <div className="relative mx-auto max-w-5xl px-5 py-8">
        <GlobalBar compact />
        <header className="mt-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">{t("land_eyebrow")}</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-6xl">
            {t("land_h1a")}
            <br />
            {t("land_h1b")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">{t("land_sub")}</p>
          <div className="mt-6 flex justify-center gap-3">
            <a href="/app" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              {t("land_open")}
            </a>
            <a href="#pricing" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold hover:border-slate-900">
              {t("land_pricing_btn")}
            </a>
          </div>
        </header>

        <section className="mt-12 grid gap-3 md:grid-cols-3">
          {ozellikler.map((o) => (
            <div key={o.baslik} className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-teal-700"><I name={o.icon} size={26} /></p>
              <p className="mt-2 font-bold">{o.baslik}</p>
              <p className="mt-1 text-sm text-slate-600">{o.aciklama}</p>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <h2 className="text-center text-2xl font-bold">{t("land_who_t")}</h2>
          <p className="mx-auto mt-1 max-w-2xl text-center text-sm text-slate-500">{t("land_who_sub")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {MESLEKLER.map((k) => (
              <span key={k} className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white">
                {t(k)}
              </span>
            ))}
          </div>
        </section>

        <section id="pricing" className="mt-12">
          <h2 className="text-center text-2xl font-bold">{t("land_price_t")}</h2>
          <p className="mt-1 text-center text-sm text-slate-500">{t("land_price_sub")}</p>
          <div className="mt-6">
            <Pricing />
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          Shop Ledger · <a className="underline" href="/app">{t("land_open")}</a>
        </footer>
      </div>
    </div>
  );
}
