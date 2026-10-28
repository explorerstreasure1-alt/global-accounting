"use client";

import { useState, useEffect } from "react";
import { Download, Monitor, Smartphone } from "lucide-react";
import { useT } from "@/lib/i18n";

export function InstallPWA() {
  const { t } = useT();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
      setShowMenu(true); // Otomatik menüyü aç
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstall(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }

  function toggleMenu() {
    setShowMenu(!showMenu);
  }

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!showMenu ? (
        <button
          onClick={toggleMenu}
          className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-2xl hover:bg-slate-800 transition-all"
        >
          {isMobile ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
          {t("install_app") || "Install App"}
        </button>
      ) : (
        <div className="rounded-2xl bg-white shadow-2xl p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">{t("pwa_baslik") || "Install the app"}</h3>
            <button onClick={toggleMenu} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <p className="text-xs text-slate-600 mb-3">{t("pwa_tek") || "Installs to your phone or computer with one tap, opens from an icon."}</p>

          {deferredPrompt && !isInstalled ? (
            <button
              onClick={() => { install(); toggleMenu(); }}
              className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {t("install_app") || "Install App"}
            </button>
          ) : isInstalled ? (
            <p className="text-xs text-green-600 font-medium">✓ {t("pwa_iptal") || "Already installed"}</p>
          ) : (
            <div className="space-y-2 text-xs text-slate-600">
              {!isMobile && (
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="font-medium text-slate-900 mb-1">💻 {t("pwa_pc") || "Computer"}</p>
                  <p>Chrome/Edge: Menu → Install app</p>
                  <p>Safari: File → Add to Dock</p>
                </div>
              )}
              {isMobile && (
                <div className="p-2 bg-slate-50 rounded-lg">
                  <p className="font-medium text-slate-900 mb-1">📱 {t("pwa_ios") || "iPhone"}</p>
                  <p>Safari: Share → Add to Home Screen</p>
                  <p>Chrome: Menu → Install app</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
