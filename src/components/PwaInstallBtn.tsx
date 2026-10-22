"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { I } from "./ui-icon";

type PromptOlay = { prompt: () => void; userChoice: Promise<{ outcome: string }> };

/** Tarayıcının kurulum davetini yakalar; kuruluysa gizler. */
export function usePwaKur() {
  const [olay, setOlay] = useState<PromptOlay | null>(null);
  const [kurulu, setKurulu] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const iosKurulu = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const h = setTimeout(() => {
      if (mq.matches || iosKurulu) setKurulu(true);
    }, 0);
    const degisim = (e: MediaQueryListEvent) => {
      if (e.matches) setKurulu(true);
    };
    mq.addEventListener("change", degisim);
    const yakala = (e: Event) => {
      e.preventDefault();
      setOlay(e as unknown as PromptOlay);
    };
    window.addEventListener("beforeinstallprompt", yakala);
    return () => {
      clearTimeout(h);
      mq.removeEventListener("change", degisim);
      window.removeEventListener("beforeinstallprompt", yakala);
    };
  }, []);

  async function kur(): Promise<"ok" | "iptal" | "hata" | "menu"> {
    if (!olay) return "menu";
    try {
      olay.prompt();
      const secim = await olay.userChoice;
      if (secim.outcome === "accepted") {
        setOlay(null);
        return "ok";
      }
      return "iptal";
    } catch {
      return "hata";
    }
  }

  return { davet: olay, kurulu, kur };
}

export function iosMu(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Toolbar'ın en başına konan göz önünde kurulum düğmesi. Kuruluysa kendini gizler. */
export function PwaInstallBtn() {
  const { t } = useT();
  const { davet, kurulu, kur } = usePwaKur();

  if (kurulu) return null;

  const dugme =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 sm:py-1.5";

  // Davet varsa tek dokunuşla kur; yoksa kurulum panelini aç (adımlar orada).
  async function tikla() {
    if (davet) {
      const s = await kur();
      if (s === "ok") return;
    }
    try {
      window.dispatchEvent(new CustomEvent("tailor-kurulum-ac"));
    } catch {
      /* yoksay */
    }
  }

  return (
    <button type="button" onClick={() => void tikla()} title={t("install_app")} className={dugme}>
      <I name="download" size={15} /> {t("install_app")}
    </button>
  );
}

function pcMi(): boolean {
  if (typeof navigator === "undefined") return false;
  return !/mobi|android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Giriş-sonrası kurulum paneli: kurulu değilse ve daha önce kapatılmadıysa
 * bir kez otomatik açılır. Tek dokunuşla kurar (davet varsa), yoksa
 * cihaza göre adımları gösterir (iPhone paylaş menüsü / PC tarayıcı menüsü).
 */
export function KurulumModal() {
  const { t } = useT();
  const { davet, kurulu, kur } = usePwaKur();
  const [acik, setAcik] = useState(false);
  const [ios, setIos] = useState(false);
  const [pc, setPc] = useState(false);
  const [sonuc, setSonuc] = useState<string | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setIos(iosMu()), 0);
    const h2 = setTimeout(() => setPc(pcMi()), 0);
    const disaridanAc = () => setAcik(true);
    window.addEventListener("tailor-kurulum-ac", disaridanAc);
    let iptal = false;
    let hAuto: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!window.localStorage.getItem("tailor-kurulum-kapali")) {
        hAuto = setTimeout(() => {
          if (!iptal) setAcik(true);
        }, 1500);
      }
    } catch {
      /* yoksay */
    }
    return () => {
      iptal = true;
      clearTimeout(h);
      clearTimeout(h2);
      if (hAuto) clearTimeout(hAuto);
      window.removeEventListener("tailor-kurulum-ac", disaridanAc);
    };
  }, []);

  if (kurulu || !acik) return null;

  function kapat() {
    setAcik(false);
    try {
      window.localStorage.setItem("tailor-kurulum-kapali", "1");
    } catch {
      /* yoksay */
    }
  }

  async function yukle() {
    const s = await kur();
    if (s === "ok") {
      kapat();
    } else if (s === "iptal") {
      setSonuc(t("pwa_iptal"));
    } else {
      setSonuc(t("pwa_menu"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="scroll-thin my-auto max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-[#fafafa] p-6 text-center shadow-2xl">
        <img src="/images/logo-192.png" alt="Shop Ledger" className="mx-auto h-16 w-16 rounded-2xl shadow" />
        <p className="font-hand mt-2 text-3xl text-slate-900">{t("pwa_baslik")}</p>
        <p className="mt-1 text-xs text-slate-600">{t("pwa_tek")}</p>
        {davet ? (
          <button
            type="button"
            onClick={() => void yukle()}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow hover:bg-emerald-500"
          >
            <I name="download" size={16} /> {t("install_app")}
          </button>
        ) : (
          <p className="mt-4 rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
            {ios ? t("pwa_ios") : pc ? t("pwa_pc") : t("pwa_menu")}
          </p>
        )}
        {sonuc ? <p className="mt-2 text-xs text-slate-600">{sonuc}</p> : null}
        <button type="button" onClick={kapat} className="mt-3 rounded-lg px-4 py-2 text-sm text-slate-600">
          {t("common_close")}
        </button>
      </div>
    </div>
  );
}
