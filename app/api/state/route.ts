import { env } from "cloudflare:workers";
import { getGoogleUser } from "../../google-auth";
import { loadNormalizedTeam, loadOrMigrateTeam, saveNormalizedTeam } from "../../../db/workspace";
import { isSameOrigin } from "../security";
import { earlyAccessStatus, isEarlyAccessAdmin } from "../../early-access-policy";

const MAX_PAYLOAD_BYTES = 256_000;
const READS_PER_MINUTE = 120;
const WRITES_PER_MINUTE = 40;

async function ensureTables() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_states (
      team_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS api_rate_limits (
      rate_key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      request_count INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS shared_teams (
      team_id INTEGER PRIMARY KEY,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_memberships (
      team_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('treasurer','member')),
      player_id INTEGER,
      joined_at TEXT NOT NULL,
      PRIMARY KEY(team_id, email)
    )`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS team_memberships_email_idx ON team_memberships(email)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS team_invites (
      token_hash TEXT PRIMARY KEY,
      team_id INTEGER NOT NULL,
      player_id INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_by TEXT,
      accepted_at TEXT
    )`),
  ]);
  try { await env.DB.prepare("ALTER TABLE team_invites ADD COLUMN invite_role TEXT NOT NULL DEFAULT 'member'").run(); } catch {}
}

async function enforceRateLimit(identity: string, action: "read" | "write") {
  const windowStart = Math.floor(Date.now() / 60_000);
  const limit = action === "write" ? WRITES_PER_MINUTE : READS_PER_MINUTE;
  const row = await env.DB.prepare(`INSERT INTO api_rate_limits (rate_key, window_start, request_count)
    VALUES (?, ?, 1)
    ON CONFLICT(rate_key) DO UPDATE SET
      request_count = CASE WHEN window_start = excluded.window_start THEN request_count + 1 ELSE 1 END,
      window_start = excluded.window_start
    RETURNING request_count`).bind(`${identity}:${action}`, windowStart).first<{ request_count: number }>();
  return { allowed: (row?.request_count ?? limit + 1) <= limit, limit };
}

export function isValidState(value: unknown): boolean {
  const text = (candidate: unknown, max: number, required = true) =>
    typeof candidate === "string" && candidate.length <= max && (!required || candidate.trim().length > 0);
  const id = (candidate: unknown) => typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate > 0;
  if (!value || typeof value !== "object") return false;
  const state = value as { registered?: unknown; name?: unknown; teams?: unknown };
  if (typeof state.registered !== "boolean" || !text(state.name, 160, state.registered) || !Array.isArray(state.teams)) return false;
  if (state.teams.length > 50) return false;
  return state.teams.every((team: unknown) => {
    if (!team || typeof team !== "object") return false;
    const item = team as { id?: unknown; name?: unknown; sport?: unknown; version?: unknown; players?: unknown[]; leagues?: unknown[]; cricclubs?: unknown };
    if (!id(item.id) || !text(item.name, 160) || !text(item.sport, 80) || !Array.isArray(item.players) || !Array.isArray(item.leagues)) return false;
    if (item.version !== undefined && (!Number.isSafeInteger(item.version) || Number(item.version)<1)) return false;
    if (item.cricclubs !== undefined) {
      if (!item.cricclubs || typeof item.cricclubs !== "object") return false;
      const connection = item.cricclubs as { shortCode?: unknown; teamName?: unknown };
      if (!text(connection.shortCode, 30) || !/^[A-Za-z0-9_-]+$/.test(String(connection.shortCode)) || !text(connection.teamName, 160)) return false;
    }
    if (item.players.length > 500 || item.leagues.length > 100) return false;
    const playerIds = new Set<number>();
    if (!item.players.every(player => {
      if (!player || typeof player !== "object") return false;
      const record = player as { id?: unknown; name?: unknown; initials?: unknown; email?: unknown; phone?: unknown; color?: unknown };
      if (!id(record.id) || playerIds.has(record.id as number) || !text(record.name, 160) || !text(record.initials, 8) || !text(record.color, 40)) return false;
      if (record.email !== undefined && !text(record.email, 254, false)) return false;
      if (record.phone !== undefined && !text(record.phone, 40, false)) return false;
      playerIds.add(record.id as number); return true;
    })) return false;
    const leagueIds = new Set<number>();
    return item.leagues.every((league: unknown) => {
      if (!league || typeof league !== "object") return false;
      const record = league as { id?: unknown; name?: unknown; season?: unknown; status?: unknown; games?: unknown[]; expenses?: unknown[]; credits?: unknown[]; payments?: unknown[]; cricclubs?: unknown };
      if (!id(record.id) || leagueIds.has(record.id as number) || !text(record.name, 160) || !text(record.season, 40) ||
          !["Active","Completed"].includes(String(record.status)) || !Array.isArray(record.games) || record.games.length > 1_000 ||
          !Array.isArray(record.expenses) || record.expenses.length > 10_000 ||
          (record.credits !== undefined && (!Array.isArray(record.credits) || record.credits.length > 10_000)) ||
          (record.payments !== undefined && (!Array.isArray(record.payments) || record.payments.length > 10_000))) return false;
      if (record.cricclubs !== undefined) {
        if (!record.cricclubs || typeof record.cricclubs !== "object") return false;
        const connection = record.cricclubs as { seriesId?: unknown; seriesName?: unknown; teamId?: unknown };
        if (!text(connection.seriesId, 80) || !/^[A-Za-z0-9_-]+$/.test(String(connection.seriesId)) ||
            !text(connection.teamId, 80) || !/^[A-Za-z0-9_-]+$/.test(String(connection.teamId)) ||
            !text(connection.seriesName, 160)) return false;
      }
      leagueIds.add(record.id as number);
      const gameIds = new Set<number>();
      if (!record.games.every(game => {
        if (!game || typeof game !== "object") return false;
        const fixture = game as { id?: unknown; date?: unknown; opponent?: unknown; venue?: unknown; players?: unknown[]; excludedFromSplit?: unknown[]; status?: unknown; source?: unknown; externalId?: unknown; sourceUrl?: unknown };
        if (!id(fixture.id) || gameIds.has(fixture.id as number) || !text(fixture.date, 10, false) || (fixture.date !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(String(fixture.date))) ||
            !text(fixture.opponent, 160) || !text(fixture.venue, 240, false) || !Array.isArray(fixture.players) ||
            fixture.players.length > 12 || !["Upcoming","Completed"].includes(String(fixture.status))) return false;
        if (fixture.source !== undefined && fixture.source !== "cricclubs") return false;
        if (fixture.source === "cricclubs" && (!text(fixture.externalId, 80) || !text(fixture.sourceUrl, 1_000) ||
            !String(fixture.sourceUrl).startsWith("https://www.cricclubs.com/"))) return false;
        if (fixture.source === undefined && (fixture.externalId !== undefined || fixture.sourceUrl !== undefined)) return false;
        if (new Set(fixture.players).size !== fixture.players.length || !fixture.players.every(playerId => id(playerId) && playerIds.has(playerId as number))) return false;
        if (fixture.excludedFromSplit !== undefined && (!Array.isArray(fixture.excludedFromSplit) ||
            new Set(fixture.excludedFromSplit).size !== fixture.excludedFromSplit.length ||
            !fixture.excludedFromSplit.every(playerId => id(playerId) && fixture.players?.includes(playerId)) ||
            fixture.excludedFromSplit.length >= fixture.players.length)) return false;
        gameIds.add(fixture.id as number); return true;
      })) return false;
      const expenseIds = new Set<number>();
      if (!record.expenses.every(expense => {
        if (!expense || typeof expense !== "object") return false;
        const payment = expense as { id?: unknown; date?: unknown; label?: unknown; category?: unknown; amount?: unknown; paidBy?: unknown; gameId?: unknown; split?: unknown; participants?: unknown[]; submittedBy?: unknown };
        if (!id(payment.id) || expenseIds.has(payment.id as number) || !text(payment.date, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(String(payment.date)) ||
            !text(payment.label, 240) || !text(payment.category, 80) || typeof payment.amount !== "number" || !Number.isFinite(payment.amount) ||
            payment.amount <= 0 || payment.amount > 100_000_000 || typeof payment.paidBy !== "number" || !Number.isSafeInteger(payment.paidBy) || payment.paidBy < 0 ||
            !["players","team","custom","appearances"].includes(String(payment.split))) return false;
        if (payment.submittedBy !== undefined && !text(payment.submittedBy, 254)) return false;
        if (payment.split === "players" && (!id(payment.gameId) || !gameIds.has(payment.gameId as number))) return false;
        if (payment.split === "custom" && (!Array.isArray(payment.participants) || payment.participants.length === 0)) return false;
        if (payment.participants !== undefined && (!Array.isArray(payment.participants) || payment.participants.length === 0 ||
            new Set(payment.participants).size !== payment.participants.length ||
            !payment.participants.every(playerId => id(playerId) && playerIds.has(playerId as number)))) return false;
        expenseIds.add(payment.id as number); return true;
      })) return false;
      const creditIds = new Set<number>();
      if (!(record.credits??[]).every(credit => {
        if (!credit || typeof credit !== "object") return false;
        const entry = credit as { id?: unknown; date?: unknown; label?: unknown; amount?: unknown; playerId?: unknown; gameId?: unknown; split?: unknown; participants?: unknown[]; kind?: unknown; units?: unknown; rate?: unknown };
        if (!id(entry.id) || creditIds.has(entry.id as number) || !text(entry.date,10) || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date)) ||
            !text(entry.label,240) || typeof entry.amount !== "number" || !Number.isFinite(entry.amount) || entry.amount <= 0 || entry.amount > 100_000_000 ||
            !id(entry.playerId) || !playerIds.has(entry.playerId as number) || !["players","team","custom"].includes(String(entry.split))) return false;
        if (entry.kind === "umpiring-waiver") {
          if (entry.split !== "custom" || entry.gameId !== undefined || entry.participants !== undefined ||
              typeof entry.units !== "number" || !Number.isSafeInteger(entry.units) || entry.units <= 0 || entry.units > 1_000 ||
              typeof entry.rate !== "number" || !Number.isFinite(entry.rate) || entry.rate <= 0 || entry.rate > 100_000_000 ||
              Math.abs(entry.amount - entry.units * entry.rate) > .005) return false;
          creditIds.add(entry.id as number); return true;
        }
        if (entry.kind !== undefined || !Array.isArray(entry.participants) || entry.participants.length === 0 ||
            new Set(entry.participants).size !== entry.participants.length ||
            !entry.participants.every(playerId => id(playerId) && playerIds.has(playerId as number))) return false;
        if (entry.split === "players" && (!id(entry.gameId) || !gameIds.has(entry.gameId as number))) return false;
        creditIds.add(entry.id as number); return true;
      })) return false;
      const paymentIds = new Set<number>();
      return (record.payments??[]).every(payment => {
        if (!payment || typeof payment !== "object") return false;
        const entry = payment as { id?: unknown; date?: unknown; fromPlayerId?: unknown; toPlayerId?: unknown; amount?: unknown; note?: unknown; recordedBy?: unknown; status?: unknown; confirmedBy?: unknown; confirmedAt?: unknown };
        if (!id(entry.id) || paymentIds.has(entry.id as number) || !text(entry.date,10) || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date)) ||
            !id(entry.fromPlayerId) || !playerIds.has(entry.fromPlayerId as number) || !id(entry.toPlayerId) || !playerIds.has(entry.toPlayerId as number) ||
            entry.fromPlayerId===entry.toPlayerId || typeof entry.amount!=="number" || !Number.isFinite(entry.amount) || entry.amount<=0 || entry.amount>100_000_000) return false;
        if (entry.note!==undefined && !text(entry.note,240,false)) return false;
        if (entry.recordedBy!==undefined && !text(entry.recordedBy,254)) return false;
        if (entry.status!==undefined && !["pending","confirmed"].includes(String(entry.status))) return false;
        if (entry.confirmedBy!==undefined && !text(entry.confirmedBy,254)) return false;
        if (entry.confirmedAt!==undefined && (!text(entry.confirmedAt,40)||Number.isNaN(Date.parse(String(entry.confirmedAt))))) return false;
        if (entry.status==="pending"&&(entry.confirmedBy!==undefined||entry.confirmedAt!==undefined)) return false;
        paymentIds.add(entry.id as number); return true;
      });
    });
  });
}

export async function GET() {
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  await ensureTables();
  const rate = await enforceRateLimit(user.email.toLowerCase(), "read");
  if (!rate.allowed) return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });
  const email = user.email.toLowerCase();
  const row = await env.DB.prepare("SELECT payload FROM app_states WHERE team_key = ?")
    .bind(user.email.toLowerCase()).first<{ payload: string }>();
  const legacy = row ? JSON.parse(row.payload) as { registered?: boolean; name?: string; teams?: Array<Record<string, unknown>> } : {};
  if (Array.isArray(legacy.teams) && legacy.teams.length) {
    const now = new Date().toISOString();
    for (const team of legacy.teams) {
      const teamId = Number(team.id);
      if (!Number.isSafeInteger(teamId)) continue;
      const clean = { ...team }; delete clean.access;
      await env.DB.batch([
        env.DB.prepare("INSERT OR IGNORE INTO shared_teams (team_id, payload, updated_at) VALUES (?, ?, ?)").bind(teamId, JSON.stringify(clean), now),
        env.DB.prepare("INSERT OR IGNORE INTO team_memberships (team_id, email, role, player_id, joined_at) VALUES (?, ?, 'treasurer', NULL, ?)").bind(teamId, email, now),
      ]);
    }
  }
  const memberships = await env.DB.prepare(`SELECT m.team_id, m.role, m.player_id, t.payload,
      CASE WHEN m.email = (
        SELECT owner.email FROM team_memberships owner
        WHERE owner.team_id = m.team_id AND owner.role = 'treasurer'
        ORDER BY owner.joined_at, owner.email LIMIT 1
      ) THEN 1 ELSE 0 END AS is_owner
    FROM team_memberships m JOIN shared_teams t ON t.team_id = m.team_id
    WHERE m.email = ? ORDER BY m.joined_at`).bind(email).all<{ team_id: number; role: "treasurer"|"member"; player_id: number|null; payload: string; is_owner:number }>();
  const teams = await Promise.all(memberships.results.map(async entry => {
    const team=await loadOrMigrateTeam(entry.team_id,entry.payload);
    return team ? { ...team, access: { role: entry.role, playerId: entry.player_id, isOwner: entry.is_owner===1 } } : null;
  }));
  const availableTeams=teams.filter((team):team is NonNullable<typeof team>=>Boolean(team));
  const registered=Boolean(legacy.registered)||availableTeams.length>0;
  const accessStatus=registered?"approved":await earlyAccessStatus(email);
  return Response.json({ registered, name: legacy.name||user.name, teams:availableTeams, earlyAccess:{status:accessStatus,isAdmin:isEarlyAccessAdmin(email)} }, { headers: { "X-RateLimit-Limit": String(rate.limit) } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const user = await getGoogleUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_PAYLOAD_BYTES) return Response.json({ error: "Workspace data is too large" }, { status: 413 });
  await ensureTables();
  const rate = await enforceRateLimit(user.email.toLowerCase(), "write");
  if (!rate.allowed) return Response.json({ error: "Too many updates. Try again shortly." }, { status: 429, headers: { "Retry-After": "60" } });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) return Response.json({ error: "Workspace data is too large" }, { status: 413 });
  let state: unknown;
  try { state = JSON.parse(raw); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!isValidState(state)) return Response.json({ error: "Invalid workspace data" }, { status: 400 });
  const account = state as { registered: boolean; name: string; teams: Array<Record<string, unknown>> };
  const email = user.email.toLowerCase();
  const now = new Date().toISOString();
  const versions:Record<number,number>={};
  const priorState=await env.DB.prepare("SELECT payload FROM app_states WHERE team_key = ?").bind(email).first<{payload:string}>();
  const wasRegistered=priorState?Boolean((JSON.parse(priorState.payload) as {registered?:boolean}).registered):false;
  const priorMembership=await env.DB.prepare("SELECT 1 AS found FROM team_memberships WHERE email = ? LIMIT 1").bind(email).first();
  const canCreateTeam=wasRegistered||Boolean(priorMembership)||await earlyAccessStatus(email)==="approved";
  if(user.provider==="team"&&(account.teams.length!==1||Number(account.teams[0]?.id)!==user.teamId))return Response.json({ error: "Shared team members cannot create or switch teams" }, { status: 403 });
  await env.DB.prepare(`INSERT INTO app_states (team_key, payload, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(team_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
    .bind(email, JSON.stringify({ registered: account.registered, name: account.name, teams: [] }), now).run();
  for (const incoming of account.teams) {
    const teamId = Number(incoming.id);
    const clean = { ...incoming }; delete clean.access;
    const existingLegacy = await env.DB.prepare("SELECT payload FROM shared_teams WHERE team_id = ?").bind(teamId).first<{ payload: string }>();
    const existingTeam = await loadNormalizedTeam(teamId)??(existingLegacy?await loadOrMigrateTeam(teamId,existingLegacy.payload):null);
    const membership = await env.DB.prepare("SELECT role, player_id FROM team_memberships WHERE team_id = ? AND email = ?")
      .bind(teamId, email).first<{ role: "treasurer"|"member"; player_id: number|null }>();
    if (!existingTeam) {
      if(user.provider==="team")return Response.json({ error: "Shared team members cannot create teams" }, { status: 403 });
      if(!canCreateTeam)return Response.json({error:"Early-access approval is required before creating a team"},{status:403});
      const saved=await saveNormalizedTeam(clean as Parameters<typeof saveNormalizedTeam>[0]);
      clean.version=saved.version;versions[teamId]=saved.version;
      await env.DB.prepare("INSERT INTO team_memberships (team_id, email, role, player_id, joined_at) VALUES (?, ?, 'treasurer', NULL, ?)").bind(teamId, email, now).run();
      continue;
    }
    if (!membership) return Response.json({ error: "You do not have access to this team" }, { status: 403 });
    if (membership.role === "treasurer") {
      let saved;
      try { saved=await saveNormalizedTeam(clean as Parameters<typeof saveNormalizedTeam>[0]); }
      catch(error){if((error as Error).message==="WORKSPACE_VERSION_CONFLICT")return Response.json({error:"This team changed in another session. Reload before saving again."},{status:409});throw error}
      clean.version=saved.version;versions[teamId]=saved.version;
      continue;
    }
    const current = existingTeam as Record<string, unknown>;
    const oldLeagues = (current.leagues as Array<Record<string, unknown>>)??[];
    const newLeagues = (clean.leagues as Array<Record<string, unknown>>)??[];
    const teamShape = (team: Record<string, unknown>) => JSON.stringify({ id: team.id, name: team.name, sport: team.sport, players: team.players, cricclubs: team.cricclubs });
    const leagueShape = (league: Record<string, unknown>) => JSON.stringify({ id: league.id, name: league.name, season: league.season, status: league.status, games: league.games, credits: league.credits??[], cricclubs: league.cricclubs });
    if (teamShape(current)!==teamShape(clean)||oldLeagues.length!==newLeagues.length) return Response.json({ error: "Members cannot change team setup" }, { status: 403 });
    for (const oldLeague of oldLeagues) {
      const nextLeague = newLeagues.find(item=>item.id===oldLeague.id);
      if (!nextLeague||leagueShape(oldLeague)!==leagueShape(nextLeague)) return Response.json({ error: "Members cannot change leagues or games" }, { status: 403 });
      const oldExpenses=(oldLeague.expenses as Array<Record<string,unknown>>)??[];
      const nextExpenses=(nextLeague.expenses as Array<Record<string,unknown>>)??[];
      const oldById=new Map(oldExpenses.map(entry=>[entry.id,entry]));
      const removed=oldExpenses.filter(old=>!nextExpenses.some(next=>next.id===old.id));
      if(removed.some(entry=>entry.submittedBy!==email))return Response.json({ error: "Members can only delete expenses they submitted" }, { status: 403 });
      for(const entry of nextExpenses){
        const old=oldById.get(entry.id);
        if(!old)return Response.json({ error: "Players cannot add expenses. Ask a treasurer to record it." }, { status: 403 });
        if(JSON.stringify(entry)!==JSON.stringify(old)){
          if(old.submittedBy!==email)return Response.json({ error: "Members can only edit expenses they submitted" }, { status: 403 });
          if(entry.paidBy!==membership.player_id)return Response.json({ error: "Members can only edit expenses they paid" }, { status: 403 });
        }
      }
      oldLeague.expenses=nextExpenses.map(entry=>{const old=oldById.get(entry.id);return old&&JSON.stringify(entry)===JSON.stringify(old)?old:{...entry,submittedBy:email}});
      const oldPayments=(oldLeague.payments as Array<Record<string,unknown>>)??[];
      const nextPayments=(nextLeague.payments as Array<Record<string,unknown>>)??[];
      const oldPaymentsById=new Map(oldPayments.map(entry=>[entry.id,entry]));
      if(oldPayments.some(old=>!nextPayments.some(next=>next.id===old.id)))return Response.json({error:"Players cannot remove payment records"},{status:403});
      for(const entry of nextPayments){
        const old=oldPaymentsById.get(entry.id);
        if(old&&JSON.stringify(entry)!==JSON.stringify(old))return Response.json({error:"Players cannot change submitted payments"},{status:403});
        if(!old&&(entry.status!=="pending"||entry.fromPlayerId!==membership.player_id))return Response.json({error:"Players can submit only their own outgoing payments"},{status:403});
      }
      oldLeague.payments=nextPayments.map(entry=>oldPaymentsById.get(entry.id)??{...entry,status:"pending",recordedBy:email});
    }
    let saved;
    try { saved=await saveNormalizedTeam(current as Parameters<typeof saveNormalizedTeam>[0]); }
    catch(error){if((error as Error).message==="WORKSPACE_VERSION_CONFLICT")return Response.json({error:"This team changed in another session. Reload before saving again."},{status:409});throw error}
    current.version=saved.version;versions[teamId]=saved.version;
  }
  return Response.json({ ok: true, versions }, { headers: { "X-RateLimit-Limit": String(rate.limit) } });
}
