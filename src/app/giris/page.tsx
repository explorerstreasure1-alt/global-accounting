"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n";

export default function GirisPage() {
  const router = useRouter();
  const { t } = useT();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  function nextPath(): string {
    try {
      const v = new URLSearchParams(window.location.search).get("next");
      return v && v.startsWith("/") ? v : "/app";
    } catch {
      return "/app";
    }
  }

  if (!supabaseConfigured()) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <p className="max-w-sm text-center text-sm text-slate-600">
          {t("giris_nokeys")} <a className="underline" href="/app">{t("giris_nokeys_link")}</a>
        </p>
      </div>
    );
  }

  async function googleGiris() {
    setBusy(true);
    setHata(null);
    setBilgi(null);
    try {
      const supa = createClient();
      const { error } = await supa.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/app` },
      });
      if (error) throw error;
    } catch (err) {
      setHata(err instanceof Error ? err.message : t("giris_google_fail"));
      setBusy(false);
    }
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setHata(null);
    setBilgi(null);
    try {
      const supa = createClient();
      if (mode === "register") {
        const { data, error } = await supa.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        // E-posta onayı açıksa oturum hemen açılmaz — kullanıcıyı bilgilendir
        if (!data.session) {
          setBilgi(t("giris_verify"));
          setMode("login");
          return;
        }
      } else {
        const { error } = await supa.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      router.replace(nextPath());
      router.refresh();
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
          {mode === "register" ? t("giris_reg_t") : t("giris_login_t")}
        </h1>
        <p className="mt-1 text-center text-xs text-slate-500">
          {mode === "register" ? t("giris_reg_sub") : t("giris_login_sub")}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 text-sm">
          {(["register", "login"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setHata(null); setBilgi(null); }}
              className={`rounded-full py-1.5 ${mode === m ? "bg-slate-900 text-white" : "text-slate-600"}`}
            >
              {m === "register" ? t("giris_tab_reg") : t("giris_tab_login")}
            </button>
          ))}
        </div>
        <form onSubmit={gonder} className="mt-4 grid gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("giris_email")}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("giris_pass")}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
          />
          {hata ? <p className="text-xs text-rose-700">{hata}</p> : null}
          {bilgi ? <p className="rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-900 ring-1 ring-teal-200">{bilgi}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : mode === "register" ? t("giris_go_reg") : t("giris_go_login")}
          </button>
        </form>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          {t("giris_or")}
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        <button
          type="button"
          onClick={() => void googleGiris()}
          disabled={busy}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500 disabled:opacity-50"
        >
          G {t("giris_google")}
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-400">{t("giris_trial")}</p>
      </div>
    </div>
  );
}
