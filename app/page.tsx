/* eslint-disable @next/next/no-html-link-for-pages */
import { getGoogleUser } from "./google-auth";
import FeatureCarousel from "./feature-carousel";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getGoogleUser();
  const workspaceLink = user ? "/app" : "/request-access";
  const cta = user ? "Open WicketSplit" : "Request early access";

  return <main className="public-site product-landing">
    <nav className="public-nav">
      <a className="public-brand" href="/"><span>W</span>WicketSplit</a>
      <div>
        <a className="nav-link" href="#features">Explore features</a>
        <a className="nav-link" href="#how">How it works</a>
        <a className="ghost" href="/login?return_to=/app">Sign in</a>
        <a className="primary" href={workspaceLink}>{cta} →</a>
      </div>
    </nav>

    <section className="product-hero">
      <div className="product-hero-copy">
        <span className="early-badge"><i/> Invite-only early access</span>
        <h1>The team ledger built for <em>cricket.</em></h1>
        <p>Add the Playing XI or XII, record every team cost, and let WicketSplit calculate a transparent settlement across the whole league.</p>
        <div className="hero-actions">
          <a className="primary hero-primary" href={workspaceLink}>{cta} →</a>
          <a className="text-action" href="#features">Explore the product ↓</a>
        </div>
        <div className="hero-proof"><span>✓ No card required</span><span>✓ Players need no account</span><span>✓ Installable on iPhone</span></div>
      </div>
      <div className="product-stage" aria-label="WicketSplit product preview">
        <div className="stage-glow"/>
        <article className="dashboard-preview">
          <div className="preview-top"><div className="preview-brand"><span>W</span><b>WicketSplit</b></div><i>Summer League · Active</i></div>
          <div className="preview-welcome"><small>MY TEAM</small><h2>Welcome back, Jordan.</h2><p>Your season at a glance</p></div>
          <div className="preview-balance"><div><small>YOUR BALANCE</small><strong>−$86.40</strong><span>You need to pay</span></div><button>View breakdown</button></div>
          <div className="preview-stats"><div><span>Games played</span><b>7</b></div><div><span>Fair share</span><b>$184.25</b></div><div><span>Expenses paid</span><b>$97.85</b></div></div>
          <div className="preview-game"><span>JUL<br/><b>28</b></span><div><small>COMPLETED</small><strong>vs. Desert Vipers</strong><p>12 selected · 11 sharing</p></div><i>XI</i></div>
        </article>
        <article className="lineup-float"><div><span>PLAYING XII</span><b>12/12</b></div><p><i>JM</i><i>AK</i><i>RP</i><i>NS</i><i>+8</i></p><strong>Lineup ready ✓</strong></article>
        <article className="settled-float"><span>SETTLEMENT</span><strong>3 payments</strong><small>League books reconciled</small></article>
      </div>
    </section>

    <section className="capability-strip"><span>Playing XI/XII</span><i/> <span>Game-based splits</span><i/> <span>Umpiring credits</span><i/> <span>CricClubs sync</span><i/> <span>CSV settlement</span></section>
    <FeatureCarousel/>
    <section className="compact-how" id="how"><div><span className="hero-kicker">HOW IT WORKS</span><h2>From fixture to settled<br/>in four clear moves.</h2></div><ol><li><b>01</b><span><strong>Create your team</strong><small>Add or import the roster</small></span></li><li><b>02</b><span><strong>Add completed games</strong><small>Select the XI or XII</small></span></li><li><b>03</b><span><strong>Record team costs</strong><small>We calculate every share</small></span></li><li><b>04</b><span><strong>Settle and share</strong><small>Clear balances with confidence</small></span></li></ol></section>
    <section className="compact-trust"><div><span className="hero-kicker">MADE FOR REAL TEAM TREASURERS</span><h2>Serious about the math.<br/>Lightweight everywhere else.</h2><p>Owners and co-treasurers manage the books. Players use one private link and PIN to see their own transparent breakdown—without creating an account.</p></div><div className="trust-accordion"><details open><summary>How is the split fair?<span>＋</span></summary><p>Team-funded costs are divided equally across completed games, then among the eligible players in each game.</p></details><details><summary>Does every player need an account?<span>＋</span></summary><p>No. Players use a reusable private team link and six-digit PIN, then select their roster identity.</p></details><details><summary>Is it mobile friendly?<span>＋</span></summary><p>Yes. WicketSplit is an installable PWA and can be added to an iPhone Home Screen without an App Store download.</p></details></div></section>

    <section className="public-cta modern-cta"><span className="hero-kicker">LIMITED EARLY ACCESS</span><h2>Ready to retire the team spreadsheet?</h2><p>Request access using only your email and team name. If approved, we’ll send you a private signup link.</p><a className="primary hero-primary" href={workspaceLink}>{cta} →</a><small>No account or card is required to request access.</small></section>

    <footer><a className="public-brand" href="/"><span>W</span>WicketSplit</a><p>Every game. Every expense. Fairly split.</p><div className="footer-links"><a href="#features">Features</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/data-deletion">Data deletion</a><a href="/forgot-password">Account recovery</a></div></footer>
    <a className="mobile-sticky-cta" href={workspaceLink}>{cta} →</a>
  </main>;
}
