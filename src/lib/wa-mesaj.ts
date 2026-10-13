/** Müşteri WhatsApp mesajları: duruma göre otomatik şablon, seçili dilde, wa.me linki. */

export type WaKind = "alindi" | "azkaldi" | "hazir" | "teslim" | "yorum" | "bilgi";

export type WaVars = {
  ad: string;
  hizmet: string;
  dukkan: string;
  kod: string;
  link: string;
};

const BOS_VARS: WaVars = { ad: "", hizmet: "", dukkan: "", kod: "", link: "" };

/** Dil varsayılanları — {ad} {hizmet} {dukkan} {kod} {link} yazılabilir. */
const SBLN: Record<string, Record<WaKind, string>> = {
  tr: {
    alindi: "Merhaba {ad}, {hizmet} işleminiz alındı (işleme alındı). Bitince size haber vereceğiz. {dukkan}",
    azkaldi: "Merhaba {ad}, {hizmet} ürününüz tamamlanmak üzere. Birazdan hazır olacak. {dukkan}",
    hazir: "Merhaba {ad}, {hizmet} işleminiz hazır. Gelip alabilirsiniz. {dukkan}",
    teslim: "Merhaba {ad}, {hizmet} işleminiz tamamlandı / teslim edildi. Bizi tercih ettiğiniz için teşekkürler. {dukkan}",
    bilgi: "Merhaba {ad}, kaydınız: {hizmet}. {dukkan}",
    yorum: "Merhaba {ad}, {dukkan}'yı tercih ettiğiniz için teşekkürler. Memnun kaldıysanız kısa bir Google yorumu bizim için çok değerli: {link}",
  },
  en: {
    alindi: "Hello {ad}, your {hizmet} order is received (in progress). We'll let you know when it's done. {dukkan}",
    azkaldi: "Hello {ad}, your {hizmet} item is almost ready. It will be done very soon. {dukkan}",
    hazir: "Hello {ad}, your {hizmet} order is ready. You can come pick it up. {dukkan}",
    teslim: "Hello {ad}, your {hizmet} order is completed / delivered. Thanks for choosing us. {dukkan}",
    bilgi: "Hello {ad}, your record: {hizmet}. {dukkan}",
    yorum: "Hello {ad}, thanks for choosing {dukkan}. If you're happy, a short Google review means a lot to us: {link}",
  },
  de: {
    alindi: "Hallo {ad}, Ihr Auftrag ({hizmet}) ist eingegangen (in Arbeit). Wir melden uns, sobald er fertig ist. {dukkan}",
    azkaldi: "Hallo {ad}, Ihr Artikel ({hizmet}) ist fast fertig. Gleich geschafft. {dukkan}",
    hazir: "Hallo {ad}, Ihr Auftrag ({hizmet}) ist fertig. Sie können ihn abholen. {dukkan}",
    teslim: "Hallo {ad}, Ihr Auftrag ({hizmet}) ist abgeschlossen / abgeholt. Danke für Ihr Vertrauen. {dukkan}",
    bilgi: "Hallo {ad}, Ihr Eintrag: {hizmet}. {dukkan}",
    yorum: "Hallo {ad}, danke, dass Sie {dukkan} gewählt haben. Über eine kurze Google-Bewertung freuen wir uns sehr: {link}",
  },
  fr: {
    alindi: "Bonjour {ad}, votre commande ({hizmet}) est bien reçue (en cours). Nous vous préviendrons dès qu'elle sera prête. {dukkan}",
    azkaldi: "Bonjour {ad}, votre article ({hizmet}) est presque terminé. Encore un petit moment. {dukkan}",
    hazir: "Bonjour {ad}, votre commande ({hizmet}) est prête. Vous pouvez passer la récupérer. {dukkan}",
    teslim: "Bonjour {ad}, votre commande ({hizmet}) est terminée / livrée. Merci de votre confiance. {dukkan}",
    bilgi: "Bonjour {ad}, votre fiche : {hizmet}. {dukkan}",
    yorum: "Bonjour {ad}, merci d'avoir choisi {dukkan}. Un court avis Google nous aiderait énormément : {link}",
  },
  es: {
    alindi: "Hola {ad}, tu pedido ({hizmet}) está recibido (en proceso). Te avisaremos cuando esté listo. {dukkan}",
    azkaldi: "Hola {ad}, tu prenda ({hizmet}) está casi lista. Enseguida terminamos. {dukkan}",
    hazir: "Hola {ad}, tu pedido ({hizmet}) está listo. Puedes pasar a recogerlo. {dukkan}",
    teslim: "Hola {ad}, tu pedido ({hizmet}) está completado / entregado. Gracias por tu confianza. {dukkan}",
    bilgi: "Hola {ad}, tu registro: {hizmet}. {dukkan}",
    yorum: "Hola {ad}, gracias por elegir {dukkan}. Una breve reseña en Google nos ayuda mucho: {link}",
  },
  ar: {
    alindi: "مرحباً {ad}، تم استلام طلبك ({hizmet}) وهو قيد التنفيذ. سنخبرك عند الانتهاء. {dukkan}",
    azkaldi: "مرحباً {ad}، قطعتك ({hizmet}) على وشك الانتهاء. لحظات وتكون جاهزة. {dukkan}",
    hazir: "مرحباً {ad}، طلبك ({hizmet}) جاهز. يمكنك الحضور لاستلامه. {dukkan}",
    teslim: "مرحباً {ad}، طلبك ({hizmet}) مكتمل / تم تسليمه. شكراً لثقتك. {dukkan}",
    bilgi: "مرحباً {ad}، سجلك: {hizmet}. {dukkan}",
    yorum: "مرحباً {ad}، شكراً لاختيارك {dukkan}. تقييم قصير على Google يعني لنا الكثير: {link}",
  },
  ru: {
    alindi: "Здравствуйте, {ad}, ваш заказ ({hizmet}) принят (в работе). Сообщим, как будет готово. {dukkan}",
    azkaldi: "Здравствуйте, {ad}, ваша вещь ({hizmet}) почти готова. Осталось совсем немного. {dukkan}",
    hazir: "Здравствуйте, {ad}, ваш заказ ({hizmet}) готов. Можете забирать. {dukkan}",
    teslim: "Здравствуйте, {ad}, ваш заказ ({hizmet}) завершён / выдан. Спасибо за доверие. {dukkan}",
    bilgi: "Здравствуйте, {ad}, ваша запись: {hizmet}. {dukkan}",
    yorum: "Здравствуйте, {ad}, спасибо, что выбрали {dukkan}. Короткий отзыв в Google очень нам поможет: {link}",
  },
};

/** Şablondaki {değişken}leri değerlerle doldurur. */
export function waDoldur(sablon: string, v: Partial<WaVars>): string {
  const t = { ...BOS_VARS, ...v };
  return sablon
    .split("{ad}").join(t.ad || "—")
    .split("{hizmet}").join(t.hizmet || "—")
    .split("{dukkan}").join(t.dukkan || "")
    .split("{kod}").join(t.kod || "")
    .split("{link}").join(t.link || "")
    .trim();
}

/**
 * Duruma göre mesajı kurar. İşletme özel şablonu (boş değilse) dil varsayılanını ezer
 * (yalnızca alındı/hazır için; teslim ve yorum hep dil varsayılanıdır).
 */
export function waMesajKur(kind: WaKind, v: Partial<WaVars>, locale: string, ozel?: string): string {
  const dil = SBLN[locale] ?? SBLN.en;
  if ((kind === "alindi" || kind === "hazir") && ozel && ozel.trim()) {
    return waDoldur(ozel, v);
  }
  return waDoldur(dil[kind], v);
}

/** Müşteri telefonundan wa.me sohbet linki (rakam yoksa null). Global: rakamlar aynen kullanılır. */
export function waLink(telefon: string, metin: string): string | null {
  const rakam = String(telefon ?? "").replace(/\D/g, "");
  if (!rakam) return null;
  return `https://wa.me/${rakam}?text=${encodeURIComponent(metin.trim())}`;
}

/** Ziyaret kodu: TZ-XXXX-01 (etiketle aynı formül). */
export function ziyaretKodu(musteriId: string, siraNo: number): string {
  return `TZ-${musteriId.replace(/-/g, "").slice(0, 4).toUpperCase()}-${String(siraNo).padStart(2, "0")}`;
}

/**
 * Cihaz aynası: sunucu (bayat Supabase önbelleği) bu alanları boş döndürse bile
 * son kaydedilen değerler bu cihazda kaybolmaz. Sunucu dolu bir değer verirse
 * sunucu kazanır; ayna sadece boşlukları doldurur.
 */
const YEREL_AYAR_KEY = "tailor-yerel-ayar-v1";

export type YerelAyar = {
  isletmeAdi: string;
  whatsappIsletme: string;
  waSablonAlindi: string;
  waSablonHazir: string;
  googleYorumLink: string;
};

const BOS_YEREL: YerelAyar = {
  isletmeAdi: "",
  whatsappIsletme: "",
  waSablonAlindi: "",
  waSablonHazir: "",
  googleYorumLink: "",
};

export function yerelAyarOku(): YerelAyar {
  try {
    if (typeof localStorage === "undefined") return { ...BOS_YEREL };
    const raw = localStorage.getItem(YEREL_AYAR_KEY);
    if (!raw) return { ...BOS_YEREL };
    const j = JSON.parse(raw) as Partial<YerelAyar>;
    return {
      isletmeAdi: typeof j.isletmeAdi === "string" ? j.isletmeAdi : "",
      whatsappIsletme: typeof j.whatsappIsletme === "string" ? j.whatsappIsletme : "",
      waSablonAlindi: typeof j.waSablonAlindi === "string" ? j.waSablonAlindi : "",
      waSablonHazir: typeof j.waSablonHazir === "string" ? j.waSablonHazir : "",
      googleYorumLink: typeof j.googleYorumLink === "string" ? j.googleYorumLink : "",
    };
  } catch {
    return { ...BOS_YEREL };
  }
}

export function yerelAyarYaz(v: Partial<YerelAyar>): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(YEREL_AYAR_KEY, JSON.stringify({ ...yerelAyarOku(), ...v }));
  } catch {
    /* kota dolarsa yoksay */
  }
}

/** Sunucu değeri boşsa cihazdaki son değeri doldur (sunucu doluysa dokunma). */
export function yerelAyarDoldur<T extends Partial<YerelAyar>>(a: T): T {
  const y = yerelAyarOku();
  const out: Record<string, unknown> = { ...a };
  (Object.keys(BOS_YEREL) as (keyof YerelAyar)[]).forEach((k) => {
    if (!out[k]) out[k] = y[k];
  });
  return out as T;
}
