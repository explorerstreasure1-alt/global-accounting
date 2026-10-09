import type { Ayarlar, GunlukOzet, Kayit, KategoriOzet, RaporOzet, Uyari } from "./types";
import { addDays, monthPrefix, parseISODate, round2, toISODate } from "./format";

export function filterByRange(kayitlar: Kayit[], baslangic: string, bitis: string): Kayit[] {
  return kayitlar
    .filter((k) => k.tarih >= baslangic && k.tarih <= bitis)
    .sort((a, b) => a.tarih.localeCompare(b.tarih) || a.olusturmaZamani.localeCompare(b.olusturmaZamani));
}

export function buildRapor(
  kayitlar: Kayit[],
  ayarlar: Ayarlar,
  baslangic: string,
  bitis: string,
): RaporOzet {
  const rows = filterByRange(kayitlar, baslangic, bitis);
  const oncekiler = kayitlar.filter((k) => k.tarih < baslangic);
  const oncekiNet = oncekiler.reduce((s, k) => s + k.kasaEtkisi, 0);
  const acilisBakiyesi = round2(ayarlar.acilisBakiyesi + oncekiNet);

  let gelir = 0;
  let gider = 0;
  let nakitGelir = 0;
  let nakitGider = 0;
  let kartGelir = 0;
  let kartGider = 0;
  let havaleGelir = 0;
  let havaleGider = 0;

  const katMap = new Map<string, KategoriOzet>();
  const gunMap = new Map<string, GunlukOzet>();

  for (const k of rows) {
    gelir += k.gelir;
    gider += k.gider;
    if (k.odemeTipi === "Nakit") {
      nakitGelir += k.gelir;
      nakitGider += k.gider;
    } else if (k.odemeTipi === "Kart") {
      kartGelir += k.gelir;
      kartGider += k.gider;
    } else {
      havaleGelir += k.gelir;
      havaleGider += k.gider;
    }

    const kat = katMap.get(k.kategori) ?? {
      kategori: k.kategori,
      gelir: 0,
      gider: 0,
      net: 0,
      adet: 0,
    };
    kat.gelir += k.gelir;
    kat.gider += k.gider;
    kat.adet += 1;
    kat.net = kat.gelir - kat.gider;
    katMap.set(k.kategori, kat);

    const gun = gunMap.get(k.tarih) ?? {
      tarih: k.tarih,
      gelir: 0,
      gider: 0,
      net: 0,
      nakitGelir: 0,
      nakitGider: 0,
      kartGelir: 0,
      kartGider: 0,
      havaleGelir: 0,
      havaleGider: 0,
      adet: 0,
    };
    gun.gelir += k.gelir;
    gun.gider += k.gider;
    gun.net = gun.gelir - gun.gider;
    gun.adet += 1;
    if (k.odemeTipi === "Nakit") {
      gun.nakitGelir += k.gelir;
      gun.nakitGider += k.gider;
    } else if (k.odemeTipi === "Kart") {
      gun.kartGelir += k.gelir;
      gun.kartGider += k.gider;
    } else {
      gun.havaleGelir += k.gelir;
      gun.havaleGider += k.gider;
    }
    gunMap.set(k.tarih, gun);
  }

  const net = gelir - gider;
  const nakitNet = nakitGelir - nakitGider;
  const kartNet = kartGelir - kartGider;
  const havaleNet = havaleGelir - havaleGider;

  return {
    baslangic,
    bitis,
    adet: rows.length,
    gelir: round2(gelir),
    gider: round2(gider),
    net: round2(net),
    nakitGelir: round2(nakitGelir),
    nakitGider: round2(nakitGider),
    nakitNet: round2(nakitNet),
    kartGelir: round2(kartGelir),
    kartGider: round2(kartGider),
    kartNet: round2(kartNet),
    havaleGelir: round2(havaleGelir),
    havaleGider: round2(havaleGider),
    havaleNet: round2(havaleNet),
    genelToplam: round2(net),
    acilisBakiyesi: round2(acilisBakiyesi),
    kapanisBakiyesi: round2(acilisBakiyesi + net),
    kategoriler: [...katMap.values()].sort((a, b) => b.gider + b.gelir - (a.gider + a.gelir)),
    gunler: [...gunMap.values()].sort((a, b) => a.tarih.localeCompare(b.tarih)),
    kayitlar: rows,
  };
}

export function monthRange(year: number, month: number): { baslangic: string; bitis: string } {
  const baslangic = `${monthPrefix(year, month)}-01`;
  const last = new Date(year, month, 0).getDate();
  const bitis = `${monthPrefix(year, month)}-${String(last).padStart(2, "0")}`;
  return { baslangic, bitis };
}

export function computeUyarilar(kayitlar: Kayit[], ayarlar: Ayarlar, today = toISODate(), locale = "en"): Uyari[] {
  const tr = locale === "tr";
  const now = parseISODate(today);
  const { baslangic, bitis } = monthRange(now.getFullYear(), now.getMonth() + 1);
  const ay = buildRapor(kayitlar, ayarlar, baslangic, bitis);
  const uyarilar: Uyari[] = [];

  if (ay.gelir > 0 && ay.gider >= ay.gelir * 0.8) {
    const oran = Math.round((ay.gider / ay.gelir) * 100);
    uyarilar.push({
      tip: ay.gider >= ay.gelir ? "kritik" : "dikkat",
      baslik: tr ? "Gider oranı yüksek" : "High expense ratio",
      mesaj: tr
        ? `Bu ay giderler gelirlerin %${oran}'ine ulaştı. Nakit akışını sıkı tutun.`
        : `Expenses reached ${oran}% of income this month. Watch cash flow.`,
    });
  }

  if (ayarlar.kiraSonrakiTarih) {
    const kalan = Math.round(
      (parseISODate(ayarlar.kiraSonrakiTarih).getTime() - parseISODate(today).getTime()) /
        86400000,
    );
    if (kalan <= 15 && kalan >= 0) {
      uyarilar.push({
        tip: kalan <= 3 ? "kritik" : "dikkat",
        baslik: tr ? "Kira hatırlatması" : "Rent reminder",
        mesaj: tr
          ? `Kira ödemesine ${kalan} gün kaldı (${ayarlar.kiraSonrakiTarih}).`
          : `${kalan} days until rent payment (${ayarlar.kiraSonrakiTarih}).`,
      });
    } else if (kalan < 0 && kalan > -20) {
      uyarilar.push({
        tip: "kritik",
        baslik: tr ? "Kira tarihi geçti" : "Rent overdue",
        mesaj: tr
          ? `Planlanan kira tarihi ${Math.abs(kalan)} gün geçti.`
          : `Planned rent date passed ${Math.abs(kalan)} days ago.`,
      });
    }
  }

  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevRange = monthRange(prev.getFullYear(), prev.getMonth() + 1);
  const oncekiAy = buildRapor(kayitlar, ayarlar, prevRange.baslangic, prevRange.bitis);
  const dogalgazBu = ay.kategoriler.find((k) => k.kategori === "Heating")?.gider ?? 0;
  const dogalgazOnce = oncekiAy.kategoriler.find((k) => k.kategori === "Heating")?.gider ?? 0;
  if (dogalgazOnce > 0 && dogalgazBu >= dogalgazOnce * 1.4) {
    const artis = Math.round(((dogalgazBu - dogalgazOnce) / dogalgazOnce) * 100);
    uyarilar.push({
      tip: "dikkat",
      baslik: tr ? "Doğalgaz artışı" : "Heating cost spike",
      mesaj: tr
        ? `Doğalgaz geçen aya göre %${artis} artmış. Faturayı kontrol edin.`
        : `Heating is up ${artis}% vs last month. Check the bill.`,
    });
  }

  const son3 = [0, 1, 2].map((i) => {
    const gun = addDays(today, -i);
    const r = buildRapor(kayitlar, ayarlar, gun, gun);
    return r.nakitNet;
  });
  const ortNet = son3.reduce((s, v) => s + v, 0) / 3;
  if (ay.nakitNet + ayarlar.acilisBakiyesi > 0 && ortNet < 0) {
    const kasa = ayarlar.acilisBakiyesi + kayitlar.filter((k) => k.tarih <= today).reduce((s, k) => s + (k.odemeTipi === "Nakit" ? k.kasaEtkisi : 0), 0);
    if (kasa + ortNet * 3 < 0) {
      uyarilar.push({
        tip: "kritik",
        baslik: tr ? "Nakit akışı uyarısı" : "Cash flow warning",
        mesaj: tr
          ? "Son günlerin nakit ortalamasına göre kasa 3 gün içinde negatife düşebilir."
          : "At the recent cash rate the safe may go negative within 3 days.",
      });
    }
  }

  if (uyarilar.length === 0 && ay.adet > 0) {
    uyarilar.push({
      tip: "bilgi",
      baslik: tr ? "Defter dengede" : "Ledger balanced",
      mesaj: tr
        ? "Bu ay için kritik bir uyarı yok. Kayıtlar düzenli görünüyor."
        : "No critical warnings this month. Records look tidy.",
    });
  }

  return uyarilar;
}
