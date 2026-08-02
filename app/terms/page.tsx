import LegalPage from "../legal-page";

export default function Terms() {
  return <LegalPage eyebrow="SERVICE TERMS" title="Terms of Use" updated="August 2, 2026">
    <section><h2>Using WicketSplit</h2><p>You may use WicketSplit to maintain team rosters, record expenses, calculate shares, and prepare settlements. You are responsible for the accuracy of the information you enter and for obtaining permission before adding another person’s contact information.</p></section>
    <section><h2>Financial calculations</h2><p>WicketSplit is an organizational tool, not a bank, payment processor, accountant, or financial adviser. Review the expense ledger and settlement before collecting or sending money.</p></section>
    <section><h2>Account and team-link security</h2><p>Treasurer access is provided through Google authentication or a Firebase-managed email account. Players may also use a private shared team link and PIN without registration. Keep passwords, signed-in devices, team links, and PINs secure. Anyone with both team secrets can select a roster identity, and the treasurer is responsible for replacing or revoking shared access when necessary.</p></section>
    <section><h2>Acceptable use</h2><p>Do not misuse the service, attempt to access another account, upload unlawful information, disrupt the application, or use automated traffic to evade rate limits.</p></section>
    <section><h2>Availability</h2><p>The service may change, experience interruptions, or discontinue features. Export important league records as CSV when a permanent copy is required.</p></section>
    <section><h2>Limitation</h2><p>To the extent permitted by law, WicketSplit is provided without guarantees and is not responsible for losses caused by incorrect entries, misunderstood settlements, unavailable service, or actions taken outside the application.</p></section>
  </LegalPage>;
}
