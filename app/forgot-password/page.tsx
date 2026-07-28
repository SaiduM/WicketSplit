export default function ForgotPassword() {
  return <main className="recovery-page">
    <a className="public-brand" href="/"><span>W</span>WicketSplit</a>
    <section className="recovery-card">
      <span className="recovery-icon">↺</span>
      <span className="hero-kicker">GOOGLE ACCOUNT RECOVERY</span>
      <h1>Can’t sign in?</h1>
      <p>WicketSplit uses your Google account and never stores a password. Use Google’s secure recovery flow to reset your password or regain access.</p>
      <a className="primary recovery-action" href="https://accounts.google.com/signin/recovery">Recover your Google account →</a>
      <div className="recovery-note"><strong>Your WicketSplit data stays safe.</strong><span>Recovering your Google account does not change your teams, leagues, games, or expenses.</span></div>
      <a className="help-link" href="/login?return_to=/app">Return to Google sign-in</a>
    </section>
  </main>;
}
