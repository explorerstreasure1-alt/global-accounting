import { GlobalBar } from "@/components/GlobalBar";
import { Pricing } from "@/components/Pricing";

export const dynamic = "force-dynamic";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <GlobalBar />
        <header className="mt-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">Tailor Ledger · Global</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-6xl">
            Accounting for tailors,
            <br />
            in your language.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Ledger, day close, month close, Z-report, Excel and backup. 7 languages, RTL ready, Pro Light / Pro Dark
            themes. Built for tailor shops worldwide.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <a href="/app" className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              Open app
            </a>
            <a href="#pricing" className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold hover:border-slate-900">
              Pricing $3/mo
            </a>
          </div>
        </header>

        <section className="mt-12 grid gap-3 md:grid-cols-3">
          {[
            ["📒", "Ledger", "Income / expense, cash / card / transfer, full history."],
            ["🤖", "AI assistant", "Natural-language entries, daily summary, Z-report."],
            ["🌍", "Global", "EN TR RU DE FR ES AR + professional themes."],
          ].map(([icon, title, desc]) => (
            <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="text-2xl">{icon}</p>
              <p className="mt-2 font-bold">{title}</p>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </div>
          ))}
        </section>

        <section id="pricing" className="mt-12">
          <h2 className="text-center text-2xl font-bold">Simple pricing</h2>
          <p className="mt-1 text-center text-sm text-slate-500">Start free. Upgrade when you need AI.</p>
          <div className="mt-6">
            <Pricing />
          </div>
        </section>

        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          Tailor Ledger · Vercel + Postgres · Lemon Squeezy billing · <a className="underline" href="/app">Open app</a>
        </footer>
      </div>
    </div>
  );
}
