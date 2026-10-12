"use client";

import QRCode from "qrcode";

/** Phomemo D520 (203 DPI) — labelife'taki değerlerin aynısı. */
export const ETIKET_DPI = 203;
export const ETIKET_GENIS_MM = 60;
export const ETIKET_YUKSEK_MM = 40;
export const ETIKET_BOSLUK_MM = 3;
export const ETIKET_HIZ = 4;
export const ETIKET_YOGUNLUK = 8;

export type SeriPort = {
  open(opts: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
  getInfo(): Promise<{ usbVendorId?: number; usbProductId?: number }>;
  readonly writable: {
    getWriter(): { write(d: Uint8Array): Promise<void>; releaseLock(): void };
  } | null;
};

type SeriApi = {
  requestPort(opts: Record<string, unknown>): Promise<SeriPort>;
  getPorts(): Promise<SeriPort[]>;
};

function seriApi(): SeriApi | null {
  if (typeof navigator === "undefined") return null;
  const s = (navigator as unknown as { serial?: SeriApi }).serial;
  return s ?? null;
}

/** Bu tarayıcı yazıcıya direkt bağlanabilir mi? (PC/Android Chrome-Edge; iPhone'da yok) */
export function seriDestekliMi(): boolean {
  return seriApi() !== null;
}

export async function kayitliPortlar(): Promise<SeriPort[]> {
  const api = seriApi();
  if (!api) return [];
  try {
    return await api.getPorts();
  } catch {
    return [];
  }
}

export async function portIste(): Promise<SeriPort | null> {
  const api = seriApi();
  if (!api) return null;
  try {
    return await api.requestPort({ filters: [] });
  } catch {
    return null;
  }
}

export async function portAc(port: SeriPort, baud: number): Promise<boolean> {
  try {
    await port.open({ baudRate: baud, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" });
    return true;
  } catch {
    return false;
  }
}

export async function portKapat(port: SeriPort): Promise<void> {
  try {
    await port.close();
  } catch {
    /* yoksay */
  }
}

export async function portBilgi(port: SeriPort): Promise<{ usb: boolean }> {
  try {
    const b = await port.getInfo();
    return { usb: b.usbVendorId !== undefined };
  } catch {
    return { usb: false };
  }
}

/** TSPL baytlarını yazıcıya parça parça gönder (Bluetooth'ta tıkanmasın). */
export async function tsplGonder(port: SeriPort, veri: Uint8Array): Promise<boolean> {
  try {
    const yazici = port.writable?.getWriter();
    if (!yazici) return false;
    try {
      const PARCA = 4096;
      for (let i = 0; i < veri.length; i += PARCA) {
        await yazici.write(veri.slice(i, i + PARCA));
        await new Promise((r) => setTimeout(r, 30));
      }
      return true;
    } finally {
      yazici.releaseLock();
    }
  } catch {
    return false;
  }
}

export type EtiketAlan = {
  adSoyad: string;
  telefon: string;
  siparisNo: string;
  kod: string;
  sira: string;
  tarih: string;
  durum: string;
  durumRenk: string;
  dukkan: string;
  dukkanAlt: string;
  qrIcerik: string;
};

/** 60×40mm etiketi 203 DPI siyah-beyaz canvas'a çizer (480×320). */
export async function etiketCanvasCiz(a: EtiketAlan): Promise<HTMLCanvasElement> {
  const W = Math.round((ETIKET_GENIS_MM * ETIKET_DPI) / 25.4);
  const H = Math.round((ETIKET_YUKSEK_MM * ETIKET_DPI) / 25.4);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  if (!x) return c;
  const mm = W / ETIKET_GENIS_MM;
  const X = (v: number) => v * mm;
  const Y = (v: number) => v * (H / ETIKET_YUKSEK_MM);

  x.fillStyle = "#000";
  x.fillRect(0, 0, W, H);
  x.fillStyle = "#fff";
  x.strokeStyle = "rgba(255,255,255,0.7)";
  x.lineWidth = 1;

  // Köşe işaretleri
  const k = 2.5 * mm;
  const k0 = 1.2 * mm;
  x.beginPath();
  x.moveTo(k0, k0 + k); x.lineTo(k0, k0); x.lineTo(k0 + k, k0);
  x.moveTo(W - k0 - k, k0); x.lineTo(W - k0, k0); x.lineTo(W - k0, k0 + k);
  x.moveTo(k0, H - k0 - k); x.lineTo(k0, H - k0); x.lineTo(k0 + k, H - k0);
  x.moveTo(W - k0 - k, H - k0); x.lineTo(W - k0, H - k0); x.lineTo(W - k0, H - k0 - k);
  x.stroke();

  x.textBaseline = "top";
  const serif = 'Georgia, "Times New Roman", serif';
  const mono = 'ui-monospace, Menlo, Consolas, monospace';

  x.font = `700 ${X(3.4)}px ${serif}`;
  try { (x as unknown as { letterSpacing: string }).letterSpacing = `${X(0.7)}px`; } catch { /* yoksay */ }
  x.fillText(a.dukkan.toUpperCase().slice(0, 22) || "SHOP", X(3.5), Y(3));
  try { (x as unknown as { letterSpacing: string }).letterSpacing = "0px"; } catch { /* yoksay */ }

  x.font = `700 ${X(1.8)}px system-ui, sans-serif`;
  x.globalAlpha = 0.7;
  x.fillText(a.dukkanAlt.toUpperCase().slice(0, 34), X(3.5), Y(6.6));
  x.globalAlpha = 1;

  // QR (beyaz üstüne siyah zeminde)
  const qrBoy = X(15);
  const qrC = document.createElement("canvas");
  await QRCode.toCanvas(qrC, a.qrIcerik || "-", { width: Math.round(qrBoy), margin: 0, color: { dark: "#ffffff", light: "#000000" } });
  x.drawImage(qrC, X(2), Y(12), qrBoy, qrBoy);

  x.font = `700 ${X(4.6)}px ${serif}`;
  x.fillText(a.adSoyad.toUpperCase().slice(0, 20) || "-", X(19.5), Y(10), X(38));

  x.font = `700 ${X(3.8)}px ${mono}`;
  x.fillText(a.telefon.toUpperCase().slice(0, 18) || "---", X(19.5), Y(17.5), X(38));

  x.font = `700 ${X(3)}px ${mono}`;
  x.fillText(a.siparisNo.toUpperCase().slice(0, 10), X(19.5), Y(24), X(19));
  x.fillText(a.kod.toUpperCase().slice(0, 12), X(39), Y(24), X(19));

  x.font = `700 ${X(4)}px ${mono}`;
  x.fillText(a.sira.toUpperCase().slice(0, 8), X(19.5), Y(29.5), X(38));

  x.font = `700 ${X(2.2)}px ${mono}`;
  x.textAlign = "right";
  x.fillText(a.tarih.slice(0, 16), X(56), Y(33), X(32));
  x.font = `700 ${X(2.4)}px system-ui, sans-serif`;
  x.fillStyle = a.durumRenk;
  x.fillText(a.durum.toUpperCase().slice(0, 12), X(58), Y(2), X(14));
  x.textAlign = "left";

  return c;
}

/** Siyah-beyaz canvas'tan D520 TSPL baskı baytı üretir. */
export function tsplKur(bw: HTMLCanvasElement, kopya = 1): Uint8Array {
  const W = bw.width;
  const H = bw.height;
  const ctx = bw.getContext("2d");
  const px = ctx ? ctx.getImageData(0, 0, W, H).data : new Uint8ClampedArray(0);
  const bpr = Math.ceil(W / 8);
  const bmp = new Uint8Array(bpr * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (px[(y * W + x) * 4] < 128) bmp[y * bpr + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const enc = new TextEncoder();
  const baslik = enc.encode(
    `SIZE ${ETIKET_GENIS_MM} mm, ${ETIKET_YUKSEK_MM} mm\r\n` +
      `GAP ${ETIKET_BOSLUK_MM.toFixed(2)} mm, 0 mm\r\n` +
      `SPEED ${ETIKET_HIZ}\r\n` +
      `DENSITY ${ETIKET_YOGUNLUK}\r\n` +
      `DIRECTION 1,0\r\n` +
      `REFERENCE 0,0\r\n` +
      `SET TEAR ON\r\n` +
      `CLS\r\n` +
      `BITMAP 0,0,${bpr},${H},0,`,
  );
  const son = enc.encode(`\r\nPRINT ${kopya},1\r\n`);
  const out = new Uint8Array(baslik.length + bmp.length + son.length);
  out.set(baslik, 0);
  out.set(bmp, baslik.length);
  out.set(son, baslik.length + bmp.length);
  return out;
}
