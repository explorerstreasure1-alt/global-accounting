import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Caveat, DM_Sans, Literata, Noto_Sans, Noto_Sans_Arabic, Noto_Sans_Hebrew } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { LocaleSync } from "@/components/LocaleSync";
import { GeoLocale } from "@/components/GeoLocale";
import { SiteTakip } from "@/components/SiteTakip";
import { CascadeScript } from "@/components/CascadeScript";

const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  variable: "--font-caveat",
});

const literata = Literata({
  subsets: ["latin", "latin-ext"],
  variable: "--font-literata",
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm",
});

// Kiril (Rusça vb.) glifleri: DM Sans bu sürümde Kiril subset'i desteklemiyor,
// Noto Sans destekliyor.
const notoSans = Noto_Sans({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "greek"],
  variable: "--font-noto",
  weight: ["400", "500", "600", "700"],
});

// Arapça alfabe için ayrı yazı tipi (Latin yazı tipleri Arapça glif içermiyor).
const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700"],
});

// İbranice alfabe için ayrı yazı tipi.
const notoHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew"],
  variable: "--font-hebrew",
  weight: ["400", "500", "600", "700"],
});

// İlk boyamadan önce dil/yön ayarını uygula: aksi halde Arapça (RTL) ve
// Kiril metinler ilk karede İngilizce (LTR) görünür, sonra kayar.
const localeInitScript = `
(function(){
  try {
    var code = localStorage.getItem("tailor-locale") || "en";
    var rtl = { ar: 1 };
    document.documentElement.lang = code;
    document.documentElement.dir = rtl[code] ? "rtl" : "ltr";
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "Shop Ledger — Global Small Business Accounting",
  description: "Global small business accounting: ledger, day/month close, Z-report, Excel, backup. 7 languages.",
  manifest: "/manifest.webmanifest",
  applicationName: "Shop Ledger",
  other: { google: "notranslate" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Shop Ledger",
  },
  icons: {
    icon: [
      { url: "/images/logo-16.png", sizes: "16x16", type: "image/png" },
      { url: "/images/logo-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/logo.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f4f4f2",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="notebook" translate="no" className={`${caveat.variable} ${literata.variable} ${dmSans.variable} ${notoSans.variable} ${notoArabic.variable} ${notoHebrew.variable}`} suppressHydrationWarning>
      <head suppressHydrationWarning>
        <Script id="locale-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: localeInitScript }} />
      </head>
      <body className="font-ui antialiased notranslate">
        <LocaleSync />
        <GeoLocale />
        <SiteTakip />
        <CascadeScript />
        {children}
      </body>
    </html>
  );
}
