"use client";

import { jsPDF } from "jspdf";
import type { Ayarlar, RaporOzet } from "./types";
import { formatMoney, formatTRDate } from "./format";

const W = 1080;
const PAD = 48;
const BG = "#FBF6EA";
const INK = "#0F172A";
const SOLUK = "#64748B";
const CIZGI = "#E2D9C3";
const YESIL = "#15803D";
const KIRMIZI = "#B91C1C";
const LACIVERT = "#16324F";

function kisalt(ctx: CanvasRenderingContext2D, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let t = s;
  while (t.length > 4 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

/** Raporu WhatsApp'lık fiş görseli olarak çizer (1080px, Türkçe sorunsuz). */
export function raporCanvas(rapor: RaporOzet, ayarlar: Ayarlar, baslik: string, damga: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const kats = [...rapor.kategoriler].sort((a, b) => b.gelir + b.gider - (a.gelir + a.gider)).slice(0, 8);
  const gunler = rapor.gunler.slice(-20);
  const fisler = rapor.kayitlar.slice(0, 45);
  const maxKat = Math.max(1, ...kats.map((k) => k.gelir + k.gider));
  const maxGun = Math.max(1, ...gunler.map((g) => Math.abs(g.net)));

  const H =
    210 + // başlık
    4 * 76 + 16 + // istatistik ızgarası (15 kutu, 4 sütun)
    96 + // net / açılış / kapanış şeridi
    60 + kats.length * 46 + // kategoriler
    (gunler.length ? 60 + gunler.length * 42 : 0) + // günlükler
    60 + 44 + fisler.length * 42 + // fiş listesi
    70; // altbilgi

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "middle";
  let y = 0;
  // PDF sayfa kesimleri yalnız bu çizgilerde olur (satır asla bölünmez).
  const kesimler: number[] = [0];
  const kes = () => {
    kesimler.push(y);
  };

  // Başlık
  y += 36;
  ctx.fillStyle = INK;
  ctx.font = "700 46px system-ui, sans-serif";
  ctx.fillText(kisalt(ctx, ayarlar.isletmeAdi, 640), PAD, y + 20);
  ctx.font = "600 25px system-ui, sans-serif";
  ctx.fillStyle = SOLUK;
  ctx.fillText(baslik.toLocaleUpperCase("tr-TR"), PAD, y + 62);
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillText(`${formatTRDate(rapor.baslangic)} — ${formatTRDate(rapor.bitis)}`, PAD, y + 96);
  // Damga
  ctx.font = "700 24px system-ui, sans-serif";
  const damgaW = ctx.measureText(damga).width + 36;
  ctx.strokeStyle = LACIVERT;
  ctx.lineWidth = 3;
  ctx.strokeRect(W - PAD - damgaW, y + 8, damgaW, 52);
  ctx.fillStyle = LACIVERT;
  ctx.fillText(damga, W - PAD - damgaW + 18, y + 35);
  y += 150;
  ctx.strokeStyle = CIZGI;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 18;
  kes();

  // İstatistik ızgarası
  const kutular: Array<[string, string, string?]> = [
    ["Nakit Gelir", formatMoney(rapor.nakitGelir)],
    ["Nakit Gider", formatMoney(rapor.nakitGider)],
    ["Kart Gelir", formatMoney(rapor.kartGelir)],
    ["Kart Gider", formatMoney(rapor.kartGider)],
    ["Havale Gelir", formatMoney(rapor.havaleGelir)],
    ["Havale Gider", formatMoney(rapor.havaleGider)],
    ["Nakit Net", formatMoney(rapor.nakitNet), YESIL],
    ["Kart Net", formatMoney(rapor.kartNet), YESIL],
    ["Havale Net", formatMoney(rapor.havaleNet), YESIL],
    ["Toplam Gelir", formatMoney(rapor.gelir)],
    ["Toplam Gider", formatMoney(rapor.gider)],
    ["Kayıt", `${rapor.adet} satır`],
  ];
  const sutun = 4;
  const kutuW = (W - PAD * 2 - (sutun - 1) * 14) / sutun;
  kutular.forEach(([etiket, deger, renk], i) => {
    const cx = PAD + (i % sutun) * (kutuW + 14);
    const cy = y + Math.floor(i / sutun) * 76;
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = CIZGI;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx, cy, kutuW, 62, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SOLUK;
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(etiket.toLocaleUpperCase("tr-TR"), cx + 14, cy + 20);
    ctx.fillStyle = renk ?? INK;
    ctx.font = "700 27px system-ui, sans-serif";
    ctx.fillText(kisalt(ctx, deger, kutuW - 28), cx + 14, cy + 44);
  });
  y += Math.ceil(kutular.length / sutun) * 76 + 16;
  kes();

  // Net şeridi
  const serit: Array<[string, string, string]> = [
    ["GENEL NET", formatMoney(rapor.net), rapor.net >= 0 ? YESIL : KIRMIZI],
    ["AÇILIŞ", formatMoney(rapor.acilisBakiyesi), INK],
    ["KAPANIŞ", formatMoney(rapor.kapanisBakiyesi), LACIVERT],
  ];
  serit.forEach(([etiket, deger, renk], i) => {
    const cx = PAD + i * ((W - PAD * 2 - 28) / 3 + 14);
    const cw = (W - PAD * 2 - 28) / 3;
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = renk;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx, y, cw, 78, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SOLUK;
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(etiket, cx + 16, y + 24);
    ctx.fillStyle = renk;
    ctx.font = "700 34px system-ui, sans-serif";
    ctx.fillText(kisalt(ctx, deger, cw - 32), cx + 16, y + 54);
  });
  y += 96;
  kes();

  // Kategoriler
  ctx.fillStyle = INK;
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText("Kategoriler", PAD, y + 20);
  y += 52;
  kes();
  ctx.font = "24px system-ui, sans-serif";
  for (const k of kats) {
    const oran = (k.gelir + k.gider) / maxKat;
    ctx.fillStyle = INK;
    ctx.fillText(kisalt(ctx, `${k.kategori} · ${k.adet} kayıt`, 330), PAD, y + 16);
    ctx.fillStyle = "#E7DFC9";
    ctx.fillRect(400, y - 6, 420, 26);
    ctx.fillStyle = LACIVERT;
    ctx.fillRect(400, y - 6, Math.max(8, 420 * oran), 26);
    ctx.fillStyle = INK;
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText(formatMoney(k.net, false), 836, y + 16);
    ctx.font = "24px system-ui, sans-serif";
    y += 46;
    kes();
  }

  // Günlük netler
  if (gunler.length) {
    y += 8;
    ctx.fillStyle = INK;
    ctx.font = "700 30px system-ui, sans-serif";
    ctx.fillText("Günlük net", PAD, y + 20);
    y += 52;
    kes();
    ctx.font = "23px system-ui, sans-serif";
    for (const g of gunler) {
      const oran = Math.abs(g.net) / maxGun;
      ctx.fillStyle = SOLUK;
      ctx.fillText(formatTRDate(g.tarih).slice(0, 5), PAD, y + 14);
      ctx.fillStyle = "#E7DFC9";
      ctx.fillRect(180, y - 6, 560, 24);
      ctx.fillStyle = g.net >= 0 ? YESIL : KIRMIZI;
      ctx.fillRect(180, y - 6, Math.max(8, 560 * oran), 24);
      ctx.fillStyle = INK;
      ctx.font = "700 23px system-ui, sans-serif";
      ctx.fillText(formatMoney(g.net, false), 760, y + 14);
      ctx.font = "23px system-ui, sans-serif";
      y += 42;
      kes();
    }
  }

  // Fiş listesi
  y += 8;
  ctx.fillStyle = INK;
  ctx.font = "700 30px system-ui, sans-serif";
  ctx.fillText(`Fiş listesi (${rapor.kayitlar.length} kayıt)`, PAD, y + 20);
  y += 56;
  kes();
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillStyle = SOLUK;
  ctx.fillText("TARİH", PAD, y);
  ctx.fillText("AÇIKLAMA", 220, y);
  ctx.fillText("TUTAR", W - PAD - 170, y);
  y += 8;
  ctx.strokeStyle = CIZGI;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 24;
  kes();
  ctx.font = "24px system-ui, sans-serif";
  for (const k of fisler) {
    ctx.fillStyle = SOLUK;
    ctx.fillText(formatTRDate(k.tarih), PAD, y);
    ctx.fillStyle = INK;
    ctx.fillText(kisalt(ctx, k.aciklama, 560), 220, y);
    const tutar = formatMoney(k.gelir || k.gider);
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText(kisalt(ctx, tutar, 190), W - PAD - 190, y);
    ctx.font = "24px system-ui, sans-serif";
    y += 42;
    kes();
  }
  if (rapor.kayitlar.length > fisler.length) {
    ctx.fillStyle = SOLUK;
    ctx.fillText(`… ve ${rapor.kayitlar.length - fisler.length} kayıt daha (tümü Excel'de)`, PAD, y);
    y += 42;
    kes();
  }

  // Altbilgi
  y += 18;
  kes();
  ctx.strokeStyle = CIZGI;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  ctx.fillStyle = SOLUK;
  ctx.font = "22px system-ui, sans-serif";
  const simdi = new Date().toLocaleString("tr-TR");
  ctx.fillText(`${ayarlar.isletmeAdi} · Defterdar ile hazırlandı · ${simdi}`, PAD, y + 30);

  (canvas as HTMLCanvasElement & { _kesimler?: number[] })._kesimler = [...kesimler, H];
  return canvas;
}

function dosyaAdi(baslik: string, rapor: RaporOzet, uzanti: string): string {
  const temiz = (s: string) => s.replace(/[^\wçğıöşüÇĞİÖŞÜ-]+/gi, "-").replace(/-+/g, "-");
  return `${temiz(baslik)}-${rapor.baslangic}_${rapor.bitis}.${uzanti}`;
}

function indirBlob(blob: Blob, ad: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = ad;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** JPG indir (WhatsApp'a dosya olarak atılır). */
export function raporJpgIndir(canvas: HTMLCanvasElement, baslik: string, rapor: RaporOzet) {
  canvas.toBlob(
    (blob) => {
      if (blob) indirBlob(blob, dosyaAdi(baslik, rapor, "jpg"));
    },
    "image/jpeg",
    0.92,
  );
}

/** Tek tuşla paylaş: WhatsApp/uygulamalar (desteklenmezse indirir). */
export async function raporPaylas(canvas: HTMLCanvasElement, baslik: string, rapor: RaporOzet): Promise<"paylasildi" | "indirildi"> {  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (!blob) return "indirildi";
  const dosya = new File([blob], dosyaAdi(baslik, rapor, "jpg"), { type: "image/jpeg" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title: string }) => Promise<void> };
  try {
    if (nav.canShare?.({ files: [dosya] }) && nav.share) {
      await nav.share({ files: [dosya], title: `${baslik} ${formatTRDate(rapor.baslangic)} - ${formatTRDate(rapor.bitis)}` });
      return "paylasildi";
    }
  } catch {
    /* kullanıcı vazgeçti */
    return "paylasildi";
  }
  indirBlob(blob, dosyaAdi(baslik, rapor, "jpg"));
  return "indirildi";
}

/** PDF indir: aynı görsel A4 sayfalara bölünür (Türkçe sorunsuz, resim tabanlı). Kesim yalnız satır aralarında olur. */
export function raporPdfIndir(canvas: HTMLCanvasElement, baslik: string, rapor: RaporOzet) {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const sayfaW = 210;
  const sayfaH = 297;
  const marj = 10;
  const genislik = sayfaW - marj * 2;
  const maxYukseklikPx = ((sayfaH - marj * 2) / genislik) * canvas.width;
  const kesimler = (canvas as HTMLCanvasElement & { _kesimler?: number[] })._kesimler ?? [];
  const sinirlar = [...kesimler.filter((k) => k > 0 && k < canvas.height), canvas.height];

  let y = 0;
  let ilk = true;
  while (y < canvas.height - 1) {
    // Sayfaya sığan en uzak güvenli kesim; yoksa zorla böl.
    let bitis = y + maxYukseklikPx;
    const uygun = sinirlar.filter((k) => k > y + 1 && k <= y + maxYukseklikPx);
    bitis = uygun.length ? uygun[uygun.length - 1] : Math.min(canvas.height, y + maxYukseklikPx);
    const dilimH = Math.max(1, Math.ceil(bitis - y));
    const dilim = document.createElement("canvas");
    dilim.width = canvas.width;
    dilim.height = dilimH;
    const dctx = dilim.getContext("2d")!;
    dctx.fillStyle = BG;
    dctx.fillRect(0, 0, dilim.width, dilim.height);
    dctx.drawImage(canvas, 0, y, canvas.width, dilimH, 0, 0, canvas.width, dilimH);
    const img = dilim.toDataURL("image/jpeg", 0.92);
    if (!ilk) pdf.addPage();
    ilk = false;
    pdf.addImage(img, "JPEG", marj, marj, genislik, (dilimH / canvas.width) * genislik);
    y = bitis;
  }
  pdf.save(dosyaAdi(baslik, rapor, "pdf"));
}

export type GonderFormati = "pdf" | "jpg" | "excel";

/** 0556102095 → 90556102095 (wa.me biçimi). Geçersizse null. */
export function waNumara(no: string): string | null {
  const rakam = String(no || "").replace(/\D/g, "");
  const bastakiSifirsiz = rakam.startsWith("0") ? rakam.slice(1) : rakam;
  const tam = bastakiSifirsiz.startsWith("90") ? bastakiSifirsiz : `90${bastakiSifirsiz}`;
  return /^90\d{10}$/.test(tam) ? tam : null;
}

/**
 * Gönder akışı: seçilen formatta dosyayı indirir, dosyayı panoya kopyalar ve
 * yüklü WhatsApp uygulamasını alıcıyla açar. Kullanıcı sohbete Ctrl+V yapıp
 * gönderir (dosya eki WhatsApp protokolüne verilemez, o yüzden pano+indir).
 */
export async function gonderRapor(opts: {
  format: GonderFormati;
  canvas?: HTMLCanvasElement | null;
  rapor: RaporOzet;
  isletmeAdi: string;
  baslik: string;
  tip: string;
  baslangic: string;
  bitis: string;
  alici: string;
}): Promise<"whatsapp-acildi" | "indirildi" | "hata"> {
  const { format, canvas, rapor, isletmeAdi, baslik, tip, baslangic, bitis, alici } = opts;
  try {
    let blob: Blob | null = null;
    let ad = "";
    if (format === "jpg") {
      if (!canvas) return "hata";
      blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      ad = dosyaAdi(baslik, rapor, "jpg");
    } else if (format === "pdf") {
      const res = await fetch(`/api/pdf?tip=${encodeURIComponent(tip)}&baslangic=${baslangic}&bitis=${bitis}`);
      if (!res.ok) return "hata";
      blob = await res.blob();
      ad = dosyaAdi(baslik, rapor, "pdf");
    } else {
      const res = await fetch(`/api/export?tip=${encodeURIComponent(tip)}&baslangic=${baslangic}&bitis=${bitis}`);
      if (!res.ok) return "hata";
      blob = await res.blob();
      ad = dosyaAdi(baslik, rapor, "xlsx");
    }
    if (!blob) return "hata";

    const ozet = `${baslik} ${formatTRDate(rapor.baslangic)} - ${formatTRDate(rapor.bitis)}: Gelir ${formatMoney(rapor.gelir)} / Gider ${formatMoney(rapor.gider)} / Net ${formatMoney(rapor.net)} (${isletmeAdi})`;
    // 1) Dosya insin (garanti)
    indirBlob(blob, ad);
    // 2) Dosya panoya (sohbete Ctrl+V)
    try {
      const pano = navigator as Navigator & { clipboard?: { write?: (d: object[]) => Promise<void> } };
      const Kalem = (window as unknown as { ClipboardItem?: new (d: Record<string, Blob>) => object }).ClipboardItem;
      if (pano.clipboard?.write && Kalem) {
        await pano.clipboard.write([new Kalem({ [blob.type || "application/octet-stream"]: blob })]);
      }
    } catch {
      /* pano izni yoksa dosya zaten indi */
    }
    // 3) Yüklü WhatsApp uygulamasını alıcıyla aç (sekme değiştirmeden).
    const hedef = waNumara(alici);
    if (hedef) {
      const cerceve = document.createElement("iframe");
      cerceve.style.display = "none";
      cerceve.src = `whatsapp://send?phone=${hedef}&text=${encodeURIComponent(`${ozet} — dosya ektedir.`)}`;
      document.body.appendChild(cerceve);
      setTimeout(() => cerceve.remove(), 5000);
      return "whatsapp-acildi";
    }
    return "indirildi";
  } catch {
    return "hata";
  }
}
