import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { HTML_LANG, getLocale } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Loquito — Fabrika Yönetim Sistemi",
  description:
    "Loquito lokum fabrikası için üretim, sipariş, stok ve finans yönetim platformu.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={HTML_LANG[locale]}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
