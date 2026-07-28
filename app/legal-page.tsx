/* eslint-disable @next/next/no-html-link-for-pages */
import type { ReactNode } from "react";

export default function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: ReactNode }) {
  return <main className="legal-page">
    <nav className="legal-nav"><a className="public-brand" href="/"><span>W</span>WicketSplit</a><a href="/">← Back home</a></nav>
    <article className="legal-card">
      <span className="hero-kicker">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="legal-updated">Last updated: {updated}</p>
      <div className="legal-content">{children}</div>
    </article>
    <footer className="legal-footer"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/data-deletion">Data deletion</a></footer>
  </main>;
}
