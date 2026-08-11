export type JsonRecord = Record<string, unknown>;
export type TeamRecord = JsonRecord & {
  id:number;name:string;sport:string;version?:number;players:JsonRecord[];
  leagues:Array<JsonRecord&{id:number;name:string;season:string;status:string;games:JsonRecord[];expenses:JsonRecord[];credits?:JsonRecord[];payments?:JsonRecord[]}>;
};
export type WorkspaceRow = {team_id:number;league_id:number;record_id:number;event_date:string;payload:string;sort_order:number};
export type PlayerRow = {team_id:number;player_id:number;payload:string;sort_order:number};
export type LeagueRow = {team_id:number;league_id:number;name:string;season:string;status:string;cricclubs:string|null;sort_order:number};
export type TeamRow = {team_id:number;name:string;sport:string;cricclubs:string|null;version:number;updated_at:string};

const parseOptional=(value:string|null)=>value?JSON.parse(value):undefined;
export const cleanOptional=(value:unknown)=>value===undefined?null:JSON.stringify(value);
const recordDate=(record:JsonRecord)=>typeof record.date==="string"?record.date:"";

export function teamToWorkspaceRows(team:TeamRecord){
  const players=team.players.map((player,sortOrder)=>({teamId:team.id,playerId:Number(player.id),payload:JSON.stringify(player),sortOrder}));
  const leagues=team.leagues.map((league,sortOrder)=>({teamId:team.id,leagueId:league.id,name:league.name,season:league.season,status:league.status,cricclubs:cleanOptional(league.cricclubs),sortOrder}));
  const records=(key:"games"|"expenses"|"credits"|"payments")=>team.leagues.flatMap(league=>((league[key]??[]) as JsonRecord[]).map((record,sortOrder)=>({teamId:team.id,leagueId:league.id,recordId:Number(record.id),eventDate:recordDate(record),payload:JSON.stringify(record),sortOrder})));
  return {players,leagues,games:records("games"),expenses:records("expenses"),credits:records("credits"),payments:records("payments")};
}

export function workspaceRowsToTeam(team:TeamRow,players:PlayerRow[],leagues:LeagueRow[],games:WorkspaceRow[],expenses:WorkspaceRow[],credits:WorkspaceRow[],payments:WorkspaceRow[]):TeamRecord{
  const byLeague=(rows:WorkspaceRow[],leagueId:number)=>rows.filter(row=>row.league_id===leagueId).sort((a,b)=>a.sort_order-b.sort_order).map(row=>JSON.parse(row.payload) as JsonRecord);
  return {id:team.team_id,name:team.name,sport:team.sport,...(team.cricclubs?{cricclubs:parseOptional(team.cricclubs)}:{}),version:team.version,
    players:[...players].sort((a,b)=>a.sort_order-b.sort_order).map(row=>JSON.parse(row.payload) as JsonRecord),
    leagues:[...leagues].sort((a,b)=>a.sort_order-b.sort_order).map(league=>({id:league.league_id,name:league.name,season:league.season,status:league.status,...(league.cricclubs?{cricclubs:parseOptional(league.cricclubs)}:{}),games:byLeague(games,league.league_id),expenses:byLeague(expenses,league.league_id),credits:byLeague(credits,league.league_id),payments:byLeague(payments,league.league_id)}))};
}
