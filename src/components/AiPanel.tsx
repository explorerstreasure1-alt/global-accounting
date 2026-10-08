"use client";

import { useEffect, useRef, useState } from "react";
import type { SohbetMesaji, Uyari } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { HIZLI_KOMUTLAR } from "@/lib/constants";

type Props = {
  mesajlar: SohbetMesaji[];
  uyarilar: Uyari[];
  busy: boolean;
  onSend: (text: string) => Promise<void>;
  onClear: () => Promise<void>;
};

export function AiPanel({ mesajlar, uyarilar, busy, onSend, onClear }: Props) {
  const { t } = useT();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [temizleKurulu, setTemizleKurulu] = useState(false);
  const [sesDurum, setSesDurum] = useState<string | null>(null);
  const recRef = useRef<BrowserSpeech | null>(null);
  const sesAktifRef = useRef(false);
  const sesSonTarihRef = useRef(0);
  const sesMetinRef = useRef("");
  const sesBaslangicMetniRef = useRef("");
  const sesZamanlayiciRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sesBaslatRef = useRef<(() => void) | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sesDurum) return;
    const t = setTimeout(() => setSesDurum(null), 5000);
    return () => clearTimeout(t);
  }, [sesDurum]);

  useEffect(() => {
    if (!temizleKurulu) return;
    const t = setTimeout(() => setTemizleKurulu(false), 4000);
    return () => clearTimeout(t);
  }, [temizleKurulu]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [mesajlar, busy]);

  useEffect(() => () => {
    sesAktifRef.current = false;
    if (sesZamanlayiciRef.current) clearTimeout(sesZamanlayiciRef.current);
    try {
      recRef.current?.stop();
    } catch {
      /* oturum kapanırken tanıma zaten durmuş olabilir */
    }
  }, []);

  async function submit(raw?: string) {
    const value = (raw ?? text).trim();
    if (!value || busy) return;
    setText("");
    await onSend(value);
  }

  function finishVoiceSession() {
    if (sesZamanlayiciRef.current) clearTimeout(sesZamanlayiciRef.current);
    sesAktifRef.current = false;
    sesBaslatRef.current = null;
    recRef.current = null;
    setListening(false);
    const gonder = [sesBaslangicMetniRef.current, sesMetinRef.current].filter(Boolean).join(" ").trim();
    setSesDurum(gonder ? "Metin hazır. Düzenleyip gönder düğmesine basabilirsiniz." : "Ses algılanamadı; tekrar deneyebilirsiniz.");
    if (gonder) {
      setText(gonder);
    }
  }

  async function startVoice() {
    if (sesAktifRef.current) {
      sesAktifRef.current = false;
      if (sesZamanlayiciRef.current) clearTimeout(sesZamanlayiciRef.current);
      setListening(false);
      setSesDurum("Dinleme durduruluyor; metin düzenlemeye hazır olacak.");
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          finishVoiceSession();
        }
      } else finishVoiceSession();
      return;
    }
    const SR =
      (window as unknown as { SpeechRecognition?: new () => BrowserSpeech; webkitSpeechRecognition?: new () => BrowserSpeech })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeech }).webkitSpeechRecognition;
    if (!SR) {
      setSesDurum("Bu pencerede sesli komut yok — yazarak devam edin.");
      return;
    }
    // Önce mikrofon iznini açıkça iste (reddedilirse sebebi göster)
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setSesDurum("Mikrofon erişimi yok; tarayıcıdan izin vermeniz gerekiyor.");
        return;
      }
      setSesDurum("Mikrofon izni isteniyor…");
      const akis = await navigator.mediaDevices.getUserMedia({ audio: true });
      akis.getTracks().forEach((t) => t.stop());
    } catch {
      setListening(false);
      setSesDurum("Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden izin verin.");
      return;
    }

    sesBaslangicMetniRef.current = text.trim();
    sesMetinRef.current = "";
    sesAktifRef.current = true;
    sesSonTarihRef.current = Date.now() + 180_000;
    setListening(true);
    setSesDurum("Dinliyorum; 3 dakikaya kadar konuşabilirsiniz. Bitince mikrofona tekrar basın.");
    sesBaslatRef.current = () => {
      if (!sesAktifRef.current) return;
      if (Date.now() >= sesSonTarihRef.current) {
        sesAktifRef.current = false;
        setListening(false);
        setSesDurum("3 dakikalık dinleme tamamlandı; metni kontrol edip gönderebilirsiniz.");
        try {
          recRef.current?.stop();
        } catch {
          sesBaslatRef.current = null;
        }
        return;
      }

      let rec: BrowserSpeech;
      try {
        rec = new SR();
      } catch {
        sesAktifRef.current = false;
        setListening(false);
        setSesDurum("Ses tanıma başlatılamadı; yazmaya devam edebilirsiniz.");
        return;
      }
      rec.lang = "tr-TR";
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = true;
      rec.onresult = (event) => {
        let araMetin = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const sonuc = event.results[index];
          const parca = sonuc[0]?.transcript?.trim();
          if (!parca) continue;
          if (sonuc.isFinal) sesMetinRef.current = `${sesMetinRef.current} ${parca}`.trim();
          else araMetin += ` ${parca}`;
        }
        const guncel = [sesBaslangicMetniRef.current, sesMetinRef.current, araMetin.trim()].filter(Boolean).join(" ");
        setText(guncel);
        setSesDurum(araMetin.trim() ? `Duyuyorum: “${araMetin.trim()}…”` : "Dinliyorum; konuşmanız metne ekleniyor.");
      };
      rec.onerror = (event) => {
        const kod = event?.error ?? "";
        if (kod === "not-allowed" || kod === "service-not-allowed" || kod === "audio-capture") {
          sesAktifRef.current = false;
          setListening(false);
          setSesDurum(kod === "audio-capture" ? "Mikrofon bulunamadı." : "Mikrofon izni kapatıldı.");
        } else if (kod !== "aborted") {
          setSesDurum("Ses bağlantısı yenileniyor; konuşmaya devam edebilirsiniz.");
        }
      };
      rec.onend = () => {
        if (recRef.current === rec) recRef.current = null;
        if (sesAktifRef.current && Date.now() < sesSonTarihRef.current) {
          window.setTimeout(() => sesBaslatRef.current?.(), 250);
          return;
        }
        finishVoiceSession();
      };
      recRef.current = rec;
      try {
        rec.start();
      } catch {
        recRef.current = null;
        sesAktifRef.current = false;
        setListening(false);
        setSesDurum("Dinleme başlatılamadı; tekrar deneyebilirsiniz.");
      }
    };
    sesBaslatRef.current();
    sesZamanlayiciRef.current = setTimeout(() => {
      if (!sesAktifRef.current) return;
      sesAktifRef.current = false;
      setListening(false);
      setSesDurum("3 dakika doldu; metni kontrol edip gönder düğmesine basabilirsiniz.");
      if (recRef.current) {
        try {
          recRef.current.stop();
        } catch {
          finishVoiceSession();
        }
      } else finishVoiceSession();
    }, 180_000);
  }

  return (
    <aside className="ai-panel flex h-full min-h-[520px] flex-col overflow-hidden rounded-[28px] text-slate-100 lg:min-h-0">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <img src="/images/ai-avatar.svg" alt="Defterdar" className="h-12 w-12 rounded-full object-cover ring-2 ring-teal-300/40" />
        <div className="min-w-0">
          <p className="font-hand text-3xl leading-none text-teal-100">Defterdar</p>
          <p className="truncate text-xs text-slate-400">dijital muhasebeciniz · Türkçe komut</p>
        </div>
        <span className="ml-auto rounded-full bg-teal-400/15 px-2 py-1 text-[10px] uppercase tracking-wider text-teal-200">
          {busy ? "Yazıyor" : "Hazır"}
        </span>
        <button
          type="button"
          disabled={busy}
          title={temizleKurulu ? "Emin misin? Tekrar bas, sohbet silinsin" : "Sohbeti temizle"}
          onClick={() => {
            if (temizleKurulu) {
              setTemizleKurulu(false);
              void onClear();
            } else {
              setTemizleKurulu(true);
            }
          }}
          className={`grid h-8 w-8 place-items-center rounded-full text-base ${
            temizleKurulu ? "bg-rose-500 text-white" : "bg-white/10 hover:bg-white/20"
          }`}
        >
          🧹
        </button>
      </div>

      {uyarilar.filter((u) => u.tip !== "bilgi").length > 0 ? (
        <div className="space-y-1 border-b border-white/10 px-3 py-2">
          {uyarilar
            .filter((u) => u.tip !== "bilgi")
            .slice(0, 2)
            .map((u) => (
              <p key={u.baslik} className="rounded-lg bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100">
                ⚠️ {u.mesaj}
              </p>
            ))}
        </div>
      ) : null}

      <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {mesajlar.map((m) => (
          <div key={m.id} className={`flex ${m.rol === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] overflow-hidden rounded-2xl px-3 py-2 text-sm leading-relaxed break-words ${
                m.rol === "user" ? "msg-user rounded-br-sm" : "msg-ai rounded-bl-sm"
              }`}
            >
              {m.rol === "user" ? (
                <span className="whitespace-pre-wrap">{m.icerik}</span>
              ) : (
                <div className="msg-html" dangerouslySetInnerHTML={{ __html: renderMesaj(m.icerik) }} />
              )}
            </div>
          </div>
        ))}
        {busy ? (
          <div className="msg-ai w-fit rounded-2xl px-3 py-2 text-sm text-slate-300">Defterdar düşünüyor…</div>
        ) : null}
      </div>

      <div className="no-print grid grid-cols-2 gap-1.5 px-3 pb-2 sm:grid-cols-3">
        {HIZLI_KOMUTLAR.map((k) => (
          <button
            key={k.id}
            disabled={busy}
            onClick={() => void submit(k.prompt)}
            className="rounded-xl bg-white/5 px-2 py-1.5 text-left text-[11px] text-slate-200 hover:bg-white/10"
          >
            {k.icon} {k.label}
          </button>
        ))}
      </div>

      <form
        className="no-print m-3 flex items-end gap-2 rounded-2xl bg-white/8 p-2 ring-1 ring-white/10"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
          <textarea
          value={text}
          disabled={listening}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={2}
          placeholder={t("ask_ai")}
          className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={startVoice}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${
            listening ? "animate-pulse bg-rose-500 text-white" : "bg-white/10 hover:bg-white/20"
          }`}
          title={listening ? "Dinlemeyi durdur; metni düzenle" : "Sesli komut (mikrofon)"}
        >
          🎤
        </button>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="grid h-10 w-10 place-items-center rounded-xl bg-teal-400 text-lg text-slate-900 disabled:opacity-40"
        >
          ➤
        </button>
      </form>
      {sesDurum || listening ? (
        <p className="no-print px-4 pb-3 text-[11px] text-teal-200/90">
          {listening ? "🔴 " : "ℹ️ "}
          {sesDurum ?? "Dinleniyor…"}
        </p>
      ) : null}
    </aside>
  );
}

type BrowserSpeechResult = {
  0: { transcript: string };
  isFinal: boolean;
};

type BrowserSpeech = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<BrowserSpeechResult> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
};

/** Asistan mesajlarındaki basit markdown'ı güvenli HTML'e çevirir (kalın, tablo, liste) */
function renderMesaj(icerik: string): string {
  const kac = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const satirici = (s: string) =>
    kac(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>");
  const satirlar = icerik.split("\n");
  const parcalar: string[] = [];
  let i = 0;
  while (i < satirlar.length) {
    // Markdown tablosu: ardışık | ile başlayan satırlar
    if (/^\s*\|.*\|\s*$/.test(satirlar[i])) {
      const blok: string[] = [];
      while (i < satirlar.length && /^\s*\|.*\|\s*$/.test(satirlar[i])) {
        blok.push(satirlar[i]);
        i += 1;
      }
      const veri = blok.filter((l) => !/^[\s|:-]+$/.test(l));
      if (veri.length > 0) {
        const hucre = (l: string) =>
          l
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => `<td>${satirici(c.trim())}</td>`)
            .join("");
        const baslik = veri[0]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => `<th>${satirici(c.trim())}</th>`)
          .join("");
        parcalar.push(
          `<div class="msg-tablo"><table><thead><tr>${baslik}</tr></thead><tbody>${veri
            .slice(1)
            .map((l) => `<tr>${hucre(l)}</tr>`)
            .join("")}</tbody></table></div>`,
        );
        continue;
      }
    }
    const s = satirlar[i];
    if (/^\s*#{1,3}\s+/.test(s)) {
      parcalar.push(`<p class="msg-baslik">${satirici(s.replace(/^\s*#{1,3}\s+/, ""))}</p>`);
    } else if (/^\s*[-•]\s+/.test(s)) {
      parcalar.push(`<p class="msg-madde">• ${satirici(s.replace(/^\s*[-•]\s+/, ""))}</p>`);
    } else if (/^\s*\d+[.)]\s+/.test(s)) {
      parcalar.push(`<p class="msg-madde">${satirici(s.trim())}</p>`);
    } else if (s.trim() === "") {
      parcalar.push("<div class=\"msg-bos\"></div>");
    } else {
      parcalar.push(`<p>${satirici(s)}</p>`);
    }
    i += 1;
  }
  return parcalar.join("");
}
