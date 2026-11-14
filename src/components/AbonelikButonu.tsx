"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { AbonelikModal } from "./AbonelikModal";
import type { SubInfo } from "./ReportModals";
import { I } from "./ui-icon";

/**
 * Üst barda her zaman görünen abonelik düğmesi.
 * Pro ise "PRO", denemede ise kalan gün rozeti gösterir; tıklayınca iptal merkezi açılır.
 */
export function AbonelikButonu({ sub, fetchStatus = false }: { sub?: SubInfo; fetchStatus?: boolean }) {
  const { t } = useT();
  const [fetched, setFetched] = useState<SubInfo | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const info = sub ?? fetched;

  useEffect(() => {
    if (sub || !fetchStatus) return;
    let alive = true;
    fetch("/api/billing/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { ok?: boolean; sub?: SubInfo | null } | null) => {
        if (alive && json?.ok && json.sub) setFetched(json.sub);
      })
      .catch(() => { /* giriş yok / yerel mod */ });
    return () => {
      alive = false;
    };
  }, [sub, fetchStatus]);

  if (!info) return null;

  const pro = info.plan === "pro";
  const cancelled = Boolean(info.cancelled);
  const badge = cancelled ? t("sub_cancelled_short") : pro ? "PRO" : `${Math.max(info.gun, 0)}g`;
  const badgeClass = cancelled
    ? "bg-amber-300/20 text-amber-100"
    : pro
      ? "bg-teal-300/25 text-teal-100"
      : "bg-white/15 text-amber-50";
  const pillClass = cancelled
    ? "bg-amber-400/15 text-amber-50 ring-amber-300/40 hover:bg-amber-400/25"
    : pro
      ? "bg-teal-400/15 text-teal-50 ring-teal-300/40 hover:bg-teal-400/25"
      : "bg-white/10 text-amber-50 ring-white/20 hover:bg-white/20";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("sub_manage")}
        aria-label={t("sub_manage")}
        className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 text-xs font-semibold outline-none ring-1 shadow-sm transition ${pillClass}`}
      >
        <I name="card" size={14} />
        <span className="hidden sm:inline">{t("sub_manage_short")}</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${badgeClass}`}>{badge}</span>
      </button>
      <AbonelikModal open={open} onClose={() => setOpen(false)} sub={info} />
    </>
  );
}
