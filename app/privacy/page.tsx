import LegalPage from "../legal-page";

export default function Privacy() {
  return <LegalPage eyebrow="YOUR DATA" title="Privacy Policy" updated="July 28, 2026">
    <section><h2>Information we collect</h2><p>When you sign in with Google, WicketSplit receives your name, verified email address, and optional profile image. We store the teams, players, leagues, games, expenses, credits, and settlements that you enter.</p></section>
    <section><h2>How we use information</h2><p>We use this information only to authenticate your account, save your private workspace, calculate expense shares, and provide exports and settlement summaries.</p></section>
    <section><h2>Storage and account separation</h2><p>Workspace records are stored in a hosted database and keyed to the signed-in Google email address. One account cannot load another account’s workspace through the application.</p></section>
    <section><h2>Sharing</h2><p>WicketSplit does not sell personal information. Data is processed by the hosting and authentication providers needed to operate the service. A settlement leaves the app only when you choose to share or export it.</p></section>
    <section><h2>Player contact details</h2><p>A team treasurer may optionally store a player’s email address and phone number to manage the roster and prepare invitations. Email-restricted invitation links can only be accepted using the matching verified email.</p></section>
    <section><h2>Passwords and payments</h2><p>WicketSplit never receives or stores your Google or Firebase password. Firebase securely handles email-password authentication. WicketSplit records payment information entered by a team treasurer but does not process bank, card, UPI, Zelle, or Venmo transactions.</p></section>
    <section><h2>Retention and deletion</h2><p>Your workspace remains available until you delete it. Visit the <a href="/data-deletion">Data Deletion page</a> to permanently remove your account data.</p></section>
  </LegalPage>;
}
