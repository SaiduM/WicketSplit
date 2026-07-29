import LegalPage from "../legal-page";

export default function Terms() {
  return <LegalPage eyebrow="SERVICE TERMS" title="Terms of Use" updated="July 28, 2026">
    <section><h2>Using WicketSplit</h2><p>You may use WicketSplit to maintain team rosters, record expenses, calculate shares, and prepare settlements. You are responsible for the accuracy of the information you enter and for obtaining permission before adding another person’s contact information.</p></section>
    <section><h2>Financial calculations</h2><p>WicketSplit is an organizational tool, not a bank, payment processor, accountant, or financial adviser. Review the expense ledger and settlement before collecting or sending money.</p></section>
    <section><h2>Account security</h2><p>Access is provided through Google authentication or a verified phone number. Keep your account and signed-in devices secure, and never share a one-time verification code.</p></section>
    <section><h2>Acceptable use</h2><p>Do not misuse the service, attempt to access another account, upload unlawful information, disrupt the application, or use automated traffic to evade rate limits.</p></section>
    <section><h2>Availability</h2><p>The service may change, experience interruptions, or discontinue features. Export important league records as CSV when a permanent copy is required.</p></section>
    <section><h2>Limitation</h2><p>To the extent permitted by law, WicketSplit is provided without guarantees and is not responsible for losses caused by incorrect entries, misunderstood settlements, unavailable service, or actions taken outside the application.</p></section>
  </LegalPage>;
}
