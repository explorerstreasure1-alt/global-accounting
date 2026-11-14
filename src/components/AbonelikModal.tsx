"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n";
import { AbonelikBolumu, type SubInfo } from "./ReportModals";
import { I } from "./ui-icon";

/** Üst bardaki abonelik düğmesinin açtığı, tek ekranda iptal merkezi. */
export function AbonelikModal({
  open,
  onClose,
  sub,
}: {
  open: boolean;
  onClose: () => void;
  sub?: SubInfo;
}) {
  const { t } = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("sub_center")}
        className="scroll-thin my-auto w-full max-w-md overflow-y-auto rounded-2xl bg-[#fafafa] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-teal-300">
              <I name="card" size={16} />
            </span>
            {t("sub_center")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common_close")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-700 hover:bg-slate-300"
          >
            <I name="close" size={16} />
          </button>
        </div>
        <AbonelikBolumu sub={sub} alwaysShow />
      </div>
    </div>
  );
}
