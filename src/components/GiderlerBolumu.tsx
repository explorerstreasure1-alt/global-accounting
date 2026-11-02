"use client";

import { useMemo, useState } from "react";
import type { Ayarlar, Kayit, KayitGirdi } from "@/lib/types";
import { useT, catLabel } from "@/lib/i18n";
import { I } from "./ui-icon";
import { formatMoneyLocale, formatDate, toISODate } from "@/lib/format";

type Props = {
  open: boolean;
  onClose: () => void;
  kayitlar: Kayit[];
  onAdd: (input: KayitGirdi) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  ayarlar: Ayarlar;
};

export function GiderlerBolumu({ open, onClose, kayitlar, onAdd, onDelete, ayarlar }: Props) {
  const { t, intl, currency, locale } = useT();
  const fm = (v: number, sym = true) => formatMoneyLocale(v, intl, currency, sym);
  const fd = (iso: string) => formatDate(iso, intl);
  const today = toISODate();

  const [draft, setDraft] = useState<KayitGirdi>({
    tarih: today,
    aciklama: "",
    kategori: "Service",
    gelir: 0,
    gider: 0,
    odemeTipi: "Nakit",
  });
  const [pending, setPending] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const giderKayitlar = useMemo(() => {
    return kayitlar
      .filter((k) => k.gider > 0)
      .sort((a, b) => b.tarih.localeCompare(a.tarih));
  }, [kayitlar]);

  const gunluk = useMemo(() => {
    const map = new Map<string, Kayit[]>();
    for (const r of giderKayitlar) {
      const list = map.get(r.tarih) ?? [];
      list.push(r);
      map.set(r.tarih, list);
    }
    return [...map.entries()];
  }, [giderKayitlar]);

  const toplamGider = giderKayitlar.reduce((s, k) => s + k.gider, 0);

  async function addRow() {
    if (!draft.aciklama.trim() || !draft.gider) return;
    setPending(true);
    try {
      await onAdd(draft);
      setDraft({ tarih: today, aciklama: "", kategori: "Service", gelir: 0, gider: 0, odemeTipi: "Nakit" });
    } finally {
      setPending(false);
    }
  }

  async function deleteKayit(id: string) {
    try {
      await onDelete(id);
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 print:static print:bg-white print:p-0">
      <div className="bg-[#fafafa] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90dvh] overflow-hidden flex flex-col border border-slate-200/50">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <p className="font-hand text-2xl leading-none text-[var(--ink)]">{t("nb_giderBolumu")}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              {t("nb_giderler")} · {t("nb_toplamGider")}: {fm(toplamGider)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            {t("rep_close")}
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1">
          <div className="mt-4 rounded-xl bg-white/40 p-3 border border-slate-200 mb-6">
            <p className="px-1 pb-1 text-[10px] uppercase tracking-wider text-slate-500">
              {t("nb_giderEkle")}
            </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <input
                type="date"
                value={draft.tarih}
                onChange={(e) => setDraft({ ...draft, tarih: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                title={t("date")}
              />
              <input
                value={draft.aciklama}
                onChange={(e) => setDraft({ ...draft, aciklama: e.target.value })}
                placeholder={t("nb_descPh")}
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
              />
              <select
                value={draft.kategori}
                onChange={(e) => setDraft({ ...draft, kategori: e.target.value as KayitGirdi["kategori"] })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
              >
                {["Rent", "Utilities", "Water", "Heating", "Home", "Workshop", "Service", "Groceries", "Other"].map((k) => (
                  <option key={k} value={k}>
                    {catLabel(k, locale)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.gider || ""}
                onChange={(e) => setDraft({ ...draft, gider: Number(e.target.value || 0), gelir: 0 })}
                placeholder={t("nb_expensePh")}
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-right tabular-nums"
              />
              <div className="col-span-3 flex gap-1">
                <button
                  onClick={() => setDraft({ ...draft, odemeTipi: "Nakit" })}
                  className={`flex-1 rounded-lg px-2 py-1 text-[10px] ${draft.odemeTipi === "Nakit" ? "bg-[var(--ink)] text-white" : "bg-white border border-slate-200 text-slate-500"}`}
                >
                  {t("pay_cash")}
                </button>
                <button
                  onClick={() => setDraft({ ...draft, odemeTipi: "Kart" })}
                  className={`flex-1 rounded-lg px-2 py-1 text-[10px] ${draft.odemeTipi === "Kart" ? "bg-[var(--ink)] text-white" : "bg-white border border-slate-200 text-slate-500"}`}
                >
                  {t("pay_card")}
                </button>
                <button
                  onClick={() => setDraft({ ...draft, odemeTipi: "Havale" })}
                  className={`flex-1 rounded-lg px-2 py-1 text-[10px] ${draft.odemeTipi === "Havale" ? "bg-[var(--ink)] text-white" : "bg-white border border-slate-200 text-slate-500"}`}
                >
                  {t("pay_transfer")}
                </button>
              </div>
              <button
                onClick={addRow}
                disabled={pending}
                className="w-auto rounded-lg bg-[var(--ink)] px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap self-start"
              >
                {pending ? "…" : t("nb_add")}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {gunluk.map(([tarih, list]) => {
              const gider = list.reduce((s, k) => s + k.gider, 0);
              return (
                <div key={tarih} className="border-b border-slate-100 pb-2 last:border-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-hand text-xl text-blue-900">{fd(tarih)}</p>
                    <p className="text-[11px] tabular-nums text-rose-700 font-semibold">−{fm(gider)}</p>
                  </div>
                  <div className="space-y-1">
                    {list.map((k) => (
                      <div
                        key={k.id}
                        className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/40 hover:bg-white/60 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--ink)] truncate">{k.aciklama}</p>
                          <p className="text-[10px] text-slate-500">
                            {catLabel(k.kategori, locale)} · {k.odemeTipi === "Nakit" ? t("pay_cash") : k.odemeTipi === "Havale" ? t("pay_transfer") : t("pay_card")}
                          </p>
                        </div>
                        <div className="text-right tabular-nums text-rose-700 font-semibold">
                          −{fm(k.gider)}
                        </div>
                        <button
                          onClick={() => setConfirmId(k.id)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                          title={t("delete")}
                        >
                          <I name="delete" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {gunluk.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <I name="receipt" size={44} className="mx-auto mb-2 opacity-40" />
                <p>{t("nb_empty")}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-white/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t("nb_toplamGider")}</span>
            <span className="text-sm font-bold tabular-nums text-rose-700">{fm(toplamGider)}</span>
          </div>
        </div>
      </div>

      {confirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <p className="font-hand text-2xl mb-4">{t("confirm_delete")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  deleteKayit(confirmId);
                  setConfirmId(null);
                }}
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm text-white"
              >
                {t("yes_delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
