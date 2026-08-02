/* eslint-disable @next/next/no-html-link-for-pages */
import { getGoogleUser } from "./google-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getGoogleUser();
  const workspaceLink = user ? "/app" : "/login?return_to=/app";

  return <main className="public-site">
    <nav className="public-nav">
      <a className="public-brand" href="/"><span>W</span>WicketSplit</a>
      <div>
        <a className="nav-link" href="#how-it-works">How it works</a>
        <a className="nav-link" href="/forgot-password">Forgot password?</a>
        <a className="ghost" href={workspaceLink}>{user ? "Open workspace" : "Sign in"}</a>
        <a className="primary" href={workspaceLink}>{user ? "Go to dashboard" : "Register free"} →</a>
      </div>
    </nav>

    <section className="public-hero">
      <div className="hero-copy">
        <span className="hero-kicker">CRICKET TEAM EXPENSES, SORTED</span>
        <h1>Every game.<br/>Every expense.<br/><em>Fairly split.</em></h1>
        <p>Select the Playing XI or XII, track who paid, and give every player a transparent settlement when the league ends.</p>
        <div className="hero-actions">
          <a className="primary hero-primary" href={workspaceLink}>{user ? "Open your workspace" : "Register your account"} →</a>
          <span>Free to start · No card required</span>
        </div>
      </div>
      <div className="hero-ledger">
        <div className="ledger-top"><span>WOLFPACKS · SUMMER LEAGUE</span><i>Active</i></div>
        <h3>Team settlement</h3>
        <div className="ledger-stat"><div><small>TOTAL SPEND</small><strong>$2,608.75</strong></div><div><small>PLAYERS</small><strong>14</strong></div><div><small>GAMES</small><strong>8</strong></div></div>
        <div className="ledger-row"><span className="demo-avatar lime">SM</span><div><strong>Sai Mallela</strong><small>Paid $1,200.00</small></div><b className="positive">+$842.14</b></div>
        <div className="ledger-row"><span className="demo-avatar blue">AR</span><div><strong>Arjun Rao</strong><small>6 games played</small></div><b className="negative">−$186.34</b></div>
        <div className="ledger-row"><span className="demo-avatar peach">KP</span><div><strong>Kiran Patel</strong><small>7 games played</small></div><b className="negative">−$193.80</b></div>
        <div className="ledger-complete"><span>✓</span><div><strong>Settlement ready</strong><small>Download and share as CSV</small></div></div>
      </div>
    </section>

    <section className="trust-strip"><span>TREASURERS</span><strong>Individual sign-in</strong><span>TEAM PLAYERS</span><strong>Private link + PIN</strong><span>ONE LEDGER</span><strong>Clear settlement</strong></section>

    <section className="public-access">
      <div className="section-title"><span className="hero-kicker">SIMPLE, ROLE-BASED ACCESS</span><h2>The right experience for every teammate.</h2><p>Treasurers manage the books. Players get a focused personal view without creating an account.</p></div>
      <div className="access-card-grid"><article><span>FULL CONTROL</span><h3>Treasurer and co-treasurer</h3><p>Sign in individually to manage teams, rosters, leagues, games, expenses, umpiring waivers, and settlements.</p><strong>Google or verified email sign-in</strong></article><article><span>NO REGISTRATION</span><h3>Team player</h3><p>Open the team’s private link, enter the six-digit PIN, choose your roster name, and see only the essentials.</p><strong>Home · Games · Expenses</strong></article></div>
    </section>

    <section className="public-features" id="how-it-works">
      <div className="section-title"><span className="hero-kicker">BUILT FOR THE TREASURER</span><h2>From first fixture to final settlement.</h2><p>Everything your team needs, without spreadsheet gymnastics.</p></div>
      <div className="feature-grid">
        <article><span>01</span><div className="feature-icon">♙</div><h3>Build the team roster</h3><p>Add your full squad once. Keep names and contact details current across every league.</p></article>
        <article><span>02</span><div className="feature-icon">XI</div><h3>Pick who played</h3><p>Select exactly 11 or 12 players for each game so match-day costs reach the right people.</p></article>
        <article><span>03</span><div className="feature-icon">↗</div><h3>Record every payment</h3><p>Track Fruits / Water, League Fee, Restaurant, or Other—plus who paid and exactly how it is shared.</p></article>
        <article><span>04</span><div className="feature-icon">⇄</div><h3>Settle with confidence</h3><p>See who owes and who gets money back, then download the complete league CSV.</p></article>
      </div>
    </section>

    <section className="public-cta"><span className="hero-kicker">YOUR NEXT LEAGUE</span><h2>Leave the calculator at home.</h2><p>Treasurers sign in to manage the team. Players join through the private message shared by their treasurer.</p><a className="primary hero-primary" href={workspaceLink}>{user ? "Open WicketSplit" : "Create your treasurer account"} →</a></section>
    <footer><a className="public-brand" href="/"><span>W</span>WicketSplit</a><p>Fair expense splitting for cricket teams.</p><div className="footer-links"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/data-deletion">Data deletion</a><a href="/forgot-password">Account recovery</a></div></footer>
  </main>;
}
