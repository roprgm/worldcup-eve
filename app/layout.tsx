import { Analytics } from "@vercel/analytics/next";
import { cn } from "cnfast";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
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
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn("dark", GeistSans.variable, GeistMono.variable)}
    >
      <body>
        <ChatProvider>
          <div className="flex h-dvh flex-col overflow-hidden">
            <Header />
            {children}
          </div>
        </ChatProvider>
        <Analytics />
      </body>
    </html>
  );
}
