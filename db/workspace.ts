import { env } from "cloudflare:workers";
import { cleanOptional, teamToWorkspaceRows, workspaceRowsToTeam, type LeagueRow, type PlayerRow, type TeamRecord, type TeamRow, type WorkspaceRow } from "./workspace-shape";

export async function loadNormalizedTeam(teamId:number):Promise<TeamRecord|null> {
  const team=await env.DB.prepare("SELECT team_id,name,sport,cricclubs,version,updated_at FROM workspace_teams WHERE team_id = ?").bind(teamId).first<TeamRow>();
  if(!team)return null;
  const results=await env.DB.batch([
    env.DB.prepare("SELECT team_id,player_id,payload,sort_order FROM workspace_players WHERE team_id = ? ORDER BY sort_order").bind(teamId),
    env.DB.prepare("SELECT team_id,league_id,name,season,status,cricclubs,sort_order FROM workspace_leagues WHERE team_id = ? ORDER BY sort_order").bind(teamId),
    env.DB.prepare("SELECT team_id,league_id,record_id,event_date,payload,sort_order FROM workspace_games WHERE team_id = ? ORDER BY league_id,sort_order").bind(teamId),
    env.DB.prepare("SELECT team_id,league_id,record_id,event_date,payload,sort_order FROM workspace_expenses WHERE team_id = ? ORDER BY league_id,sort_order").bind(teamId),
    env.DB.prepare("SELECT team_id,league_id,record_id,event_date,payload,sort_order FROM workspace_credits WHERE team_id = ? ORDER BY league_id,sort_order").bind(teamId),
    env.DB.prepare("SELECT team_id,league_id,record_id,event_date,payload,sort_order FROM workspace_payments WHERE team_id = ? ORDER BY league_id,sort_order").bind(teamId),
  ]);
  return workspaceRowsToTeam(team,
    results[0].results as PlayerRow[],results[1].results as LeagueRow[],results[2].results as WorkspaceRow[],
    results[3].results as WorkspaceRow[],results[4].results as WorkspaceRow[],results[5].results as WorkspaceRow[]);
}

export async function saveNormalizedTeam(team:TeamRecord, options:{migration?:boolean}={}):Promise<{version:number}> {
  const existing=await env.DB.prepare("SELECT version FROM workspace_teams WHERE team_id = ?").bind(team.id).first<{version:number}>();
  if(existing&&!options.migration&&team.version!==undefined&&team.version!==existing.version){
    throw new Error("WORKSPACE_VERSION_CONFLICT");
  }
  if(existing&&options.migration)return {version:existing.version};
  const version=existing?existing.version+1:1;
  const rows=teamToWorkspaceRows(team);
  const mutationToken=`${new Date().toISOString()}:${crypto.randomUUID()}`;
  const legacySnapshot=JSON.stringify({...team,version});
  const guard="EXISTS (SELECT 1 FROM workspace_teams WHERE team_id = ? AND updated_at = ?)";
  const claim=existing
    ? env.DB.prepare("UPDATE workspace_teams SET name=?,sport=?,cricclubs=?,version=?,updated_at=? WHERE team_id=? AND version=?")
      .bind(team.name,team.sport,cleanOptional(team.cricclubs),version,mutationToken,team.id,existing.version)
    : env.DB.prepare("INSERT OR IGNORE INTO workspace_teams (team_id,name,sport,cricclubs,version,updated_at) VALUES (?,?,?,?,?,?)")
      .bind(team.id,team.name,team.sport,cleanOptional(team.cricclubs),version,mutationToken);
  const statements=[
    claim,
    env.DB.prepare(`DELETE FROM workspace_payments WHERE team_id = ? AND ${guard}`).bind(team.id,team.id,mutationToken),
    env.DB.prepare(`DELETE FROM workspace_credits WHERE team_id = ? AND ${guard}`).bind(team.id,team.id,mutationToken),
    env.DB.prepare(`DELETE FROM workspace_expenses WHERE team_id = ? AND ${guard}`).bind(team.id,team.id,mutationToken),
    env.DB.prepare(`DELETE FROM workspace_games WHERE team_id = ? AND ${guard}`).bind(team.id,team.id,mutationToken),
    env.DB.prepare(`DELETE FROM workspace_leagues WHERE team_id = ? AND ${guard}`).bind(team.id,team.id,mutationToken),
    env.DB.prepare(`DELETE FROM workspace_players WHERE team_id = ? AND ${guard}`).bind(team.id,team.id,mutationToken),
    ...rows.players.map(row=>env.DB.prepare(`INSERT INTO workspace_players (team_id,player_id,payload,sort_order) SELECT ?,?,?,? WHERE ${guard}`).bind(row.teamId,row.playerId,row.payload,row.sortOrder,team.id,mutationToken)),
    ...rows.leagues.map(row=>env.DB.prepare(`INSERT INTO workspace_leagues (team_id,league_id,name,season,status,cricclubs,sort_order) SELECT ?,?,?,?,?,?,? WHERE ${guard}`).bind(row.teamId,row.leagueId,row.name,row.season,row.status,row.cricclubs,row.sortOrder,team.id,mutationToken)),
    ...rows.games.map(row=>env.DB.prepare(`INSERT INTO workspace_games (team_id,league_id,record_id,event_date,payload,sort_order) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(row.teamId,row.leagueId,row.recordId,row.eventDate,row.payload,row.sortOrder,team.id,mutationToken)),
    ...rows.expenses.map(row=>env.DB.prepare(`INSERT INTO workspace_expenses (team_id,league_id,record_id,event_date,payload,sort_order) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(row.teamId,row.leagueId,row.recordId,row.eventDate,row.payload,row.sortOrder,team.id,mutationToken)),
    ...rows.credits.map(row=>env.DB.prepare(`INSERT INTO workspace_credits (team_id,league_id,record_id,event_date,payload,sort_order) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(row.teamId,row.leagueId,row.recordId,row.eventDate,row.payload,row.sortOrder,team.id,mutationToken)),
    ...rows.payments.map(row=>env.DB.prepare(`INSERT INTO workspace_payments (team_id,league_id,record_id,event_date,payload,sort_order) SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(row.teamId,row.leagueId,row.recordId,row.eventDate,row.payload,row.sortOrder,team.id,mutationToken)),
    env.DB.prepare(`INSERT INTO shared_teams (team_id,payload,updated_at) SELECT ?,?,? WHERE ${guard}
      ON CONFLICT(team_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`)
      .bind(team.id,legacySnapshot,mutationToken,team.id,mutationToken),
  ];
  const results=await env.DB.batch(statements);
  if((results[0].meta?.changes??0)!==1)throw new Error("WORKSPACE_VERSION_CONFLICT");
  return {version};
}

export async function loadOrMigrateTeam(teamId:number,legacyPayload?:string):Promise<TeamRecord|null>{
  const current=await loadNormalizedTeam(teamId);
  if(current)return current;
  const payload=legacyPayload??(await env.DB.prepare("SELECT payload FROM shared_teams WHERE team_id = ?").bind(teamId).first<{payload:string}>())?.payload;
  if(!payload)return null;
  const legacy=JSON.parse(payload) as TeamRecord;
  await saveNormalizedTeam(legacy,{migration:true});
  return loadNormalizedTeam(teamId);
}

export async function deleteNormalizedTeam(teamId:number){
  await env.DB.batch([
    env.DB.prepare("DELETE FROM workspace_payments WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM workspace_credits WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM workspace_expenses WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM workspace_games WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM workspace_leagues WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM workspace_players WHERE team_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM workspace_teams WHERE team_id = ?").bind(teamId),
  ]);
}
