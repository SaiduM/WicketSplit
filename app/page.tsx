/* eslint-disable @next/next/no-html-link-for-pages */
import { getGoogleUser } from "./google-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getGoogleUser();
  const workspaceLink = user ? "/app" : "/request-access";
  const cta = user ? "Open WicketSplit" : "Request early access";

  return <main className="public-site product-landing">
    <nav className="public-nav">
      <a className="public-brand" href="/"><span>W</span>WicketSplit</a>
      <div>
        <a className="nav-link" href="#workflow">How it works</a>
        <a className="nav-link" href="#features">Features</a>
        <a className="nav-link" href="#access">Team access</a>
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
          <a className="text-action" href="#workflow">See how it works ↓</a>
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

    <section className="workflow-section" id="workflow">
      <div className="section-title"><span className="hero-kicker">ONE CLEAR WORKFLOW</span><h2>From fixture to final settlement.</h2><p>WicketSplit does the repetitive math while your team keeps full visibility.</p></div>
      <div className="workflow-grid">
        <article><span className="step-number">01</span><div className="workflow-visual game-visual"><div><small>COMPLETED GAME</small><strong>Wolfpacks <i>vs</i> Cheetahs</strong><p>Jul 19 · Playing XII</p></div><b>12</b><section><i>SM</i><i>AR</i><i>KP</i><i>VN</i><i>+8</i></section></div><h3>Add who played</h3><p>Create a game manually, sync completed CricClubs matches, or import lineup screenshots privately on your device.</p></article>
        <article><span className="step-number">02</span><div className="workflow-visual expense-visual"><div><i>↗</i><span><small>FRUITS / WATER</small><strong>Match refreshments</strong></span><b>$48.00</b></div><div><i>÷</i><span><small>SHARED BY</small><strong>Completed games</strong></span><b>Auto</b></div><div><i>＋</i><span><small>UMPIRE CREDIT</small><strong>2 outside games</strong></span><b>$50.00</b></div></div><h3>Record costs and credits</h3><p>Track league fees, refreshments, restaurants, other costs, who paid, and fixed umpiring credits.</p></article>
        <article><span className="step-number">03</span><div className="workflow-visual settle-visual"><header><span>PLAYER</span><span>REMAINING</span></header><div><span><i className="lime">JM</i>Jordan</span><b className="positive">+$126.40</b></div><div><span><i className="blue">AK</i>Arun</span><b className="negative">−$71.20</b></div><div><span><i className="peach">RP</i>Ravi</span><b className="negative">−$55.20</b></div><footer>Jordan receives from 2 players</footer></div><h3>Settle with confidence</h3><p>See every player’s calculation, suggested payments, confirmed history, and exportable league records.</p></article>
      </div>
    </section>

    <section className="feature-bento" id="features">
      <div className="section-title"><span className="hero-kicker">MORE THAN AN EXPENSE LIST</span><h2>Purpose-built for the treasurer.</h2><p>Powerful where the league needs it, intentionally simple everywhere else.</p></div>
      <div className="bento-grid">
        <article className="bento-large"><span className="bento-icon">÷</span><h3>Fair by game, not by roster</h3><p>The team cost pool is divided across completed games, then among each game’s included players. Edit a lineup and every affected share updates automatically.</p><div className="formula-chip"><span>Team costs</span><b>÷ games</b><span>÷ eligible players</span><strong>= fair share</strong></div></article>
        <article><span className="bento-icon">◎</span><h3>CricClubs sync</h3><p>Discover leagues, import completed games, lineups, and missing roster players.</p></article>
        <article><span className="bento-icon">▧</span><h3>Private screenshot import</h3><p>Read up to 10 lineup screenshots on-device. Images are discarded after review.</p></article>
        <article><span className="bento-icon">＋</span><h3>Umpiring credits</h3><p>Enter one fixed rate and each player’s game count. Credits flow into the team settlement.</p></article>
        <article><span className="bento-icon">⇄</span><h3>Transparent settlement</h3><p>Fair share, expenses paid, credits, sent, received, and remaining—all explained.</p></article>
        <article className="bento-wide"><span className="bento-icon">↗</span><h3>One team, the right access for everyone</h3><p>Owners and co-treasurers manage the books. Players open one private team link and PIN, choose their roster name, and see their personal balance without registering.</p></article>
      </div>
    </section>

    <section className="access-showcase" id="access">
      <div><span className="hero-kicker">SIMPLE, ROLE-BASED ACCESS</span><h2>Your team sees what they need.</h2><p>No shared treasurer passwords. No account creation for every player. No confusing admin controls in the player view.</p><div className="access-points"><span><i>1</i><b>Treasurer</b><small>Owns teams and full financial control</small></span><span><i>2</i><b>Co-treasurer</b><small>Authenticated full team management</small></span><span><i>3</i><b>Player</b><small>Private link + PIN and personal view</small></span></div></div>
      <div className="phone-shell"><div className="phone-notch"/><div className="phone-screen"><header><span>W</span><b>WicketSplit</b></header><small>MY SETTLEMENT</small><h3>Hi, Maya.</h3><div className="phone-balance"><span>You need to pay</span><strong>$74.60</strong><small>Across 6 games</small></div><div className="phone-row"><span>Fair share</span><b>$149.60</b></div><div className="phone-row"><span>Expenses paid</span><b className="positive">+$75.00</b></div><button>See my breakdown</button><footer><i>⌂</i><i>◉</i><i>↗</i><i>⇄</i></footer></div></div>
    </section>

    <section className="trust-section">
      <div><span className="hero-kicker">BUILT FROM A REAL TEAM PROBLEM</span><h2>Made by a cricket-team treasurer.</h2><p>WicketSplit started with a simple question: how do you fairly split a league fee when every player appears in a different number of games? It grew into one focused place for fixtures, expenses, credits, and settlement—without turning into heavyweight club-management software.</p></div>
      <div className="trust-cards"><article><span>⌁</span><strong>No card required</strong><small>Join the early preview for free</small></article><article><span>▣</span><strong>Your records stay private</strong><small>Server-enforced team permissions</small></article><article><span>⌂</span><strong>Works like an app</strong><small>Add it to your iPhone Home Screen</small></article></div>
    </section>

    <section className="public-cta modern-cta"><span className="hero-kicker">LIMITED EARLY ACCESS</span><h2>Ready to retire the team spreadsheet?</h2><p>Request access using only your email and team name. If approved, we’ll send you a private signup link.</p><a className="primary hero-primary" href={workspaceLink}>{cta} →</a><small>No account or card is required to request access.</small></section>

    <footer><a className="public-brand" href="/"><span>W</span>WicketSplit</a><p>Every game. Every expense. Fairly split.</p><div className="footer-links"><a href="#workflow">How it works</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/data-deletion">Data deletion</a><a href="/forgot-password">Account recovery</a></div></footer>
  </main>;
}
