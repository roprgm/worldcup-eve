import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wc26.chat"),
  title: "WC26.chat",
  description: "WC26.chat — ask an AI agent anything about the World Cup.",
  openGraph: {
    title: "WC26.chat",
    description: "Ask an AI agent anything about the World Cup.",
    url: "https://wc26.chat",
    siteName: "WC26.chat",
    type: "website",
    images: [
      {
        url: "/og-image-v2.png",
        width: 1200,
        height: 628,
        alt: "WC26.chat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WC26.chat",
    description: "Ask an AI agent anything about the World Cup.",
    images: ["/og-image-v2.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WC26.chat",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body>
        {/* Subtle atmospheric depth: a soft top glow and a gentle vignette. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
          <div
            className="absolute -top-48 left-1/2 h-[42rem] w-[64rem] -translate-x-1/2 rounded-full opacity-[0.06]"
            style={{
              background:
                "radial-gradient(circle, #ffffff 0%, transparent 62%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 75% at 50% 0%, transparent 56%, rgba(0,0,0,0.55) 100%)",
            }}
          />
        </div>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
