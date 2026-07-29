import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public product surface has replaced the starter preview", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /WicketSplit/);
  assert.match(page, /Every game/);
  assert.match(page, /Register free/);
  assert.match(layout, /WicketSplit — Cricket Team Expenses/);
  assert.doesNotMatch(`${page}${layout}${packageJson}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("Google account recovery does not collect an app password", async () => {
  const recovery = await readFile(new URL("../app/forgot-password/page.tsx", import.meta.url), "utf8");
  assert.match(recovery, /GOOGLE ACCOUNT RECOVERY/);
  assert.match(recovery, /never stores a password/);
  assert.doesNotMatch(recovery, /type=["']password["']/i);
});

test("email login uses Firebase verification and a server-verified session", async () => {
  const [login, emailApi, configApi] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/email/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/auth/firebase-config/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(login, /createUserWithEmailAndPassword/);
  assert.match(login, /sendEmailVerification/);
  assert.match(login, /sendPasswordResetEmail/);
  assert.match(login, /Show password/);
  assert.match(login, /wicketsplit\/session-failed/);
  assert.match(login, /WicketSplit never receives or stores your password/);
  assert.match(emailApi, /securetoken\.google\.com/);
  assert.match(emailApi, /email_verified/);
  assert.match(emailApi, /email-login:/);
  assert.match(emailApi, /keys\.find/);
  assert.match(configApi, /FIREBASE_PROJECT_ID/);
});

test("public legal and self-service deletion surfaces are present", async () => {
  const [privacy, terms, deletion, accountApi, home] = await Promise.all([
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data-deletion/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(privacy, /Privacy Policy/);
  assert.match(terms, /Terms of Use/);
  assert.match(deletion, /Permanently delete my data/);
  assert.match(accountApi, /DELETE FROM app_states/);
  assert.match(home, /Data deletion/);
});

test("finance workflow includes editable dated expenses and settlement transfers", async () => {
  const dashboard = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /Expense date/);
  assert.match(dashboard, /Fruits &amp; Water/);
  assert.match(dashboard, /Add a player not listed/);
  assert.match(dashboard, /Pending only/);
  assert.match(dashboard, /exportBalances/);
  assert.match(dashboard, /Edit expense/);
  assert.match(dashboard, /Suggested payments/);
  assert.match(dashboard, /participants/);
  assert.match(dashboard, /Custom players/);
  assert.match(dashboard, /By games played/);
  assert.match(dashboard, /Credit a contribution/);
  assert.match(dashboard, /Not saved/);
  assert.match(dashboard, /Copy previous lineup/);
  assert.match(dashboard, /Share summary/);
  assert.match(dashboard, /Possible duplicate expense/);
  assert.match(dashboard, /PLAYER CALCULATION/);
  assert.match(dashboard, /Invite \/ access/);
  assert.match(dashboard, /Create & share invite/);
  assert.match(dashboard, /Phone number \(optional\)/);
  assert.match(dashboard, /Create & email invite/);
  assert.match(dashboard, /mailto:/);
  assert.match(dashboard, /aria-label="Log out"/);
  assert.doesNotMatch(dashboard, /logout-header/);
  assert.match(dashboard, /app-nav-trigger/);
  assert.match(dashboard, /Open account menu/);
  assert.match(dashboard, /profile-menu/);
  assert.match(dashboard, /Submitted by you/);
});

test("shared teams use authenticated invitations and server-side roles", async () => {
  const [stateApi, inviteApi, acceptApi] = await Promise.all([
    readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invites/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invites/accept/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(stateApi, /team_memberships/);
  assert.match(stateApi, /Members can only submit expenses they paid/);
  assert.match(inviteApi, /Only a treasurer can invite members/);
  assert.match(inviteApi, /invite_role/);
  assert.match(inviteApi, /intended_email/);
  assert.match(acceptApi, /role, player_id/);
  assert.match(acceptApi, /invite\.invite_role/);
  assert.match(acceptApi, /invite\.intended_email/);
});
