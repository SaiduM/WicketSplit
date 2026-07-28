import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    title: "WicketSplit — Cricket Team Expenses",
    description: "Pick your Playing XI or XII, split every team expense fairly, and settle the league in one CSV.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "WicketSplit",
      description: "Every game. Every expense. Fairly split.",
      images: [{ url: new URL("/og.jpg", base).toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "WicketSplit",
      description: "Every game. Every expense. Fairly split.",
      images: [new URL("/og.jpg", base).toString()],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
