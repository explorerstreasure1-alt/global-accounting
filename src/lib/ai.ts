import type { Ayarlar, ChatAction, InitData, Kayit, KayitGirdi, Kategori, SohbetMesaji } from "./types";
import { KATEGORILER } from "./types";
import { AYLAR, addMonths, duzeltAciklama, formatMoney, formatTRDate, formatTRDateLong, round2, toISODate } from "./format";
import { buildRapor, computeUyarilar, monthRange } from "./reports";
import { AY_ADLARI, AY_EKI, SAYISAL_TARIH_DESENI, detectKategori, findKayit, findKayitGevsekAdaylar, findKayitMatches, isQuestion, parseCommand, parseRange, type KayitAraligi, type NlpIntent } from "./nlp";
import {
  addMesaj,
  createKayit,
  deleteKayit,
  getAyarlar,
  getInitData,
  listKayitlar,
  restoreLatestBackup,
  sifirlaTumu,
  temizleSohbet,
  updateAyarlar,
  updateKayit,
} from "./data";

export type ChatResponse = {
  reply: string;
  data: InitData;
  action?: ChatAction;
};

function kayitOnay(k: Kayit): string {
  const tutar = k.gelir > 0 ? k.gelir : k.gider;
  const tur = k.gelir > 0 ? "gelir" : "gider";
  const girisler = ["Tamamdır, deftere yazdım", "Kaydettim", "İşledim, defterde"];
  const giris = girisler[(k.aciklama.length + Math.round(tutar)) % girisler.length];
  let gun = "";
  try {
    gun = formatTRDateLong(k.tarih);
  } catch {
    gun = formatTRDate(k.tarih);
  }
  return `${giris} 👍\n• ${gun} – ${k.aciklama} – ${formatMoney(tutar)} – ${k.odemeTipi} – ${tur} (${k.kategori})`;
}

function parseChatAction(message: string): ChatAction | null {
  const text = message.toLocaleLowerCase("tr-TR").trim();
  if (/yedek dosyasını (seç|yükle|geri yükle)|yedek dosyasini (sec|yukle|geri yukle)|yedek dosyası yükle|yedek dosyasi yukle|dosyadan yedek yükle|dosyadan yedek yukle/.test(text)) {
    return { type: "choose_backup_file" };
  }
  if (/takvim(i)? (aç|ac)|takvim ekranını aç|takvim ekranini ac/.test(text)) return { type: "open_calendar" };
  if (/ayar (ekranını|ekranini) aç|ayarları aç|ayarlari ac|ayar ekranını aç|ayar ekranini ac/.test(text)) {
    return { type: "open_settings" };
  }
  if (/defter sekmesini aç|defter sekmesini ac|deftere geç|deftere gec/.test(text)) {
    return { type: "open_tab", tab: "defter" };
  }
  if (/asistan sekmesini aç|asistan sekmesini ac|asistanı aç|asistani ac|asistana geç|asistana gec/.test(text)) {
    return { type: "open_tab", tab: "asistan" };
  }
  const dateMention = text.match(/\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/);
  if (dateMention && /tarihe git|defteri .*?(git|götür|gotur)|takvimi .*?(git|götür|gotur)/.test(text)) {
    const date = normTarih(dateMention[0]);
    if (date) return { type: "navigate_date", date };
  }
  const monthIndex = AYLAR.findIndex((month) => text.includes(month));
  if (monthIndex >= 0 && /geç|gec|git|götür|gotur|seç|sec/.test(text) && !/rapor|excel|indir|çıkar|çıkart|cikar/.test(text)) {
    const year = Number(text.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? new Date().getFullYear());
    return { type: "navigate_month", year, month: monthIndex + 1 };
  }
  // Dosya indirme takvimde gezinmeden ÖNCE bakılır ("geçen ayın raporunu çıkar" → indirir, ayı değiştirmez).
  const erkenNiyet = parseCommand(message);
  if (erkenNiyet.type === "indir_rapor") {
    return {
      type: "download_excel",
      tip: erkenNiyet.tip,
      baslangic: erkenNiyet.baslangic,
      bitis: erkenNiyet.bitis,
    };
  }
  if (erkenNiyet.type === "indir_yedek") return { type: "download_backup" };
  if (/geçen ay|gecen ay|önceki ay|onceki ay|gelecek ay|gelecek aya|bu aya dön|bu aya don/.test(text)) {
    const delta = /geçen ay|gecen ay|önceki ay|onceki ay/.test(text) ? -1 : /gelecek ay|gelecek aya/.test(text) ? 1 : 0;
    const target = new Date(new Date().getFullYear(), new Date().getMonth() + delta, 1);
    return { type: "navigate_month", year: target.getFullYear(), month: target.getMonth() + 1 };
  }
  if (/^(bu sayfayı |bu sayfayi |ekranı |ekrani |raporu )?yazdır( şimdi| simdi)?[.!]?$/.test(text)) {
    return { type: "print_page" };
  }
  if (/rapor (penceresini|ekranını|ekranini) aç|raporu ekranda aç|raporu ekranda ac/.test(text)) {
    const intent = parseCommand(message);
    if (intent.type === "rapor") {
      const report = intent.tip === "z" ? "z" : intent.tip === "gunluk" || intent.tip === "gunsonu" ? "day" : "month";
      const today = toISODate();
      const currentMonth = monthRange(new Date().getFullYear(), new Date().getMonth() + 1);
      return {
        type: "open_report",
        report,
        baslangic: intent.baslangic ?? (report === "day" ? today : currentMonth.baslangic),
        bitis: intent.bitis ?? (report === "day" ? today : currentMonth.bitis),
      };
    }
  }
  const intent = parseCommand(message);
  if (intent.type === "rapor") {
    const report = intent.tip === "z" ? "z" : intent.tip === "gunluk" || intent.tip === "gunsonu" ? "day" : "month";
    const today = toISODate();
    const currentMonth = monthRange(new Date().getFullYear(), new Date().getMonth() + 1);
    return {
      type: "open_report",
      report,
      baslangic: intent.baslangic ?? (report === "day" ? today : currentMonth.baslangic),
      bitis: intent.bitis ?? (report === "day" ? today : currentMonth.bitis),
    };
  }
  return null;
}

/** Aralık + kategori + ödeme filtreli kayıt seçimi (listeleme / toplu silme) */
function filtreleAralik(kayitlar: Kayit[], f: KayitAraligi): Kayit[] {
  return kayitlar
    .filter((k) => (!f.baslangic || k.tarih >= f.baslangic) && (!f.bitis || k.tarih <= f.bitis))
    .filter((k) => (!f.kategori || k.kategori === f.kategori) && (!f.odemeTipi || k.odemeTipi === f.odemeTipi))
    .filter((k) => !f.tur || (f.tur === "gelir" ? k.gelir > 0 : k.gider > 0))
    .sort((a, b) => a.tarih.localeCompare(b.tarih) || a.olusturmaZamani.localeCompare(b.olusturmaZamani));
}

/** Fiş dökümü: her satır tarih + açıklama + tutar + ödeme tipi, altta tip toplamları. */
function fisDokumu(r: ReturnType<typeof buildRapor>): string[] {
  const fisler = [...(r.kayitlar ?? [])].sort(
    (a, b) => a.tarih.localeCompare(b.tarih) || a.olusturmaZamani.localeCompare(b.olusturmaZamani),
  );
  const goster = fisler.slice(0, 100);
  return [
    "",
    "Fişler:",
    ...goster.map(
      (k) => `• ${formatTRDate(k.tarih)} – ${k.aciklama} – ${formatMoney(k.gelir || k.gider)} – ${k.odemeTipi} (${k.gelir > 0 ? "gelir" : "gider"})`,
    ),
    fisler.length > goster.length ? `… ve ${fisler.length - goster.length} kayıt daha (tümü Excel'de)` : "",
    "",
    "Alt toplam:",
    `• Nakit toplam: gelir ${formatMoney(r.nakitGelir)} – gider ${formatMoney(r.nakitGider)} = net ${formatMoney(r.nakitNet)}`,
    `• Kart toplamı: gelir ${formatMoney(r.kartGelir)} – gider ${formatMoney(r.kartGider)} = net ${formatMoney(r.kartNet)}`,
    `• Havale toplamı: gelir ${formatMoney(r.havaleGelir)} – gider ${formatMoney(r.havaleGider)} = net ${formatMoney(r.havaleNet)}`,
    `• GENEL TOPLAM: ${formatMoney(r.net)}`,
  ];
}

function raporMetni(tip: string, kayitlar: Kayit[], ayarlar: Ayarlar, baslangic: string, bitis: string, kategori?: Kategori): string {
  const r = buildRapor(kayitlar, ayarlar, baslangic, bitis);
  const donem = baslangic === bitis ? formatTRDate(baslangic) : `${formatTRDate(baslangic)} – ${formatTRDate(bitis)}`;

  if (tip === "kira") {
    const kiraKayitlari = kayitlar.filter((k) => k.kategori === "Kira");
    const odenen = kiraKayitlari.reduce((s, k) => s + k.gider, 0);
    const kalanGun = ayarlar.kiraSonrakiTarih
      ? Math.round((new Date(ayarlar.kiraSonrakiTarih).getTime() - Date.now()) / 86400000)
      : null;
    return [
      "🏠 Kira özeti",
      `• Dönem tutarı: ${formatMoney(ayarlar.kiraTutari)} / ${ayarlar.kiraPeriyodu} ay`,
      `• Aylık karşılık: ${formatMoney(ayarlar.aylikKiraKarsiligi)}`,
      `• Sonraki ödeme: ${ayarlar.kiraSonrakiTarih ? formatTRDate(ayarlar.kiraSonrakiTarih) : "tanımsız"}${kalanGun != null ? ` (${kalanGun} gün)` : ""}`,
      `• Deftere işlenen kira toplamı: ${formatMoney(odenen)} (${kiraKayitlari.length} kayıt)`,
    ].join("\n");
  }

  if (tip === "kategori" && kategori) {
    const kat = r.kategoriler.find((k) => k.kategori === kategori);
    return [
      `📂 ${kategori} – ${donem}`,
      `• Adet: ${kat?.adet ?? 0}`,
      `• Gelir: ${formatMoney(kat?.gelir ?? 0)}`,
      `• Gider: ${formatMoney(kat?.gider ?? 0)}`,
      `• Net: ${formatMoney(kat?.net ?? 0)}`,
    ].join("\n");
  }

  if (tip === "nakitkart") {
    return [
      `💳 Nakit / Kart – ${donem}`,
      `• Nakit gelir: ${formatMoney(r.nakitGelir)}`,
      `• Nakit gider: ${formatMoney(r.nakitGider)}`,
      `• Nakit net: ${formatMoney(r.nakitNet)}`,
      `• Kart gelir: ${formatMoney(r.kartGelir)}`,
      `• Kart gider: ${formatMoney(r.kartGider)}`,
      `• Kart net: ${formatMoney(r.kartNet)}`,
      `• Havale gelir: ${formatMoney(r.havaleGelir)}`,
      `• Havale gider: ${formatMoney(r.havaleGider)}`,
      `• Havale net: ${formatMoney(r.havaleNet)}`,
      `• Genel net: ${formatMoney(r.net)}`,
    ].join("\n");
  }

  if (tip === "gunsonu") {
    return [
      `🌙 Gün sonu – ${donem}`,
      `• İşlem: ${r.adet} satır`,
      `• Gelir: ${formatMoney(r.gelir)}`,
      `• Gider: ${formatMoney(r.gider)}`,
      `• Günlük net: ${formatMoney(r.net)}`,
      `• Nakit net: ${formatMoney(r.nakitNet)}`,
      `• Kart net: ${formatMoney(r.kartNet)}`,
      `• Havale net: ${formatMoney(r.havaleNet)}`,
      `• Kapanış bakiyesi: ${formatMoney(r.kapanisBakiyesi)}`,
      r.kayitlar.length
        ? "\nKayıtlar:\n" + r.kayitlar.map((k) => `• ${k.aciklama} (${k.odemeTipi}) ${formatMoney(k.gelir || k.gider)}`).join("\n")
        : "\nBu tarihte kayıt yok.",
    ].join("\n");
  }

  if (tip === "aysonu") {
    const gunSayisi = r.gunler.length || 1;
    const enGider = [...r.kategoriler].sort((a, b) => b.gider - a.gider)[0];
    return [
      `📅 AY SONU – ${donem}`,
      `• İşlem: ${r.adet} satır (${gunSayisi} aktif gün)`,
      `• Toplam gelir: ${formatMoney(r.gelir)}`,
      `• Toplam gider: ${formatMoney(r.gider)}`,
      `• AYLIK NET: ${formatMoney(r.net)}`,
      `• Açılış: ${formatMoney(r.acilisBakiyesi)} → Kapanış: ${formatMoney(r.kapanisBakiyesi)}`,
      `• Günlük ortalama net: ${formatMoney(Math.round((r.net / gunSayisi) * 100) / 100)}`,
      enGider && enGider.gider > 0 ? `• En çok gider: ${enGider.kategori} (${formatMoney(enGider.gider)})` : "",
      ...fisDokumu(r),
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (tip === "z") {
    const katSatirlari = [...r.kategoriler]
      .sort((a, b) => b.gelir + b.gider - (a.gelir + a.gider))
      .map((k) => `• ${k.kategori}: ${k.adet} kayıt – gelir ${formatMoney(k.gelir)} / gider ${formatMoney(k.gider)} = net ${formatMoney(k.net)}`);
    return [
      `🧾 Z RAPORU – ${donem}`,
      `• Belge sayısı: ${r.adet}`,
      `• NAKİT GELİR: ${formatMoney(r.nakitGelir)}`,
      `• NAKİT GİDER: ${formatMoney(r.nakitGider)}`,
      `• NAKİT NET: ${formatMoney(r.nakitNet)}`,
      `• KART GELİR: ${formatMoney(r.kartGelir)}`,
      `• KART GİDER: ${formatMoney(r.kartGider)}`,
      `• KART NET: ${formatMoney(r.kartNet)}`,
      `• HAVALE GELİR: ${formatMoney(r.havaleGelir)}`,
      `• HAVALE GİDER: ${formatMoney(r.havaleGider)}`,
      `• HAVALE NET: ${formatMoney(r.havaleNet)}`,
      `• GENEL TOPLAM (NET): ${formatMoney(r.net)}`,
      `• Açılış: ${formatMoney(r.acilisBakiyesi)} → Kapanış: ${formatMoney(r.kapanisBakiyesi)}`,
      ...(katSatirlari.length ? ["", "Kategoriler:", ...katSatirlari] : []),
      ...fisDokumu(r),
    ].filter(Boolean).join("\n");
  }

  if (tip === "karzarar") {
    const durum = r.net >= 0 ? "KÂR" : "ZARAR";
    return [
      `📈 Kar-Zarar – ${donem}`,
      `• Toplam gelir: ${formatMoney(r.gelir)}`,
      `• Toplam gider: ${formatMoney(r.gider)}`,
      `• Net ${durum}: ${formatMoney(r.net)}`,
      r.net >= 0 ? "Bereketli bir dönem olmuş 👍" : "Bu dönem biraz sıkışık geçmiş — gider kalemlerine bir göz atalım.",
      r.kategoriler.length
        ? "\nKategoriler:\n" +
          r.kategoriler
            .slice(0, 8)
            .map((k) => `• ${k.kategori}: gelir ${formatMoney(k.gelir)} / gider ${formatMoney(k.gider)}`)
            .join("\n")
        : "",
    ].join("\n");
  }

  return [
    `📊 Özet – ${donem}`,
    `• Kayıt: ${r.adet}`,
    `• Gelir: ${formatMoney(r.gelir)}`,
    `• Gider: ${formatMoney(r.gider)}`,
    `• Net: ${formatMoney(r.net)}`,
    `• Nakit net: ${formatMoney(r.nakitNet)}`,
    `• Kart net: ${formatMoney(r.kartNet)}`,
    `• Havale net: ${formatMoney(r.havaleNet)}`,
    `• Kasa kapanış: ${formatMoney(r.kapanisBakiyesi)}`,
    r.adet > 0 ? "Başka bir döküm isterseniz söyleyin." : "Bu aralıkta kayıt yok.",
  ].join("\n");
}

async function executeIntent(intent: NlpIntent, kayitlar: Kayit[], ayarlar: Ayarlar): Promise<string> {
  const today = toISODate();
  const now = new Date();
  const thisMonth = monthRange(now.getFullYear(), now.getMonth() + 1);

  if (intent.type === "netlestir") return intent.mesaj; // No changes here

  if (intent.type === "sohbet") {
    return "Buyur, seni dinliyorum. Bugün defter için ne yapalım?";
  }

  if (intent.type === "yardim") {
    return [
      "Ben Defterdar, dijital muhasebeciniz. Dükkânın defter işleri bende, siz işinize bakın. Şunları yaparım:",
      "• \"Bugün 5.000 TL nakit hizmet geliri yaz\" (hemen işlerim)",
      "• \"12.03.2023 tarihinde 2.000 TL kart hizmet geliri\" (geçmişe de yazarım, tarihi siz nasıl söylerseniz)",
      "• \"mart ayı hizmetleri göster\" (listelerim)",
      "• \"mart ayı market harcamalarını sil\" (önce gösteririm, onaylarsanız silerim)",
      "• \"Bu ayın kar-zarar durumu ne?\" (yorumlarım, öneri veririm)",
      "• \"Gün sonu al\" / \"Ay sonu al\" / \"1.02 ile 15.02 arası Z raporu\"",
      "• \"Son hizmet kaydını sil\" / \"Dünkü elektrik kaydını 1.500 TL yap\"",
      "• \"Tüm defteri Excel indir\" / \"Yedeğimi indir\"",
      "• \"Son yedeği geri yükle\" (önce onayınızı ister)",
      "• \"Tüm verileri sıfırla\" (geri alınamaz; ayrıca onay ister)",
      "• \"Takvimi aç\" / \"Ayarları aç\" / \"Rapor penceresini aç\" / \"Yazdır\"",
      "• \"Yedek dosyası yükle\" (dosyayı seçmeniz için pencereyi açarım)",
      "• \"Kasım 2025'e geç\" / \"Defteri 2025-03-12 tarihine götür\"",
      "• \"Sohbeti temizle\" (konuşmayı sıfırlar, kayıtlara dokunmaz)",
      "Üstteki 📅 Takvim'den istediğiniz güne gidip geçmişe kayıt da yazabilirsiniz.",
    ].join("\n");
  }

  if (intent.type === "ekle") {
    // Yazım denetimi: Excel'e düzgün açıklama girsin.
    intent.kayit.aciklama = duzeltAciklama(intent.kayit.aciklama) || intent.kayit.aciklama;
    const kayit = await createKayit(intent.kayit);
    if (intent.kayit.kategori === "Kira" && intent.kayit.gider > 0) {
      const ay = ayarlar.kiraPeriyodu || 6;
      await updateAyarlar({
        kiraTutari: intent.kayit.gider,
        kiraPeriyodu: ay,
        aylikKiraKarsiligi: round2(intent.kayit.gider / ay),
        kiraSonrakiTarih: addMonths(intent.kayit.tarih, ay),
      });
    }
    return kayitOnay(kayit) + (intent.not ? `\n${intent.not}` : "");
  }

  if (intent.type === "ekle_coklu") {
    const eklenenler: Kayit[] = [];
    for (const girdi of intent.kayitlar) {
      girdi.aciklama = duzeltAciklama(girdi.aciklama) || girdi.aciklama;
      eklenenler.push(await createKayit(girdi));
    }
    const toplam = eklenenler.reduce((sum, kayit) => sum + kayit.gelir + kayit.gider, 0);
    const tarih = eklenenler[0]?.tarih;
    return [
      `${eklenenler.length} kalemi ${tarih ? formatTRDateLong(tarih) : "belirttiğiniz tarihe"} işledim:`,
      ...eklenenler.map((kayit) => `• ${kayit.aciklama} – ${formatMoney(kayit.gelir || kayit.gider)} – ${kayit.gelir > 0 ? "gelir" : "gider"} (${kayit.odemeTipi})`),
      `Toplam: ${formatMoney(toplam)}`,
    ].join("\n");
  }

  if (intent.type === "guncelle") {
    const matches = findKayitMatches(kayitlar, intent.filtre);
    if (matches.length > 1 && !intent.filtre.sonMu) {
      return `Bu ölçütlere uyan ${matches.length} kayıt buldum. Hangisini değiştireyim?\n${matches.slice(0, 5).map((k) => `• ${formatTRDate(k.tarih)} – ${k.aciklama} – ${formatMoney(k.gelir || k.gider)}`).join("\n")}`;
    }
    let hedef = matches[0];
    if (!hedef && intent.filtre.aciklamaIcerir) {
      // Birebir tutmadıysa tekil esnek adayı kabul et (çok aday varsa sormaya devam).
      const adaylar = findKayitGevsekAdaylar(kayitlar, intent.filtre);
      if (adaylar.length === 1) hedef = adaylar[0];
      else if (adaylar.length > 1 && intent.filtre.sonMu) hedef = adaylar[0];
      else if (adaylar.length > 1) {
        return `Bu tarife uyan ${adaylar.length} kayıt buldum. Hangisini değiştireyim?\n${adaylar.slice(0, 5).map((k) => `• ${formatTRDate(k.tarih)} – ${k.aciklama} – ${formatMoney(k.gelir || k.gider)}`).join("\n")}`;
      }
    }
    if (!hedef) return "Aradığınız kaydı defterde bulamadım. Tarihi veya açıklamasını biraz daha tarif eder misiniz?";
    const guncel = await updateKayit(hedef.id, {
      ...intent.patch,
      ...(intent.patch.aciklama ? { aciklama: duzeltAciklama(intent.patch.aciklama) || intent.patch.aciklama } : {}),
    });
    if (!guncel) return "Kayıt güncellenemedi.";
    return `Tamam, düzelttim ✏️\n• ${formatTRDate(guncel.tarih)} – ${guncel.aciklama} – ${formatMoney(guncel.gelir || guncel.gider)} – ${guncel.odemeTipi}`;
  }

  if (intent.type === "sil") {
    const matches = findKayitMatches(kayitlar, intent.filtre);
    if (matches.length > 1 && !intent.filtre.sonMu) {
      return `Bu ölçütlere uyan ${matches.length} kayıt var; yanlış olanı silmeyeyim. Tutarını veya açıklamasını biraz daha netleştirir misiniz?\n${matches.slice(0, 5).map((k) => `• ${formatTRDate(k.tarih)} – ${k.aciklama} – ${formatMoney(k.gelir || k.gider)}`).join("\n")}`;
    }
    let hedef = matches[0];
    if (!hedef && intent.filtre.aciklamaIcerir) {
      const adaylar = findKayitGevsekAdaylar(kayitlar, intent.filtre);
      if (adaylar.length === 1) hedef = adaylar[0];
      else if (adaylar.length > 1 && intent.filtre.sonMu) hedef = adaylar[0];
      else if (adaylar.length > 1) {
        return `Bu tarife uyan ${adaylar.length} kayıt var; yanlış olanı silmeyeyim. Tutarını veya açıklamasını biraz daha netleştirir misiniz?\n${adaylar.slice(0, 5).map((k) => `• ${formatTRDate(k.tarih)} – ${k.aciklama} – ${formatMoney(k.gelir || k.gider)}`).join("\n")}`;
      }
    }
    if (!hedef) return "Sileceğim kaydı bulamadım. Tarihini veya açıklamasını biraz daha tarif eder misiniz?";
    await deleteKayit(hedef.id);
    return `Tamam, sildim 🗑️\n• ${formatTRDate(hedef.tarih)} – ${hedef.aciklama} – ${formatMoney(hedef.gelir || hedef.gider)}`;
  }

  if (intent.type === "listele") {
    const rows = filtreleAralik(kayitlar, intent.filtre);
    if (rows.length === 0) return "Bu kritere uyan kayıt bulamadım. Tarih veya kategoriyi değiştirip tekrar deneyin.";
    const goster = rows.slice(-30);
    const gelir = rows.reduce((s, k) => s + k.gelir, 0);
    const gider = rows.reduce((s, k) => s + k.gider, 0);
    const satirlar = goster.map(
      (k) => `• ${formatTRDate(k.tarih)} – ${k.aciklama} – ${formatMoney(k.gelir || k.gider)} – ${k.odemeTipi} (${k.kategori})`,
    );
    return [
      `📋 Buyurun, ${rows.length} kayıt buldum:`,
      ...satirlar,
      rows.length > 30 ? `… ve ${rows.length - 30} kayıt daha (aralık daraltın)` : "",
      `Toplam gelir: ${formatMoney(gelir)} • Toplam gider: ${formatMoney(gider)} • Net: ${formatMoney(gelir - gider)}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (intent.type === "toplu_sil") {
    const f = intent.filtre;
    if (!f.baslangic && !f.bitis && !f.kategori && !f.odemeTipi && !f.tur) {
      return "Hangi kayıtları sileceğimi netleştirir misiniz? Örnek: \"mart ayı market harcamalarını sil\" veya \"geçen ayın tüm giderlerini sil\".";
    }
    const rows = filtreleAralik(kayitlar, f);
    if (rows.length === 0) return "Bu kritere uyan kayıt bulamadım, silecek bir şey yok.";
    const gider = rows.reduce((s, k) => s + k.gider, 0);
    const gelir = rows.reduce((s, k) => s + k.gelir, 0);
    if (!intent.onayla) {
      const ornek = rows
        .slice(0, 5)
        .map((k) => `• ${formatTRDate(k.tarih)} – ${k.aciklama} – ${formatMoney(k.gelir || k.gider)}`)
        .join("\n");
      return [
        `Durun bir bakalım — ${rows.length} kayıt buldum (gelir ${formatMoney(gelir)} / gider ${formatMoney(gider)}):`,
        ornek,
        rows.length > 5 ? `… ve ${rows.length - 5} kayıt daha` : "",
        "Hepsini silmemi istiyorsanız aynı isteği \"onayla\" diye ekleyip yazın.",
        'Örnek: "mart ayı market harcamalarını silmeyi onayla"',
      ]
        .filter(Boolean)
        .join("\n");
    }
    for (const k of rows) {
      await deleteKayit(k.id);
    }
    return `Hallettim — ${rows.length} kaydı sildim 🗑️ (gelir ${formatMoney(gelir)} / gider ${formatMoney(gider)}).`;
  }

  if (intent.type === "temizle") {
    await temizleSohbet();
    return "🧹 Sohbet temizlendi. Yeni bir sayfa açtık, buyurun.";
  }

  if (intent.type === "indir_yedek") {
    return [
      "Buyurun, tüm defterin yedeği hazır 💾",
      "[📥 Yedeği indir (JSON)](/api/hafiza?indir=1)",
      "Bu dosyayı saklayın; Ayarlar → Hafıza → Yedekten geri yükle ile istediğiniz zaman dönebilirsiniz.",
    ].join("\n");
  }

  if (intent.type === "restore_backup") {
    if (!intent.confirm) {
      return "Son otomatik yedeği geri yüklersem mevcut defterin, ayarların ve sohbet geçmişin yedekteki hale döner. Devam etmek için şu cümleyi yazın: ‘Son yedeği geri yükle, onaylıyorum.’";
    }
    const restored = await restoreLatestBackup();
    return restored
      ? `Son otomatik yedeği geri yükledim. Defterde ${restored.kayitlar.length} kayıt var.`
      : "Geri yükleyebileceğim bir otomatik yedek bulamadım.";
  }

  if (intent.type === "reset_all") {
    if (!intent.confirm) {
      return "Bu işlem tüm kayıtları siler ve açılış bakiyesiyle kira ayarlarını sıfırlar; geri alınamaz. Devam etmek için şu cümleyi aynen yazın: ‘Tüm verileri sıfırla, onaylıyorum.’";
    }
    await sifirlaTumu();
    return "Defteri sıfırladım. Kayıtlar, kira ve açılış bakiyesi temizlendi.";
  }

  if (intent.type === "indir_rapor") {
    const isimler: Record<string, string> = {
      defter: "Tam-Defter",
      z: "Z-Raporu",
      gunsonu: "Gün-Sonu",
      aysonu: "Ay-Sonu",
      karzarar: "Kar-Zarar",
      ozet: "Dönem-Özeti",
    };
    const ad = isimler[intent.tip] ?? "Rapor";
    const url = `/api/export?tip=${intent.tip}&baslangic=${intent.baslangic}&bitis=${intent.bitis}`;
    return [
      `Buyurun, ${formatTRDate(intent.baslangic)} – ${formatTRDate(intent.bitis)} ${ad} Excel'i hazır 📊`,
      `[📥 ${ad} indir (Excel)](${url})`,
      "İçinde özet, günlük döküm, kategoriler ve fiş listesi var.",
    ].join("\n");
  }

  if (intent.type === "bol_kira") {
    const hedef = findKayit(kayitlar, { kategori: "Kira", sonMu: true });
    if (!hedef || hedef.gider <= 0) return "Bölünecek bir kira kaydı bulamadım.";
    const ay = Math.max(1, intent.ay);
    const parca = round2(hedef.gider / ay);
    await deleteKayit(hedef.id);
    for (let i = 0; i < ay; i += 1) {
      await createKayit({
        tarih: addMonths(hedef.tarih, i),
        aciklama: `${hedef.aciklama} (${i + 1}/${ay} aylık dilim)`,
        kategori: "Kira",
        gelir: 0,
        gider: parca,
        odemeTipi: hedef.odemeTipi,
      });
    }
    await updateAyarlar({
      kiraTutari: hedef.gider,
      kiraPeriyodu: ay,
      aylikKiraKarsiligi: parca,
    });
    return `🏠 Kira ${ay} aya bölündü. Her ay ${formatMoney(parca)} olarak deftere işlendi.`;
  }

  if (intent.type === "ayar") {
    const guncel = await updateAyarlar(intent.patch);
    const neler: string[] = [];
    if (intent.patch.isletmeAdi) neler.push(`işletme adı "${guncel.isletmeAdi}" oldu`);
    if (intent.patch.kiraTutari != null || intent.patch.kiraPeriyodu != null)
      neler.push(`kira ${formatMoney(guncel.kiraTutari)} / ${guncel.kiraPeriyodu} ay (aylık ${formatMoney(guncel.aylikKiraKarsiligi)})`);
    if (intent.patch.kiraSonrakiTarih !== undefined)
      neler.push(guncel.kiraSonrakiTarih ? `sonraki ödeme ${formatTRDate(guncel.kiraSonrakiTarih)}` : "sonraki kira tarihi kaldırıldı");
    if (intent.patch.acilisBakiyesi != null) neler.push(`açılış bakiyesi ${formatMoney(guncel.acilisBakiyesi)}`);
    return neler.length ? `Tamam, ayarı güncelledim ⚙️\n• ${neler.join("\n• ")}` : "⚙️ Ayarlar güncellendi.";
  }

  if (intent.type === "rapor") {
    const baslangic = intent.baslangic ?? (intent.tip === "gunluk" || intent.tip === "gunsonu" ? today : thisMonth.baslangic);
    const bitis = intent.bitis ?? (intent.tip === "gunluk" || intent.tip === "gunsonu" ? today : thisMonth.bitis);
    return raporMetni(intent.tip, kayitlar, ayarlar, baslangic, bitis, intent.kategori);
  }

  const uyarilar = computeUyarilar(kayitlar, ayarlar, today).filter((u) => u.tip !== "bilgi");
  if (uyarilar.length) {
    return `Mesajınızı tam çözemedim ama bir bakayım:\n${uyarilar.map((u) => `⚠️ ${u.baslik}: ${u.mesaj}`).join("\n")}\n\nKayıt, rapor veya Z raporu için daha net yazabilirsiniz.`;
  }
  return "Bunu henüz deftere işlemedim; yanlış kayıt açmamak için isteğinizi biraz netleştirelim. Kayıt gireceksek tarih, tutar, ne için olduğu ve nakit/kart bilgisini yazın. Rapor istiyorsanız hangi döneme bakacağımı söyleyin.";
}

const GROQ_TOOLS = [
  {
    type: "function",
    function: {
      name: "ekle_kayit",
      description: "Deftere gelir veya gider kaydı ekler.",
      parameters: {
        type: "object",
        properties: {
          tarih: { type: "string", description: "Kayıt tarihi, HER ZAMAN YYYY-MM-DD. Kullanıcı nasıl söylerse söylesin sen çevir: '12.03.2024'→2024-03-12, '26 06 2026'→2026-06-26, 'dün'→bugünden 1 çıkar, '3 gün önce'→3 çıkar, 'geçen salı'→en yakın geçmiş salı, 'mart 2024'→2024-03-01. Tarih yoksa bugünü ver." },
          aciklama: { type: "string" },
          kategori: { type: "string", enum: [...KATEGORILER] },
          gelir: { type: "number" },
          gider: { type: "number" },
          odemeTipi: { type: "string", enum: ["Nakit", "Kart", "Havale"] },
        },
        required: ["aciklama", "kategori", "odemeTipi"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ekle_coklu_kayit",
      description: "Aynı istekte birden fazla kalem ve tutar verildiğinde her kalemi belirtilen tarihe ayrı kayıt olarak ekle. 'Biri 1400 diğeri 200' iki tutardır; '2 paça' içindeki 2 adet bilgisidir.",
      parameters: {
        type: "object",
        properties: {
          tarih: { type: "string", description: "İstenen tarih YYYY-MM-DD" },
          kategori: { type: "string", enum: [...KATEGORILER] },
          tur: { type: "string", enum: ["gelir", "gider"] },
          odemeTipi: { type: "string", enum: ["Nakit", "Kart", "Havale"] },
          kalemler: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              properties: { aciklama: { type: "string" }, tutar: { type: "number" } },
              required: ["aciklama", "tutar"],
            },
          },
        },
        required: ["tarih", "kategori", "tur", "kalemler"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "guncelle_kayit",
      description: "Mevcut kaydı günceller. sonKayit true ise en son eşleşen kayıt seçilir. Kaydın TARİHİNİ değiştirecekse yeniTarih ver.",
      parameters: {
        type: "object",
        properties: {
          tarih: { type: "string", description: "HEDEF kaydın MEVCUT tarihi (bulmak için). Değişmiyorsa aynen ver veya boş bırak." },
          kategori: { type: "string", description: "HEDEF kaydın MEVCUT kategorisi (bulmak için). Kategori DEĞİŞMİYORSA aynen ver." },
          sonKayit: { type: "boolean", description: "Kullanıcı 'son kayıt' dediyse true." },
          gelir: { type: "number", description: "YENİ gelir tutarı (yama). Tutar DEĞİŞMİYORSA verme." },
          gider: { type: "number", description: "YENİ gider tutarı (yama). Tutar DEĞİŞMİYORSA verme." },
          odemeTipi: { type: "string", enum: ["Nakit", "Kart", "Havale"], description: "YENİ ödeme tipi (yama). 'Kart değil nakit olacak' denirse Nakit ver. Bulmak için KULLANMA." },
          aciklama: { type: "string", description: "YENİ açıklama (yama). Açıklama DEĞİŞMİYORSA verme; bulmak için aciklamaIcerir kullan." },
          aciklamaIcerir: { type: "string", description: "HEDEF kaydın MEVCUT açıklamasından ayırt edici ifade (sadece bulmak için, değişmez)" },
          tutar: { type: "number", description: "HEDEF kaydın MEVCUT tutarı (bulmak için). Yeni tutarı gelir/gider ile ver." },
          tur: { type: "string", enum: ["gelir", "gider"], description: "YENİ yön (yama). Bulmak için KULLANMA." },
          yeniTarih: { type: "string", description: "Kaydın taşınacağı YENİ tarih YYYY-MM-DD (yama)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sil_kayit",
      description: "Kayıt siler.",
      parameters: {
        type: "object",
        properties: {
          tarih: { type: "string" },
          kategori: { type: "string" },
          aciklamaIcerir: { type: "string", description: "Silinecek kaydın açıklamasından ayırt edici ifade" },
          tutar: { type: "number", description: "Silinecek kaydı ayırt etmek için tutar" },
          tur: { type: "string", enum: ["gelir", "gider"] },
          odemeTipi: { type: "string", enum: ["Nakit", "Kart", "Havale"] },
          sonKayit: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getir_rapor",
      description: "Kar-zarar, kasa, Z raporu, gün sonu, kira veya kategori raporu üretir.",
      parameters: {
        type: "object",
        properties: {
          tip: { type: "string", enum: ["gunluk", "kasa", "karzarar", "kira", "nakitkart", "z", "gunsonu", "aysonu", "kategori", "ozet"] },
          baslangic: { type: "string" },
          bitis: { type: "string" },
          kategori: { type: "string" },
        },
        required: ["tip"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "kira_bol",
      description: "Son kira kaydını belirtilen aya böler.",
      parameters: {
        type: "object",
        properties: { ay: { type: "number" } },
        required: ["ay"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listele_kayitlar",
      description: "Defterdeki kayıtları tarih aralığı, kategori veya ödeme tipine göre listeler. Kullanıcı 'göster', 'listele', 'neler var' derse bunu kullan.",
      parameters: {
        type: "object",
        properties: {
          baslangic: { type: "string", description: "YYYY-MM-DD" },
          bitis: { type: "string", description: "YYYY-MM-DD" },
          kategori: { type: "string" },
          odemeTipi: { type: "string", enum: ["Nakit", "Kart", "Havale"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toplu_sil",
      description: "Kapsama uyan TÜM kayıtları siler. SADECE kullanıcı açıkça onaylarsa (onayla/onaylıyorum/evet) onayla=true ver. Onay yoksa onayla=false ver, önizleme gösterilir.",
      parameters: {
        type: "object",
        properties: {
          baslangic: { type: "string", description: "YYYY-MM-DD" },
          bitis: { type: "string", description: "YYYY-MM-DD" },
          kategori: { type: "string" },
          odemeTipi: { type: "string", enum: ["Nakit", "Kart", "Havale"] },
          onayla: { type: "boolean", description: "Kullanıcı açıkça onayladı mı?" },
        },
        required: ["onayla"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "guncelle_ayar",
      description: "İşletme ayarlarını günceller: işletme adı, kira tutarı/periyodu/sonraki tarihi, açılış bakiyesi.",
      parameters: {
        type: "object",
        properties: {
          isletmeAdi: { type: "string" },
          kiraTutari: { type: "number" },
          kiraPeriyodu: { type: "number" },
          kiraSonrakiTarih: { type: "string", description: "YYYY-MM-DD" },
          acilisBakiyesi: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "sohbet_temizle",
      description: "Sohbet geçmişini temizler. SADECE kullanıcı sohbeti/konuşmayı temizlemeni isterse kullan. Kayıtlara dokunmaz.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "indir_rapor",
      description: "Kullanıcı raporu DOSYA olarak isterse (indir, excel, çıktı, çıkar/çıkart/cikar, dosya) bu aracı kullan. Dosya linki + otomatik indirme birlikte verilir.",
      parameters: {
        type: "object",
        properties: {
          tip: { type: "string", enum: ["defter", "z", "gunsonu", "aysonu", "karzarar", "ozet"] },
          baslangic: { type: "string", description: "YYYY-MM-DD" },
          bitis: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["tip"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "indir_yedek",
      description: "Kullanıcı defterin YEDEĞİNİ isterse (yedek al, yedeği indir) bu aracı kullan. Dosya linki otomatik verilir.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "yedek_geri_yukle",
      description: "En son otomatik yedeği geri yükler. Mevcut veriyi değiştirdiği için yalnızca kullanıcı aynı mesajda açıkça onaylarsa onayla=true ver.",
      parameters: {
        type: "object",
        properties: { onayla: { type: "boolean" } },
        required: ["onayla"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tum_verileri_sifirla",
      description: "Tüm kayıtları silip kira ve açılış bakiyesini sıfırlar. Geri alınamaz; yalnızca kullanıcı aynı mesajda açıkça onaylarsa onayla=true ver.",
      parameters: {
        type: "object",
        properties: { onayla: { type: "boolean" } },
        required: ["onayla"],
      },
    },
  },
];

type GroqToolCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};

/** Modelin verdiği tarihi YYYY-MM-DD'ye çevirir; bozuksa null verir (asla çöp tarih yazılmaz) */
function normTarih(raw: unknown): string | null {
  const s = String(raw || "").trim();
  const gecerli = (y: number, mo: number, d: number): boolean => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return false;
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  };
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    if (gecerli(y, mo, d)) return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return null;
  }
  const dmy = s.match(/^(\d{1,2})[./\-\s](\d{1,2})[./\-\s](\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const mo = Number(dmy[2]);
    const y = Number(dmy[3]);
    if (gecerli(y, mo, d)) return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return null;
  }
  return null;
}

const GROQ_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];

// Yerel anlatım (Ollama): araçsız cümle kurma işleri önce yerelden yenir, key harcanmaz.
// Araç çağırma (kayıt/rapor/sil) her zaman Groq'tadır — yerel modeller araç desteklemiyor.
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_ANLATIM = process.env.OLLAMA_ANLATIM !== "0";

/** Sadece okuyan araçlar: soru sorulduğunda yazan araçlar modele hiç gösterilmez. */
const GROQ_READ_TOOLS = GROQ_TOOLS.filter(
  (t) => t.function.name === "listele_kayitlar" || t.function.name === "getir_rapor",
);

/** Defteri değiştirebilen niyetler — bunlar dışında modele yazan araç verilmez. */
const WRITE_INTENTS: ReadonlySet<string> = new Set([
  "ekle",
  "ekle_coklu",
  "guncelle",
  "sil",
  "toplu_sil",
  "ayar",
  "bol_kira",
  "indir_rapor",
  "indir_yedek",
  "restore_backup",
  "reset_all",
  "temizle",
]);

async function groqChat(
  messages: { role: string; content: string | null; tool_calls?: GroqToolCall[]; tool_call_id?: string }[],
  withTools = true,
  toolChoice: "auto" | { type: "function"; function: { name: string } } = "auto",
  temperature = 0.3,
  tools: typeof GROQ_TOOLS = GROQ_TOOLS,
) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error("[groq] GROQ_API_KEY tanımlı değil — yerel kurallara düşülüyor.");
    return null;
  }
  for (const model of GROQ_MODELS) {
    for (let deneme = 0; deneme < 2; deneme += 1) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25_000);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          model,
          temperature,
          messages,
          ...(withTools ? { tools, tool_choice: toolChoice } : {}),
        }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(`[groq] ${model} ${res.status}: ${body.slice(0, 300)}`);
        // 429'da Groq'un söylediği kadar bekleyip aynı modeli bir kez daha dene.
        if (res.status === 429 && deneme === 0) {
          const bekleSn = Number(body.match(/try again in ([\d.]+)s/)?.[1] ?? 0);
          if (bekleSn > 0 && bekleSn <= 30) {
            await new Promise((r) => setTimeout(r, Math.ceil(bekleSn * 1000) + 500));
            continue;
          }
        }
        break;
      }
      const json = (await res.json()) as {
        choices?: { message?: { content?: string | null; tool_calls?: GroqToolCall[] } }[];
      };
      const msg = json.choices?.[0]?.message ?? null;
      if (msg) return msg;
      break;
    } catch (err) {
      console.error(`[groq] ${model} istek hatası:`, err instanceof Error ? err.message : String(err));
      break;
    }
    }
  }
  return null;
}

/** Araçsız anlatım: önce yerel (Ollama), olmazsa Groq. Key yalnız yerelde yoksa harcanır. */
async function ollamaChat(
  messages: { role: string; content: string | null }[],
  temperature = 0.7,
  model?: string,
): Promise<string | null> {
  if (!OLLAMA_ANLATIM) return null;
  const secili = (model || process.env.OLLAMA_MODEL || "gemma3:4b").trim() || "gemma3:4b";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45_000);
    const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({ model: secili, temperature, messages }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(`[yerel] ${secili} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return null;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const icerik = json.choices?.[0]?.message?.content?.trim() || null;
    if (icerik) console.error(`[yerel] anlatım OK (${secili})`);
    return icerik;
  } catch (err) {
    console.error(`[yerel] istek hatası:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export type MotorBilgisi = { motor: "otomatik" | "groq" | "ollama"; model: string };

/** Ayarlardan motor kararı: uygulamada seçilen değer esastır. */
export function cozMotor(ayarlar: Ayarlar): MotorBilgisi {
  const motor = ayarlar.aiMotor === "groq" || ayarlar.aiMotor === "ollama" ? ayarlar.aiMotor : "otomatik";
  const model = (ayarlar.ollamaModel || process.env.OLLAMA_MODEL || "gemma3:4b").trim() || "gemma3:4b";
  return { motor, model };
}

/** Anlatım çağrısı: groq modunda yalnız Groq; diğer modlarda önce yerel, olmazsa Groq. */
async function anlatimChat(
  messages: { role: string; content: string | null }[],
  temperature = 0.7,
  mb?: MotorBilgisi,
): Promise<string | null> {
  const bilgi = mb ?? { motor: "otomatik" as const, model: (process.env.OLLAMA_MODEL || "gemma3:4b").trim() || "gemma3:4b" };
  if (bilgi.motor !== "groq") {
    const yerel = await ollamaChat(messages, temperature, bilgi.model);
    if (yerel) return yerel;
  }
  const answer = await groqChat(messages, false, "auto", temperature);
  return answer?.content?.trim() || null;
}

/** Saf sohbet (kayıt/rapor yok): araçsız, sıcak ve doğal Türkçe. */
async function freeChat(message: string, history: SohbetMesaji[], ayarlar: Ayarlar): Promise<string | null> {
  const mb = cozMotor(ayarlar);
  if (!process.env.GROQ_API_KEY && mb.motor !== "ollama" && !OLLAMA_ANLATIM) return null;
  try {
    return await anlatimChat(
      [
        {
          role: "system",
          content: `Sen Defterdar'sın — küçük bir işletmenin cana yakın dijital muhasebecisi. Kullanıcıyla gerçek bir insan gibi, doğal ve sıcak Türkçe konuş. Selamlaşmaya selamla karşılık ver, hatır sorana içten cevap ver, şakalaşmaya gülümseyerek katıl. Kendini insanmış gibi tanıtma, "dil modeli" nutukları atma. Robotik madde listeleri, kalıp açılışlar ("Bunu henüz deftere işlemedim") ve gereksiz emoji yağmuru yapma. Kısa yaz (1-3 cümle), sonunda kısaca nasıl yardım edebileceğini hissettir. İşletme: ${ayarlar.isletmeAdi}.
YASAK: Senin kayıt ekleme/silme/düzeltme/listeleme yetkin YOK. Asla "kaydettim, ekledim, düzelttim, sildim, buldum, listeledim, kaydedeceğim, düzeltiyorum" gibi defter işlemi yaptığını/yapacağını SÖYLEME — bu yalandır. Kullanıcı işlem isterse ("ekle", "düzelt", tutarlı istek) şunu de: "Tam anlayamadım, tarih + tutar + ne olduğunu bir cümlede söyler misin?"`,
        },
        ...history.slice(-10).map((item) => ({
          role: item.rol === "user" ? "user" : "assistant",
          content: item.icerik,
        })),
        { role: "user", content: message },
      ],
      0.8,
      mb,
    );
  } catch {
    return null;
  }
}

/** Modelin düşünme kalıntısı/İngilizce sızdırdığı anlatımı ele, deterministik sonuca düş. */
function humanizeGuvenli(metin: string | null | undefined, yedek: string): string {
  const t = (metin ?? "").trim();
  if (!t) return yedek;
  // Bu kalıplar doğal Türkçe yanıtta ASLA geçmez; biri bile varsa model sızdırmıştır.
  if (/we need to|according to|as an ai|as a language model|reasoning|tool_call|function call|okay,? (so|now)|let me (check|verify|think)/i.test(t)) return yedek;
  return t;
}

async function humanizeLocalReply(message: string, result: string, history: SohbetMesaji[], ayarlar: Ayarlar): Promise<string | null> {
  const mb = cozMotor(ayarlar);
  if (!process.env.GROQ_API_KEY && mb.motor !== "ollama" && !OLLAMA_ANLATIM) return null;
  try {
    return await anlatimChat(
      [
        {
          role: "system",
          content:
            "Sen Defterdar'sın; küçük bir işletmenin muhasebecisi gibi kullanıcıyla doğal ve sakin konuş. Kullanıcının işlemi uygulama tarafından zaten tamamlandı; aşağıdaki sonuç tek doğruluk kaynağın. Sonucu sıcak ama ölçülü bir Türkçeyle, kısa ve konuşma dilinde anlat. Her yanıta aynı kalıpla başlama; gereksiz emoji, madde işareti ve resmi çağrı merkezi dili kullanma. Tarih, tutar, kategori, ödeme türü ve işlemin başarılı/başarısız oluşu dahil hiçbir bilgiyi değiştirme veya ekleme. Sonuçta bir onay ya da ek bilgi isteniyorsa bunu aynen koru. Araç çağırma; yalnızca kullanıcıya verilecek son yanıtı yaz.",
        },
        ...history.slice(-8).map((item) => ({
          role: item.rol === "user" ? "user" : "assistant",
          content: item.icerik,
        })),
        {
          role: "user",
          content: `İsteğim: ${message}\nUygulamanın kesin işlem sonucu:\n${result}\nBunu doğal bir muhasebeci gibi kısaca anlat.`,
        },
      ],
      0.7,
      mb,
    );
  } catch {
    return null;
  }
}

/** Kullanıcı "son kayıt / son satış / en son" dediyse model bayrağı unutsa da son kayıt hedeflenir. */
function messageIsterSonKayit(message: string): boolean {
  return /son (kayıt|kaydı|kaydını|kayit|satış|satis|hizmet|işlem|islem|girdi|harcama|fatura|ödeme|odeme)|en son|sonuncu/i.test(
    message.toLocaleLowerCase("tr-TR"),
  );
}

function messageHasExplicitDate(message: string): boolean {
  return new RegExp(
    `\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b|\\b\\d{1,2}\\s*[./-]\\s*\\d{1,2}\\s+\\d{4}\\b|\\b\\d{1,2}[./-]\\d{1,2}[./-]\\d{2,4}\\b|\\b\\d{1,2}\\s*(?:${AY_ADLARI})${AY_EKI}(?:\\s+\\d{4})?\\b`,
    "i",
  ).test(message);
}

function toolToIntent(name: string, args: Record<string, unknown>, today: string, message: string): NlpIntent | null {
  // Model "Diğer"e kaçıp yerel tarama net kategori bulursa yereli kullan
  // ("satış yaptım" → Hizmet; model listede Satış göremeyip Diğer seçiyor).
  const cozKategori = (modelKat: unknown): Kategori | null => {
    const gecerli = (KATEGORILER as readonly string[]).includes(String(modelKat)) ? (modelKat as Kategori) : null;
    if (gecerli && gecerli !== "Diğer") return gecerli;
    const yerel = detectKategori(message.toLocaleLowerCase("tr-TR"));
    return yerel ?? gecerli;
  };
  if (name === "ekle_coklu_kayit") {
    const tarih = args.tarih == null || args.tarih === "" ? (messageHasExplicitDate(message) ? null : today) : normTarih(args.tarih);
    const kategori = cozKategori(args.kategori);
    const kalemler = Array.isArray(args.kalemler) ? args.kalemler as Array<Record<string, unknown>> : [];
    const gelirMi = args.tur === "gelir";
    const giderMi = args.tur === "gider";
    const odemeTipi = args.odemeTipi === "Kart" || args.odemeTipi === "Havale" ? args.odemeTipi : args.odemeTipi === "Nakit" || args.odemeTipi == null ? "Nakit" : null;
    if (!tarih || !kategori || (!gelirMi && !giderMi) || !odemeTipi || kalemler.length < 2 || kalemler.length > 20) return null;
    // Açıklamasız kalem yığını ("Diğer 4, Diğer 8") — tarih parçasını tutar sanma hastalığı. Sor.
    const katAdlari = new Set((KATEGORILER as readonly string[]).map((k) => k.toLocaleLowerCase("tr-TR")));
    const hepsiBos = kalemler.every((kalem) => {
      const a = String(kalem.aciklama || "").trim().toLocaleLowerCase("tr-TR");
      return !a || katAdlari.has(a);
    });
    if (hepsiBos) return null;
    const kayitlar: KayitGirdi[] = [];
    for (const kalem of kalemler) {
      const tutar = Number(kalem.tutar);
      const aciklama = String(kalem.aciklama || "").trim();
      if (!aciklama || !Number.isFinite(tutar) || tutar <= 0) return null;
      kayitlar.push({ tarih, aciklama, kategori, gelir: gelirMi ? tutar : 0, gider: giderMi ? tutar : 0, odemeTipi });
    }
    return { type: "ekle_coklu", kayitlar, confidence: 0.95 };
  }
  if (name === "ekle_kayit") {
    const gelir = Number(args.gelir ?? 0);
    const gider = Number(args.gider ?? 0);
    const tarih = args.tarih == null || args.tarih === "" ? (messageHasExplicitDate(message) ? null : today) : normTarih(args.tarih);
    const kat = cozKategori(args.kategori);
    const aciklamaHam = String(args.aciklama || "").trim();
    // Çıplak kategori adlı "açıklama" ("Diğer") uydurmadır — sor.
    if (aciklamaHam && (KATEGORILER as readonly string[]).map((k) => k.toLocaleLowerCase("tr-TR")).includes(aciklamaHam.toLocaleLowerCase("tr-TR"))) {
      return null;
    }
    if (
      !tarih ||
      !aciklamaHam ||
      !kat ||
      (args.odemeTipi !== "Kart" && args.odemeTipi !== "Nakit" && args.odemeTipi !== "Havale") ||
      !Number.isFinite(gelir) ||
      !Number.isFinite(gider) ||
      (gelir > 0) === (gider > 0)
    ) {
      return null;
    }
    return {
      type: "ekle",
      kayit: {
        tarih,
        aciklama: aciklamaHam,
        kategori: kat,
        gelir,
        gider,
        odemeTipi: args.odemeTipi,
      },
      confidence: 0.9,
    };
  }
  if (name === "guncelle_kayit") {
    const kategori = (KATEGORILER as readonly string[]).includes(String(args.kategori || ""))
      ? (args.kategori as Kategori)
      : undefined;
    const tarihBelirtilmis = args.tarih != null && args.tarih !== "";
    const tarih = tarihBelirtilmis ? (normTarih(args.tarih) ?? undefined) : undefined;
    const aciklamaIcerir = String(args.aciklamaIcerir || "").trim() || undefined;
    const tutar = args.tutar == null ? undefined : Number(args.tutar);
    if ((tarihBelirtilmis && !tarih) || (messageHasExplicitDate(message) && !tarih && !aciklamaIcerir && !args.sonKayit)) return null;
    if (tutar != null && (!Number.isFinite(tutar) || tutar <= 0)) return null;
    const patch: Partial<KayitGirdi> = {};
    if (args.gelir != null) patch.gelir = Number(args.gelir);
    if (args.gider != null) patch.gider = Number(args.gider);
    if (args.odemeTipi === "Kart" || args.odemeTipi === "Nakit" || args.odemeTipi === "Havale") patch.odemeTipi = args.odemeTipi;
    if (args.aciklama) patch.aciklama = String(args.aciklama);
    if (kategori) patch.kategori = kategori;
    if (args.yeniTarih) {
      const yt = normTarih(args.yeniTarih);
      if (!yt) return null;
      patch.tarih = yt;
    }
    if (!Object.keys(patch).length) return null;
    // Yama alanları (odemeTipi/tur) filtre DEĞİLDİR: "kart değil nakit" denirse
    // filtrede Nakit aramak mevcut Kart kaydı dışlar. Hedef; tarih/kategori/açıklama/tutar ile bulunur.
    return {
      type: "guncelle",
      filtre: {
        tarih,
        kategori,
        aciklamaIcerir,
        tutar,
        sonMu: args.sonKayit === true || (!tarih && !kategori && !aciklamaIcerir && tutar == null && messageIsterSonKayit(message)),
      },
      patch,
      confidence: 0.9,
    };
  }
  if (name === "sil_kayit") {
    const kategori = (KATEGORILER as readonly string[]).includes(String(args.kategori || ""))
      ? (args.kategori as Kategori)
      : undefined;
    const tarihBelirtilmis = args.tarih != null && args.tarih !== "";
    const tarih = tarihBelirtilmis ? (normTarih(args.tarih) ?? undefined) : undefined;
    const aciklamaIcerir = String(args.aciklamaIcerir || "").trim() || undefined;
    const tutar = args.tutar == null ? undefined : Number(args.tutar);
    // "Son kaydı sil" nettir: modelin uydurduğu filtreleri çöpe at, en yeniyi hedefle.
    if (
      messageIsterSonKayit(message) &&
      !messageHasExplicitDate(message) &&
      !kategori &&
      tutar == null &&
      (args.tarih == null || args.tarih === "")
    ) {
      return { type: "sil", filtre: { sonMu: true }, confidence: 0.9 };
    }
    const sonMu = args.sonKayit === true || (!tarih && !kategori && !aciklamaIcerir && tutar == null && messageIsterSonKayit(message));
    if ((tarihBelirtilmis && !tarih) || (messageHasExplicitDate(message) && !tarih) || (tutar != null && (!Number.isFinite(tutar) || tutar <= 0))) {
      return null;
    }
    if (!tarih && !kategori && !aciklamaIcerir && tutar == null && !sonMu) return null;
    return {
      type: "sil",
      filtre: {
        tarih,
        kategori,
        aciklamaIcerir,
        tutar,
        odemeTipi: args.odemeTipi === "Kart" || args.odemeTipi === "Nakit" || args.odemeTipi === "Havale" ? args.odemeTipi : undefined,
        tur: args.tur === "gelir" || args.tur === "gider" ? args.tur : undefined,
        sonMu,
      },
      confidence: 0.9,
    };
  }
  if (name === "kira_bol") {
    return { type: "bol_kira", ay: Number(args.ay || 3), confidence: 0.9 };
  }
  if (name === "listele_kayitlar") {
    const kategori = (KATEGORILER as readonly string[]).includes(String(args.kategori || ""))
      ? (args.kategori as Kategori)
      : undefined;
    if ((args.baslangic && !normTarih(args.baslangic)) || (args.bitis && !normTarih(args.bitis))) return null;
    // Model tarih vermezse ("geçen ayın kayıtları") yerelden çöz, hepsini dökme.
    const yerelAralik = !args.baslangic && !args.bitis ? parseRange(message.toLocaleLowerCase("tr-TR"), today) : null;
    const baslangic = args.baslangic ? (normTarih(args.baslangic) ?? undefined) : yerelAralik?.baslangic;
    const bitis = args.bitis ? (normTarih(args.bitis) ?? undefined) : yerelAralik?.bitis;
    return {
      type: "listele",
      filtre: {
        baslangic,
        bitis,
        kategori,
        odemeTipi: args.odemeTipi === "Kart" || args.odemeTipi === "Nakit" || args.odemeTipi === "Havale" ? args.odemeTipi : undefined,
      },
      confidence: 0.9,
    };
  }
  if (name === "toplu_sil") {
    const kategori = (KATEGORILER as readonly string[]).includes(String(args.kategori || ""))
      ? (args.kategori as Kategori)
      : undefined;
    return {
      type: "toplu_sil",
      filtre: {
        baslangic: args.baslangic ? String(args.baslangic) : undefined,
        bitis: args.bitis ? String(args.bitis) : undefined,
        kategori,
        odemeTipi: args.odemeTipi === "Kart" || args.odemeTipi === "Nakit" || args.odemeTipi === "Havale" ? args.odemeTipi : undefined,
      },
      onayla: args.onayla === true,
      confidence: 0.9,
    };
  }
  if (name === "guncelle_ayar") {
    const patch: Partial<Ayarlar> = {};
    if (args.isletmeAdi) patch.isletmeAdi = String(args.isletmeAdi);
    if (args.kiraTutari != null) patch.kiraTutari = Number(args.kiraTutari);
    if (args.kiraPeriyodu != null) patch.kiraPeriyodu = Number(args.kiraPeriyodu);
    if (args.kiraSonrakiTarih) patch.kiraSonrakiTarih = String(args.kiraSonrakiTarih);
    if (args.acilisBakiyesi != null) patch.acilisBakiyesi = Number(args.acilisBakiyesi);
    return { type: "ayar", patch, confidence: 0.9 };
  }
  if (name === "sohbet_temizle") {
    return { type: "temizle", confidence: 0.9 };
  }
  if (name === "indir_yedek") {
    return { type: "indir_yedek", confidence: 0.9 };
  }
  if (name === "yedek_geri_yukle") {
    return { type: "restore_backup", confirm: args.onayla === true, confidence: 0.9 };
  }
  if (name === "tum_verileri_sifirla") {
    return { type: "reset_all", confirm: args.onayla === true, confidence: 0.9 };
  }
  if (name === "indir_rapor") {
    const tip = ["defter", "z", "gunsonu", "aysonu", "karzarar", "ozet"].includes(String(args.tip))
      ? (args.tip as "defter" | "z" | "gunsonu" | "aysonu" | "karzarar" | "ozet")
      : "ozet";
    const now = new Date();
    const ay = monthRange(now.getFullYear(), now.getMonth() + 1);
    // Model tarih vermezse ("geçen ayın raporunu indir") yerelden çöz, bu aya düşme.
    const yerelAralik = !args.baslangic && !args.bitis ? parseRange(message.toLocaleLowerCase("tr-TR"), today) : null;
    return {
      type: "indir_rapor",
      tip,
      baslangic: args.baslangic ? (normTarih(args.baslangic) ?? today) : (yerelAralik?.baslangic ?? (tip === "defter" ? "2000-01-01" : tip === "gunsonu" ? today : ay.baslangic)),
      bitis: args.bitis ? (normTarih(args.bitis) ?? today) : (yerelAralik?.bitis ?? (tip === "defter" ? "2100-12-31" : tip === "gunsonu" ? today : ay.bitis)),
      confidence: 0.9,
    };
  }
  const tip = String(args.tip || "ozet") as Extract<NlpIntent, { type: "rapor" }>["tip"];
  const kategori = (KATEGORILER as readonly string[]).includes(String(args.kategori || ""))
    ? (args.kategori as Kategori)
    : undefined;
  const rYerel = !args.baslangic && !args.bitis ? parseRange(message.toLocaleLowerCase("tr-TR"), today) : null;
  const rBaslangic = args.baslangic ? (normTarih(args.baslangic) ?? undefined) : rYerel?.baslangic;
  const rBitis = args.bitis ? (normTarih(args.bitis) ?? undefined) : rYerel?.bitis;
  return {
    type: "rapor",
    tip,
    baslangic: rBaslangic,
    bitis: rBitis,
    kategori,
    confidence: 0.9,
  };
}

function ozetContext(kayitlar: Kayit[], ayarlar: Ayarlar): string {
  const today = toISODate();
  const now = new Date();
  const buAy = monthRange(now.getFullYear(), now.getMonth() + 1);
  const onceki = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const gecenAy = monthRange(onceki.getFullYear(), onceki.getMonth() + 1);
  const yil = now.getFullYear();
  const r = buildRapor(kayitlar, ayarlar, buAy.baslangic, buAy.bitis);
  const rg = buildRapor(kayitlar, ayarlar, gecenAy.baslangic, gecenAy.bitis);
  const ry = buildRapor(kayitlar, ayarlar, `${yil}-01-01`, `${yil}-12-31`);
  const tum = buildRapor(kayitlar, ayarlar, "2000-01-01", "2100-12-31");
  const gun = buildRapor(kayitlar, ayarlar, today, today);
  const uyarilar = computeUyarilar(kayitlar, ayarlar, today);
  const yillar = [...new Set(kayitlar.map((k) => k.tarih.slice(0, 4)))].sort();
  // Kayıt olan TÜM aylar (adetleriyle) + ilk/son tarih: "hangi aylar var?" soruları için.
  const ayAdet = new Map<string, number>();
  for (const k of kayitlar) {
    const ay = k.tarih.slice(0, 7);
    ayAdet.set(ay, (ayAdet.get(ay) ?? 0) + 1);
  }
  const aylar = [...ayAdet.entries()].sort().map(([ay, adet]) => ({ ay, adet }));
  const tarihler = kayitlar.map((k) => k.tarih).sort();
  const kisa = (k: Kayit) => ({
    t: k.tarih,
    a: k.aciklama.slice(0, 32),
    k: k.kategori,
    g: k.gelir,
    d: k.gider,
    o: k.odemeTipi,
  });
  // Token diyeti: bugünkü özetin ham kayıt listesini kısalt, son kayıtları 12'ye indir.
  const gunKisa = {
    adet: gun.adet,
    gelir: gun.gelir,
    gider: gun.gider,
    net: gun.net,
    kayitlar: (gun.kayitlar ?? []).slice(-12).map(kisa),
  };
  return JSON.stringify(
    {
      bugun: today,
      isletme: ayarlar.isletmeAdi,
      kira: {
        donem: ayarlar.kiraTutari,
        periyot: ayarlar.kiraPeriyodu,
        aylik: ayarlar.aylikKiraKarsiligi,
        sonraki: ayarlar.kiraSonrakiTarih,
      },
      buAy: { ...r, kayitlar: undefined, gunler: r.gunler.slice(-10) },
      gecenAy: { ...rg, kayitlar: undefined, gunler: [] },
      buYil: { yil: yil, gelir: ry.gelir, gider: ry.gider, net: ry.net, adet: ry.adet },
      tumZamanlar: { gelir: tum.gelir, gider: tum.gider, net: tum.net, adet: tum.adet, kapanis: tum.kapanisBakiyesi },
      kategorilerTumu: tum.kategoriler,
      yillar,
      aylar,
      ilkKayit: tarihler[0] ?? null,
      sonKayit: tarihler[tarihler.length - 1] ?? null,
      toplamKayit: kayitlar.length,
      bugunOzet: gunKisa,
      uyarilar,
      sonKayitlar: kayitlar.slice(-12).map(kisa),
    },
    null,
    0,
  );
}

export type GroqSonuc = {
  text: string;
  /** Dosya üretildiyse öne otomatik indirme emri verilir. */
  excel?: { tip: string; baslangic: string; bitis: string };
};

async function tryGroq(message: string, history: SohbetMesaji[], kayitlar: Kayit[], ayarlar: Ayarlar): Promise<GroqSonuc | null> {
  if (!process.env.GROQ_API_KEY) return null;
  const today = toISODate();
  const system = `Sen Defterdar'sın, kullanıcının dijital muhasebecisi. Gerçek bir muhasebeci gibi düşün ve konuş.
Tarih formatı GG.AA.YYYY, para birimi ₺.
Bugün ${today}. İşletme: ${ayarlar.isletmeAdi}.
Kira: ${ayarlar.kiraTutari} ₺ / ${ayarlar.kiraPeriyodu} ay, aylık karşılık ${ayarlar.aylikKiraKarsiligi} ₺.
Kayıt eklerken kategori şunlardan biri olmalı: ${KATEGORILER.join(", ")}. Kullanıcı "satış/satis/ciro" derse Hizmet seç (eski adı).
Ödeme tipi Nakit, Kart veya banka transferi için Havale.
Gelir için gelir alanını, gider için gider alanını doldur.
Doğal dilden kayıt çıkar, rapor sorularında getir_rapor kullan.
TARİH KURALI (çok önemli): Kullanıcının söylediği tarihi ASLA bugüne çevirme, kendin hesapla. Bugün ${today}.
Örnekler: "12.03.2024"→2024-03-12 • "26 06 2026"→2026-06-26 • "dün"→bugünden 1 gün önce • "3 gün önce"→3 gün önce • "geçen salı"→en yakın geçmiş salının tarihi • "mart 2024"→2024-03-01 • "geçen ay"→önceki ayın 1'i (aralık için baslangic/bitis ver).
tarih/baslangic/bitis alanları her zaman YYYY-MM-DD formatında olmalı.
Kayıtları listelemen gerekirse listele_kayitlar, ayar değiştireceksen guncelle_ayar kullan. Kullanıcı IBAN/EFT/FAST diyorsa ödeme tipi Havale seç; bunu Nakit veya Kart'a çevirme.
ÇOKLU KALEM: Kullanıcı "biri 1.400 diğeri 200", "iki ürün" veya birden çok ayrı kalem söylüyorsa bunları tek açıklama/tutar yapma; her birini ayrı kayıt olarak ekle ve ekle_coklu_kayit aracını çağır. "2 paça" içindeki 2 adet sayısıdır, para değildir. Paça kısaltma/terzi işi işletme hizmet geliri olarak Hizmet kategorisine yazılır; kullanıcı açıkça gider/alışveriş olduğunu söylerse gider olarak yaz.
İŞLEM PROTOKOLÜ: Bir kayıt eklemek, silmek veya değiştirmek istendiğinde önce niyeti, tarihi, her kalemin tutarını ve gelir/gider yönünü konuşma bağlamından çöz; sonra mutlaka uygun aracı çağır. Aracı başarıyla çalıştırmadan işlem tamamlandı deme. Açıkça söylenen tarihi aynen kullan; gün adıyla çelişirse tam tarih öncelikli. Açık tarihli istekte tarihi araca veremiyorsan bugüne düşürme, netleştir.
OKUMA KURALI (çok önemli): Kullanıcı SORU soruyorsa ("ne girilmiş?", "kaç para?", "neler var?", "göster", "listele", "durum ne?") ASLA kayıt ekleme/değiştirme/silme — yalnızca listele_kayitlar veya getir_rapor kullan, sonucu olduğu gibi anlat. Soru cümlesindeki tutar/açıklama örnekleri ("150 TL'lik fermuar işi ne zaman?") işlem talimatı DEĞİLDİR; bunları deftere yazma. Kayıt işlemi SADECE kullanıcı açıkça yeni işlem bildiriyorsa yapılır ("yaptım", "ödedim", "aldım", "ekle", "yaz" + tutar).
ÜSLUP: Kullanıcının konuşma rahatlığına uyum sağla; kullanıcı "abi/kardeşim" diye samimi konuşuyorsa sen de gerektiğinde doğal karşılık ver, ama her cümleye aynı hitabı ekleme. Gerçek muhasebeci gibi önce ne istediğini anla, gereken işlemi yap, sonra kısa ve duruma uygun biçimde haber ver. Kalıp selam, gereksiz emoji ve robotik madde listelerinden kaçın; eksik veya çakışan bilgi varsa işlemden önce tek ve net soru sor.
DOSYA KURALI: Kullanıcı excel/rapor/yedek DOSYASI isterse indir_rapor veya indir_yedek kullan; sonucu mutlaka markdown linki olarak ver: [📥 Dosyayı indir](/api/...) — linki asla düz metin yazma.
TOPLU SİLME KURALI: toplu_sil aracını SADECE kullanıcı açıkça onaylarsa (onayla/onaylıyorum/evet sözcükleri) onayla=true ile çağır. Onay yoksa onayla=false ver, önizleme gösterilip onay istenir. Kapsam belirsizse asla silme, önce sor.
TAM UYGULAMA KAPSAMI: Kayıt ekle/düzelt/sil/listele, tüm raporlar, işletme ayarları, tam defter Excel'i, yedek indirme/geri yükleme ve sıfırlama araçlarını kullanabilirsin. Yedek geri yükleme ve tüm verileri sıfırlama için aynı kullanıcı mesajında ilgili işlemin adıyla birlikte açık onay yoksa aracı çalıştırma; önce tam onay cümlesini iste.
SORU-CEVAP KURALI: Rakamları yalnızca güncel defter özetinden al, uydurma. Sorulan şeye önce doğrudan cevap ver; karşılaştırma ve öneriyi yalnızca yararlıysa ekle. Konuşmayı rapor şablonuna zorlama.
SOHBET KURALI: Kullanıcı kayıt/rapor/sil/ayar istemiyor, sadece selamlaşıyor, hatır soruyor, teşekkür ediyor veya sohbet ediyorsa (merhaba, selam, naber, nasılsın, sağ ol, eyvallah, günaydın...) HİÇBİR araç çağırma ve muhasebe şablonu dayatma. Kısa (1-3 cümle), sıcak, doğal karşılık ver; gerekiyorsa sonunda kısaca "defter için buradayım" de. Asla "Bunu henüz deftere işlemedim" deme.
ÜSLUP: Bu defteri gerçekten takip eden, işini bilen bir muhasebeci gibi konuş; önceki konuşmadaki ayrıntıları yerinde kullan. Doğal ve ölçülü ol, samimiyeti zorlama. Her yanıta "tamamdır/hallettim/buyurun" diye başlama; tek işlem onaylarında gereksiz madde ve emoji kullanma. Kullanıcıya "siz" diye hitap et. Bilmediğini uydurma; eksik bilgi varsa yalnızca gereken şeyi sor. Kendini insanmış gibi tanıtma ve "yapay zeka/dil modeli" açıklamalarına girme.
Cevaplarını Türkçe yaz. Rakamları Türk formatında söyle.
Güncel defter özeti: ${ozetContext(kayitlar, ayarlar)}`;

  const msgs: { role: string; content: string | null; tool_calls?: GroqToolCall[]; tool_call_id?: string }[] = [
    { role: "system", content: system },
    ...history.slice(-8).map((m) => ({ role: m.rol === "user" ? "user" : "assistant", content: m.icerik })),
    { role: "user", content: message },
  ];

  try {
    const mb = cozMotor(ayarlar);
    // Ollama modunda Groq beyni atlanır: yerel niyet + yerel anlatım (key harcanmaz).
    if (mb.motor === "ollama") return null;
    const intent = parseCommand(message, today);
    const zorunluArac: Partial<Record<NlpIntent["type"], string>> = {
      ekle_coklu: "ekle_coklu_kayit",
      ekle: "ekle_kayit",
      guncelle: "guncelle_kayit",
      sil: "sil_kayit",
      toplu_sil: "toplu_sil",
      listele: "listele_kayitlar",
      rapor: "getir_rapor",
      ayar: "guncelle_ayar",
      bol_kira: "kira_bol",
      indir_rapor: "indir_rapor",
      indir_yedek: "indir_yedek",
      restore_backup: "yedek_geri_yukle",
      reset_all: "tum_verileri_sifirla",
    };
    const requiredTool = intent.confidence >= 0.75 ? zorunluArac[intent.type] : undefined;
    // Soru/sohbet/listeleme niyetinde modele yazan araçlar hiç gösterilmez:
    // "ne girilmiş?" sorusuna cevap verecekken kayıt uydurup defteri kirletemez.
    // Soru cümlesi ayrıca yerel ayrıştırıcının ekle tahminini de ezer.
    const soruMu = isQuestion(message.toLocaleLowerCase("tr-TR"));
    const allowWrite = !soruMu && intent.confidence >= 0.75 && WRITE_INTENTS.has(intent.type);
    // Liste raporları (ay/gün sonu, Z, listeleme) modele sorulmadan defterden verilir:
    // hem key harcanmaz hem satır yutulmaz.
    const hamListeNiyet = intent.confidence >= 0.75 && (intent.type === "listele" ||
      (intent.type === "rapor" && (intent.tip === "aysonu" || intent.tip === "gunsonu" || intent.tip === "z")));
    if (hamListeNiyet) {
      const freshKayitlar = await listKayitlar();
      const freshAyarlar = await getAyarlar();
      return { text: await executeIntent(intent, freshKayitlar, freshAyarlar) };
    }
    const first = await groqChat(
      msgs,
      true,
      requiredTool && allowWrite ? { type: "function", function: { name: requiredTool } } : "auto",
      0.3,
      allowWrite ? GROQ_TOOLS : GROQ_READ_TOOLS,
    );
    if (!first) return null;
    if (first.tool_calls?.length) {
      msgs.push({ role: "assistant", content: first.content ?? null, tool_calls: first.tool_calls });
      const parts: string[] = [];
      let excel: GroqSonuc["excel"];
      let hamListe = false;
      for (const call of first.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          args = {};
        }
        const normalizedMessage = message.toLocaleLowerCase("tr-TR");
        const explicitResetConfirmation =
          /(tüm verileri sıfırla|tum verileri sifirla|tüm defteri sıfırla|tum defteri sifirla)/.test(normalizedMessage) &&
          /(onaylıyorum|onayliyorum|onayla)/.test(normalizedMessage);
        const explicitRestoreConfirmation =
          /((yedek|yedeğ).*(geri yükle|geri yukle)|(geri yükle|geri yukle).*(yedek|yedeğ))/.test(normalizedMessage) &&
          /(onaylıyorum|onayliyorum|onayla)/.test(normalizedMessage);
        if (
          (call.function.name === "tum_verileri_sifirla" && !explicitResetConfirmation) ||
          (call.function.name === "yedek_geri_yukle" && !explicitRestoreConfirmation)
        ) {
          const result = "Bu işlem geri alınamaz. İşlemi yapmadım; devam etmek için istediğiniz işlemi açıkça yazıp aynı mesajda ‘onaylıyorum’ diye belirtin.";
          parts.push(result);
          msgs.push({ role: "tool", tool_call_id: call.id, content: result });
          continue;
        }
        const toolIntent = toolToIntent(call.function.name, args, today, message);
        // Zorunlu araç reddedilirse (bozuk argüman) yerel niyet sağlamsa onu uygula:
        // kullanıcı "düzelt" demişken "netleştir" diye oyalanma.
        const useIntent = toolIntent ?? (requiredTool && allowWrite && call.function.name === requiredTool ? intent : null);
        if (!useIntent) {
          console.error(`[groq] araç elendi: ${call.function.name} ${(call.function.arguments || "").slice(0, 300)}`);
          const result = "Bu kaydı işlemedim; tarih, tutar, kategori veya ödeme bilgisi eksik ya da geçersiz. Lütfen eksik bilgiyi netleştirin.";
          parts.push(result);
          msgs.push({ role: "tool", tool_call_id: call.id, content: result });
          continue;
        }
        const freshKayitlar = await listKayitlar();
        const freshAyarlar = await getAyarlar();
        if (useIntent.type === "guncelle" || useIntent.type === "sil") {
          console.error(`[groq] araç OK: ${call.function.name} filtre=${JSON.stringify((useIntent as { filtre: unknown }).filtre)} args=${(call.function.arguments || "").slice(0, 200)}`);
        }
        const result = await executeIntent(useIntent, freshKayitlar, freshAyarlar);
        parts.push(result);
        msgs.push({ role: "tool", tool_call_id: call.id, content: result });
        // Dosya üretildiyse öne otomatik indirme emri iliştir.
        if (useIntent.type === "indir_rapor" && !excel) {
          excel = { tip: useIntent.tip, baslangic: useIntent.baslangic, bitis: useIntent.bitis };
        }
        // Liste taşıyan sonuç (ay/gün sonu, Z, listeleme) anlatımda kısaltılmasın.
        if (
          useIntent.type === "listele" ||
          (useIntent.type === "rapor" && (useIntent.tip === "aysonu" || useIntent.tip === "gunsonu" || useIntent.tip === "z"))
        ) {
          hamListe = true;
        }
      }
      const second = await anlatimChat(msgs, 0.7, mb);
      return { text: hamListe ? parts.join("\n\n") : humanizeGuvenli(second, parts.join("\n\n")), ...(excel ? { excel } : {}) };
    }
    // Zorunlu araç varken model araçsız cevap verirse yerel niyeti uygula (araçsız bırakma).
    if (requiredTool && allowWrite && first.content) {
      const freshKayitlar = await listKayitlar();
      const freshAyarlar = await getAyarlar();
      const result = await executeIntent(intent, freshKayitlar, freshAyarlar);
      const anlatim = await anlatimChat(
        [
          {
            role: "system",
            content:
              "Sen Defterdar'sın. Uygulamanın kesin işlem sonucunu sıcak, kısa, konuşma diliyle anlat. Bilgiyi değiştirme, ekleme. Araç çağırma.",
          },
          { role: "user", content: `İsteğim: ${message}\nKesin sonuç:\n${result}` },
        ],
        0.7,
        mb,
      );
      return { text: humanizeGuvenli(anlatim, result) };
    }
    if (first.content) return { text: first.content };
  } catch {
    return null;
  }
  return null;
}

export async function handleChat(message: string): Promise<ChatResponse> {
  // Sohbet temizliği: kullanıcı mesajını kaydetmeden direkt temizle
  const ilkBakista = parseCommand(message);
  if (ilkBakista.type === "temizle" && ilkBakista.confidence >= 0.75) {
    const selamlar = await temizleSohbet();
    const taze = await getInitData();
    return {
      reply: selamlar[0]?.icerik ?? "🧹 Sohbet temizlendi.",
      data: taze,
    };
  }

  const data = await getInitData();
  await addMesaj("user", message);

  let action = parseChatAction(message);
  const local = parseCommand(message);
  let reply: string | null = null;

  // Yapay zekâ dosya ürettiyse öne otomatik indirme emri iliştir.
  const excelEylemi = (g: GroqSonuc | null): void => {
    if (g?.excel && !action) {
      action = {
        type: "download_excel",
        tip: g.excel.tip,
        baslangic: g.excel.baslangic,
        bitis: g.excel.bitis,
      };
    }
  };

  if (action) {
    if (action.type === "download_excel") reply = "Excel dosyanızı indiriyorum.";
    else if (action.type === "download_backup") reply = "Defter yedeğinizi indiriyorum.";
    else if (action.type === "choose_backup_file") reply = "Yedek dosyasını seçmeniz için pencereyi açıyorum.";
    else if (action.type === "print_page") reply = "Yazdırma penceresini açıyorum.";
    else if (action.type === "open_tab") reply = action.tab === "defter" ? "Defter sekmesine geçiyorum." : "Asistan sekmesine geçiyorum.";
    else if (action.type === "open_report") reply = "Rapor penceresini açıyorum.";
    else reply = action.type === "open_settings" ? "Ayarları açıyorum." : "Takvimi açıyorum.";
  } else if (local.type === "sohbet") {
    // Saf sohbet: muhasebe şablonu dayatma, doğal konuş.
    const g = await tryGroq(message, data.mesajlar, data.kayitlar, data.ayarlar);
    excelEylemi(g);
    reply = g?.text ?? null;
    if (!reply) {
      // Rakam soruluyorsa uydurma — defter özetinden gerçek cevabı üret.
      const rakamSoruyor = /kasa|kaç|kac|ne kadar|toplam|kâr|kar|zarar|rapor|kay[ıi]t|defter|borç|borc|alacak|girdi|çıktı|cikti|bakiye/.test(
        message.toLocaleLowerCase("tr-TR"),
      );
      if (rakamSoruyor) {
        const ozet = await executeIntent(
          { type: "rapor", tip: "ozet", confidence: 0.9 },
          data.kayitlar,
          data.ayarlar,
        );
        // Ollama modunda rakamları yerelin kalemine bırakma — özeti aynen ver.
        if (cozMotor(data.ayarlar).motor === "ollama") {
          reply = ozet;
        } else {
          const anlatim = await humanizeLocalReply(message, ozet, data.mesajlar, data.ayarlar);
          reply = anlatim ? humanizeGuvenli(anlatim, ozet) : ozet;
        }
      } else {
        reply = await freeChat(message, data.mesajlar, data.ayarlar);
      }
    }
    if (!reply) reply = "Buyur, seni dinliyorum. Nasılsın, bugün defter için ne yapalım?";
  } else {
    const g = await tryGroq(message, data.mesajlar, data.kayitlar, data.ayarlar);
    excelEylemi(g);
    reply = g?.text ?? null;
    if (!reply) {
      console.error(`[yerel] niyet: ${local.type} ${JSON.stringify(local).slice(0, 300)}`);
      const result = await executeIntent(local, data.kayitlar, data.ayarlar);
      // Ollama modunda liste/rapor/netleştirme ham verilir: format zaten düzgün,
      // küçük modelin rakam uydurması engellenir. Kısa onaylar yerelde anlatılır.
      // Liste taşıyan raporlar her modda ham verilir (özetleyici satır yutmasın).
      const hamVer = cozMotor(data.ayarlar).motor === "ollama" &&
        (local.type === "listele" || local.type === "rapor" || local.type === "netlestir" || local.type === "yardim" || local.type === "temizle");
      const hamListe = local.type === "listele" ||
        (local.type === "rapor" && local.tip !== undefined && (local.tip === "aysonu" || local.tip === "gunsonu" || local.tip === "z"));
      if (hamVer || hamListe) {
        reply = result;
      } else {
        const conversational = local.type === "netlestir" || local.type === "ekle_coklu"
          ? null
          : await humanizeLocalReply(message, result, data.mesajlar, data.ayarlar);
        reply = conversational ? humanizeGuvenli(conversational, result) : result;
      }
    }
  }

  const saved = await addMesaj("assistant", reply);
  const next = await getInitData();
  return {
    reply: saved.icerik,
    data: next,
    ...(action ? { action } : {}),
  };
}
