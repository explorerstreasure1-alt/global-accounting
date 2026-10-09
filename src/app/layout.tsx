import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Caveat, DM_Sans, Literata } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Shop Ledger — Global Small Business Accounting",
  description: "Global small business accounting: ledger, day/month close, Z-report, Excel, backup. 7 languages.",
  manifest: "/manifest.webmanifest",
  themeColor: "#0f172a",
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="notebook" translate="no" className={`${caveat.variable} ${literata.variable} ${dmSans.variable}`}>
      <body className="font-ui antialiased notranslate">{children}</body>
    </html>
  );
}
