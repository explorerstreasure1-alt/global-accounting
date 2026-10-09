"use client";

import { useEffect, useRef } from "react";

type Parca = {
  metin: string;
  x: number;
  y: number;
  hiz: number;
  salinim: number;
  faz: number;
  boyut: number;
  renk: string;
  alfa: number;
};

const METINLER = [
  "+$1,250.00", "-€320.50", "+₺4.800", "-$96.20", "+£2,140", "−₺750",
  "%18", "27", "×12", "= 8.270", "+", "−", "$", "€", "₺", "₽",
  "1,500.00", "250.00", "125.00", "3/ay", "$3", "NET",
];

const RENKLER = ["#0f766e", "#b45309", "#1d4ed8", "#334155", "#0e7490"];

function rastgeleParca(w: number, h: number, rastgeleY = false): Parca {
  return {
    metin: METINLER[Math.floor(Math.random() * METINLER.length)],
    x: Math.random() * w,
    y: rastgeleY ? Math.random() * h : h + 20 + Math.random() * 120,
    hiz: 0.15 + Math.random() * 0.45,
    salinim: 10 + Math.random() * 26,
    faz: Math.random() * Math.PI * 2,
    boyut: 11 + Math.random() * 17,
    renk: RENKLER[Math.floor(Math.random() * RENKLER.length)],
    alfa: 0.06 + Math.random() * 0.09,
  };
}

export function AnimatedLedgerBg() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parcalar: Parca[] = [];

    function boyutlandir() {
      const r = canvas!.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (parcalar.length === 0) {
        const adet = Math.max(24, Math.floor((w * h) / 26000));
        for (let i = 0; i < adet; i += 1) parcalar.push(rastgeleParca(w, h, true));
      }
    }
    boyutlandir();
    window.addEventListener("resize", boyutlandir);

    let gorunur = true;
    const gozlemci = new IntersectionObserver(([g]) => { gorunur = g.isIntersecting; });
    gozlemci.observe(canvas);

    function kare() {
      t += 1;
      if (gorunur && w > 0) {
        ctx!.clearRect(0, 0, w, h);
        ctx!.textBaseline = "middle";
        for (const p of parcalar) {
          p.y -= p.hiz;
          if (p.y < -40) Object.assign(p, rastgeleParca(w, h));
          const x = p.x + Math.sin(t / 90 + p.faz) * p.salinim;
          ctx!.globalAlpha = p.alfa;
          ctx!.font = `600 ${p.boyut}px ui-monospace, Menlo, Consolas, monospace`;
          ctx!.fillStyle = p.renk;
          ctx!.fillText(p.metin, x, p.y);
        }
        ctx!.globalAlpha = 1;
      }
      raf = requestAnimationFrame(kare);
    }
    raf = requestAnimationFrame(kare);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", boyutlandir);
      gozlemci.disconnect();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(15,23,42,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.055) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse 90% 80% at 50% 20%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 20%, black 30%, transparent 100%)",
        }}
      />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
