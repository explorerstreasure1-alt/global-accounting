/** Müşteri WhatsApp mesajları: duruma göre otomatik şablon, seçili dilde, wa.me linki. */

export type WaKind = "alindi" | "hazir" | "teslim" | "yorum";

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
    alindi: "Merhaba {ad}, {hizmet} işleminiz alındı. Bitince size haber vereceğiz. {dukkan}",
    hazir: "Merhaba {ad}, {hizmet} işleminiz hazır. Gelip alabilirsiniz. {dukkan}",
    teslim: "Merhaba {ad}, bizi tercih ettiğiniz için teşekkürler. {dukkan}",
    yorum: "Merhaba {ad}, {dukkan}'yı tercih ettiğiniz için teşekkürler. Memnun kaldıysanız kısa bir Google yorumu bizim için çok değerli: {link}",
  },
  en: {
    alindi: "Hello {ad}, your {hizmet} order is received. We'll let you know when it's done. {dukkan}",
    hazir: "Hello {ad}, your {hizmet} order is ready. You can come pick it up. {dukkan}",
    teslim: "Hello {ad}, thanks for choosing us. {dukkan}",
    yorum: "Hello {ad}, thanks for choosing {dukkan}. If you're happy, a short Google review means a lot to us: {link}",
  },
  de: {
    alindi: "Hallo {ad}, Ihr Auftrag ({hizmet}) ist eingegangen. Wir melden uns, sobald er fertig ist. {dukkan}",
    hazir: "Hallo {ad}, Ihr Auftrag ({hizmet}) ist fertig. Sie können ihn abholen. {dukkan}",
    teslim: "Hallo {ad}, danke für Ihr Vertrauen. {dukkan}",
    yorum: "Hallo {ad}, danke, dass Sie {dukkan} gewählt haben. Über eine kurze Google-Bewertung freuen wir uns sehr: {link}",
  },
  fr: {
    alindi: "Bonjour {ad}, votre commande ({hizmet}) est bien reçue. Nous vous préviendrons dès qu'elle sera prête. {dukkan}",
    hazir: "Bonjour {ad}, votre commande ({hizmet}) est prête. Vous pouvez passer la récupérer. {dukkan}",
    teslim: "Bonjour {ad}, merci de votre confiance. {dukkan}",
    yorum: "Bonjour {ad}, merci d'avoir choisi {dukkan}. Un court avis Google nous aiderait énormément : {link}",
  },
  es: {
    alindi: "Hola {ad}, tu pedido ({hizmet}) está recibido. Te avisaremos cuando esté listo. {dukkan}",
    hazir: "Hola {ad}, tu pedido ({hizmet}) está listo. Puedes pasar a recogerlo. {dukkan}",
    teslim: "Hola {ad}, gracias por tu confianza. {dukkan}",
    yorum: "Hola {ad}, gracias por elegir {dukkan}. Una breve reseña en Google nos ayuda mucho: {link}",
  },
  ar: {
    alindi: "مرحباً {ad}، تم استلام طلبك ({hizmet}). سنخبرك عند الانتهاء. {dukkan}",
    hazir: "مرحباً {ad}، طلبك ({hizmet}) جاهز. يمكنك الحضور لاستلامه. {dukkan}",
    teslim: "مرحباً {ad}، شكراً لثقتك. {dukkan}",
    yorum: "مرحباً {ad}، شكراً لاختيارك {dukkan}. تقييم قصير على Google يعني لنا الكثير: {link}",
  },
  ru: {
    alindi: "Здравствуйте, {ad}, ваш заказ ({hizmet}) принят. Сообщим, как будет готово. {dukkan}",
    hazir: "Здравствуйте, {ad}, ваш заказ ({hizmet}) готов. Можете забирать. {dukkan}",
    teslim: "Здравствуйте, {ad}, спасибо за доверие. {dukkan}",
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
