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
  assert.doesNotMatch(`${emailApi}${configApi}`, /firebaseWebDefaults|AIzaSy/);
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
  assert.match(privacy, /Squad screenshots/);
  assert.match(privacy, /does not upload or store the image/);
  assert.match(accountApi, /DELETE FROM app_states/);
  assert.match(accountApi, /export async function PATCH/);
  assert.match(accountApi, /account-player-link:/);
  assert.match(accountApi, /That roster player is already linked to another account/);
  assert.match(home, /Data deletion/);
});

test("finance workflow includes editable dated expenses and settlement transfers", async () => {
  const [dashboard,stateApi] = await Promise.all([
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /Expense date/);
  assert.match(dashboard, /<option>Fruits \/ Water<\/option>/);
  assert.match(dashboard, /<option>Restaurant<\/option><option>Other<\/option>/);
  assert.match(dashboard, /Add a player not listed/);
  assert.match(dashboard, /Pending only/);
  assert.match(dashboard, /exportBalances/);
  assert.match(dashboard, /Edit expense/);
  assert.match(dashboard, /Who should pay whom now/);
  assert.match(dashboard, /participants/);
  assert.match(dashboard, /Custom players/);
  assert.match(dashboard, /By games played/);
  assert.match(dashboard, /appearanceCategories = new Set\(\["League fee","League Fee","Fruits & Water","Fruits \/ Water","Fruits","Water"\]\)/);
  assert.match(dashboard, /League share calculator/);
  assert.match(dashboard, /Player share = expense × eligible appearances ÷ total eligible appearances/);
  assert.match(dashboard, /Fruits \/ water/);
  assert.doesNotMatch(dashboard, />A game lineup</);
  assert.match(dashboard, /Which roster player are you/);
  assert.match(dashboard, /You need to pay/);
  assert.match(dashboard, /You will receive/);
  assert.match(dashboard, /My settlement/);
  assert.match(dashboard, /My games/);
  assert.match(dashboard, /My fair share/);
  assert.doesNotMatch(dashboard, /Total league cost/);
  assert.doesNotMatch(dashboard, /Recent entries/);
  assert.doesNotMatch(dashboard, /Player balances/);
  assert.doesNotMatch(dashboard, /Available for selection/);
  assert.match(dashboard, /Record umpiring for the team/);
  assert.match(dashboard, /Only players with more than 0 games will be saved/);
  assert.match(dashboard, /Fixed credit per game/);
  assert.match(dashboard, /aria-label="Current league" value=\{league\.id\} onChange=\{e=>setLeagueId\(Number\(e\.target\.value\)\)\}/);
  assert.doesNotMatch(dashboard, /setLeagueId\(Number\(e\.target\.value\)\);chooseView\("overview"\)/);
  assert.match(dashboard, /nobody else is charged/);
  assert.match(dashboard, /Save umpiring waivers/);
  assert.match(dashboard, /Games umpired/);
  assert.match(dashboard, /umpiringDetails\.join/);
  assert.match(dashboard, /Not saved · Retry/);
  assert.match(dashboard, /Copy previous lineup/);
  assert.match(dashboard, /View \{lineupTitle\}/);
  assert.match(dashboard, /filter\(\(player\):player is Player=>Boolean\(player\)\)\.sort\(\(a,b\)=>a\.name\.localeCompare/);
  assert.match(dashboard, /Playing XII/);
  assert.match(dashboard, /Included in fair split/);
  assert.match(dashboard, /Everyone is included by default/);
  assert.match(dashboard, /Not included in split/);
  assert.match(dashboard, /splitEligiblePlayers/);
  assert.match(dashboard, /Split-eligible Appearances/);
  assert.match(stateApi, /excludedFromSplit/);
  assert.match(stateApi, /fixture\.excludedFromSplit\.length >= fixture\.players\.length/);
  assert.match(dashboard, /Share remaining/);
  assert.match(dashboard, /Possible duplicate expense/);
  assert.doesNotMatch(dashboard, /\["overview","expenses"\]\.includes\(view\)/);
  assert.doesNotMatch(dashboard, /view==="overview" && league && players\.length>0/);
  assert.match(dashboard, /PLAYER CALCULATION/);
  assert.match(dashboard, />↗ Co-treasurer<\/button>/);
  assert.match(dashboard, /Message being sent/);
  assert.match(dashboard, /Copy invitation/);
  assert.match(dashboard, /Phone number \(optional\)/);
  assert.match(dashboard, /Invite co-treasurer/);
  assert.doesNotMatch(dashboard, /mailto:/);
  assert.match(dashboard, /aria-label="Log out"/);
  assert.doesNotMatch(dashboard, /logout-header/);
  assert.match(dashboard, /app-nav-trigger/);
  assert.match(dashboard, /className="mobile-back"/);
  assert.match(dashboard, /addEventListener\("popstate",restoreView\)/);
  assert.match(dashboard, /history\.pushState/);
  assert.match(dashboard, /standalone!==true/);
  assert.match(dashboard, /horizontal>=75&&horizontal>vertical\*1\.35/);
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
  assert.match(dashboard, /Date \(optional\)/);
  assert.match(dashboard, /DATE NOT ADDED/);
  assert.match(dashboard, /delete-team-link/);
  assert.match(dashboard, /Record payment/);
  assert.match(dashboard, /Confirm payment received/);
  assert.match(dashboard, /Who should pay whom now/);
  assert.match(dashboard, /Confirmed payment history/);
  assert.match(dashboard, /Settlement Sent/);
  assert.match(dashboard, /originalBalance \+ sent - received/);
});

test("mobile game cards display two per row", async () => {
  const [css, dashboard] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.game-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:10px\}/);
  assert.match(css, /\.roster-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:10px\}/);
  assert.match(css, /\.delete-player\{border:1px solid #e6b9b5;background:#fff7f6/);
  assert.match(dashboard, /mobile-secondary-nav/);
  assert.match(css, /\.sidebar nav button\.mobile-secondary-nav\{display:none\}/);
});

test("public access messaging and financial ledgers are mobile friendly", async () => {
  const [home, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(home, /SIMPLE, ROLE-BASED ACCESS/);
  assert.match(home, /Private link \+ PIN/);
  assert.match(home, /Create your treasurer account/);
  assert.match(css, /\.ledger-filters\+\.table-panel td:nth-child\(1\)::before\{content:"Date"\}/);
  assert.match(css, /\.settlement-filter\+\.table-panel td:nth-child\(1\)::before\{content:"Player"\}/);
  assert.match(css, /\.payment-history>\.table-panel td:nth-child\(1\)::before\{content:"Date"\}/);
  assert.match(css, /min-width:0!important/);
});

test("squad screenshots are processed locally and reviewed before batch import", async () => {
  const [dashboard, packageJson] = await Promise.all([
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(packageJson, /"tesseract\.js"/);
  assert.match(dashboard, /Import screenshots/);
  assert.match(dashboard, /PRIVATE SCREENSHOT IMPORT/);
  assert.match(dashboard, /never uploads or saves the screenshot/);
  assert.match(dashboard, /multiple onChange=\{event=>processFiles/);
  assert.match(dashboard, /Our team column/);
  assert.match(dashboard, /Add as new roster player/);
  assert.match(dashboard, /Date \(optional\)/);
  assert.match(dashboard, /worker\?\.terminate\(\)/);
});

test("shared teams use authenticated invitations and server-side roles", async () => {
  const [stateApi, inviteApi, acceptApi, treasurerApi] = await Promise.all([
    readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invites/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/invites/accept/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/team-treasurers/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(stateApi, /team_memberships/);
  assert.match(stateApi, /is_owner/);
  assert.match(stateApi, /Members can only submit expenses they paid/);
  assert.match(stateApi, /Members can only edit expenses they submitted/);
  assert.match(stateApi, /Members can only delete expenses they submitted/);
  assert.match(stateApi, /Shared team members cannot create or switch teams/);
  const dashboard = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /item\.entry\.submittedBy===memberEmail\.toLowerCase\(\)/);
  assert.match(dashboard, /Select category/);
  assert.match(dashboard, /Select who paid/);
  assert.match(dashboard, /Select sharing method/);
  assert.match(dashboard, /appearanceCategories\.has\(next\)\?"appearances":"custom"/);
  assert.match(dashboard, /isSharedMember\?\[\["overview","▦","Home"\],\["games","◉","Games"\],\["expenses","↗","Expenses"\]\]/);
  assert.match(dashboard, /onAddExpense=.*setModal\("expense"\)/);
  assert.match(dashboard, /!isSharedMember&&<button className="add-team-link"/);
  assert.match(inviteApi, /Only a treasurer can invite members/);
  assert.match(inviteApi, /invite_role/);
  assert.match(inviteApi, /intended_email/);
  assert.match(inviteApi, /invite-create:/);
  assert.match(inviteApi, /Add the player's email before granting co-treasurer access/);
  assert.match(acceptApi, /role, player_id/);
  assert.match(acceptApi, /invite\.invite_role/);
  assert.match(acceptApi, /invite\.intended_email/);
  assert.match(acceptApi, /invite-accept-ip:/);
  assert.match(treasurerApi, /Only a treasurer can remove co-treasurer access/);
  assert.match(treasurerApi, /The original team owner cannot be removed/);
  assert.match(treasurerApi, /You cannot remove your own current access/);
  assert.match(treasurerApi, /DELETE FROM team_memberships/);
  assert.match(treasurerApi, /DELETE FROM team_invites/);
  assert.match(dashboard, /Remove access/);
  assert.match(dashboard, /Owner protected/);
});

test("shared team member mode reuses encrypted access until explicit replacement", async () => {
  const [dashboard, joinPage, accessApi, joinApi, auth, migration, reuseMigration, privacy] = await Promise.all([
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/join-team/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/team-access/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/team-access/join/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/google-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_loving_colossus.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0004_worried_omega_red.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /Team member access/);
  assert.match(dashboard, /Create link & PIN/);
  assert.match(dashboard, /Replace link & PIN/);
  assert.match(dashboard, /Copy same message/);
  assert.match(dashboard, /Keep reusing this message/);
  assert.match(dashboard, /Revoke access/);
  assert.match(dashboard, /Choose your own name from the roster/);
  assert.match(joinPage, /You do not need to create an account/);
  assert.match(joinPage, /Choose your player/);
  assert.match(accessApi, /token_hash TEXT NOT NULL UNIQUE/);
  assert.match(accessApi, /pin_hash TEXT NOT NULL/);
  assert.match(accessApi, /AES-GCM/);
  assert.match(accessApi, /current\?\.access_secret&&!replace/);
  assert.match(accessApi, /export async function GET/);
  assert.match(accessApi, /Only a treasurer can manage team member access/);
  assert.match(accessApi, /team-access-create-ip:/);
  assert.match(joinApi, /team-access-join-ip:/);
  assert.match(joinApi, /team-access-join-token:/);
  assert.match(joinApi, /provider:"team"/);
  assert.match(joinApi, /role='member'/);
  assert.match(auth, /teamAccessTokenHash/);
  assert.match(auth, /access\?\.token_hash===user\.teamAccessTokenHash/);
  assert.match(migration, /CREATE TABLE `team_member_access`/);
  assert.match(reuseMigration, /ADD `access_secret` text/);
  assert.match(privacy, /encrypted at rest/);
});

test("player deletion is treasurer-only and protects historical records", async () => {
  const playerApi = await readFile(new URL("../app/api/players/route.ts", import.meta.url), "utf8");
  assert.match(playerApi, /Only a treasurer can delete players/);
  assert.match(playerApi, /This player has team access/);
  assert.match(playerApi, /used in a game or financial entry/);
  assert.match(playerApi, /player-delete:/);
  assert.match(playerApi, /DELETE FROM team_invites/);
  assert.match(playerApi, /fromPlayerId/);
});

test("settlement payments are validated and members cannot modify them", async () => {
  const stateApi = await readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8");
  assert.match(stateApi, /record\.payments\.length > 10_000/);
  assert.match(stateApi, /entry\.fromPlayerId===entry\.toPlayerId/);
  assert.match(stateApi, /entry\.amount<=0/);
  assert.match(stateApi, /payments: league\.payments\?\?\[\]/);
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

test("treasurers can permanently delete a league and its contained records", async () => {
  const dashboard = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /Delete league/);
  assert.match(dashboard, /This removes all of its games, expenses, credits, and settlement payments/);
  assert.match(dashboard, /current\.leagues\.filter\(candidate=>candidate\.id!==target\.id\)/);
  assert.match(dashboard, /setLeagueId\(remaining\[0\]\?\.id\?\?null\)/);
});

test("CricClubs sync previews completed games and preserves duplicate identifiers", async () => {
  const [dashboard, syncApi, stateApi] = await Promise.all([
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cricclubs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /Sync CricClubs/);
  assert.match(dashboard, /Match all 11 or 12 unique players/);
  assert.match(dashboard, /Check for new leagues/);
  assert.match(dashboard, /CricClubs club code/);
  assert.match(dashboard, /Find my leagues/);
  assert.match(dashboard, /Import leagues, games & roster from CricClubs/);
  assert.match(dashboard, /missing roster players will be added automatically/);
  assert.match(dashboard, /players:\[\.\.\.current\.players,\.\.\.newPlayers\]/);
  assert.match(dashboard, /modal==="cricclubs" && team && <CricClubsImportModal/);
  assert.match(dashboard, /shortCode:clubCode\.trim\(\),teamName:searchTeamName\.trim\(\)/);
  assert.match(dashboard, /Create league & check games/);
  assert.match(dashboard, /Create league & import games/);
  assert.match(dashboard, /name:leagueConnection\.seriesName/);
  assert.match(dashboard, /game\.externalId===match\.externalId/);
  assert.match(syncApi, /core-prod-origin\.cricclubs\.com/);
  assert.match(syncApi, /x-content-token/);
  assert.match(syncApi, /4392f2cedc79257/);
  assert.doesNotMatch(syncApi, /4392f2cede1c79257/);
  assert.match(syncApi, /completed\.map/);
  assert.match(syncApi, /public\/league\/\$\{encodeURIComponent\(leagueId\)\}\/series/);
  assert.match(syncApi, /public\/series\/\$\{encodeURIComponent\(seriesId\)\}\/teams/);
  assert.match(syncApi, /normalizedName\(team\.teamName\) === target/);
  assert.match(syncApi, /teamInnings\?\.batting/);
  assert.match(syncApi, /cricclubs:\$\{user\.email\.toLowerCase\(\)\}/);
  assert.match(stateApi, /fixture\.source === "cricclubs"/);
  assert.match(stateApi, /connection\.seriesId/);
  assert.match(stateApi, /https:\/\/www\.cricclubs\.com\//);
});
