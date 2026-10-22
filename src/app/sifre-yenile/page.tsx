"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

export default function SifreYenilePage() {
  const router = useRouter();
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  if (!supabaseConfigured()) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <p className="max-w-sm text-center text-sm text-slate-600">
          {t("giris_nokeys")} <a className="underline" href="/app">{t("giris_nokeys_link")}</a>
        </p>
      </div>
    );
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);
    if (password.length < 6) {
      setHata(t("giris_pass"));
      return;
    }
    if (password !== password2) {
      setHata(t("giris_pass_mismatch") || "Şifreler uyuşmuyor.");
      return;
    }
    setBusy(true);
    try {
      const supa = createClient();
      const { error } = await supa.auth.updateUser({ password });
      if (error) throw error;
      setBilgi(t("giris_pass_changed") || "Şifreniz güncellendi. Giriş yapabilirsiniz.");
      setTimeout(() => router.replace("/giris"), 1500);
    } catch (err) {
      setHata(err instanceof Error ? err.message : t("giris_fail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Shop Ledger</p>
        <h1 className="mt-2 text-center text-2xl font-extrabold">
          {t("giris_reset_t") || "Yeni şifre belirle"}
        </h1>
        <p className="mt-1 text-center text-xs text-slate-500">
          {t("giris_reset_sub") || "En az 6 karakterli yeni şifrenizi girin."}
        </p>
        <form onSubmit={gonder} className="mt-4 grid gap-2">
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("giris_pass")}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder={t("giris_pass2") || "Şifre (tekrar)"}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
          {hata ? <p className="text-xs text-rose-700">{hata}</p> : null}
          {bilgi ? <p className="rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-900 ring-1 ring-teal-200">{bilgi}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : (t("giris_pass_change_btn") || "Şifreyi güncelle")}
          </button>
        </form>
      </div>
    </div>
  );
}