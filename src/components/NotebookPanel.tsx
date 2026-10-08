"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ayarlar, Kayit, KayitGirdi, Kategori } from "@/lib/types";
import { KATEGORILER } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { formatMoney, formatMoneySigned, formatTRDate, toISODate } from "@/lib/format";

type Props = {
  kayitlar: Kayit[];
  ayarlar: Ayarlar;
  year: number;
  month: number;
  focusDate?: string | null;
  onJumpDate?: (iso: string) => void;
  onAdd: (input: KayitGirdi) => Promise<void>;
  onUpdate: (id: string, patch: Partial<KayitGirdi>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function NotebookPanel({ kayitlar, year, month, focusDate, onJumpDate, onAdd, onUpdate, onDelete }: Props) {
  const { t } = useT();
  const today = toISODate();
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const rows = useMemo(
    () => kayitlar.filter((k) => k.tarih.startsWith(prefix)).sort((a, b) => a.tarih.localeCompare(b.tarih)),
    [kayitlar, prefix],
  );

  const [draft, setDraft] = useState<KayitGirdi>({
    tarih: today.startsWith(prefix) ? today : `${prefix}-01`,
    aciklama: "",
    kategori: "Hizmet",
    gelir: 0,
    gider: 0,
    odemeTipi: "Nakit",
  });
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<KayitGirdi | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tariheGit, setTariheGit] = useState("");
  const [arama, setArama] = useState("");

  // Ay değişince yeni satır tarihini o aya çek (geçmişe yazım)
  useEffect(() => {
    setDraft((d) => {
      if (d.tarih.startsWith(prefix)) return d;
      return { ...d, tarih: `${prefix}-01` };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix]);

  // Takvimden "Bu güne yaz" gelirse yeni satırı o tarihe kur
  useEffect(() => {
    if (focusDate) {
      setDraft((d) => ({ ...d, tarih: focusDate }));
    }
  }, [focusDate]);

  // Defter içi arama (açıklama / kategori / ödeme tipi)
  const süzülmüş = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    if (!q) return rows;
    return rows.filter((k) =>
      `${k.aciklama} ${k.kategori} ${k.odemeTipi} ${formatTRDate(k.tarih)}`.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [rows, arama]);

  const gunluk = useMemo(() => {
    const map = new Map<string, Kayit[]>();
    for (const r of süzülmüş) {
      const list = map.get(r.tarih) ?? [];
      list.push(r);
      map.set(r.tarih, list);
    }
    return [...map.entries()];
  }, [rows]);

  async function addRow() {
    if (!draft.aciklama.trim() || (!draft.gelir && !draft.gider)) return;
    setPending(true);
    try {
      await onAdd(draft);
      setDraft((d) => ({ ...d, aciklama: "", gelir: 0, gider: 0 }));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="notebook relative overflow-hidden rounded-[28px]">
      <div className="pointer-events-none absolute bottom-8 left-5 top-8 flex w-5 flex-col justify-between">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="spiral-delik" />
        ))}
      </div>

      <div className="relative pl-12 pr-4 pt-5 pb-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-hand text-4xl leading-none text-[var(--ink)]">{t("ledger")}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{t("income")} · {t("expense")} · {t("cash")} · {t("card")}</p>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <input
              type="date"
              value={tariheGit}
              min="2015-01-01"
              max="2035-12-31"
              onChange={(e) => setTariheGit(e.target.value)}
              className="w-28 min-w-0 rounded-lg border border-amber-900/20 bg-white/60 px-2 py-1 text-xs"
              title="Tarihe git (geçmiş dahil)"
            />
            <button
              onClick={() => {
                if (!tariheGit) return;
                if (onJumpDate) {
                  onJumpDate(tariheGit);
                } else {
                  setDraft((d) => ({ ...d, tarih: tariheGit }));
                }
                setTariheGit("");
              }}
              className="rounded-lg bg-[var(--ink)] px-2 py-1 text-xs text-white"
              title="Bu tarihe kayıt yaz"
            >
              Git
            </button>
          </div>
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-1.5">
          <span className="text-slate-500">🔍</span>
          <input
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder={t("search")}
            className="ink-input min-w-0 flex-1 rounded-lg bg-white/50 px-2 py-1 text-sm"
          />
          {arama ? (
            <button
              onClick={() => setArama("")}
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white/40"
              title="Aramayı temizle"
            >
              ✕
            </button>
          ) : null}
        </div>
        {arama.trim() ? (
          <p className="mt-1 px-1 text-[11px] text-slate-500">
            {süzülmüş.length} kayıt bulundu{rows.length !== süzülmüş.length ? ` (${rows.length} satırdan)` : ""}
          </p>
        ) : null}

        <div className="hidden gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 xl:grid xl:grid-cols-[148px_1fr_118px_100px_100px_92px_92px_52px]">
          <span>{t("date")}</span>
          <span>{t("description")}</span>
          <span>{t("category")}</span>
          <span className="text-right">{t("income")}</span>
          <span className="text-right">{t("expense")}</span>
          <span>{t("payment")}</span>
          <span className="text-right">{t("net")}</span>
          <span />
        </div>

        <div className="mt-1 max-h-[58vh] space-y-3 overflow-y-auto scroll-thin pr-1">
          {gunluk.map(([tarih, list]) => {
            const gelir = list.reduce((s, k) => s + k.gelir, 0);
            const gider = list.reduce((s, k) => s + k.gider, 0);
            return (
              <section key={tarih}>
                <div className="flex items-center justify-between px-1">
                  <p className="font-hand text-xl text-blue-900">{formatTRDate(tarih)}</p>
                  <p className="text-[11px] tabular-nums text-slate-600">
                    +{formatMoney(gelir, false)} / −{formatMoney(gider, false)} · net {formatMoney(gelir - gider)}
                  </p>
                </div>
                {list.map((k) =>
                  editing === k.id && editDraft ? (
                    <RowEditor
                      key={k.id}
                      value={editDraft}
                      onChange={setEditDraft}
                      onSave={async () => {
                        await onUpdate(k.id, editDraft);
                        setEditing(null);
                        setEditDraft(null);
                      }}
                      onCancel={() => {
                        setEditing(null);
                        setEditDraft(null);
                      }}
                    />
                  ) : (
                    <article
                      key={k.id}
                      className="notebook-row grid grid-cols-1 items-center gap-x-2 gap-y-1 border-b border-transparent px-1 py-1 text-sm min-[480px]:grid-cols-2 xl:grid-cols-[148px_1fr_118px_100px_100px_92px_92px_52px]"
                    >
                      <span className="font-book text-[13px] text-slate-600 min-[480px]:col-span-2 xl:col-span-1">{formatTRDate(k.tarih)}</span>
                      <span className="font-book break-words text-[15px] text-[var(--ink)] min-[480px]:col-span-2 xl:col-span-1">{k.aciklama}</span>
                      <span className="w-fit rounded-full bg-white/50 px-2 py-0.5 text-[11px]">{k.kategori}</span>
                      <span className="text-right tabular-nums text-emerald-800">{k.gelir ? formatMoney(k.gelir, false) : ""}</span>
                      <span className="text-right tabular-nums text-rose-800">{k.gider ? formatMoney(k.gider, false) : ""}</span>
                      <span>
                        <span className={`chip rounded-full px-2 py-0.5 text-[11px] ${k.odemeTipi === "Nakit" ? "active-nakit" : k.odemeTipi === "Havale" ? "active-havale" : "active-kart"}`}>
                          {k.odemeTipi === "Nakit" ? "🔵 Nakit" : k.odemeTipi === "Havale" ? "🏦 Havale" : "💳 Kart"}
                        </span>
                      </span>
                      <span className="text-right tabular-nums text-[var(--ink-soft)]">{formatMoneySigned(k.kasaEtkisi)}</span>
                      <span className="flex justify-end gap-1">
                        <button
                          className="text-xs"
                          onClick={() => {
                            setEditing(k.id);
                            setEditDraft({
                              tarih: k.tarih,
                              aciklama: k.aciklama,
                              kategori: k.kategori,
                              gelir: k.gelir,
                              gider: k.gider,
                              odemeTipi: k.odemeTipi,
                            });
                          }}
                          title="Düzenle"
                          aria-label={`${k.aciklama} kaydını düzenle`}
                        >
                          ✏️
                        </button>
                        <button
                          className="text-xs"
                          onClick={() => setConfirmId(k.id)}
                          title="Sil"
                          aria-label={`${k.aciklama} kaydını sil`}
                        >
                          🗑️
                        </button>
                      </span>
                    </article>
                  ),
                )}
              </section>
            );
          })}
          {rows.length === 0 ? (
            <p className="font-hand py-10 text-center text-2xl text-slate-500">Bu ay henüz satır yok. İlk kaydı alta yazın.</p>
          ) : süzülmüş.length === 0 ? (
            <p className="font-hand py-10 text-center text-2xl text-slate-500">Aramaya uyan satır yok.</p>
          ) : null}
        </div>

        <div className="mt-3 rounded-2xl bg-white/35 p-2 ring-1 ring-amber-900/10">
          <p className="px-1 pb-1 text-[10px] uppercase tracking-wider text-slate-500">
            Yeni satır — tarih kutusundan geçmiş gün de seçebilirsiniz ({formatTRDate(today)} bugün)
          </p>
          <RowEditor
            value={draft}
            onChange={setDraft}
            onSave={addRow}
            saving={pending}
            saveLabel={pending ? "…" : "Ekle"}
          />
        </div>
      </div>

      {confirmId ? (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#f3e6c4]/80">
          <div className="rounded-2xl bg-white p-5 shadow-xl">
            <p className="font-hand text-2xl">Satır silinsin mi?</p>
            <p className="mt-1 text-sm text-slate-600">Bu işlem defterden kalıcı olarak kaldırır.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmId(null)} className="rounded-lg px-3 py-1.5 text-sm">
                Vazgeç
              </button>
              <button
                onClick={async () => {
                  await onDelete(confirmId);
                  setConfirmId(null);
                }}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm text-white"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RowEditor({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
  saveLabel = "Kaydet",
}: {
  value: KayitGirdi;
  onChange: (v: KayitGirdi) => void;
  onSave: () => void | Promise<void>;
  onCancel?: () => void;
  saving?: boolean;
  saveLabel?: string;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-1 min-[480px]:grid-cols-2 xl:grid-cols-[148px_1fr_118px_100px_100px_92px_92px_auto]">
      <input
        type="date"
        value={value.tarih}
        min="2015-01-01"
        max="2035-12-31"
        onChange={(e) => onChange({ ...value, tarih: e.target.value })}
        className="ink-input col-span-1 min-w-0 rounded px-1 py-1 text-sm tabular-nums min-[480px]:col-span-2 xl:col-span-1"
        title="İstediğiniz tarihi seçin (geçmiş dahil)"
      />
      <input
        value={value.aciklama}
        onChange={(e) => onChange({ ...value, aciklama: e.target.value })}
        placeholder="Açıklama"
        className="ink-input min-w-0 rounded px-1 py-1 font-book text-[15px] min-[480px]:col-span-2 xl:col-span-1"
        onKeyDown={(e) => {
          if (e.key === "Enter") void onSave();
        }}
      />
      <select
        value={value.kategori}
        onChange={(e) => onChange({ ...value, kategori: e.target.value as Kategori })}
        className="ink-input rounded px-1 py-1 text-sm"
      >
        {KATEGORILER.map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value.gelir || ""}
        onChange={(e) => onChange({ ...value, gelir: Number(e.target.value || 0), gider: Number(e.target.value || 0) ? 0 : value.gider })}
        placeholder="Gelir"
        className="ink-input rounded px-1 py-1 text-right tabular-nums"
      />
      <input
        type="number"
        min="0"
        step="0.01"
        value={value.gider || ""}
        onChange={(e) => onChange({ ...value, gider: Number(e.target.value || 0), gelir: Number(e.target.value || 0) ? 0 : value.gelir })}
        placeholder="Gider"
        className="ink-input rounded px-1 py-1 text-right tabular-nums"
      />
      <div className="flex gap-1">
        <PayChip
          active={value.odemeTipi === "Nakit"}
          label="🔵"
          title="Nakit"
          onClick={() => onChange({ ...value, odemeTipi: "Nakit" })}
        />
        <PayChip
          active={value.odemeTipi === "Kart"}
          label="💳"
          title="Kart"
          onClick={() => onChange({ ...value, odemeTipi: "Kart" })}
        />
        <PayChip
          active={value.odemeTipi === "Havale"}
          label="🏦"
          title="Havale"
          onClick={() => onChange({ ...value, odemeTipi: "Havale" })}
        />
      </div>
      <span className="hidden text-right text-xs tabular-nums text-slate-500 xl:block">
        {formatMoneySigned((value.gelir || 0) - (value.gider || 0))}
      </span>
      <div className="flex gap-1">
        <button
          disabled={saving}
          onClick={() => void onSave()}
          className="rounded-lg bg-[var(--ink)] px-2 py-1 text-[11px] text-white"
        >
          {saveLabel}
        </button>
        {onCancel ? (
          <button onClick={onCancel} className="rounded-lg px-2 py-1 text-[11px]">
            Vazgeç
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PayChip({
  active,
  label,
  title,
  onClick,
}: {
  active: boolean;
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`chip rounded-full px-1.5 py-0.5 text-xs ${active ? (title === "Nakit" ? "active-nakit" : title === "Havale" ? "active-havale" : "active-kart") : ""}`}
    >
      {label}
    </button>
  );
}

export function TotalsStrip({
  kayitlar,
  ayarlar,
  year,
  month,
}: {
  kayitlar: Kayit[];
  ayarlar: Ayarlar;
  year: number;
  month: number;
}) {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const rows = kayitlar.filter((k) => k.tarih.startsWith(prefix));
  const gelir = rows.reduce((s, k) => s + k.gelir, 0);
  const gider = rows.reduce((s, k) => s + k.gider, 0);
  const nakit = rows.filter((k) => k.odemeTipi === "Nakit").reduce((s, k) => s + k.gelir - k.gider, 0);
  const kart = rows.filter((k) => k.odemeTipi === "Kart").reduce((s, k) => s + k.gelir - k.gider, 0);
  const havale = rows.filter((k) => k.odemeTipi === "Havale").reduce((s, k) => s + k.gelir - k.gider, 0);
  const kasa =
    ayarlar.acilisBakiyesi +
    kayitlar.filter((k) => k.odemeTipi === "Nakit").reduce((s, k) => s + k.kasaEtkisi, 0);

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <TotalCard label="Nakit toplam" value={formatMoney(nakit)} />
      <TotalCard label="Kart toplam" value={formatMoney(kart)} />
      <TotalCard label="Havale toplam" value={formatMoney(havale)} />
      <TotalCard label="Genel toplam" value={formatMoney(gelir - gider)} />
      <TotalCard label="Aylık net" value={formatMoney(gelir - gider)} hint={`Gelir ${formatMoney(gelir)}`} />
      <TotalCard label="Kasa (nakit)" value={formatMoney(kasa)} hint={`Açılış ${formatMoney(ayarlar.acilisBakiyesi)}`} />
    </div>
  );
}

function TotalCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-[var(--paper)]/90 px-3 py-2 shadow-sm ring-1 ring-amber-950/10">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-semibold tabular-nums text-[var(--ink)]">{value}</p>
      {hint ? <p className="text-[10px] text-slate-500">{hint}</p> : null}
    </div>
  );
}


