"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { AbonelikModal } from "./AbonelikModal";
import type { SubInfo } from "./ReportModals";
import { I } from "./ui-icon";

/**
 * Üst barda her zaman görünen abonelik düğmesi.
 * Pro veya deneme durumunda💳 ikonla görünür; tıklayınca iptal merkezi açılır.
 * Kullanıcı istediği zaman kolayca iptal edebilir, zorlama yoktur.
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
  const hasActiveSub = pro || (info.gun ?? 0) > 0;
  if (!hasActiveSub) return null;

  const badge = cancelled ? t("sub_cancelled_short") : pro ? "PRO" : `${Math.max(info.gun, 0)}g`;
  const badgeClass = cancelled
    ? "bg-amber-300/20 text-amber-100"
    : pro
      ? "bg-teal-300/25 text-teal-100"
      : "bg-white/15 text-amber-50";
  const pillClass = cancelled
    ? "bg-amber-500/20 text-amber-100 ring-amber-400/40 hover:bg-amber-500/30"
    : pro
      ? "bg-teal-500/20 text-teal-100 ring-teal-400/40 hover:bg-teal-500/30"
      : "bg-white/15 text-amber-50 ring-white/20 hover:bg-white/30";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t("sub_manage")}
        aria-label={t("sub_manage")}
        className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-2.5 pr-2.5 text-xs font-bold outline-none ring-1 shadow-md transition ${pillClass}`}
      >
        <span className="text-[16px]">💳</span>
        <span className="hidden sm:inline">{t("sub_manage_short")}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${badgeClass}`}>{badge}</span>
      </button>
      <AbonelikModal open={open} onClose={() => setOpen(false)} sub={info} />
    </>
  );
}
