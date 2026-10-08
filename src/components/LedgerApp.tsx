"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Ayarlar, ChatAction, InitData, Kayit, KayitGirdi, RaporOzet, SohbetMesaji, Uyari } from "@/lib/types";
import { formatMoney, monthLabel, toISODate, AYLAR } from "@/lib/format";
import { buildRapor, computeUyarilar, monthRange } from "@/lib/reports";
import { NotebookPanel, TotalsStrip } from "./NotebookPanel";
import { GlobalBar } from "./GlobalBar";
import { useT } from "@/lib/i18n";
import { AiPanel } from "./AiPanel";
import { ReportModal, SettingsModal, TelefonModal } from "./ReportModals";
import { TakvimPanel } from "./TakvimPanel";

type Tab = "defter" | "asistan";

export function LedgerApp({ initial }: { initial: InitData }) {
  const { t } = useT();
  const now = new Date();
  const [kayitlar, setKayitlar] = useState<Kayit[]>(initial.kayitlar);
  const [ayarlar, setAyarlar] = useState<Ayarlar>(initial.ayarlar);
  const [mesajlar, setMesajlar] = useState<SohbetMesaji[]>(initial.mesajlar);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<Tab>("defter");
  const [chatBusy, setChatBusy] = useState(false);
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
  const [yazilacakTarih, setYazilacakTarih] = useState<string | null>(null);
  const [hafizaMod, setHafizaMod] = useState<string>("dosya");
  const [groqAktif, setGroqAktif] = useState<boolean>(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Hafıza + Groq durumu (üstte rozet)
  useEffect(() => {
    // Telefona kurulum için service worker (önbelleksiz, bayatlatmaz)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => {
        setHafizaMod(j.mod ?? "dosya");
        setGroqAktif(Boolean(j.groq));
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

  const uyarilar: Uyari[] = useMemo(() => computeUyarilar(kayitlar, ayarlar), [kayitlar, ayarlar]);
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
    setMesajlar(data.mesajlar);
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
      setToast("Satır deftere işlendi");
    } catch {
      setToast("Kaydedilemedi — bağlantıyı kontrol edip tekrar deneyin");
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
      setToast("Kayıt güncellendi");
    } catch {
      setToast("Güncellenemedi — tekrar deneyin");
      void tazeleKayitlar();
    }
  }

  async function deleteKayit(id: string) {
    try {
      const res = await fetch(`/api/kayitlar/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("sil");
      // Sunucudan doğrula: gerçekten gitti mi?
      const ok = await tazeleKayitlar();
      setToast(ok ? "Kayıt silindi" : "Silindi (liste yenilenemedi, sayfayı yenileyin)");
    } catch {
      setToast("Silinemedi — bağlantıyı kontrol edip tekrar deneyin");
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
      setToast("Tüm veriler sıfırlandı — sıfırdan başlayabilirsiniz");
    } catch {
      setToast("Sıfırlanamadı — tekrar deneyin");
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
    setToast("Ayarlar kaydedildi");
  }

  async function sendChat(message: string) {
    setChatBusy(true);
    const optimistic: SohbetMesaji = {
      id: `tmp-${Date.now()}`,
      rol: "user",
      icerik: message,
      olusturmaZamani: new Date().toISOString(),
    };
    setMesajlar((prev) => [...prev, optimistic]);
    try {
      const res = await fetch("/api/sohbet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = (await res.json()) as { reply: string; data: InitData; action?: ChatAction };
      applyData(json.data);
      if (json.action) applyChatAction(json.action);
    } catch {
      setMesajlar((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          rol: "assistant",
          icerik: "Bağlantı hatası. Komutu tekrar dener misiniz?",
          olusturmaZamani: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  function applyChatAction(action: ChatAction) {
    if (action.type === "open_calendar") setTakvimOpen(true);
    else if (action.type === "open_settings") setSettingsOpen(true);
    else if (action.type === "choose_backup_file") fileInput.current?.click();
    else if (action.type === "download_backup") yedekAl();
    else if (action.type === "download_excel") downloadExcel(action.tip, action.baslangic, action.bitis);
    else if (action.type === "print_page") window.print();
    else if (action.type === "open_tab") setTab(action.tab);
    else if (action.type === "navigate_month") gitAy(action.year, action.month);
    else if (action.type === "navigate_date") {
      const [targetYear, targetMonth] = action.date.split("-").map(Number);
      gitAy(targetYear, targetMonth);
      setGunTarih(action.date);
      setYazilacakTarih(action.date);
      setTab("defter");
      setTakvimOpen(false);
    }
    else if (action.type === "open_report") {
      const start = action.baslangic ?? toISODate();
      const end = action.bitis ?? start;
      if (action.report === "z") {
        setZBas(start);
        setZBit(end);
        setZOpen(true);
      } else if (action.report === "day") {
        setGunTarih(start);
        setGunOpen(true);
      } else {
        setAyBas(start);
        setAyBit(end);
        setAyOpen(true);
      }
    }
  }

  /** Sohbeti temizle (kayıtlara dokunmaz) */
  async function temizleSohbet() {
    try {
      const res = await fetch("/api/sohbet", { method: "DELETE" });
      if (!res.ok) throw new Error("temizle");
      const json = (await res.json()) as { data: InitData };
      applyData(json.data);
      setToast("Sohbet temizlendi");
    } catch {
      setToast("Temizlenemedi — tekrar deneyin");
    }
  }

  function downloadExcel(tip: string, baslangic: string, bitis: string) {
    window.location.href = `/api/export?tip=${encodeURIComponent(tip)}&baslangic=${baslangic}&bitis=${bitis}`;
    setToast("Excel indiriliyor");
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
    setTab("defter");
    setToast(`${iso} seçildi — yeni satır bu tarihe hazır`);
  }

  function pickRange(bas: string, bit: string) {
    setZBas(bas);
    setZBit(bit);
    setTakvimOpen(false);
    setZOpen(true);
  }

  function yedekAl() {
    window.location.href = "/api/hafiza?indir=1";
    setToast("Yedek indiriliyor");
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
      setToast("Yedek geri yüklendi");
    } catch {
      setToast("Yedek yüklenemedi");
    }
  }

  return (
    <div className="desk-app min-h-screen">
      <div className={`mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3 md:px-5 md:py-4 ${zOpen || gunOpen ? "no-print" : ""}`}>
        <div className="mb-2">
          <GlobalBar />
        </div>
        <header className="no-print mb-3 flex flex-wrap items-center gap-3 rounded-[24px] bg-black/25 px-3 py-2 text-amber-50 backdrop-blur-md">
          <img src="/images/logo.svg" alt="Mgroq Defter" className="h-12 w-12 rounded-full object-cover ring-2 ring-amber-200/40" />
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
              title="Ay seç"
            >
              {AYLAR.map((a, i) => (
                <option key={a} value={i + 1}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => gitAy(Number(e.target.value), month)}
              className="bg-transparent px-1 text-center text-sm outline-none [&>option]:text-slate-900"
              title="Yıl seç (geçmişe git)"
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
              className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wider ${
                hafizaMod === "postgres" ? "bg-sky-400/20 text-sky-100" : "bg-emerald-400/20 text-emerald-100"
              }`}
              title="Hafıza modu: dosya + otomatik yedek, veri kaybolmaz"
            >
              💾 {hafizaMod === "postgres" ? "DB+Dosya" : "Kalıcı hafıza"}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wider ${
                groqAktif ? "bg-teal-400/20 text-teal-100" : "bg-amber-400/20 text-amber-100"
              }`}
              title={groqAktif ? "Groq AI bağlı" : "Yerel asistan (Groq anahtarı yoksa yerel çalışır)"}
            >
              {groqAktif ? "🤖 Groq açık" : "🤖 Yerel"}
            </span>
          </div>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <HeaderStat label={t("income")} value={formatMoney(donem.gelir)} />
            <HeaderStat label={t("expense")} value={formatMoney(donem.gider)} />
            <HeaderStat label={t("net")} value={formatMoney(donem.gelir - donem.gider)} />
            <HeaderStat label={t("monthly_rent")} value={formatMoney(ayarlar.aylikKiraKarsiligi)} />
          </div>

          <div className="flex flex-wrap gap-1">
            <ToolBtn onClick={() => setTakvimOpen(true)}>📅 {t("calendar")}</ToolBtn>
            <ToolBtn onClick={() => setGunOpen(true)}>🌙 {t("day_end")}</ToolBtn>
            <ToolBtn onClick={() => setAyOpen(true)}>📅 {t("month_end")}</ToolBtn>
            <ToolBtn onClick={() => setZOpen(true)}>🧾 {t("z_report")}</ToolBtn>
            <ToolBtn onClick={() => downloadExcel("defter", monthRange(year, month).baslangic, monthRange(year, month).bitis)}>
              📤 {t("excel")}
            </ToolBtn>
            <ToolBtn onClick={yedekAl}>💾 {t("backup")}</ToolBtn>
            <ToolBtn
              onClick={() => {
                const r = monthRange(year, month);
                setZBas(r.baslangic);
                setZBit(r.bitis);
                setZOpen(true);
              }}
            >
              🖨️ {t("print")}
            </ToolBtn>
            <ToolBtn onClick={() => setSettingsOpen(true)}>⚙️</ToolBtn>
            <ToolBtn onClick={() => setTelefonOpen(true)}>📱 {t("phone")}</ToolBtn>
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

        <div className="no-print mb-3 lg:hidden">
          <div className="grid grid-cols-2 gap-2 rounded-[20px] bg-black/20 p-1 text-amber-50">
            <button
              onClick={() => setTab("defter")}
              className={`rounded-2xl py-2 text-sm ${tab === "defter" ? "bg-amber-100 text-slate-900" : ""}`}
            >
              {t("ledger")}
            </button>
            <button
              onClick={() => setTab("asistan")}
              className={`rounded-2xl py-2 text-sm ${tab === "asistan" ? "bg-teal-200 text-slate-900" : ""}`}
            >
              {t("assistant")}
            </button>
          </div>
        </div>

        <div className="mb-3 no-print">
          <TotalsStrip kayitlar={kayitlar} ayarlar={ayarlar} year={year} month={month} />
        </div>

        <div className="mb-3 no-print grid gap-2 rounded-2xl bg-black/20 p-3 text-amber-50 md:grid-cols-[1fr_1fr_1fr_auto]">
          <p className="text-sm">
            <span className="text-amber-200/70">{t("period")}:</span> <span className="capitalize">{monthLabel(year, month)}</span>
          </p>
          <p className="text-sm">
            <span className="text-amber-200/70">{t("rent_period")}:</span> {formatMoney(ayarlar.kiraTutari)} / {ayarlar.kiraPeriyodu}
          </p>
          <p className="text-sm">
            <span className="text-amber-200/70">{t("monthly_cover")}:</span> {formatMoney(ayarlar.aylikKiraKarsiligi)}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-amber-200/70">{t("next_rent")}:</span> {ayarlar.kiraSonrakiTarih ?? "—"}
            <button onClick={() => fileInput.current?.click()} className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] hover:bg-white/20">
              📥 {t("upload_backup")}
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
          <div className={tab === "defter" ? "block" : "hidden lg:block"}>
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
          <div className={`${tab === "asistan" ? "block" : "hidden lg:block"} no-print min-h-[70vh] lg:min-h-0 lg:sticky lg:bottom-3 lg:h-[calc(100dvh-340px)] lg:max-h-[620px] lg:self-end`}>
            <AiPanel mesajlar={mesajlar} uyarilar={uyarilar} busy={chatBusy} onSend={sendChat} onClear={temizleSohbet} />
          </div>
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
      />
      <ReportModal
        open={zOpen}
        title="Z Raporu"
        subtitle="İki tarih arası nakit / kart dökümü"
        rapor={zRapor}
        ayarlar={ayarlar}
        baslangic={zBas}
        bitis={zBit}
        onBaslangic={setZBas}
        onBitis={setZBit}
        onClose={() => setZOpen(false)}
        onRefresh={() => setToast("Rapor güncellendi")}
        onExcel={() => downloadExcel("z", zBas, zBit)}
        pdfTip="z"
      />
      <ReportModal
        open={gunOpen}
        title="Gün Sonu"
        subtitle="Seçilen tarihin kasa kapanışı"
        rapor={gunRapor}
        ayarlar={ayarlar}
        baslangic={gunTarih}
        bitis={gunTarih}
        onBaslangic={setGunTarih}
        onBitis={setGunTarih}
        onClose={() => setGunOpen(false)}
        onRefresh={() => setToast("Gün sonu hazır")}
        onExcel={() => downloadExcel("gunsonu", gunTarih, gunTarih)}
        pdfTip="gunsonu"
        singleDate
      />
      <ReportModal
        open={ayOpen}
        title="Ay Sonu"
        subtitle="Aylık kapanış — nakit / kart / günlük döküm"
        rapor={ayRapor}
        ayarlar={ayarlar}
        baslangic={ayBas}
        bitis={ayBit}
        onBaslangic={setAyBas}
        onBitis={setAyBit}
        onClose={() => setAyOpen(false)}
        onRefresh={() => setToast("Ay sonu hazır")}
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
      className="rounded-full bg-amber-50/95 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-white"
    >
      {children}
    </button>
  );
}
