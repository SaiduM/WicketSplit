import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const workspaceLink = user ? "/app" : chatGPTSignInPath("/app");

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

    <section className="trust-strip"><span>ONE ACCOUNT</span><strong>Multiple teams</strong><span>ONE ROSTER</span><strong>Multiple leagues</strong><span>ONE CLICK</span><strong>Final CSV</strong></section>

    <section className="public-features" id="how-it-works">
      <div className="section-title"><span className="hero-kicker">BUILT FOR THE TREASURER</span><h2>From first fixture to final settlement.</h2><p>Everything your team needs, without spreadsheet gymnastics.</p></div>
      <div className="feature-grid">
        <article><span>01</span><div className="feature-icon">♙</div><h3>Build the team roster</h3><p>Add your full squad once. Keep names and contact details current across every league.</p></article>
        <article><span>02</span><div className="feature-icon">XI</div><h3>Pick who played</h3><p>Select exactly 11 or 12 players for each game so match-day costs reach the right people.</p></article>
        <article><span>03</span><div className="feature-icon">↗</div><h3>Record every payment</h3><p>League fees, fruits, water, equipment, and team funds—plus who paid for each.</p></article>
        <article><span>04</span><div className="feature-icon">⇄</div><h3>Settle with confidence</h3><p>See who owes and who gets money back, then download the complete league CSV.</p></article>
      </div>
    </section>

    <section className="public-cta"><span className="hero-kicker">YOUR NEXT LEAGUE</span><h2>Leave the calculator at home.</h2><p>Create an account, register your teams, and let WicketSplit handle the math.</p><a className="primary hero-primary" href={workspaceLink}>{user ? "Open WicketSplit" : "Create your free account"} →</a></section>
    <footer><a className="public-brand" href="/"><span>W</span>WicketSplit</a><p>Fair expense splitting for cricket teams.</p><a href="/forgot-password">Account recovery</a></footer>
  </main>;
}
