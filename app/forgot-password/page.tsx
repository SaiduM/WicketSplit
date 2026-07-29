/* eslint-disable @next/next/no-html-link-for-pages */

export default function ForgotPassword() {
  return <main className="recovery-page">
    <a className="public-brand" href="/"><span>W</span>WicketSplit</a>
    <section className="recovery-card">
      <span className="recovery-icon">↺</span>
      <span className="hero-kicker">GOOGLE ACCOUNT RECOVERY</span>
      <h1>Can’t sign in?</h1>
      <p>Firebase securely manages email passwords and WicketSplit never stores a password. Request a reset email, or use Google recovery for a Google account.</p>
      <a className="primary recovery-action" href="/login?reset=1">Reset an email password →</a>
      <div className="recovery-note"><strong>Your WicketSplit data stays safe.</strong><span>Resetting a password does not change your teams, leagues, games, expenses, or assigned access.</span></div>
      <a className="help-link" href="https://accounts.google.com/signin/recovery">Recover a Google account</a>
    </section>
  </main>;
}
