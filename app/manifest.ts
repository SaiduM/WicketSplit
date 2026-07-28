import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WicketSplit — Team Expense Tracker",
    short_name: "WicketSplit",
    description: "Track cricket team expenses, Playing XI/XII shares, and league settlements.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f7f7f2",
    theme_color: "#163e2c",
    orientation: "portrait-primary",
    categories: ["finance", "sports", "productivity"],
    icons: [
      { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
