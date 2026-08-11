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
  assert.match(page, /Request early access/);
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
  assert.match(dashboard, /Remaining = expenses paid \+ umpiring credits \+ sent − fair share − received/);
  assert.match(dashboard, /<th>Expenses paid<\/th><th>Umpiring credit<\/th>/);
  assert.match(dashboard, /Positive contributions/);
  assert.match(dashboard, /Fair-share costs/);
  assert.match(dashboard, /Paid: \$\{expense\.label\}/);
  assert.match(dashboard, /participants/);
  assert.match(dashboard, /Custom players/);
  assert.match(dashboard, /By games played/);
  assert.match(dashboard, /appearanceCategories = new Set\(\["League fee","League Fee","Fruits & Water","Fruits \/ Water","Fruits","Water"\]\)/);
  assert.match(dashboard, /League share calculator/);
  assert.match(dashboard, /The full team cost pool is split equally across/);
  assert.match(dashboard, /Each game’s cost is then divided equally among that game’s eligible players/);
  assert.doesNotMatch(dashboard, /<th>Fruits \/ water<\/th>/);
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
  assert.match(dashboard, /Only players with more than 0 games umpired will be saved/);
  assert.match(dashboard, /Fixed credit per game/);
  assert.match(dashboard, /aria-label="Current league" value=\{league\.id\} onChange=\{e=>setLeagueId\(Number\(e\.target\.value\)\)\}/);
  assert.doesNotMatch(dashboard, /setLeagueId\(Number\(e\.target\.value\)\);chooseView\("overview"\)/);
  assert.match(dashboard, /The player receives the full credit/);
  assert.match(dashboard, /That full amount is added to the team cost pool/);
  assert.match(dashboard, /Save umpiring credits/);
  assert.match(dashboard, /Split equally by game · \$\{count\} completed \$\{count===1\?"game":"games"\}/);
  assert.match(dashboard, /if\(entry\.kind==="umpiring-waiver"\) return gameSplitLabel\(games\)/);
  assert.match(dashboard, /gameWeightedShare\(e\.amount,player\.id,games\)/);
  assert.match(dashboard, /Combined expense share/);
  assert.match(dashboard, /All league, refreshments, umpiring, and other shared costs/);
  assert.match(dashboard, /Credits reduce each player’s net share/);
  assert.doesNotMatch(dashboard, /<th>Weight<\/th>/);
  assert.match(dashboard, /Per-game breakdown/);
  assert.match(dashboard, /Each completed game receives an equal part of the team cost pool/);
  assert.match(dashboard, /1\/fundedGameCount/);
  assert.match(dashboard, /PER-GAME BREAKDOWN/);
  assert.match(dashboard, /Allocated Cost/);
  assert.match(dashboard, /perGame\/eligible\.length/);
  assert.doesNotMatch(dashboard, /Maximum waiver/);
  assert.doesNotMatch(dashboard, /<th>Games umpired<\/th>/);
  assert.match(dashboard, /Not saved · Retry/);
  assert.match(dashboard, /Use previous lineup/);
  assert.match(dashboard, /View \{lineupTitle\}/);
  assert.match(dashboard, /filter\(\(player\):player is Player=>Boolean\(player\)\)\.sort\(\(a,b\)=>a\.name\.localeCompare/);
  assert.match(dashboard, /Playing XII/);
  assert.match(dashboard, /Adjust who shares \(optional\)/);
  assert.match(dashboard, /Everyone selected will share this game by default/);
  assert.match(dashboard, /Automatic game split/);
  assert.match(dashboard, /Adding or editing a lineup automatically recalculates every share/);
  assert.match(dashboard, /\{!appearanceCategory&&<SplitFields/);
  assert.match(dashboard, /const GAME_PAGE_SIZE = 12/);
  assert.match(dashboard, /const LEDGER_PAGE_SIZE = 20/);
  assert.match(dashboard, /aria-label=\{`\$\{itemLabel\} pagination`\}/);
  assert.match(dashboard, /visibleGames\.map/);
  assert.match(dashboard, /visibleEntries\.map/);
  assert.match(dashboard, /Shares cost/);
  assert.match(dashboard, /Excluded/);
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

test("D1 access queries have migrations for their real lookup patterns", async () => {
  const [schema,migration,workspaceMigration,workspace,stateApi,dashboard] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0005_mysterious_caretaker.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0006_ordinary_starfox.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/workspace.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /idx_team_memberships_email_joined/);
  assert.match(schema, /idx_team_memberships_team_role_joined/);
  assert.match(schema, /idx_team_memberships_team_player/);
  assert.match(schema, /idx_team_invites_team_player_pending/);
  assert.match(schema, /idx_team_invites_team_email_pending/);
  assert.match(schema, /idx_team_invites_expiry/);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS/);
  assert.match(migration, /PRAGMA optimize/);
  assert.match(workspaceMigration, /CREATE TABLE IF NOT EXISTS `workspace_teams`/);
  assert.match(workspaceMigration, /idx_workspace_games_league_date/);
  assert.match(workspaceMigration, /idx_workspace_expenses_league_date/);
  assert.match(workspace, /teamToWorkspaceRows/);
  assert.match(workspace, /workspaceRowsToTeam/);
  assert.match(workspace, /WORKSPACE_VERSION_CONFLICT/);
  assert.match(workspace, /crypto\.randomUUID/);
  assert.match(workspace, /legacySnapshot/);
  assert.match(stateApi, /loadOrMigrateTeam/);
  assert.match(stateApi, /This team changed in another session/);
  assert.match(dashboard, /teamVersions/);
});

test("legacy team records round-trip through normalized workspace rows", async () => {
  const {teamToWorkspaceRows,workspaceRowsToTeam}=await import("../db/workspace-shape.ts");
  const team={id:7,name:"Wolfpacks",sport:"Cricket",cricclubs:{shortCode:"CL",teamName:"Wolfpacks"},players:[{id:11,name:"A",initials:"A",color:"#fff"}],leagues:[{id:21,name:"Summer",season:"2026",status:"Active",games:[{id:31,date:"2026-08-01",opponent:"Cactus",venue:"",players:[11],status:"Completed"}],expenses:[{id:41,date:"2026-08-01",label:"League",category:"League Fee",amount:120,paidBy:11,split:"appearances"}],credits:[{id:51,date:"2026-08-02",label:"Umpiring credit",amount:20,playerId:11,split:"custom",kind:"umpiring-waiver",units:1,rate:20}],payments:[]}]};
  const rows=teamToWorkspaceRows(team);
  const records=items=>items.map(row=>({team_id:row.teamId,league_id:row.leagueId,record_id:row.recordId,event_date:row.eventDate,payload:row.payload,sort_order:row.sortOrder}));
  const restored=workspaceRowsToTeam({team_id:team.id,name:team.name,sport:team.sport,cricclubs:JSON.stringify(team.cricclubs),version:1,updated_at:"now"},rows.players.map(row=>({team_id:row.teamId,player_id:row.playerId,payload:row.payload,sort_order:row.sortOrder})),rows.leagues.map(row=>({team_id:row.teamId,league_id:row.leagueId,name:row.name,season:row.season,status:row.status,cricclubs:row.cricclubs,sort_order:row.sortOrder})),records(rows.games),records(rows.expenses),records(rows.credits),records(rows.payments));
  assert.deepEqual({...restored,version:undefined},{...team,version:undefined});
});

test("workspace loading completes before registration UI can render", async () => {
  const dashboard = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
  const loadingGuard = dashboard.indexOf('if (saveState === "loading")');
  const registrationGuard = dashboard.indexOf("if (!account.registered)");
  assert.ok(loadingGuard >= 0);
  assert.ok(registrationGuard >= 0);
  assert.ok(loadingGuard < registrationGuard);
  assert.match(dashboard, /Syncing your teams and leagues/);
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
  assert.match(home, /LIMITED EARLY ACCESS/);
  assert.match(css, /\.ledger-filters\+\.table-panel td:nth-child\(1\)::before\{content:"Date"\}/);
  assert.match(css, /\.settlement-filter\+\.table-panel td:nth-child\(1\)::before\{content:"Player"\}/);
  assert.match(css, /\.payment-history>\.table-panel td:nth-child\(1\)::before\{content:"Date"\}/);
  assert.match(css, /min-width:0!important/);
});

test("new team creation is protected by an administrator-approved early-access gate", async () => {
  const [stateApi, accessApi, policy, dashboard, migration] = await Promise.all([
    readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/early-access/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/early-access-policy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0007_overrated_spyke.sql", import.meta.url), "utf8"),
  ]);
  assert.match(stateApi, /Early-access approval is required before creating a team/);
  assert.match(accessApi, /Administrator access required/);
  assert.match(accessApi, /early-access-request:/);
  assert.match(policy, /EARLY_ACCESS_ADMIN_EMAILS/);
  assert.match(dashboard, /INVITE-ONLY EARLY ACCESS/);
  const admin = await readFile(new URL("../app/early-access/early-access-admin.tsx", import.meta.url), "utf8");
  assert.match(admin, /Copy approval message/);
  assert.match(admin, /navigator\.clipboard\.writeText/);
  assert.match(admin, /login\?return_to=\/app/);
  assert.match(migration, /early_access_requests/);
  assert.match(migration, /idx_early_access_status_requested/);
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
  assert.match(stateApi, /Players cannot add expenses\. Ask a treasurer to record it\./);
  assert.match(stateApi, /Members can only edit expenses they submitted/);
  assert.match(stateApi, /Members can only delete expenses they submitted/);
  assert.match(stateApi, /Shared team members cannot create or switch teams/);
  const dashboard = await readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /item\.entry\.submittedBy===memberEmail\.toLowerCase\(\)/);
  assert.match(dashboard, /Select category/);
  assert.match(dashboard, /Select who paid/);
  assert.match(dashboard, /Select sharing method/);
  assert.match(dashboard, /appearanceCategories\.has\(next\)\?"appearances":"custom"/);
  assert.match(dashboard, /const navigationItems:ReadonlyArray<readonly \[View,string,string\]>=isSharedMember/);
  assert.match(dashboard, /\["overview","▦","Home"\],\["games","◉","Games"\],\["expenses","↗","Expenses"\],\["settlement","⇄","My breakdown"\]/);
  assert.match(dashboard, /viewerPlayerId=\{isSharedMember\?memberPlayerId:undefined\}/);
  assert.match(dashboard, /const playerView=!canManage&&viewerPlayerId!==undefined/);
  assert.match(dashboard, /useState<"all"\|"pending">\("all"\)/);
  assert.match(dashboard, /!isSharedMember&&id==="calculator"\?"mobile-secondary-nav"/);
  assert.match(dashboard, /What I should do now/);
  assert.match(dashboard, /My confirmed payments/);
  assert.match(dashboard, /modal==="expense" && league && isTreasurer/);
  assert.match(dashboard, /action=\{canManage\?"Add expense":undefined\}/);
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

test("team users administration is treasurer-only and never exposes access secrets", async () => {
  const [dashboard, teamUsersApi, styles] = await Promise.all([
    readFile(new URL("../app/dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/team-users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /Team users/);
  assert.match(dashboard, /Team owners and co-treasurers can view this page/);
  assert.match(dashboard, /Manage co-treasurers/);
  assert.match(dashboard, /Manage team link/);
  assert.match(teamUsersApi, /Only a team treasurer can view team users/);
  assert.match(teamUsersApi, /requireTreasurer/);
  assert.match(teamUsersApi, /row\.email===owner\?"Owner":"Co-treasurer"/);
  assert.match(teamUsersApi, /target\.role!=="member"/);
  assert.match(teamUsersApi, /team-users-remove-ip:/);
  assert.doesNotMatch(teamUsersApi, /token_hash|pin_hash|access_secret/);
  assert.match(styles, /\.team-users-summary/);
  assert.match(styles, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
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
