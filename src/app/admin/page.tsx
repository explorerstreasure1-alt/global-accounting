"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * YÖNETİCİ PANELİ (/admin)
 * Gizli şifre ile girilir (env ADMIN_PASSWORD). Panelde:
 *  - Bu ay: kaç ziyaret, kaç giriş, kaç Google girişi, kaç kişi kullandı
 *  - 30 günlük grafik + günlük tablo
 *  - Bu ay kim kaç kez girmiş (e-posta, adet, son giriş, ülke)
 *  - Ülke dağılımı + en son giriş yapılan ülke
 *  - Ziyaret edenlerin e-posta listesi
 */
type Veri = {  ok: boolean;
  buAy: string;
  ziyaretBuAy: number;
  girisBuAy: number;
  googleBuAy: number;
  parolaBuAy: number;
  kullananBuAy: number;
  bugunZiyaret: number;
  bugunGiris: number;
  gunluk: { gun: string; ziyaret: number; giris: number; google: number; parola: number; kullanan: number }[];
  gunDetay: {
    gun: string;
    ziyaret: number;
    giris: number;
    google: number;
    parola: number;
    kisiler: { email: string; adet: number; ulke: string; kaynak: string; son: string }[];
  }[];
  kullanicilar: { email: string; adet: number; sonGiris: string; ulke: string; kaynak: string }[];
  ulkeler: { ulke: string; adet: number }[];
  sonUlke: { ulke: string; zaman: string };
  epostalar: { email: string; sonZaman: string; adet: number }[];
  uyari?: string;
  projeRef?: string;
};

const GUNLER_TR = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function gunYaz(gun: string): string {
  const [, ay, g] = gun.split("-");
  const d = new Date(Number(gun), 0);
  d.setDate(Number(g));
  return `${Number(g)}.${Number(ay)} ${GUNLER_TR[d.getDay()]}`;
}

function saatZaman(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function Kpi({ etiket, deger, alt }: { etiket: string; deger: number | string; alt?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{etiket}</p>
      <p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{deger}</p>
      {alt ? <p className="mt-0.5 text-[11px] text-slate-500">{alt}</p> : null}
    </div>
  );
}

/** Saf SVG çubuk grafiği (bağımlılık yok): her gün bazında ziyaret & giriş */
function GunGrafigi({ gunluk }: { gunluk: Veri["gunluk"] }) {
  const enBuyuk = Math.max(1, ...gunluk.map((g) => Math.max(g.ziyaret, g.giris)));
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-600">
        <span className="inline-block h-3 w-3 rounded-sm bg-teal-500" /> Ziyaret
        <span className="ml-2 inline-block h-3 w-3 rounded-sm bg-slate-800" /> Giriş
      </div>      <svg viewBox={`0 0 ${Math.max(240, gunluk.length * 18)} 190`} className="mt-2 w-full" role="img" aria-label="30 günlük ziyaret ve giriş grafiği">
        {gunluk.map((g, i) => {
          const z = (g.ziyaret / enBuyuk) * 150;
          const r = (g.giris / enBuyuk) * 150;
          return (
            <g key={g.gun}>
              <rect x={i * 18 + 2} y={160 - z} width={7} height={Math.max(g.ziyaret ? 2 : 0, z)} rx={1.5} fill="#14b8a6" />
              <rect x={i * 18 + 10} y={160 - r} width={7} height={Math.max(g.giris ? 2 : 0, r)} rx={1.5} fill="#1e293b" />
              <title>{`${gunYaz(g.gun)} — ziyaret: ${g.ziyaret}, giriş: ${g.giris}`}</title>
            </g>
          );
        })}
        <line x1={0} x2="100%" y1={160} y2={160} stroke="#cbd5e1" strokeWidth={1} />
      </svg>
      <p className="text-[10px] text-slate-400">Son 30 gün · Teal = siteye açılan, koyu = oturum açan kişi</p>
    </div>
  );
}

export default function AdminPanel() {
  const [sifre, setSifre] = useState("");
  const [oturum, setOturum] = useState(false);
  const [giriliyor, setGiriliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [veri, setVeri] = useState<Veri | null>(null);
  const [bekliyor, setBekliyor] = useState(true);
  const [testMesaj, setTestMesaj] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setBekliyor(true);
    try {
      const r = await fetch("/api/admin/veri", { cache: "no-store" });
      if (r.status === 401) {
        setOturum(false);
        return;
      }
      const j = (await r.json()) as Veri;
      if (j.ok) {
        setVeri(j);
        setOturum(true);
      }
    } catch {
      /* sessiz */
    } finally {
      setBekliyor(false);
    }
  }, []);

  useEffect(() => {
    const h = setTimeout(() => void yukle(), 0);
    return () => clearTimeout(h);
  }, [yukle]);

  async function gir(e: React.FormEvent) {
    e.preventDefault();
    setGiriliyor(true);
    setHata(null);
    try {
      const r = await fetch("/api/admin/giris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sifre }),
      });
      const j = (await r.json()) as { ok?: boolean; hata?: string };
      // Şifre bellekte kalmasın: ister doğru ister yanlış, denemeden hemen sil.
      setSifre("");
      if (!r.ok || !j.ok) {
        setHata(j.hata || "Şifre yanlış.");
        return;
      }
      await yukle();
    } catch {
      setSifre("");
      setHata("Bağlantı sorunu.");
    } finally {
      setGiriliyor(false);
    }
  }

  /** Takip kaydı gerçekten yazılabiliyor mu? Hatayı aynen gösterir. */
  async function testEt() {
    setTestMesaj("Deneniyor…");
    try {
      const r = await fetch("/api/admin/test-takip", { method: "POST" });
      const j = (await r.json()) as { ok?: boolean; mod?: string; hata?: string };
      if (j.ok) {
        setTestMesaj(`Test kaydı yazıldı (${j.mod === "supabase" ? "Supabase" : "dosya"}). Veriler yenilendi.`);
        await yukle();
      } else {
        const ham = j.hata || "bilinmeyen hata";
        const ipucu = /Could not find the table|schema cache/i.test(ham)
          ? " → SQL'i Vercel'deki Supabase projesinde çalıştırıp ardından `notify pgrst, 'reload schema';` komutunu da çalıştır."
          : "";
        setTestMesaj(`Test kaydı BAŞARISIZ: ${ham}${ipucu}`);
      }
    } catch {
      setTestMesaj("Test kaydı BAŞARISIZ: bağlantı sorunu.");
    }
  }

  function csvIndir() {
    if (!veri) return;
    const satirlar: string[] = [];
    satirlar.push("gün;ziyaret;giris;google;parola;kullanan");
    for (const g of veri.gunluk) satirlar.push(`${g.gun};${g.ziyaret};${g.giris};${g.google};${g.parola};${g.kullanan}`);
    satirlar.push("");
    satirlar.push("gün;kim;giriş_adedi;ülke");
    for (const g of veri.gunDetay) {
      for (const k of g.kisiler) satirlar.push(`${g.gun};${k.email};${k.adet};${k.ulke}`);
    }
    satirlar.push("");
    satirlar.push("bu_ay;kisi;giris_adet;son_giris;ulke");
    for (const k of veri.kullanicilar) satirlar.push(`${veri.buAy};${k.email};${k.adet};${k.sonGiris};${k.ulke}`);
    const blob = new Blob(["\ufeff" + satirlar.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `admin-rapor-${veri.buAy}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!oturum) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <form onSubmit={gir} className="w-full max-w-xs rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <p className="text-center text-4xl">🔒</p>
          <h1 className="mt-2 text-center text-lg font-extrabold text-slate-900">Yönetici Paneli</h1>
          <p className="mt-1 text-center text-xs text-slate-500">Gizli şifreyle girilir.</p>
          <input
            type="password"
            name="y-gizli"
            required
            autoComplete="new-password"
            spellCheck={false}
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            placeholder="Şifre"
            className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
          {hata ? <p className="mt-2 text-xs text-rose-700">{hata}</p> : null}
          <button
            type="submit"
            disabled={giriliyor}
            className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {giriliyor ? "…" : "Giriş"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h1 className="text-xl font-extrabold text-slate-900">Yönetici Paneli</h1>
            <p className="text-xs text-slate-500">Bu ay: {veri?.buAy} · oturum 8 saat açık kalır</p>
            {veri?.projeRef ? (
              <p className="text-[11px] text-slate-400">
                Supabase projesi: <b className="font-mono text-slate-600">{veri.projeRef}</b>
              </p>
            ) : null}
          </div>
          <button onClick={csvIndir} className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50">
            CSV indir
          </button>
          <button
            onClick={() => void yukle()}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Yenile
          </button>
          <button
            onClick={() => void testEt()}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-teal-800 ring-1 ring-teal-300 hover:bg-teal-50"
          >
            Test kaydı
          </button>
          <button
            onClick={() => {
              fetch("/api/admin/giris", { method: "DELETE" }).catch(() => {});
              setOturum(false);
            }}
            className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-700"
          >
            Çıkış
          </button>
        </header>

        {testMesaj ? (
          <p className="rounded-2xl bg-teal-50 px-4 py-2 text-xs text-teal-900 ring-1 ring-teal-200">{testMesaj}</p>
        ) : null}

        {veri?.uyari ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-2 text-xs text-amber-900 ring-1 ring-amber-200">{veri.uyari}</p>
        ) : null}

        {bekliyor && !veri ? (
          <p className="text-sm text-slate-500">Yükleniyor…</p>
        ) : veri ? (
          <>
            {/* Üst KPI */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi etiket="Bugün ziyaret" deger={veri.bugunZiyaret} alt="Sayfa açılışı" />
              <Kpi etiket="Bugün giriş" deger={veri.bugunGiris} alt="Oturum açma" />
              <Kpi etiket="Kullanan kişi (bu ay)" deger={veri.kullananBuAy} alt="Farklı e-posta" />
              <Kpi etiket="En son giriş ülkesi" deger={veri.sonUlke.ulke || "??"} alt={veri.sonUlke.zaman ? saatZaman(veri.sonUlke.zaman) : ""} />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi etiket="Aylık ziyaret" deger={veri.ziyaretBuAy} alt={`${veri.buAy} toplam`} />
              <Kpi etiket="Aylık giriş" deger={veri.girisBuAy} alt="Oturum açma toplamı" />
              <Kpi etiket="Google girişi (ay)" deger={veri.googleBuAy} alt="G ile giriş" />
              <Kpi etiket="Şifreli giriş (ay)" deger={veri.parolaBuAy} alt="E-posta + şifre" />
            </div>

            {/* Grafik */}
            <GunGrafigi gunluk={veri.gunluk} />

            {/* Her gün kim girmiş */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">
                Her gün kim girmiş (gün bazında ziyaret + girenler, son 30 gün)
              </p>
              <div className="max-h-[26rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Gün</th>
                      <th className="px-4 py-2">Ziyaret</th>
                      <th className="px-4 py-2">Giriş</th>
                      <th className="px-4 py-2">Girenler (e-posta × adet)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...veri.gunDetay].reverse().map((g) => (
                      <tr key={g.gun} className="border-t border-slate-100 align-top">
                        <td className="whitespace-nowrap px-4 py-2">{gunYaz(g.gun)}</td>
                        <td className="px-4 py-2 tabular-nums font-bold">{g.ziyaret}</td>
                        <td className="px-4 py-2 tabular-nums">{g.giris}</td>
                        <td className="px-4 py-2">
                          {g.kisiler.length === 0 ? (
                            <span className="text-xs text-slate-300">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {g.kisiler.map((k) => (
                                <span
                                  key={`${g.gun}:${k.email}`}
                                  title={`${saatZaman(k.son)} · ${k.ulke || "??"} · ${k.kaynak === "google" ? "Google" : k.kaynak === "parola" ? "Şifre" : ""}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                                >
                                  {k.email}
                                  <b className="text-slate-900">×{k.adet}</b>
                                  {k.ulke ? <span className="text-[10px] text-teal-700">{k.ulke}</span> : null}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Son ülke */}
            <div className="gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">En son giriş ülkesi</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">{veri.sonUlke.ulke || "Bilinmiyor"}</p>
                <p className="text-[11px] text-slate-500">{veri.sonUlke.zaman ? saatZaman(veri.sonUlke.zaman) : ""}</p>
              </div>
              <div className="mt-3 sm:mt-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ülke dağılımı (10 gün)</p>
                <ul className="mt-1 space-y-1">
                  {veri.ulkeler.slice(0, 6).map((u) => (
                    <li key={u.ulke} className="flex items-center gap-2 text-xs text-slate-700">
                      <span className="w-10 font-bold">{u.ulke || "?"}</span>
                      <span className="h-2 rounded-full bg-teal-500" style={{ width: `${Math.min(100, u.adet * 8)}%` }} />
                      <span className="tabular-nums">{u.adet}</span>
                    </li>
                  ))}
                  {veri.ulkeler.length === 0 ? <li className="text-xs text-slate-400">Kayıt yok</li> : null}
                </ul>
              </div>
            </div>

            {/* Bu ay kim kaç kez girmiş */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">Bu ay kim kaç kez girmiş</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-2">E-posta</th>
                      <th className="px-4 py-2">Giriş adedi</th>
                      <th className="px-4 py-2">Son giriş</th>
                      <th className="px-4 py-2">Ülke</th>
                      <th className="px-4 py-2">Kaynak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veri.kullanicilar.map((k) => (
                      <tr key={k.email} className="border-t border-slate-100">
                        <td className="px-4 py-2">{k.email}</td>
                        <td className="px-4 py-2 tabular-nums font-bold">{k.adet}</td>
                        <td className="px-4 py-2 text-xs text-slate-600">{saatZaman(k.sonGiris)}</td>
                        <td className="px-4 py-2">{k.ulke || "?"}</td>
                        <td className="px-4 py-2 text-xs">{k.kaynak === "google" ? "Google" : k.kaynak === "parola" ? "Şifre" : "—"}</td>
                      </tr>
                    ))}
                    {veri.kullanicilar.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                          Bu ay giriş kaydı yok
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 30 Günlük tablo */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">Günlük tablo (30 gün; UTC+3 İstanbul)</p>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Gün</th>
                      <th className="px-4 py-2">Ziyaret</th>
                      <th className="px-4 py-2">Giriş</th>
                      <th className="px-4 py-2">Google</th>
                      <th className="px-4 py-2">Şifre</th>                      <th className="px-4 py-2">Kullanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...veri.gunluk].reverse().map((g) => (
                      <tr key={g.gun} className="border-t border-slate-100">
                        <td className="px-4 py-1.5">{gunYaz(g.gun)}</td>
                        <td className="px-4 py-1.5 tabular-nums">{g.ziyaret}</td>
                        <td className="px-4 py-1.5 tabular-nums">{g.giris}</td>
                        <td className="px-4 py-1.5 tabular-nums">{g.google}</td>
                        <td className="px-4 py-1.5 tabular-nums">{g.parola}</td>
                        <td className="px-4 py-1.5 tabular-nums">{g.kullanan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* E-posta listesi */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <p className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">
                Ziyaret edilen e-postalar (son oturumlarda gördüğümüz)
              </p>
              <ul className="divide-y divide-slate-100">
                {veri.epostalar.slice(0, 60).map((m) => (
                  <li key={m.email} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-800">{m.email}</span>
                    <span className="ml-2 shrink-0 text-[11px] text-slate-500">
                      {m.adet} giriş · {saatZaman(m.sonZaman)}
                    </span>
                  </li>
                ))}
                {veri.epostalar.length === 0 ? <li className="px-4 py-6 text-center text-sm text-slate-400">Henüz e-posta görülmedi</li> : null}
              </ul>
            </div>

            <p className="pb-6 text-center text-[11px] text-slate-400">Veriler site ziyaretleri + oturum açmalarından toplanır. Sadece yönetici görebilir.</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Veri açılamadı — yenile.</p>
        )}
      </div>
    </div>
  );
}
