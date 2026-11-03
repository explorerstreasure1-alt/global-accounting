"use client";

import { useState } from "react";
import { Printer, RotateCcw, ZoomIn, CheckCircle2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { I } from "./ui-icon";

type Props = {
  open: boolean;
  onClose: () => void;
  onPrint: () => void;
};

export function PrintSetup({ open, onClose, onPrint }: Props) {
  const { t } = useT();
  const [copies, setCopies] = useState(1);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [scale, setScale] = useState<"fit" | "actual" | "custom">("fit");
  const [customScale, setCustomScale] = useState(100);
  const [margins, setMargins] = useState<"default" | "none" | "minimum">("default");

  const print = () => {
    const root = document.querySelector("html");
    if (root) {
      root.style.setProperty("--print-orientation", orientation);
      root.style.setProperty("--print-scale", scale === "custom" ? `${customScale}%` : scale === "fit" ? "fit" : "100%");
      root.style.setProperty("--print-margins", margins);
    }
    onPrint();
    onClose();
  };

  if (!open) return null;

  const fitCls = scale === "fit" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
  const actualCls = scale === "actual" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
  const customCls = scale === "custom" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
  const portraitCls = orientation === "portrait" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
  const landscapeCls = orientation === "landscape" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
  const marginsDefaultCls = margins === "default" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
  const marginsNoneCls = margins === "none" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";
  const marginsMinCls = margins === "minimum" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50";

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto print:hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-hand text-2xl text-slate-900">{t("print_setup") || "Yazdrma Ayarlar"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <I name="print" size={16} className="text-slate-400 group-hover:text-blue-600 transition" />
              <span className="text-sm font-medium text-slate-700">{t("printer") || "Yazc"}</span>
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm text-slate-900">Sistem Yzc (Varsaylan)</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{t("default_printer") || "Sistem varsaylan"}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <span className="text-slate-400 group-hover:text-blue-600 transition">📋</span>
              <span className="text-sm font-medium text-slate-700">{t("copies") || "Kopya Say"}</span>
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCopies((c) => Math.max(1, c - 1))}
                disabled={copies === 1}
                className={copies === 1 ? "rounded-lg px-3 py-1.5 text-sm font-medium transition bg-slate-100 text-slate-400" : "rounded-lg px-3 py-1.5 text-sm font-medium transition bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"}
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-semibold text-slate-900 tabular-nums">{copies}</span>
              <button
                onClick={() => setCopies((c) => c + 1)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 transition"
              >
                +
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <I name="refresh" size={16} className="text-slate-400 group-hover:text-blue-600 transition" />
              <span className="text-sm font-medium text-slate-700">{t("orientation") || "Sayfa Yonu"}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOrientation("portrait")}
                className={portraitCls + " rounded-lg p-3 flex flex-col items-center gap-1 text-sm transition"}
              >
                <I name="portrait" size={20} className="transform rotate-90" />
                <span className="font-medium">{t("portrait") || "Dikey"}</span>
              </button>
              <button
                onClick={() => setOrientation("landscape")}
                className={landscapeCls + " rounded-lg p-3 flex flex-col items-center gap-1 text-sm transition"}
              >
                <I name="landscape" size={20} />
                <span className="font-medium">{t("landscape") || "Manzara"}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <I name="zoomIn" size={16} className="text-slate-400 group-hover:text-blue-600 transition" />
              <span className="text-sm font-medium text-slate-700">{t("scale") || "lcek"}</span>
            </label>
            <div className="space-y-2">
              <label className={"flex items-center gap-2 p-2 rounded-lg cursor-pointer select-none border transition " + fitCls} onClick={() => setScale("fit")}>
                <input type="radio" name="print-scale" defaultChecked={scale === "fit"} className="accent-blue-600" readOnly />
                <span className="text-sm">{t("fit_page") || "Sayfaya sdr"}</span>
              </label>
              <label className={"flex items-center gap-2 p-2 rounded-lg cursor-pointer select-none border transition " + actualCls} onClick={() => setScale("actual")}>
                <input type="radio" name="print-scale" defaultChecked={scale === "actual"} className="accent-blue-600" readOnly />
                <span className="text-sm">{t("actual_size") || "Gerçek byut"}</span>
              </label>
              <div className={"flex items-center gap-2 p-2 rounded-lg border transition " + customCls}>
                <input
                  type="radio"
                  name="print-scale"
                  defaultChecked={scale === "custom"}
                  className="accent-blue-600"
                  readOnly
                  onChange={() => setScale("custom")}
                />
                <input
                  type="number"
                  min="10"
                  max="200"
                  step="5"
                  value={customScale}
                  onChange={(e) => {
                    setScale("custom");
                    setCustomScale(Math.max(10, Math.min(200, Number(e.target.value || 100))));
                  }}
                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-right"
                  disabled={scale !== "custom"}
                />
                <span className="text-[10px] text-slate-500">%</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <span className="text-slate-400 group-hover:text-blue-600 transition">📄</span>
              <span className="text-sm font-medium text-slate-700">{t("margins") || "Kenar Bosluklar"}</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                key="default"
                onClick={() => setMargins("default")}
                className={marginsDefaultCls + " rounded-lg p-2 text-xs transition"}
              >
                {t("default") || "Varsaylan"}
              </button>
              <button
                key="none"
                onClick={() => setMargins("none")}
                className={marginsNoneCls + " rounded-lg p-2 text-xs transition"}
              >
                {t("none") || "Yok"}
              </button>
              <button
                key="minimum"
                onClick={() => setMargins("minimum")}
                className={marginsMinCls + " rounded-lg p-2 text-xs transition"}
              >
                {t("minimum") || "Minimum"}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
          >
            {t("cancel") || "Vazgeç"}
          </button>
          <button
            onClick={print}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-md transition"
          >
            <CheckCircle2 size={14} className="mr-1.5" /> {t("print") || "Yazdr"}
          </button>
        </div>
      </div>
    </div>
  );
}
