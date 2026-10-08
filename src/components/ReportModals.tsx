"use client";

import { useEffect, useState } from "react";
import type { Ayarlar, RaporOzet } from "@/lib/types";
import { formatMoney, formatTRDate, formatTRDateLong } from "@/lib/format";
import { gonderRapor, raporCanvas, raporJpgIndir, type GonderFormati } from "@/lib/rapor-gorsel";

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  rapor: RaporOzet | null;
  ayarlar: Ayarlar;
  baslangic: string;
  bitis: string;
  onBaslangic: (v: string) => void;
  onBitis: (v: string) => void;
  onClose: () => void;
  onRefresh: () => void;
  onExcel: () => void;
  singleDate?: boolean;
  damga?: string;
  pdfTip?: string;
};

export function ReportModal({
  open,
  title,
  subtitle,
  rapor,
  ayarlar,
  baslangic,
  bitis,
  onBaslangic,
  onBitis,
  onClose,
  onRefresh,
  onExcel,
  singleDate,
  damga,
  pdfTip,
}: Props) {
  const [hazirlaniyor, setHazirlaniyor] = useState(false);
  const [gonderSec, setGonderSec] = useState(false);
  const [gonderDurum, setGonderDurum] = useState<string | null>(null);
  if (!open) return null;

  const damgaMetni = damga ?? (singleDate ? "GÜN SONU" : "Z RAPORU");

  function gorselHazirla(): HTMLCanvasElement | null {
    if (!rapor) return null;
    try {
      return raporCanvas(rapor, ayarlar, title, damgaMetni);
    } catch {
      return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/55 p-3 print:static print:bg-white print:p-0">
      <div className="print-root my-4 w-full max-w-4xl rounded-2xl bg-[#fbf6ea] text-slate-900 shadow-2xl print:my-0 print:max-w-none print:rounded-none print:shadow-none">
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-amber-200 px-5 py-3">
          <div className="mr-auto">
            <p className="font-hand text-3xl leading-none">{title}</p>
            <p className="text-xs text-slate-600">{subtitle}</p>
          </div>
          {singleDate ? (
            <input
              type="date"
              value={baslangic}
              onChange={(e) => {
                onBaslangic(e.target.value);
                onBitis(e.target.value);
              }}
              className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm"
            />
          ) : (
            <>
              <input
                type="date"
                value={baslangic}
                onChange={(e) => onBaslangic(e.target.value)}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm"
              />
              <span className="text-sm">—</span>
              <input
                type="date"
                value={bitis}
                onChange={(e) => onBitis(e.target.value)}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm"
              />
            </>
          )}
          <button onClick={onRefresh} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white">
            Getir
          </button>
          <button onClick={onExcel} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm text-white">
            Excel
          </button>
          <button
            disabled={hazirlaniyor || !rapor}
            onClick={() => {
              const c = gorselHazirla();
              if (c && rapor) raporJpgIndir(c, title, rapor);
            }}
            className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            title="Raporu resim olarak indir (WhatsApp'a atılır)"
          >
            📥 JPG
          </button>
          <button
            disabled={hazirlaniyor || !rapor}
            onClick={() => {
              window.location.href = `/api/pdf?tip=${encodeURIComponent(pdfTip ?? "z")}&baslangic=${baslangic}&bitis=${bitis}`;
            }}
            className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            title="Raporu PDF olarak indir (sunucudan, kesintisiz)"
          >
            📄 PDF
          </button>
          <button
            disabled={hazirlaniyor || !rapor}
            onClick={() => {
              setGonderDurum(null);
              setGonderSec(true);
            }}
            className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            title="Format seçip WhatsApp ile gönder"
          >
            📤 Gönder
          </button>
          <button onClick={() => window.print()} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm text-white">
            Yazdır / PDF
          </button>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600">
            Kapat
          </button>
        </div>

        {gonderSec ? (
          <div className="no-print border-b border-amber-200 bg-sky-50 px-5 py-3">
            <p className="text-sm font-semibold text-slate-800">
              Ne olarak göndereyim? <span className="font-normal text-slate-500">(alıcı: {ayarlar.whatsappAlici || "tanımsız"})</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["pdf", "jpg", "excel"] as GonderFormati[]).map((f) => (
                <button
                  key={f}
                  disabled={hazirlaniyor}
                  onClick={async () => {
                    if (!rapor) return;
                    setHazirlaniyor(true);
                    setGonderDurum("Hazırlanıyor…");
                    try {
                      const sonuc = await gonderRapor({
                        format: f,
                        canvas: f === "jpg" ? gorselHazirla() : null,
                        rapor,
                        isletmeAdi: ayarlar.isletmeAdi,
                        baslik: title,
                        tip: pdfTip ?? "z",
                        baslangic,
                        bitis,
                        alici: ayarlar.whatsappAlici,
                      });
                      setGonderDurum(
                        sonuc === "whatsapp-acildi"
                          ? "WhatsApp açılıyor — dosyayı sohbete yapıştır (Ctrl+V) ya da ataçla ekle."
                          : sonuc === "indirildi"
                            ? "Dosya indirildi (WhatsApp açılamadıysa numarayı ayarlardan kontrol et)."
                            : "Olmadı — tekrar dene.",
                      );
                    } finally {
                      setHazirlaniyor(false);
                    }
                  }}
                  className="rounded-lg bg-sky-700 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {f === "pdf" ? "📄 PDF" : f === "jpg" ? "🖼️ JPG" : "📊 Excel"}
                </button>
              ))}
              <button
                onClick={() => setGonderSec(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600"
              >
                Vazgeç
              </button>
            </div>
            {gonderDurum ? <p className="mt-1 text-xs text-slate-600">{gonderDurum}</p> : null}
          </div>
        ) : null}

        <div className="print-sheet px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/images/logo.svg" alt="Logo" className="h-16 w-16 rounded-full object-cover" />
              <div>
                <p className="font-hand text-4xl leading-none">{ayarlar.isletmeAdi}</p>
                <p className="mt-1 text-sm uppercase tracking-[0.2em] text-slate-500">{title}</p>
                <p className="text-sm text-slate-600">
                  {rapor ? `${formatTRDate(rapor.baslangic)} — ${formatTRDate(rapor.bitis)}` : ""}
                </p>
              </div>
            </div>
            <div className="stamp px-3 py-1 text-xs font-bold">{damga ?? (singleDate ? "GÜN SONU" : "Z RAPORU")}</div>
          </div>

          {rapor ? (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Nakit Gelir" value={formatMoney(rapor.nakitGelir)} />
                <Stat label="Nakit Gider" value={formatMoney(rapor.nakitGider)} />
                <Stat label="Kart Gelir" value={formatMoney(rapor.kartGelir)} />
                <Stat label="Kart Gider" value={formatMoney(rapor.kartGider)} />
                <Stat label="Havale Gelir" value={formatMoney(rapor.havaleGelir)} />
                <Stat label="Havale Gider" value={formatMoney(rapor.havaleGider)} />
                <Stat label="Nakit Net" value={formatMoney(rapor.nakitNet)} accent />
                <Stat label="Kart Net" value={formatMoney(rapor.kartNet)} accent />
                <Stat label="Havale Net" value={formatMoney(rapor.havaleNet)} accent />
                <Stat label="Toplam Gelir" value={formatMoney(rapor.gelir)} />
                <Stat label="Toplam Gider" value={formatMoney(rapor.gider)} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label="Genel Net" value={formatMoney(rapor.net)} big />
                <Stat label="Açılış" value={formatMoney(rapor.acilisBakiyesi)} />
                <Stat label="Kapanış" value={formatMoney(rapor.kapanisBakiyesi)} big />
              </div>

              <GrafikCubuklari rapor={rapor} />

              <h3 className="mt-8 font-hand text-2xl">Günlük döküm</h3>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2">Tarih</th>
                    <th>Nakit</th>
                    <th>Kart</th>
                    <th>Havale</th>
                    <th>Gelir</th>
                    <th>Gider</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.gunler.map((g) => (
                    <tr key={g.tarih} className="border-b border-slate-200">
                      <td className="py-1.5">{formatTRDate(g.tarih)}</td>
                      <td>{formatMoney(g.nakitGelir - g.nakitGider)}</td>
                      <td>{formatMoney(g.kartGelir - g.kartGider)}</td>
                      <td>{formatMoney(g.havaleGelir - g.havaleGider)}</td>
                      <td>{formatMoney(g.gelir)}</td>
                      <td>{formatMoney(g.gider)}</td>
                      <td className="font-semibold">{formatMoney(g.net)}</td>
                    </tr>
                  ))}
                  {rapor.gunler.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-500">
                        Bu aralıkta kayıt yok.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <h3 className="mt-8 font-hand text-2xl">Kategoriler</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {rapor.kategoriler.map((k) => (
                  <div key={k.kategori} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm">
                    <span>{k.kategori} · {k.adet} kayıt</span>
                    <span className="tabular-nums">{formatMoney(k.net)}</span>
                  </div>
                ))}
              </div>

              <h3 className="mt-8 font-hand text-2xl">Fiş listesi</h3>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-2">Tarih</th>
                    <th>Açıklama</th>
                    <th>Kategori</th>
                    <th>Tip</th>
                    <th>Gelir</th>
                    <th>Gider</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.kayitlar.map((k) => (
                    <tr key={k.id} className="border-b border-slate-200">
                      <td className="py-1.5">{formatTRDate(k.tarih)}</td>
                      <td>{k.aciklama}</td>
                      <td>{k.kategori}</td>
                      <td>{k.odemeTipi}</td>
                      <td>{k.gelir ? formatMoney(k.gelir) : "—"}</td>
                      <td>{k.gider ? formatMoney(k.gider) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-8 text-right text-xs text-slate-500">
                {ayarlar.isletmeAdi} · {formatTRDateLong(rapor.bitis)} · Mgroq Defter
              </p>
            </>
          ) : (
            <p className="py-10 text-center text-slate-500">Rapor yükleniyor…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function GrafikCubuklari({ rapor }: { rapor: RaporOzet }) {
  const maxGun = Math.max(1, ...rapor.gunler.map((g) => Math.abs(g.net)));
  const maxKat = Math.max(1, ...rapor.kategoriler.map((k) => k.gider + k.gelir));
  const gunler = rapor.gunler.slice(-14);
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Günlük net grafiği{rapor.gunler.length > 14 ? " (son 14 gün)" : ""}</p>
        <div className="mt-2 space-y-1">
          {gunler.map((g) => (
            <div key={g.tarih} className="flex items-center gap-2 text-[11px]">
              <span className="w-14 shrink-0 tabular-nums text-slate-600">{formatTRDate(g.tarih).slice(0, 5)}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="yazdir-renk h-3 rounded-full"
                  style={{
                    width: `${Math.max(3, Math.round((Math.abs(g.net) / maxGun) * 100))}%`,
                    background: g.net >= 0 ? "#15803d" : "#b91c1c",
                  }}
                />
              </div>
              <span className="w-20 shrink-0 text-right tabular-nums text-slate-700">{formatMoney(g.net, false)}</span>
            </div>
          ))}
          {gunler.length === 0 ? <p className="text-xs text-slate-400">Grafik için kayıt yok.</p> : null}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-white/80 p-3">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">Kategori dağılımı (hacme göre)</p>
        <div className="mt-2 space-y-1">
          {rapor.kategoriler.slice(0, 8).map((k) => (
            <div key={k.kategori} className="flex items-center gap-2 text-[11px]">
              <span className="w-16 shrink-0 truncate text-slate-600">{k.kategori}</span>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="yazdir-renk h-3 rounded-full"
                  style={{
                    width: `${Math.max(3, Math.round(((k.gider + k.gelir) / maxKat) * 100))}%`,
                    background: "#16324f",
                  }}
                />
              </div>
              <span className="w-20 shrink-0 text-right tabular-nums text-slate-700">{formatMoney(k.net, false)}</span>
            </div>
          ))}
          {rapor.kategoriler.length === 0 ? <p className="text-xs text-slate-400">Grafik için kayıt yok.</p> : null}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent?: boolean;
  big?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-amber-200 bg-white/80 px-3 py-3 ${big ? "col-span-1" : ""}`}>
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-semibold tabular-nums ${accent ? "text-teal-800" : "text-slate-900"} ${big ? "text-xl" : "text-base"}`}>
        {value}
      </p>
    </div>
  );
}

type SettingsProps = {
  open: boolean;
  ayarlar: Ayarlar;
  onClose: () => void;
  onSave: (patch: Partial<Ayarlar>) => Promise<void>;
  onYedekIndir: () => void;
  onYedekYukle: () => void;
  onSifirla: () => void;
};

type HafizaBilgi = {
  mod: string;
  kayitSayisi: number;
  mesajSayisi: number;
  yedekSayisi: number;
  sonYedek: string | null;
  veriKlasoru: string;
  groqAktif: boolean;
};

function HafizaBolumu({
  onYedekIndir,
  onYedekYukle,
  onSifirla,
}: {
  onYedekIndir: () => void;
  onYedekYukle: () => void;
  onSifirla: () => void;
}) {
  const [bilgi, setBilgi] = useState<HafizaBilgi | null>(null);
  const [sifirlaKurulu, setSifirlaKurulu] = useState(false);

  useEffect(() => {
    fetch("/api/hafiza")
      .then((r) => r.json())
      .then((j) => setBilgi(j as HafizaBilgi))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!sifirlaKurulu) return;
    const t = setTimeout(() => setSifirlaKurulu(false), 6000);
    return () => clearTimeout(t);
  }, [sifirlaKurulu]);

  return (
    <div className="mt-5 rounded-2xl bg-slate-900 p-4 text-slate-100">
      <p className="font-hand text-2xl text-emerald-200">💾 Hafıza koruması</p>
      {bilgi ? (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Mod</p>
              <p className="font-semibold">{bilgi.mod === "postgres" ? "DB + Dosya" : "Kalıcı dosya"}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Kayıt</p>
              <p className="font-semibold tabular-nums">{bilgi.kayitSayisi}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Sohbet</p>
              <p className="font-semibold tabular-nums">{bilgi.mesajSayisi}</p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Yedek</p>
              <p className="font-semibold tabular-nums">{bilgi.yedekSayisi} adet</p>
            </div>
          </div>
          <p className="mt-2 truncate text-[11px] text-slate-400" title={bilgi.veriKlasoru}>
            📁 {bilgi.veriKlasoru}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Veriler program klasörünün <span className="text-emerald-300">dışında</span> saklanır — güncelleme yapsanız bile
            silinmez. Her yazımda <span className="text-emerald-300">.bak</span> kopyası + günlük otomatik yedek alınır.
            {bilgi.sonYedek ? ` Son yedek: ${bilgi.sonYedek}.` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onYedekIndir} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white">
              📥 Yedeği indir
            </button>
            <button type="button" onClick={onYedekYukle} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm">
              📤 Yedekten geri yükle
            </button>
          </div>
          <div className="mt-3 rounded-xl border border-rose-500/40 p-3">
            <p className="text-xs text-rose-200">⛔ Tehlike bölgesi: tüm kayıtlar, kasa açılışı ve kira sıfırlanır. Geri alınamaz!</p>
            {sifirlaKurulu ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">Emin misin? HEPSİ gidecek!</span>
                <button
                  type="button"
                  onClick={() => {
                    setSifirlaKurulu(false);
                    onSifirla();
                  }}
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-bold text-white"
                >
                  Evet, SIFIRLA
                </button>
                <button type="button" onClick={() => setSifirlaKurulu(false)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm">
                  Vazgeç
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSifirlaKurulu(true)}
                className="mt-2 rounded-lg border border-rose-400/60 px-3 py-1.5 text-sm text-rose-200"
              >
                🗑️ Tüm veriyi sıfırla
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Hafıza bilgisi yükleniyor…</p>
      )}
    </div>
  );
}

export function SettingsModal({ open, ayarlar, onClose, onSave, onYedekIndir, onYedekYukle, onSifirla }: SettingsProps) {  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <form
        className="w-full max-w-lg rounded-2xl bg-[#fbf6ea] p-6 shadow-2xl"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          const kiraTutari = Number(data.get("kiraTutari") || 0);
          const kiraPeriyodu = Number(data.get("kiraPeriyodu") || 6);
          await onSave({
            isletmeAdi: String(data.get("isletmeAdi") || ""),
            kiraTutari,
            kiraPeriyodu,
            aylikKiraKarsiligi: kiraPeriyodu ? kiraTutari / kiraPeriyodu : 0,
            kiraSonrakiTarih: String(data.get("kiraSonrakiTarih") || "") || null,
            acilisBakiyesi: Number(data.get("acilisBakiyesi") || 0),
            aiMotor: ["otomatik", "groq", "ollama"].includes(String(data.get("aiMotor")))
              ? (String(data.get("aiMotor")) as Ayarlar["aiMotor"])
              : "otomatik",
            ollamaModel: String(data.get("ollamaModel") || "").trim() || "gemma3:4b",
            whatsappAlici: String(data.get("whatsappAlici") || "").trim() || "0556102095",
          });
          onClose();
        }}
      >
        <p className="font-hand text-3xl">Defter ayarları</p>
        <div className="mt-4 grid gap-3">
          <label className="text-sm">
            İşletme adı
            <input name="isletmeAdi" defaultValue={ayarlar.isletmeAdi} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Kira tutarı (₺)
              <input name="kiraTutari" type="number" step="0.01" defaultValue={ayarlar.kiraTutari} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
            </label>
            <label className="text-sm">
              Periyot (ay)
              <input name="kiraPeriyodu" type="number" defaultValue={ayarlar.kiraPeriyodu} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
            </label>
          </div>
          <p className="text-xs text-slate-600">
            6 ayda bir 150.000 ₺ girilirse aylık karşılık otomatik 25.000 ₺ olur.
          </p>
          <label className="text-sm">
            Sonraki kira tarihi
            <input name="kiraSonrakiTarih" type="date" defaultValue={ayarlar.kiraSonrakiTarih ?? ""} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
          </label>
          <label className="text-sm">
            Açılış bakiyesi (₺)
            <input name="acilisBakiyesi" type="number" step="0.01" defaultValue={ayarlar.acilisBakiyesi} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
          </label>
          <label className="text-sm">
            Yapay zekâ motoru
            <select name="aiMotor" defaultValue={ayarlar.aiMotor} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2">
              <option value="otomatik">Otomatik (önerilir: Groq beyin + yerel anlatım)</option>
              <option value="groq">Groq (hepsi internetten, key harcar)</option>
              <option value="ollama">Ollama (önce yerel, key harcamaz)</option>
            </select>
          </label>
          <label className="text-sm">
            Ollama modeli
            <input name="ollamaModel" defaultValue={ayarlar.ollamaModel} placeholder="gemma3:4b" className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
          </label>
          <label className="text-sm">
            WhatsApp alıcı no (rapor buraya gider)
            <input name="whatsappAlici" defaultValue={ayarlar.whatsappAlici} placeholder="0556102095" className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2" />
          </label>
          <p className="text-xs text-slate-600">
            Ollama kapalıysa veya model bulunamazsa otomatik Groq devreye girer. Yeni model çekmek için: <code>ollama pull model-adi</code>
          </p>
        </div>
        <HafizaBolumu onYedekIndir={onYedekIndir} onYedekYukle={onYedekYukle} onSifirla={onSifirla} />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm">
            Vazgeç
          </button>
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
            Kaydet
          </button>
        </div>
      </form>
    </div>
  );
}

type TelefonBilgi = {
  ip: string;
  port: number;
  url: string;
  qr: string | null;
};

/** Telefonda aç: aynı Wi-Fi'den karekodla bağlan. */
export function TelefonModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [bilgi, setBilgi] = useState<TelefonBilgi | null>(null);
  const [kopya, setKopya] = useState(false);
  const [kurabilir, setKurabilir] = useState(false);
  const [kuruldu, setKuruldu] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBilgi(null);
    fetch("/api/telefon")
      .then((r) => r.json())
      .then((j) => setBilgi(j as TelefonBilgi))
      .catch(() => undefined);
  }, [open ]);

  useEffect(() => {
    const yakala = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __kurOlay?: { prompt: () => void; userChoice: Promise<{ outcome: string }> } }).__kurOlay = e as unknown as {
        prompt: () => void;
        userChoice: Promise<{ outcome: string }>;
      };
      setKurabilir(true);
    };
    window.addEventListener("beforeinstallprompt", yakala);
    return () => window.removeEventListener("beforeinstallprompt", yakala);
  }, []);

  async function kur() {
    const olay = (window as unknown as { __kurOlay?: { prompt: () => void; userChoice: Promise<{ outcome: string }> } }).__kurOlay;
    if (!olay) {
      setKuruldu("Telefonda tarayıcı menüsünden kur (aşağıya bak).");
      return;
    }
    try {
      olay.prompt();
      const secim = await olay.userChoice;
      setKuruldu(secim.outcome === "accepted" ? "Kuruluyor — ana ekrana Defterdar gelecek." : "Vazgeçtin — menüden de kurabilirsin.");
      if (secim.outcome === "accepted") setKurabilir(false);
    } catch {
      setKuruldu("Olmadı — menüden dene.");
    }
  }

  useEffect(() => {
    if (!kopya) return;
    const t = setTimeout(() => setKopya(false), 2000);
    return () => clearTimeout(t);
  }, [kopya]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#fbf6ea] p-6 text-center shadow-2xl">
        <p className="font-hand text-3xl">📱 Telefonda aç</p>
        <p className="mt-1 text-xs text-slate-600">Aynı Wi-Fi'ye bağlı telefonun kamerasıyla oku</p>
        {bilgi ? (
          <>
            {bilgi.qr ? (
              <img src={bilgi.qr} alt="Bağlantı karekodu" className="mx-auto mt-3 h-52 w-52 rounded-xl bg-white p-2 ring-1 ring-amber-300" />
            ) : (
              <p className="mt-3 text-sm text-slate-500">Karekod üretilemedi — adresi elle yaz:</p>
            )}
            <p className="mt-3 font-mono text-lg font-bold text-slate-900">{bilgi.url}</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(bilgi.url).then(
                  () => setKopya(true),
                  () => undefined,
                );
              }}
              className="mt-2 rounded-lg bg-slate-900 px-4 py-1.5 text-sm text-white"
            >
              {kopya ? "Kopyalandı ✓" : "Adresi kopyala"}
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Açılmazsa: bilgisayar açık + aynı Wi-Fi'de olmalısın. Windows sorarsa ağ iznini ver.
              Bilgisayar kapanınca telefon da kesilir.
            </p>
            <div className="mt-3 rounded-xl bg-teal-50 p-3 ring-1 ring-teal-200">
              <p className="text-sm font-semibold text-teal-900">📲 Uygulama gibi kur</p>
              {kurabilir ? (
                <button
                  type="button"
                  onClick={() => void kur()}
                  className="mt-2 w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
                >
                  Telefona kur
                </button>
              ) : (
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                  iPhone: Safari'de Paylaş → <b>Ana Ekrana Ekle</b>.
                  Android: Chrome'da <b>⋮ → Ana ekrana ekle / Uygulamayı yükle</b>.
                </p>
              )}
              {kuruldu ? <p className="mt-1 text-[11px] text-teal-800">{kuruldu}</p> : null}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Adres bulunuyor…</p>
        )}
        <button type="button" onClick={onClose} className="mt-4 rounded-lg px-4 py-2 text-sm text-slate-600">
          Kapat
        </button>
      </div>
    </div>
  );
}
