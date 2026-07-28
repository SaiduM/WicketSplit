import { chatGPTSignInPath } from "../chatgpt-auth";

export default function ForgotPassword() {
  return <main className="recovery-page">
    <a className="public-brand" href="/"><span>W</span>WicketSplit</a>
    <section className="recovery-card">
      <span className="recovery-icon">↺</span>
      <span className="hero-kicker">ACCOUNT RECOVERY</span>
      <h1>Forgot your password?</h1>
      <p>WicketSplit uses secure ChatGPT accounts. Continue to the sign-in screen, enter your email address, then choose <strong>Forgot password?</strong> to receive a reset email.</p>
      <a className="primary recovery-action" href={chatGPTSignInPath("/app")}>Continue to account recovery →</a>
      <div className="recovery-note"><strong>Signed up with Google, Microsoft, or Apple?</strong><span>Use the same provider to sign in. Password recovery is managed by that provider.</span></div>
      <a className="help-link" href="https://help.openai.com/en/articles/4936828-how-do-i-change-my-account-password">View password reset help</a>
    </section>
  </main>;
}
