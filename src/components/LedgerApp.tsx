"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Ayarlar, InitData, Kayit, KayitGirdi, RaporOzet, SohbetMesaji, Uyari } from "@/lib/types";
import { formatMoneyLocale, formatDate, monthLabel, toISODate, getMonthNames } from "@/lib/format";
import { buildRapor, computeUyarilar, monthRange } from "@/lib/reports";
import { NotebookPanel, TotalsStrip } from "./NotebookPanel";
import { GlobalBar } from "./GlobalBar";
import { I } from "./ui-icon";
import { useT } from "@/lib/i18n";
import { ReportModal, SettingsModal, TelefonModal } from "./ReportModals";
import { TakvimPanel } from "./TakvimPanel";
import { KlavuzPaneli } from "./KlavuzPaneli";
import { ProBanner } from "./ProBanner";

export function LedgerApp({ initial, trial, sub }: { initial: InitData; trial?: { gun: number; email: string }; sub?: { plan: string; gun: number; email: string } }) {
  const { t, intl, currency, locale } = useT();
  const fm = (v: number) => formatMoneyLocale(v, intl, currency);
  const monthNames = getMonthNames(intl);
  const now = new Date();
  const [kayitlar, setKayitlar] = useState<Kayit[]>(initial.kayitlar);
  const [ayarlar, setAyarlar] = useState<Ayarlar>(initial.ayarlar);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [telefonOpen, setTelefonOpen] = useState(false);
  const [zOpen, setZOpen] = useState(false);
  const [gunOpen, setGunOpen] = useState(false);
  const [zBas, setZBas] = useState(monthRange(now.getFullYear(), now.getMonth() + 1).baslangic);
  const [zBit, setZBit] = useState(monthRange(now.getFullYear(), now.getMonth() + 1).bitis);
  const [gunTarih, setGunTarih] = useState(toISODate());
  const [ayOpen, setAyOpen] = useState(false);
  const [ayBas, setAyBas] = useState(monthRange(now.getFullYear(), now.getMonth() + 1).baslangic);
  const [ayBit, setAyBit] = useState(monthRange(now.getFullYear(), now.getMonth() + 1).bitis);
  const [toast, setToast] = useState<string | null>(null);
  const [takvimOpen, setTakvimOpen] = useState(false);
  const [kilavuzOpen, setKilavuzOpen] = useState(true);
  const [yazilacakTarih, setYazilacakTarih] = useState<string | null>(null);
  const [hafizaMod, setHafizaMod] = useState<string>("dosya");
  const fileInput = useRef<HTMLInputElement>(null);

  // Hafıza durumu (üstte rozet)
  useEffect(() => {
    // Telefona kurulum için service worker (önbelleksiz, bayatlatmaz)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => {
        setHafizaMod(j.mod ?? "dosya");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mgroq-defter-backup", JSON.stringify({ kayitlar, ayarlar }));
    } catch {
      /* ignore quota */
    }
  }, [kayitlar, ayarlar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const uyarilar: Uyari[] = useMemo(() => computeUyarilar(kayitlar, ayarlar, toISODate(), locale), [kayitlar, ayarlar, locale]);
  const zRapor: RaporOzet = useMemo(() => buildRapor(kayitlar, ayarlar, zBas, zBit), [kayitlar, ayarlar, zBas, zBit]);
  const ayRapor: RaporOzet = useMemo(() => buildRapor(kayitlar, ayarlar, ayBas, ayBit), [kayitlar, ayarlar, ayBas, ayBit]);
  const gunRapor: RaporOzet = useMemo(
    () => buildRapor(kayitlar, ayarlar, gunTarih, gunTarih),
    [kayitlar, ayarlar, gunTarih],
  );

  const donem = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const rows = kayitlar.filter((k) => k.tarih.startsWith(prefix));
    return {
      gelir: rows.reduce((s, k) => s + k.gelir, 0),
      gider: rows.reduce((s, k) => s + k.gider, 0),
      adet: rows.length,
    };
  }, [kayitlar, year, month]);

  function applyData(data: InitData) {
    setKayitlar(data.kayitlar);
    setAyarlar(data.ayarlar);
  }

  /** Sunucudaki gerçek listeyi çekip ekranla eşitle (kayma olmasın) */
  async function tazeleKayitlar(): Promise<boolean> {
    try {
      const res = await fetch("/api/kayitlar");
      if (!res.ok) return false;
      const json = (await res.json()) as { kayitlar: Kayit[] };
      setKayitlar(json.kayitlar);
      return true;
    } catch {
      return false;
    }
  }

  async function addKayit(input: KayitGirdi) {
    try {
      const res = await fetch("/api/kayitlar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("kayit");
      const json = (await res.json()) as { kayit: Kayit };
      setKayitlar((prev) => [...prev, json.kayit].sort((a, b) => a.tarih.localeCompare(b.tarih)));
      setToast(t("toast_rowAdded"));
    } catch {
      setToast(t("toast_saveFailed"));
    }
  }

  async function updateKayit(id: string, patch: Partial<KayitGirdi>) {
    try {
      const res = await fetch(`/api/kayitlar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("guncelle");
      const json = (await res.json()) as { kayit: Kayit };
      setKayitlar((prev) => prev.map((k) => (k.id === id ? json.kayit : k)));
      setToast(t("toast_updated"));
    } catch {
      setToast(t("toast_updateFailed"));
      void tazeleKayitlar();
    }
  }

  async function deleteKayit(id: string) {
    try {
      const res = await fetch(`/api/kayitlar/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("sil");
      // Sunucudan doğrula: gerçekten gitti mi?
      const ok = await tazeleKayitlar();
      setToast(ok ? t("toast_deleted") : t("toast_deleteRefresh"));
    } catch {
      setToast(t("toast_deleteFailed"));
      void tazeleKayitlar();
    }
  }

  /** TÜM veriyi sıfırla: kayıtlar + açılış bakiyesi + kira + sohbet */
  async function sifirlaHepsi() {
    try {
      const res = await fetch("/api/sifirla", { method: "POST" });
      if (!res.ok) throw new Error("sifirla");
      const data = (await res.json()) as InitData;
      applyData(data);
      try {
        localStorage.removeItem("mgroq-defter-backup");
      } catch {
        /* yoksay */
      }
      setToast(t("toast_resetDone"));
    } catch {
      setToast(t("toast_resetFailed"));
    }
  }

  async function saveAyarlar(patch: Partial<Ayarlar>) {
    const res = await fetch("/api/ayarlar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = (await res.json()) as { ayarlar: Ayarlar };
    setAyarlar(json.ayarlar);
    setToast(t("toast_settingsSaved"));
  }

  /** Kirayı aylara böl (AI'sız): son kira giderini N taksite ayırır */
  async function kiraBol(ay: number): Promise<boolean> {
    try {
      const res = await fetch("/api/kira-bol", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ay }),
      });
      if (!res.ok) throw new Error("kirabol");
      const data = (await res.json()) as InitData;
      applyData(data);
      setToast(t("toast_reportReady"));
      return true;
    } catch {
      setToast(t("toast_resetFailed"));
      return false;
    }
  }

  function downloadExcel(tip: string, baslangic: string, bitis: string) {
    window.location.href = `/api/export?tip=${encodeURIComponent(tip)}&baslangic=${baslangic}&bitis=${bitis}&locale=${locale}&currency=${currency}`;
    setToast(t("toast_excelDownloading"));
  }

  function downloadWord(tip: string, baslangic: string, bitis: string) {
    window.location.href = `/api/word?tip=${encodeURIComponent(tip)}&baslangic=${baslangic}&bitis=${bitis}&locale=${locale}&currency=${currency}`;
    setToast(t("toast_excelDownloading"));
  }

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    gitAy(d.getFullYear(), d.getMonth() + 1);
  }

  /** Ay/yıl değişince defter + ay sonu aralığını birlikte götür */
  function gitAy(y: number, m: number) {
    setYear(y);
    setMonth(m);
    const r = monthRange(y, m);
    setAyBas(r.baslangic);
    setAyBit(r.bitis);
  }

  /** Takvimden gün seçimi → defteri o aya götür, yeni satırı o tarihe kur */
  function pickDate(iso: string) {
    const [yy, mm] = iso.split("-").map(Number);
    if (yy && mm) {
      gitAy(yy, mm);
    }
    setGunTarih(iso);
    setYazilacakTarih(iso);
    setTakvimOpen(false);
    setToast(`${formatDate(iso, intl)}`);
  }

  function pickRange(bas: string, bit: string) {
    setZBas(bas);
    setZBit(bit);
    setTakvimOpen(false);
    setZOpen(true);
  }

  function yedekAl() {
    window.location.href = "/api/hafiza?indir=1";
    setToast(t("toast_backupDownloading"));
  }

  async function yedekYukle(file: File) {
    try {
      const text = await file.text();
      const json = JSON.parse(text) as { kayitlar: Kayit[]; ayarlar: Ayarlar; mesajlar: SohbetMesaji[] };
      const res = await fetch("/api/hafiza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) throw new Error("yükleme hatası");
      const fresh = await fetch("/api/sohbet").then((r) => r.json());
      applyData(fresh as InitData);
      setToast(t("toast_backupRestored"));
    } catch {
      setToast(t("toast_backupFailed"));
    }
  }

  return (
    <div className="desk-app min-h-screen">
      <div className={`mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3 md:px-5 md:py-4 ${zOpen || gunOpen ? "no-print" : ""}`}>
        <div className="mb-2">
          <GlobalBar />
        </div>
        {trial ? <ProBanner gun={trial.gun} email={trial.email} /> : null}
        <header className="no-print mb-3 flex flex-wrap items-center gap-3 rounded-[24px] bg-black/25 px-3 py-2 text-amber-50 backdrop-blur-md">
          <img src="/images/logo.svg" alt="Shop Ledger" className="h-12 w-12 rounded-full object-cover ring-2 ring-amber-200/40" />
          <div className="min-w-0">
            <p className="font-hand text-3xl leading-none md:text-4xl">{ayarlar.isletmeAdi}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-amber-100/70">{t("app_sub")}</p>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-black/20 p-1">
            <button onClick={() => shiftMonth(-1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10">
              ‹
            </button>
            <select
              value={month}
              onChange={(e) => gitAy(year, Number(e.target.value))}
              className="bg-transparent px-1 text-center text-sm capitalize outline-none [&>option]:text-slate-900"
            >
              {monthNames.map((a, i) => (
                <option key={a} value={i + 1}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => gitAy(Number(e.target.value), month)}
              className="bg-transparent px-1 text-center text-sm outline-none [&>option]:text-slate-900"
            >
              {Array.from({ length: 16 }, (_, i) => new Date().getFullYear() - 10 + i).map((yy) => (
                <option key={yy} value={yy}>
                  {yy}
                </option>
              ))}
            </select>
            <button onClick={() => shiftMonth(1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10">
              ›
            </button>
          </div>
          <div className="hidden items-center gap-1 xl:flex">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] uppercase tracking-wider ${
                hafizaMod === "postgres" ? "bg-sky-400/20 text-sky-100" : "bg-emerald-400/20 text-emerald-100"
              }`}
              title="Storage: file + auto backup"
            >
              <I name="db" size={11} /> {hafizaMod === "postgres" ? t("memoryDb") : t("memoryPermanent")}
            </span>
          </div>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <HeaderStat label={t("income")} value={fm(donem.gelir)} />
            <HeaderStat label={t("expense")} value={fm(donem.gider)} />
            <HeaderStat label={t("net")} value={fm(donem.gelir - donem.gider)} />
            <HeaderStat label={t("monthly_rent")} value={fm(ayarlar.aylikKiraKarsiligi)} />
          </div>

          <div className="flex flex-wrap gap-1">
            <ToolBtn onClick={() => setTakvimOpen(true)}><I name="calendar" /> {t("calendar")}</ToolBtn>
            <ToolBtn onClick={() => setGunOpen(true)}><I name="day" /> {t("day_end")}</ToolBtn>
            <ToolBtn onClick={() => setAyOpen(true)}><I name="month" /> {t("month_end")}</ToolBtn>
            <ToolBtn onClick={() => setZOpen(true)}><I name="report" /> {t("z_report")}</ToolBtn>
            <ToolBtn onClick={() => downloadExcel("defter", monthRange(year, month).baslangic, monthRange(year, month).bitis)}>
              <I name="excel" /> {t("excel")}
            </ToolBtn>
            <ToolBtn onClick={() => downloadWord("defter", monthRange(year, month).baslangic, monthRange(year, month).bitis)}>
              <I name="report" /> Word
            </ToolBtn>
            <ToolBtn onClick={yedekAl}><I name="backup" /> {t("backup")}</ToolBtn>
            <ToolBtn
              onClick={() => {
                const r = monthRange(year, month);
                setZBas(r.baslangic);
                setZBit(r.bitis);
                setZOpen(true);
              }}
            >
              <I name="print" /> {t("print")}
            </ToolBtn>
            <ToolBtn onClick={() => setSettingsOpen(true)}><I name="settings" /></ToolBtn>
            <ToolBtn onClick={() => setTelefonOpen(true)}><I name="phone" /> {t("phone")}</ToolBtn>
            <ToolBtn onClick={() => setKilavuzOpen((v) => !v)}><I name="book" /> {t("guide_toggle")}</ToolBtn>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void yedekYukle(f);
              e.target.value = "";
            }}
          />
        </header>

        {uyarilar.filter((u) => u.tip !== "bilgi").length > 0 ? (
          <div className="no-print mb-3 space-y-1">
            {uyarilar
              .filter((u) => u.tip !== "bilgi")
              .slice(0, 3)
              .map((u) => (
                <p key={u.baslik} className="flex items-center gap-1.5 rounded-2xl bg-amber-400/15 px-3 py-1.5 text-xs text-amber-100">
                  <I name="warn" size={13} /> {u.mesaj}
                </p>
              ))}
          </div>
        ) : null}

        <div className="mb-3 no-print">
          <TotalsStrip kayitlar={kayitlar} ayarlar={ayarlar} year={year} month={month} />
        </div>

        <div className="mb-3 no-print grid gap-2 rounded-2xl bg-black/20 p-3 text-amber-50 md:grid-cols-[1fr_1fr_1fr_auto]">
          <p className="text-sm">
            <span className="text-amber-200/70">{t("period")}:</span> <span className="capitalize">{monthLabel(year, month, intl)}</span>
          </p>
          <p className="text-sm">
            <span className="text-amber-200/70">{t("rent_period")}:</span> {fm(ayarlar.kiraTutari)} / {ayarlar.kiraPeriyodu}
          </p>
          <p className="text-sm">
            <span className="text-amber-200/70">{t("monthly_cover")}:</span> {fm(ayarlar.aylikKiraKarsiligi)}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-200/70">{t("next_rent")}:</span> {ayarlar.kiraSonrakiTarih ? formatDate(ayarlar.kiraSonrakiTarih, intl) : t("noDate")}
            <button onClick={() => fileInput.current?.click()} className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] hover:bg-white/20">
              <I name="backup" size={12} /> {t("upload_backup")}
            </button>
          </div>
        </div>

        <div className={`grid min-h-0 flex-1 gap-3 ${kilavuzOpen ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
          <div className="min-w-0">
            <NotebookPanel
              kayitlar={kayitlar}
              ayarlar={ayarlar}
              year={year}
              month={month}
              focusDate={yazilacakTarih}
              onJumpDate={pickDate}
              onAdd={addKayit}
              onUpdate={updateKayit}
              onDelete={deleteKayit}
            />
          </div>
          {kilavuzOpen ? <KlavuzPaneli /> : null}
        </div>
      </div>

      <SettingsModal
        open={settingsOpen}
        ayarlar={ayarlar}
        onClose={() => setSettingsOpen(false)}
        onSave={saveAyarlar}
        onYedekIndir={yedekAl}
        onYedekYukle={() => fileInput.current?.click()}
        onSifirla={sifirlaHepsi}
        onKiraBol={kiraBol}
        sub={sub}
      />
      <TelefonModal open={telefonOpen} onClose={() => setTelefonOpen(false)} />
      <TakvimPanel
        open={takvimOpen}
        kayitlar={kayitlar}
        year={year}
        month={month}
        onClose={() => setTakvimOpen(false)}
        onPickDate={pickDate}
        onPickRange={pickRange}
        onChanged={() => void tazeleKayitlar()}
      />
      <ReportModal
        open={zOpen}
        title={t("rep_zTitle")}
        subtitle={t("rep_zSub")}
        rapor={zRapor}
        ayarlar={ayarlar}
        baslangic={zBas}
        bitis={zBit}
        onBaslangic={setZBas}
        onBitis={setZBit}
        onClose={() => setZOpen(false)}
        onRefresh={() => setToast(t("toast_reportReady"))}
        onExcel={() => downloadExcel("z", zBas, zBit)}
        pdfTip="z"
      />
      <ReportModal
        open={gunOpen}
        title={t("rep_dayTitle")}
        subtitle={t("rep_daySub")}
        rapor={gunRapor}
        ayarlar={ayarlar}
        baslangic={gunTarih}
        bitis={gunTarih}
        onBaslangic={setGunTarih}
        onBitis={setGunTarih}
        onClose={() => setGunOpen(false)}
        onRefresh={() => setToast(t("toast_dayReady"))}
        onExcel={() => downloadExcel("gunsonu", gunTarih, gunTarih)}
        pdfTip="gunsonu"
        singleDate
      />
      <ReportModal
        open={ayOpen}
        title={t("rep_monthTitle")}
        subtitle={t("rep_monthSub")}
        rapor={ayRapor}
        ayarlar={ayarlar}
        baslangic={ayBas}
        bitis={ayBit}
        onBaslangic={setAyBas}
        onBitis={setAyBit}
        onClose={() => setAyOpen(false)}
        onRefresh={() => setToast(t("toast_monthReady"))}
        onExcel={() => downloadExcel("aysonu", ayBas, ayBit)}
        pdfTip="aysonu"
        damga="AY SONU"
      />

      {toast ? (
        <div className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 px-3 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-amber-100/60">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ToolBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-amber-50/95 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-white"
    >
      {children}
    </button>
  );
}
