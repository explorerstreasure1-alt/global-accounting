"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

export const MESLEKLER = [
  "terzi",
  "berber",
  "tamirci",
  "market",
  "kafe",
  "atolye",
  "freelancer",
  "diger",
] as const;

export type Meslek = (typeof MESLEKLER)[number];

export const MESLEK_ETIKET: Record<Meslek, string> = {
  terzi: "Terzi / Dikim",
  berber: "Berber / Kuaför",
  tamirci: "Tamirci",
  market: "Market / Bakkal",
  kafe: "Kafe / Restoran",
  atolye: "Atölye / Üretim",
  freelancer: "Serbest çalışan",
  diger: "Diğer",
};

/** Mesleğe göre önerilen hizmet çeşitleri. */
export const MESLEK_HIZMETLERI: Record<Meslek, string[]> = {
  terzi: ["Dikim", "Tadilat", "Ütü", "Daraltma", "Uzatma", "Astar"],
  berber: ["Saç kesimi", "Sakal", "Boya", "Bakım", "Yıkama"],
  tamirci: ["Tamir", "Bakım", "Parça değişimi", "Arıza tespit", "Montaj"],
  market: ["Satış", "İade", "Toplu alım"],
  kafe: ["İçecek", "Yemek", "Tatlı", "Paket servis"],
  atolye: ["Üretim", "Tamir", "Montaj", "Boya"],
  freelancer: ["Danışmanlık", "Tasarım", "Geliştirme", "Bakım", "Eğitim"],
  diger: [],
};

export function meslekEtiket(code: string): string {
  return MESLEK_ETIKET[code as Meslek] ?? code;
}

export function meslekHizmetleri(code: string): string[] {
  return MESLEK_HIZMETLERI[code as Meslek] ?? [];
}

type Props = {
  open: boolean;
  ilkMeslek?: string;
  onKaydet: (meslek: string, hizmetSecimiAcik: boolean, digerHizmet?: string) => void;
  onAtla: () => void;
};

export function MeslekAnketi({ open, ilkMeslek, onKaydet, onAtla }: Props) {
  const { t } = useT();
  const [secim, setSecim] = useState<Meslek>((ilkMeslek as Meslek) || "terzi");
  const [diger, setDiger] = useState("");
  const [acik, setAcik] = useState(true);

  if (!open) return null;

  const digerSecili = secim === "diger";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <p className="font-hand text-3xl text-slate-900">{t("anket_baslik") || "Mesleğiniz nedir?"}</p>
        <p className="mt-1 text-xs text-slate-500">{t("anket_aciklama") || "Uygulama hizmet çeşitlerini mesleğinize göre ayarlar."}</p>

        <div className="mt-4 grid gap-2">
          {MESLEKLER.map((m) => (
            <label
              key={m}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                secim === m ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
              }`}
            >
              <input
                type="radio"
                name="meslek"
                value={m}
                checked={secim === m}
                onChange={() => setSecim(m)}
                className="accent-teal-600"
              />
              <span>{MESLEK_ETIKET[m]}</span>
            </label>
          ))}
        </div>

        {digerSecili ? (
          <label className="mt-3 block text-sm">
            {t("anket_diger_hizmet") || "Hizmetinizi yazın"}
            <input
              type="text"
              value={diger}
              onChange={(e) => setDiger(e.target.value)}
              placeholder="Örn: Fotoğrafçılık, Temizlik..."
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
        ) : null}

        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">{t("anket_hizmet_secimi") || "Hizmet seçimi"}</p>
            <p className="text-xs text-slate-500">
              {acik
                ? (t("anket_acik_aciklama") || "Açık: hizmet çeşitlerini seçebilirsiniz.")
                : (t("anket_kapali_aciklama") || "Kapalı: tümü 'Hizmet' işaretlenir, ne olduğunu siz yazarsınız.")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAcik((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition ${acik ? "bg-teal-600" : "bg-slate-300"}`}
            aria-pressed={acik}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${acik ? "left-5" : "left-0.5"}`} />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onAtla}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            {t("anket_atla") || "Atla"}
          </button>
          <button
            type="button"
            onClick={() => onKaydet(secim === "diger" ? (diger.trim() || "diger") : secim, acik, digerSecili ? diger.trim() : undefined)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
          >
            {t("anket_kaydet") || "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}