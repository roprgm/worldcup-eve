import { Analytics } from "@vercel/analytics/next";
import { cn } from "cnfast";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import { ChatProvider } from "@/components/chat/chat-context";
import { Header } from "@/components/header";

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
    // og:image comes from app/opengraph-image.tsx, which renders per-day and
    // emits a date-versioned URL. A manual unversioned URL here would shadow it
    // and keep social crawlers stuck on a stale cached image.
  },
  twitter: {
    card: "summary_large_image",
    title: "WC26.chat",
    description: "Ask an AI agent anything about the World Cup.",
    // twitter:image comes from app/twitter-image.tsx with a per-day URL; X
    // caches images by URL, so the daily URL busts the cache on each new scrape.
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
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn("dark", GeistSans.variable, GeistMono.variable)}
    >
      <body>
        <Providers>
          <ChatProvider>
            <div className="flex h-dvh flex-col overflow-hidden">
              <Header />
              {children}
            </div>
          </ChatProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
