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
  assert.match(dashboard, /<option>Other<\/option><option>Food<\/option><option>Night out<\/option><option>Party<\/option>/);
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
  assert.match(dashboard, />↗ Invite<\/button>/);
  assert.match(dashboard, /Message being sent/);
  assert.match(dashboard, /Copy invitation/);
  assert.match(dashboard, /Phone number \(optional\)/);
  assert.match(dashboard, /Create invitation/);
  assert.doesNotMatch(dashboard, /mailto:/);
  assert.match(dashboard, /aria-label="Log out"/);
  assert.doesNotMatch(dashboard, /logout-header/);
  assert.match(dashboard, /app-nav-trigger/);
  assert.match(dashboard, /Open account menu/);
  assert.match(dashboard, /profile-menu/);
  assert.match(dashboard, /document\.addEventListener\("pointerdown", closeOutside\)/);
  assert.match(dashboard, /event\.key === "Escape"/);
  assert.match(dashboard, /ref=\{profileMenuRef\}/);
  assert.match(dashboard, /Co-treasurer/);
  assert.match(dashboard, /<dt>Name<\/dt>/);
  assert.match(dashboard, /<dt>Role<\/dt>/);
  assert.match(dashboard, /<dt>Email<\/dt>/);
  assert.match(dashboard, /<dt>Phone<\/dt>/);
  assert.match(dashboard, /deleted from the roster/);
  assert.match(dashboard, /Submitted by you/);
  assert.match(dashboard, /Delete game/);
  assert.match(dashboard, /Expense deleted and balances recalculated/);
  assert.match(dashboard, /Delete linked expenses or credits before deleting this game/);
  assert.match(dashboard, /delete-team-link/);
});

test("shared teams use authenticated invitations and server-side roles", async () => {
  const [stateApi, inviteApi, acceptApi] = await Promise.all([
    readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invites/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invites/accept/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(stateApi, /team_memberships/);
  assert.match(stateApi, /is_owner/);
  assert.match(stateApi, /Members can only submit expenses they paid/);
  assert.match(inviteApi, /Only a treasurer can invite members/);
  assert.match(inviteApi, /invite_role/);
  assert.match(inviteApi, /intended_email/);
  assert.match(inviteApi, /invite-create:/);
  assert.match(inviteApi, /Add the player's email before granting co-treasurer access/);
  assert.match(acceptApi, /role, player_id/);
  assert.match(acceptApi, /invite\.invite_role/);
  assert.match(acceptApi, /invite\.intended_email/);
  assert.match(acceptApi, /invite-accept-ip:/);
});

test("player deletion is treasurer-only and protects historical records", async () => {
  const playerApi = await readFile(new URL("../app/api/players/route.ts", import.meta.url), "utf8");
  assert.match(playerApi, /Only a treasurer can delete players/);
  assert.match(playerApi, /This player has team access/);
  assert.match(playerApi, /used in a game or financial entry/);
  assert.match(playerApi, /player-delete:/);
  assert.match(playerApi, /DELETE FROM team_invites/);
});

test("team deletion is owner-only, throttled, and removes shared access atomically", async () => {
  const teamApi = await readFile(new URL("../app/api/teams/route.ts", import.meta.url), "utf8");
  assert.match(teamApi, /Only the original team treasurer can delete this team/);
  assert.match(teamApi, /team-delete:/);
  assert.match(teamApi, /env\.DB\.batch/);
  assert.match(teamApi, /DELETE FROM team_invites/);
  assert.match(teamApi, /DELETE FROM team_memberships/);
  assert.match(teamApi, /DELETE FROM shared_teams/);
});
