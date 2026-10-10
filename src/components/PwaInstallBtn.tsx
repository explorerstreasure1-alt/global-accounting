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
    if (mq.matches || iosKurulu) setKurulu(true);
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
export function PwaInstallBtn({ onRehber }: { onRehber?: () => void }) {
  const { t } = useT();
  const { davet, kurulu, kur } = usePwaKur();
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(iosMu());
  }, []);

  if (kurulu) return null;

  const dugme =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-500 sm:py-1.5";

  if (davet) {
    return (
      <button type="button" onClick={() => void kur()} title={t("install_app")} className={dugme}>
        <I name="download" size={15} /> {t("install_app")}
      </button>
    );
  }

  // iPhone: sistem daveti vermez, telefon penceresindeki adımlara yönlendir
  if (ios && onRehber) {
    return (
      <button type="button" onClick={onRehber} title={t("install_app")} className={dugme}>
        <I name="download" size={15} /> {t("install_app")}
      </button>
    );
  }

  return null;
}
