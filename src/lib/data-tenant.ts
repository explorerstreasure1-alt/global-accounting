import type { SupabaseClient } from "@supabase/supabase-js";
import type { Ayarlar, InitData, Kayit, KayitGirdi, Kategori, Musteri, MusteriGirdi, SohbetMesaji, Ziyaret, ZiyaretDurum, ZiyaretGirdi } from "./types";
import { KATEGORILER, KATEGORI_ESKI } from "./types";
import { addMonths, num, round2, toISODate } from "./format";

/**
 * Çok kiracılı veri katmanı (Supabase + RLS).
 * DB kolonları snake_case (drizzle şemasıyla birebir).
 * Tüm sorgular business_id ile sınırlı — işletmeler birbirinin verisini göremez.
 */

type Row = Record<string, unknown>;

function mapKayit(row: Row): Kayit {
  const rawKat = String(row.kategori ?? "Other");
  const kategori = (KATEGORILER as readonly string[]).includes(rawKat)
    ? (rawKat as Kategori)
    : ((KATEGORI_ESKI[rawKat] ?? "Other") as Kategori);
  const odt = String(row.odeme_tipi ?? "Nakit");
  const oz = row.olusturma_zamani;
  return {
    id: String(row.id),
    tarih: String(row.tarih),
    aciklama: String(row.aciklama ?? ""),
    kategori,
    gelir: num(row.gelir as string | number | null | undefined),
    gider: num(row.gider as string | number | null | undefined),
    odemeTipi: odt === "Kart" ? "Kart" : odt === "Havale" ? "Havale" : "Nakit",
    kasaEtkisi: num(row.kasa_etkisi as string | number | null | undefined),
    olusturmaZamani: oz ? new Date(oz as string).toISOString() : new Date().toISOString(),
  };
}

function mapAyarlar(row: Row): Ayarlar {
  return {
    id: Number(row.id ?? 1),
    isletmeAdi: String(row.isletme_adi ?? "My Tailor Shop"),
    kiraTutari: num(row.kira_tutari as string | number | null | undefined),
    kiraPeriyodu: Number(row.kira_periyodu ?? 6),
    aylikKiraKarsiligi: num(row.aylik_kira_karsiligi as string | number | null | undefined),
    paraBirimi: String(row.para_birimi ?? "USD"),
    kiraSonrakiTarih: (row.kira_sonraki_tarih ?? null) as string | null,
    acilisBakiyesi: num(row.acilis_bakiyesi as string | number | null | undefined),
    aiMotor: row.ai_motor === "groq" || row.ai_motor === "ollama" ? (row.ai_motor as Ayarlar["aiMotor"]) : "otomatik",
    ollamaModel: String(row.ollama_model ?? "gemma3:4b"),
    whatsappAlici: String(row.whatsapp_alici ?? ""),
  };
}

function mapMesaj(row: Row): SohbetMesaji {
  const oz = row.olusturma_zamani;
  return {
    id: String(row.id),
    rol: row.rol === "user" ? "user" : "assistant",
    icerik: String(row.icerik ?? ""),
    olusturmaZamani: oz ? new Date(oz as string).toISOString() : new Date().toISOString(),
  };
}

const ZDURUM: ZiyaretDurum[] = ["hazirlaniyor", "hazir", "teslim"];

function mapZiyaret(row: Row): Ziyaret {
  const d = String(row.durum ?? "hazirlaniyor");
  const oz = row.olusturma_zamani;
  return {
    id: String(row.id),
    musteriId: String(row.musteri_id ?? ""),
    hizmet: String(row.hizmet ?? ""),
    tutar: num(row.tutar as string | number | null | undefined),
    tarih: String(row.tarih ?? ""),
    not: String(row.not ?? ""),
    durum: (ZDURUM as string[]).includes(d) ? (d as ZiyaretDurum) : "hazirlaniyor",
    olusturmaZamani: oz ? new Date(oz as string).toISOString() : new Date().toISOString(),
  };
}

function musteriOzet(row: Row, tum: Ziyaret[]): Musteri {
  const zs = tum
    .filter((z) => z.musteriId === String(row.id))
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
  const oz = row.olusturma_zamani;
  return {
    id: String(row.id),
    ad: String(row.ad ?? ""),
    soyad: String(row.soyad ?? ""),
    telefon: String(row.telefon ?? ""),
    not: String(row.not ?? ""),
    ziyaretSayisi: zs.length,
    toplamHarcama: round2(zs.reduce((s, z) => s + z.tutar, 0)),
    sonZiyaret: zs.length ? zs[0].tarih : null,
    silindi: row.silindi_at !== null && row.silindi_at !== undefined,
    olusturmaZamani: oz ? new Date(oz as string).toISOString() : new Date().toISOString(),
  };
}

export type TenantDb = {
  listKayitlar(): Promise<Kayit[]>;
  getAyarlar(): Promise<Ayarlar>;
  createKayit(input: KayitGirdi): Promise<Kayit>;
  updateKayit(id: string, patch: Partial<KayitGirdi>): Promise<Kayit | null>;
  deleteKayit(id: string): Promise<boolean>;
  listMusteriler(q?: string, silinmis?: boolean): Promise<Musteri[]>;
  getMusteri(id: string): Promise<(Musteri & { ziyaretler: Ziyaret[] }) | null>;
  createMusteri(input: MusteriGirdi): Promise<Musteri>;
  updateMusteri(id: string, patch: Partial<MusteriGirdi>): Promise<Musteri | null>;
  deleteMusteri(id: string): Promise<boolean>;
  restoreMusteri(id: string): Promise<boolean>;
  addZiyaret(input: ZiyaretGirdi): Promise<Ziyaret>;
  updateZiyaretDurum(id: string, durum: ZiyaretDurum): Promise<Ziyaret | null>;
  deleteZiyaret(id: string): Promise<boolean>;
  updateAyarlar(patch: Partial<Ayarlar>): Promise<Ayarlar>;
  addMesaj(rol: "user" | "assistant", icerik: string): Promise<SohbetMesaji>;
  temizleSohbet(locale?: string): Promise<SohbetMesaji[]>;
  sifirlaTumu(): Promise<InitData>;
  restoreSnapshot(snap: InitData): Promise<InitData>;
  restoreLatestBackup(): Promise<InitData | null>;
  getInitData(): Promise<InitData>;
};

const SELAM: Record<string, string> = {
  tr: "Sohbet temizlendi. Ben Defterdar, dijital muhasebeciniz. Nasıl yardımcı olayım?",
  en: "Chat cleared. I'm TailorAI, your tailor shop assistant. How can I help?",
  de: "Chat gelöscht. Ich bin TailorAI, Ihr Assistent. Wie kann ich helfen?",
  fr: "Discussion effacée. Je suis TailorAI, votre assistant. Comment aider ?",
  es: "Chat borrado. Soy TailorAI, tu asistente. ¿En qué ayudo?",
  ar: "تم مسح المحادثة. أنا TailorAI، مساعدك. كيف أساعد؟",
  ru: "Чат очищен. Я TailorAI, ваш ассистент. Чем помочь?",
};

export function tenantDb(supa: SupabaseClient, businessId: string, businessName: string): TenantDb {
  function gecerliTarih(t: string | undefined | null): string {
    const s = String(t || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return toISODate();
  }

  async function listKayitlar(): Promise<Kayit[]> {
    const { data, error } = await supa
      .from("kayitlar")
      .select("*")
      .eq("business_id", businessId)
      .order("tarih", { ascending: true });
    if (error) throw error;
    return (data as Row[]).map(mapKayit);
  }

  async function getAyarlar(): Promise<Ayarlar> {
    const { data, error } = await supa.from("ayarlar").select("*").eq("business_id", businessId).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) {
      const today = toISODate();
      const ilk = addMonths(today, 1).slice(0, 8) + "01";
      const { data: ins, error: e2 } = await supa
        .from("ayarlar")
        .insert({
          isletme_adi: businessName,
          kira_tutari: 1500, kira_periyodu: 6, aylik_kira_karsiligi: 250,
          para_birimi: "USD", kira_sonraki_tarih: ilk, acilis_bakiyesi: 125,
          ai_motor: "otomatik", ollama_model: "gemma3:4b", whatsapp_alici: "",
          business_id: businessId,
        })
        .select("*")
        .single();
      if (e2) throw e2;
      return mapAyarlar(ins as Row);
    }
    return mapAyarlar(data as Row);
  }

  async function createKayit(input: KayitGirdi): Promise<Kayit> {
    const gelir = round2(Math.max(0, input.gelir || 0));
    const gider = round2(Math.max(0, input.gider || 0));
    const { data, error } = await supa
      .from("kayitlar")
      .insert({
        tarih: gecerliTarih(input.tarih),
        aciklama: input.aciklama.trim() || "Entry",
        kategori: input.kategori,
        gelir, gider,
        odeme_tipi: input.odemeTipi,
        kasa_etkisi: round2(gelir - gider),
        business_id: businessId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapKayit(data as Row);
  }

  async function updateKayit(id: string, patch: Partial<KayitGirdi>): Promise<Kayit | null> {
    const cur = await supa.from("kayitlar").select("*").eq("id", id).eq("business_id", businessId).limit(1).maybeSingle();
    if (cur.error || !cur.data) return null;
    const current = mapKayit(cur.data as Row);
    const gelir = patch.gelir != null ? round2(Math.max(0, patch.gelir)) : current.gelir;
    const gider = patch.gider != null ? round2(Math.max(0, patch.gider)) : current.gider;
    const next = {
      tarih: patch.tarih ? gecerliTarih(patch.tarih) : current.tarih,
      aciklama: patch.aciklama ?? current.aciklama,
      kategori: patch.kategori ?? current.kategori,
      gelir, gider,
      odeme_tipi: patch.odemeTipi ?? current.odemeTipi,
      kasa_etkisi: round2(gelir - gider),
    };
    const { error } = await supa.from("kayitlar").update(next).eq("id", id).eq("business_id", businessId);
    if (error) throw error;
    return { ...current, ...next, odemeTipi: next.odeme_tipi as Kayit["odemeTipi"] };
  }

  async function deleteKayit(id: string): Promise<boolean> {
    const { error, count } = await supa.from("kayitlar").delete({ count: "exact" }).eq("id", id).eq("business_id", businessId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async function updateAyarlar(patch: Partial<Ayarlar>): Promise<Ayarlar> {
    const current = await getAyarlar();
    const kiraTutari = patch.kiraTutari ?? current.kiraTutari;
    const kiraPeriyodu = patch.kiraPeriyodu ?? current.kiraPeriyodu;
    const aylik = patch.aylikKiraKarsiligi ?? (kiraPeriyodu > 0 ? round2(kiraTutari / kiraPeriyodu) : current.aylikKiraKarsiligi);
    const next = {
      isletme_adi: patch.isletmeAdi ?? current.isletmeAdi,
      kira_tutari: kiraTutari, kira_periyodu: kiraPeriyodu, aylik_kira_karsiligi: aylik,
      para_birimi: patch.paraBirimi ?? current.paraBirimi,
      kira_sonraki_tarih: patch.kiraSonrakiTarih === undefined ? current.kiraSonrakiTarih : patch.kiraSonrakiTarih,
      acilis_bakiyesi: patch.acilisBakiyesi ?? current.acilisBakiyesi,
      ai_motor: patch.aiMotor ?? current.aiMotor,
      ollama_model: patch.ollamaModel ?? current.ollamaModel,
      whatsapp_alici: patch.whatsappAlici ?? current.whatsappAlici,
    };
    const { error } = await supa.from("ayarlar").update(next).eq("business_id", businessId);
    if (error) throw error;
    return getAyarlar();
  }

  async function addMesaj(rol: "user" | "assistant", icerik: string): Promise<SohbetMesaji> {
    const { data, error } = await supa
      .from("sohbetMesajlari")
      .insert({ rol, icerik, business_id: businessId })
      .select("*")
      .single();
    if (error) throw error;
    return mapMesaj(data as Row);
  }

  async function temizleSohbet(locale = "en"): Promise<SohbetMesaji[]> {
    const selam: SohbetMesaji = {
      id: crypto.randomUUID(),
      rol: "assistant",
      icerik: SELAM[locale] ?? SELAM.en,
      olusturmaZamani: new Date().toISOString(),
    };
    const del = await supa.from("sohbetMesajlari").delete().eq("business_id", businessId);
    if (del.error) throw del.error;
    const ins = await supa.from("sohbetMesajlari").insert({
      id: selam.id, rol: selam.rol, icerik: selam.icerik, business_id: businessId,
    });
    if (ins.error) throw ins.error;
    return [selam];
  }

  async function sifirlaTumu(): Promise<InitData> {
    await supa.from("kayitlar").delete().eq("business_id", businessId);
    await supa.from("sohbetMesajlari").delete().eq("business_id", businessId);
    await updateAyarlar({ kiraTutari: 0, kiraPeriyodu: 1, aylikKiraKarsiligi: 0, kiraSonrakiTarih: null, acilisBakiyesi: 0 });
    const selam = await addMesaj("assistant", "Fresh start. Ledger cleared.");
    return { kayitlar: [], ayarlar: await getAyarlar(), mesajlar: [selam] };
  }

  async function getInitData(): Promise<InitData> {
    const [kayitlar, ayarlar, tum] = await Promise.all([
      listKayitlar(),
      getAyarlar(),
      supa.from("sohbetMesajlari").select("*").eq("business_id", businessId).order("olusturma_zamani", { ascending: false }).limit(200),
    ]);
    if (tum.error) throw tum.error;
    return {
      kayitlar,
      ayarlar,
      mesajlar: (tum.data as Row[]).map(mapMesaj).reverse(),
    };
  }

  async function restoreLatestBackup(): Promise<InitData | null> {
    return null; // SaaS modunda dosya yedeği yok; yakında Supabase yedeği
  }

  /** Yedek dosyasından geri yükle (satırlar bu işletmeye damgalanır). */
  async function restoreSnapshot(snap: InitData): Promise<InitData> {
    for (const k of snap.kayitlar) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(k.tarih || ""))) throw new Error("Invalid backup date.");
      if (!Number.isFinite(Number(k.gelir)) || !Number.isFinite(Number(k.gider))) throw new Error("Invalid backup amount.");
    }
    if (!Number.isFinite(Number(snap.ayarlar.kiraTutari)) || !Number.isFinite(Number(snap.ayarlar.acilisBakiyesi))) {
      throw new Error("Invalid backup settings.");
    }
    await supa.from("kayitlar").delete().eq("business_id", businessId);
    await supa.from("sohbetMesajlari").delete().eq("business_id", businessId);
    if (snap.kayitlar.length) {
      const rows = snap.kayitlar.map((k) => ({
        tarih: String(k.tarih),
        aciklama: String(k.aciklama || "Entry"),
        kategori: (KATEGORILER as readonly string[]).includes(k.kategori) ? k.kategori : "Other",
        gelir: round2(Math.max(0, Number(k.gelir) || 0)),
        gider: round2(Math.max(0, Number(k.gider) || 0)),
        odeme_tipi: k.odemeTipi === "Kart" ? "Kart" : k.odemeTipi === "Havale" ? "Havale" : "Nakit",
        kasa_etkisi: round2((Number(k.gelir) || 0) - (Number(k.gider) || 0)),
        business_id: businessId,
      }));
      const { error } = await supa.from("kayitlar").insert(rows);
      if (error) throw error;
    }
    await updateAyarlar({ ...snap.ayarlar, id: undefined as unknown as number });
    const msgs = (snap.mesajlar || []).slice(-500).map((m) => ({
      rol: m.rol === "user" ? "user" : "assistant",
      icerik: String(m.icerik || ""),
      business_id: businessId,
    }));
    if (msgs.length) {
      const { error } = await supa.from("sohbetMesajlari").insert(msgs);
      if (error) throw error;
    }
    return getInitData();
  }

  async function tumZiyaretler(): Promise<Ziyaret[]> {
    const { data, error } = await supa.from("ziyaretler").select("*").eq("business_id", businessId);
    if (error) throw error;
    return ((data ?? []) as Row[]).map(mapZiyaret);
  }

  function suzMusteri(ms: Musteri[], q?: string, silinmis = false): Musteri[] {
    let out = silinmis ? ms : ms.filter((m) => !m.silindi);
    if (q) {
      const t = q.toLocaleLowerCase();
      out = out.filter((m) => `${m.ad} ${m.soyad} ${m.telefon}`.toLocaleLowerCase().includes(t));
    }
    return out.sort((a, b) => `${a.ad} ${a.soyad}`.localeCompare(`${b.ad} ${b.soyad}`));
  }

  async function listMusteriler(q?: string, silinmis = false): Promise<Musteri[]> {
    const { data, error } = await supa.from("musteriler").select("*").eq("business_id", businessId);
    if (error) throw error;
    const zs = await tumZiyaretler();
    return suzMusteri(((data ?? []) as Row[]).map((r) => musteriOzet(r, zs)), q, silinmis);
  }

  async function getMusteri(id: string): Promise<(Musteri & { ziyaretler: Ziyaret[] }) | null> {
    const cur = await supa.from("musteriler").select("*").eq("id", id).eq("business_id", businessId).limit(1).maybeSingle();
    if (cur.error || !cur.data) return null;
    const z = await supa.from("ziyaretler").select("*").eq("musteri_id", id).eq("business_id", businessId).order("tarih", { ascending: false });
    if (z.error) throw z.error;
    const zs = ((z.data ?? []) as Row[]).map(mapZiyaret);
    return { ...musteriOzet(cur.data as Row, zs), ziyaretler: zs };
  }

  async function createMusteri(input: MusteriGirdi): Promise<Musteri> {
    const { data, error } = await supa
      .from("musteriler")
      .insert({
        ad: String(input.ad || "").trim().slice(0, 60) || "İsimsiz",
        soyad: String(input.soyad || "").trim().slice(0, 60),
        telefon: String(input.telefon || "").trim().slice(0, 30),
        not: String(input.not || "").trim().slice(0, 500),
        business_id: businessId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return musteriOzet(data as Row, []);
  }

  async function updateMusteri(id: string, patch: Partial<MusteriGirdi>): Promise<Musteri | null> {
    const cur = await getMusteri(id);
    if (!cur) return null;
    const next = {
      ad: patch.ad !== undefined ? String(patch.ad).trim().slice(0, 60) || cur.ad : cur.ad,
      soyad: patch.soyad !== undefined ? String(patch.soyad).trim().slice(0, 60) : cur.soyad,
      telefon: patch.telefon !== undefined ? String(patch.telefon).trim().slice(0, 30) : cur.telefon,
      not: patch.not !== undefined ? String(patch.not).trim().slice(0, 500) : cur.not,
    };
    const { error } = await supa.from("musteriler").update(next).eq("id", id).eq("business_id", businessId);
    if (error) throw error;
    return getMusteri(id).then((g) => (g ? { ...g, ziyaretler: undefined as never } as Musteri : null));
  }

  async function setSilindi(id: string, silindi: boolean): Promise<boolean> {
    const { error, count } = await supa
      .from("musteriler")
      .update({ silindi_at: silindi ? new Date().toISOString() : null }, { count: "exact" })
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async function deleteMusteri(id: string): Promise<boolean> {
    return setSilindi(id, true);
  }

  async function restoreMusteri(id: string): Promise<boolean> {
    return setSilindi(id, false);
  }

  async function addZiyaret(input: ZiyaretGirdi): Promise<Ziyaret> {
    const tutar = round2(Math.max(0, Number(input.tutar) || 0));
    const { data, error } = await supa
      .from("ziyaretler")
      .insert({
        musteri_id: input.musteriId,
        hizmet: String(input.hizmet || "").trim().slice(0, 80),
        tutar,
        tarih: /^\d{4}-\d{2}-\d{2}$/.test(String(input.tarih || "")) ? input.tarih : toISODate(),
        not: String(input.not || "").trim().slice(0, 500),
        durum: "hazirlaniyor",
        business_id: businessId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapZiyaret(data as Row);
  }

  async function updateZiyaretDurum(id: string, durum: ZiyaretDurum): Promise<Ziyaret | null> {
    const d = (["hazirlaniyor", "hazir", "teslim"] as string[]).includes(durum) ? durum : "hazirlaniyor";
    const { data, error } = await supa
      .from("ziyaretler")
      .update({ durum: d })
      .eq("id", id)
      .eq("business_id", businessId)
      .select("*");
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    if (!rows.length) return null;
    return mapZiyaret(rows[0]);
  }

  async function deleteZiyaret(id: string): Promise<boolean> {
    const { error, count } = await supa.from("ziyaretler").delete({ count: "exact" }).eq("id", id).eq("business_id", businessId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  return { listKayitlar, getAyarlar, createKayit, updateKayit, deleteKayit, updateAyarlar, addMesaj, temizleSohbet, sifirlaTumu, restoreSnapshot, restoreLatestBackup, getInitData, listMusteriler, getMusteri, createMusteri, updateMusteri, deleteMusteri, restoreMusteri, addZiyaret, updateZiyaretDurum, deleteZiyaret };
}

/** Dosya/tek-kullanıcı modu için aynı arayüz (mevcut davranış birebir). */
export async function fileDb(): Promise<TenantDb> {
  const d = await import("./data");
  return {
    listKayitlar: d.listKayitlar,
    getAyarlar: d.getAyarlar,
    createKayit: d.createKayit,
    updateKayit: d.updateKayit,
    deleteKayit: d.deleteKayit,
    updateAyarlar: d.updateAyarlar,
    addMesaj: d.addMesaj,
    temizleSohbet: (locale?: string) => d.temizleSohbet(locale),
    sifirlaTumu: d.sifirlaTumu,
    restoreSnapshot: d.restoreSnapshot,
    restoreLatestBackup: d.restoreLatestBackup,
    getInitData: d.getInitData,
    listMusteriler: d.listMusteriler,
    getMusteri: d.getMusteri,
    createMusteri: d.createMusteri,
    updateMusteri: d.updateMusteri,
    deleteMusteri: d.deleteMusteri,
    restoreMusteri: d.restoreMusteri,
    addZiyaret: d.addZiyaret,
    updateZiyaretDurum: d.updateZiyaretDurum,
    deleteZiyaret: d.deleteZiyaret,
  };
}
