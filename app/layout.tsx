import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import PwaClient from "./pwa-client";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#163e2c",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    title: "WicketSplit — Cricket Team Expenses",
    description: "The cricket-team ledger for Playing XI/XII, game-based expense splits, umpiring credits, and transparent league settlements.",
    manifest: "/manifest.webmanifest",
    applicationName: "WicketSplit",
    referrer: "no-referrer",
    appleWebApp: { capable: true, title: "WicketSplit", statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    icons: {
      icon: [{ url: "/app-icon-192.png", sizes: "192x192", type: "image/png" }],
      shortcut: "/app-icon-192.png",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      title: "WicketSplit",
      description: "Every game. Every expense. Fairly split.",
      images: [{ url: new URL("/og.png", base).toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "WicketSplit",
      description: "Every game. Every expense. Fairly split.",
      images: [new URL("/og.png", base).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><PwaClient />{children}</body></html>;
}
