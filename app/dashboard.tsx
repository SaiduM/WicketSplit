"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Player = { id: number; name: string; initials: string; email?: string; color: string };
type Game = { id: number; date: string; opponent: string; venue: string; players: number[]; status: "Upcoming" | "Completed" };
type Expense = { id: number; date: string; label: string; category: string; amount: number; paidBy: number; gameId?: number; split: "players" | "team" };
type League = { id: number; name: string; season: string; status: "Active" | "Completed"; games: Game[]; expenses: Expense[] };
type Team = { id: number; name: string; sport: string; players: Player[]; leagues: League[] };
type Account = { registered: boolean; name: string; teams: Team[] };
type View = "overview" | "roster" | "games" | "expenses" | "settlement" | "leagues";

const colors = ["#d9f99d","#bfdbfe","#fed7aa","#ddd6fe","#fecdd3","#bae6fd","#fde68a","#bbf7d0","#e9d5ff","#c7d2fe","#fbcfe8","#a7f3d0"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const emptyAccount = (name: string): Account => ({ registered: false, name, teams: [] });
const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();

export default function Dashboard({ user }: { user: { name: string; email: string } }) {
  const [account, setAccount] = useState<Account>(() => emptyAccount(user.name));
  const [teamId, setTeamId] = useState<number | null>(null);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [view, setView] = useState<View>("overview");
  const [modal, setModal] = useState<null | "team" | "league" | "player" | "game" | "expense">(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [teamMenu, setTeamMenu] = useState(false);
  const [toast, setToast] = useState("");
  const loaded = useRef(false);

  useEffect(() => {
    fetch("/api/state").then(r => r.ok ? r.json() : null).then(data => {
      const next = data?.registered ? data as Account : emptyAccount(user.name);
      setAccount(next);
      setTeamId(next.teams[0]?.id ?? null);
      setLeagueId(next.teams[0]?.leagues[0]?.id ?? null);
      loaded.current = true;
    }).catch(() => { loaded.current = true; });
  }, [user.name]);

  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => fetch("/api/state", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(account),
    }).catch(() => undefined), 300);
    return () => clearTimeout(timer);
  }, [account]);

  const team = account.teams.find(t => t.id === teamId) ?? account.teams[0];
  const league = team?.leagues.find(l => l.id === leagueId) ?? team?.leagues[0];
  const players = team?.players ?? [];
  const games = league?.games ?? [];
  const expenses = league?.expenses ?? [];
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2200); };

  const updateTeam = (updater: (team: Team) => Team) => {
    if (!team) return;
    setAccount(a => ({ ...a, teams: a.teams.map(t => t.id === team.id ? updater(t) : t) }));
  };
  const updateLeague = (updater: (league: League) => League) => updateTeam(t => ({
    ...t, leagues: t.leagues.map(l => l.id === league?.id ? updater(l) : l),
  }));

  const balances = useMemo(() => players.map(player => {
    const paid = expenses.filter(e => e.paidBy === player.id).reduce((s,e) => s + e.amount, 0);
    const share = expenses.reduce((sum,e) => {
      if (e.split === "team") return sum + (players.length ? e.amount / players.length : 0);
      const game = games.find(g => g.id === e.gameId);
      return game?.players.includes(player.id) ? sum + e.amount / game.players.length : sum;
    }, 0);
    return { ...player, paid, share, balance: paid - share };
  }), [players, games, expenses]);

  if (!account.registered) {
    return <Registration user={user} onRegister={(name, teamName, leagueName) => {
      const id = Date.now(); const firstLeagueId = id + 1;
      const next: Account = { registered: true, name, teams: [{
        id, name: teamName, sport: "Cricket", players: [], leagues: [{
          id: firstLeagueId, name: leagueName, season: new Date().getFullYear().toString(),
          status: "Active", games: [], expenses: [],
        }],
      }] };
      setAccount(next); setTeamId(id); setLeagueId(firstLeagueId); notify("Your team workspace is ready");
    }} />;
  }

  function selectTeam(id: number) {
    const selected = account.teams.find(t => t.id === id)!;
    setTeamId(id); setLeagueId(selected.leagues[0]?.id ?? null); setView("overview"); setTeamMenu(false);
  }

  function exportCsv() {
    if (!team || !league) return;
    const rows = [["Team",team.name],["League",league.name],[],["Player","Games Played","Amount Paid","Fair Share","Balance"],
      ...balances.map(b => [b.name,games.filter(g=>g.players.includes(b.id)).length,b.paid.toFixed(2),b.share.toFixed(2),b.balance.toFixed(2)])];
    const csv = rows.map(r => r.map(c => `"${String(c).replaceAll('"','""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    link.download = `${team.name}-${league.name}-settlement.csv`.replaceAll(" ","-").toLowerCase(); link.click();
    URL.revokeObjectURL(link.href); notify("Settlement CSV downloaded");
  }

  const total = expenses.reduce((s,e)=>s+e.amount,0);
  const outstanding = balances.filter(b=>b.balance<0).reduce((s,b)=>s+Math.abs(b.balance),0);

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">W</span><span>WicketSplit</span></div>
      <div className="team-switch-wrap">
        <button className="team-card team-switch" onClick={()=>setTeamMenu(!teamMenu)}>
          <div><span className="eyebrow">CURRENT TEAM</span><strong>{team?.name ?? "Choose team"}</strong></div><span>⌄</span>
        </button>
        {teamMenu && <div className="team-menu">
          {account.teams.map(t=><button className={t.id===team?.id?"selected":""} key={t.id} onClick={()=>selectTeam(t.id)}><span>{initials(t.name)}</span><div><strong>{t.name}</strong><small>{t.players.length} players · {t.leagues.length} leagues</small></div>{t.id===team?.id&&<i>✓</i>}</button>)}
          <button className="add-team-link" onClick={()=>{setModal("team");setTeamMenu(false)}}>＋ Register another team</button>
        </div>}
      </div>
      <nav aria-label="Main navigation">
        {([["overview","▦","Overview"],["roster","♙","Team roster"],["leagues","▤","Leagues"],["games","◉","Games"],["expenses","↗","Expenses"],["settlement","⇄","Settlement"]] as const).map(([id,icon,label])=>
          <button key={id} className={view===id?"active":""} onClick={()=>setView(id)}><span>{icon}</span>{label}</button>)}
      </nav>
      <div className="side-bottom">
        <button><span>⚙</span>Settings</button>
        <div className="profile"><div className="avatar dark">{initials(account.name)}</div><div><strong>{account.name}</strong><small>{user.email}</small></div><span>•••</span></div>
      </div>
    </aside>

    <section className="workspace">
      <header>
        <div>
          <div className="league-picker">
            <span className="season-pill"><i /> {league ? `${league.name} · ${league.season}` : "NO LEAGUE SELECTED"}</span>
            {team && team.leagues.length>1 && <select aria-label="Current league" value={league?.id ?? ""} onChange={e=>{setLeagueId(Number(e.target.value));setView("overview")}}>{team.leagues.map(l=><option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}</select>}
          </div>
          <h1>{view==="overview"?`Welcome back, ${account.name.split(" ")[0]}.`:title(view)}</h1>
          <p>{team?.name}{league ? ` · ${league.name}` : " · Create a league to begin"}</p>
        </div>
        <div className="header-actions">
          {view==="roster" && <button className="primary" onClick={()=>setModal("player")}>＋ Add player</button>}
          {view==="leagues" && <button className="primary" onClick={()=>setModal("league")}>＋ Create league</button>}
          {["overview","expenses"].includes(view) && league && players.length>0 && <button className="primary" onClick={()=>setModal("expense")}>＋ Add expense</button>}
        </div>
      </header>

      {!team ? <EmptyState icon="♙" title="Register your first team" text="Create a team workspace, add its roster, then organize expenses by league." action="Register team" onAction={()=>setModal("team")}/> :
       !league && view!=="roster" && view!=="leagues" ? <EmptyState icon="▤" title="Create your first league" text="A team can have as many leagues and seasons as you need." action="Create league" onAction={()=>setModal("league")}/> : <>
        {view==="overview" && league && <Overview total={total} outstanding={outstanding} players={players} games={games} expenses={expenses} balances={balances} setView={setView} onPlayer={()=>setModal("player")} onGame={()=>setModal("game")} onExpense={()=>setModal("expense")}/>}
        {view==="roster" && <RosterView team={team} onAdd={()=>setModal("player")} onEdit={setEditingPlayer}/>}
        {view==="leagues" && <LeaguesView team={team} activeId={league?.id} onSelect={id=>{setLeagueId(id);setView("overview")}} onAdd={()=>setModal("league")} onEdit={setEditingLeague}/>}
        {view==="games" && league && <GamesView games={games} players={players} onAdd={()=>setModal("game")} onChange={next=>updateLeague(l=>({...l,games:next}))} notify={notify}/>}
        {view==="expenses" && league && <ExpensesView expenses={expenses} players={players} games={games} onAdd={()=>setModal("expense")}/>}
        {view==="settlement" && league && <SettlementView balances={balances} games={games} exportCsv={exportCsv}/>}
      </>}
    </section>

    {modal==="team" && <NameModal eyebrow="NEW TEAM" title="Register a team" description="Each team gets its own roster, leagues, games, and finances." label="Team name" placeholder="e.g. Wolfpacks" onClose={()=>setModal(null)} onSave={name=>{const id=Date.now();setAccount(a=>({...a,teams:[...a.teams,{id,name,sport:"Cricket",players:[],leagues:[]}]}));setTeamId(id);setLeagueId(null);setModal(null);setView("roster");notify(`${name} registered`)}}/>}
    {modal==="league" && team && <LeagueModal onClose={()=>setModal(null)} onSave={(name,season)=>{const id=Date.now();updateTeam(t=>({...t,leagues:[...t.leagues,{id,name,season,status:"Active",games:[],expenses:[]}]}));setLeagueId(id);setModal(null);setView("overview");notify(`${name} created`)}}/>}
    {editingLeague && team && <LeagueModal league={editingLeague} onClose={()=>setEditingLeague(null)} onSave={(name,season,status)=>{updateTeam(t=>({...t,leagues:t.leagues.map(l=>l.id===editingLeague.id?{...l,name,season,status}:l)}));setEditingLeague(null);notify("League details updated")}}/>}
    {modal==="player" && team && <PlayerModal teamName={team.name} onClose={()=>setModal(null)} onSave={(name,email)=>{const id=Date.now();updateTeam(t=>({...t,players:[...t.players,{id,name,email,initials:initials(name),color:colors[t.players.length%colors.length]}]}));setModal(null);notify(`${name} added to ${team.name}`)}}/>}
    {editingPlayer && team && <PlayerModal teamName={team.name} player={editingPlayer} onClose={()=>setEditingPlayer(null)} onSave={(name,email)=>{updateTeam(t=>({...t,players:t.players.map(p=>p.id===editingPlayer.id?{...p,name,email,initials:initials(name)}:p)}));setEditingPlayer(null);notify("Player details updated")}}/>}
    {modal==="game" && league && <GameModal players={players} onClose={()=>setModal(null)} onSave={game=>{updateLeague(l=>({...l,games:[...l.games,{...game,id:Date.now()}]}));setModal(null);notify("Game and lineup added")}}/>}
    {modal==="expense" && league && <ExpenseModal players={players} games={games} onClose={()=>setModal(null)} onSave={expense=>{updateLeague(l=>({...l,expenses:[...l.expenses,{...expense,id:Date.now()}]}));setModal(null);notify("Expense added and split recalculated")}}/>}
    {toast && <div className="toast">✓ {toast}</div>}
  </main>;
}

function title(view: View) { return ({roster:"Team roster",leagues:"Leagues",games:"Games",expenses:"Expenses",settlement:"Settlement",overview:"Overview"})[view]; }

function Registration({user,onRegister}:{user:{name:string;email:string};onRegister:(name:string,team:string,league:string)=>void}) {
  const [name,setName]=useState(user.name); const [team,setTeam]=useState(""); const [league,setLeague]=useState("");
  return <main className="registration-page"><section className="registration-brand"><div className="brand"><span className="brand-mark">W</span><span>WicketSplit</span></div><div><span className="eyebrow">BUILT FOR TEAM TREASURERS</span><h1>Every game.<br/>Every expense.<br/><em>Fairly split.</em></h1><p>Pick the Playing XI or XII, record who paid, and finish every league with a settlement everyone can understand.</p></div><div className="registration-points"><span>✓ One roster, many leagues</span><span>✓ Automatic player shares</span><span>✓ Clean CSV settlement</span></div></section>
  <section className="registration-form-wrap"><form className="registration-form" onSubmit={e=>{e.preventDefault();onRegister(name,team,league)}}><span className="step-badge">1 minute setup</span><h2>Create your workspace</h2><p>You’re signed in as <strong>{user.email}</strong>. Start with your first cricket team and league.</p><label>Your name<input required value={name} onChange={e=>setName(e.target.value)} /></label><label>First team name<input autoFocus required value={team} onChange={e=>setTeam(e.target.value)} placeholder="e.g. Wolfpacks"/></label><label>First league name<input required value={league} onChange={e=>setLeague(e.target.value)} placeholder="e.g. Summer League 2026"/></label><button className="primary">Create team workspace →</button><small>You can register more teams and create multiple leagues after setup.</small></form></section></main>;
}

function Overview({total,outstanding,players,games,expenses,balances,setView,onPlayer,onGame,onExpense}:{total:number;outstanding:number;players:Player[];games:Game[];expenses:Expense[];balances:(Player&{paid:number;share:number;balance:number})[];setView:(v:View)=>void;onPlayer:()=>void;onGame:()=>void;onExpense:()=>void}) {
  if (!players.length) return <EmptyState icon="♙" title="Build your team roster" text="Add every squad member once. They’ll be available when selecting the Playing XI or XII for any league game." action="Add first player" onAction={onPlayer}/>;
  if (!games.length && !expenses.length) return <div className="start-grid"><EmptyState icon="◉" title="Add your first game" text="Choose the Playing XI or XII so match expenses split only among participants." action="Add game" onAction={onGame}/><EmptyState icon="↗" title="Record a league fee" text="Add a full-team fee or wait until match-day costs arrive." action="Add expense" onAction={onExpense}/></div>;
  return <><section className="stats"><div><span>Total league cost <b>↗</b></span><strong>{money.format(total)}</strong><small>All recorded expenses</small></div><div><span>Players <b>♙</b></span><strong>{players.length}</strong><small>On the full team roster</small></div><div><span>Still to collect <b className="amber">!</b></span><strong className="amber-text">{money.format(outstanding)}</strong><small>Across {balances.filter(b=>b.balance<-.01).length} players</small></div><div><span>Games <b>◉</b></span><strong>{games.length}</strong><small>{games.filter(g=>g.status==="Completed").length} completed</small></div></section>
  <section className="content-grid"><div className="panel"><div className="panel-head"><div><h2>Recent expenses</h2><p>Latest league spending</p></div><button onClick={()=>setView("expenses")}>View all →</button></div>{expenses.length?<div className="expense-list">{expenses.slice().reverse().slice(0,5).map(e=><div className="expense-row" key={e.id}><span className="cat">↗</span><div><strong>{e.label}</strong><small>{new Date(e.date+"T12:00").toLocaleDateString()} · {e.category}</small></div><strong>{money.format(e.amount)}</strong><span className="split-label">÷ {e.split==="team"?players.length:games.find(g=>g.id===e.gameId)?.players.length||0}</span></div>)}</div>:<MiniEmpty text="No expenses recorded yet."/>}</div>
  <div className="panel"><div className="panel-head"><div><h2>Player balances</h2><p>Who owes and who gets back</p></div><button onClick={()=>setView("settlement")}>Settlement →</button></div><div className="balance-list">{balances.slice().sort((a,b)=>a.balance-b.balance).slice(0,6).map(b=><div key={b.id}><div className="avatar" style={{background:b.color}}>{b.initials}</div><div><strong>{b.name}</strong><small>{games.filter(g=>g.players.includes(b.id)).length} games</small></div><span className={b.balance>=0?"positive":"negative"}>{b.balance>=0?"+":"−"}{money.format(Math.abs(b.balance))}</span></div>)}</div></div></section></>;
}

function RosterView({team,onAdd,onEdit}:{team:Team;onAdd:()=>void;onEdit:(player:Player)=>void}) {
  return <>{team.players.length?<><div className="roster-summary"><div><span className="eyebrow">FULL SQUAD</span><strong>{team.players.length}</strong><small>active players</small></div><p>This roster is shared across all <strong>{team.leagues.length} leagues</strong> for {team.name}. Select 11 or 12 from this list for each game.</p></div><div className="roster-grid">{team.players.map((p,i)=><article className="player-card" key={p.id}><span className="squad-no">{String(i+1).padStart(2,"0")}</span><div className="avatar large" style={{background:p.color}}>{p.initials}</div><h3>{p.name}</h3><p>{p.email||"No email added"}</p><div><span>Available for selection</span><i>Active</i></div><button className="edit-player" onClick={()=>onEdit(p)}>✎ Edit player</button></article>)}</div></>:<EmptyState icon="♙" title="Your roster is empty" text={`Add all ${team.name} players here. The roster will be available across every league.`} action="Add first player" onAction={onAdd}/>}</>;
}

function LeaguesView({team,activeId,onSelect,onAdd,onEdit}:{team:Team;activeId?:number;onSelect:(id:number)=>void;onAdd:()=>void;onEdit:(league:League)=>void}) {
  return <>{team.leagues.length?<div className="league-grid">{team.leagues.map(l=><article className={`league-card ${l.id===activeId?"current":""}`} key={l.id}><div><span className={l.status==="Active"?"status complete":"status"}>{l.status}</span><button className="edit-league" onClick={()=>onEdit(l)}>✎ Edit</button></div><h3>{l.name}</h3><p>{l.season} · {l.games.length} games · {l.expenses.length} expenses</p><div className="league-metrics"><div><strong>{money.format(l.expenses.reduce((s,e)=>s+e.amount,0))}</strong><span>Total spend</span></div><div><strong>{l.games.length}</strong><span>Games</span></div></div><button className="card-action" onClick={()=>onSelect(l.id)}>{l.id===activeId?"Open current league":"Switch to league"} →</button></article>)}<button className="new-league-card" onClick={onAdd}><span>＋</span><strong>Create another league</strong><small>New season or tournament</small></button></div>:<EmptyState icon="▤" title="No leagues yet" text={`${team.name} can have multiple leagues, seasons, and tournaments—each with separate expenses.`} action="Create first league" onAction={onAdd}/>}</>;
}

function GamesView({games,players,onAdd,onChange,notify}:{games:Game[];players:Player[];onAdd:()=>void;onChange:(g:Game[])=>void;notify:(s:string)=>void}) {
  const [editing,setEditing]=useState<number|null>(null); const game=games.find(g=>g.id===editing);
  const toggle=(id:number)=>game&&onChange(games.map(g=>g.id===game.id?{...g,players:g.players.includes(id)?g.players.filter(x=>x!==id):g.players.length<12?[...g.players,id]:g.players}:g));
  if (!players.length) return <EmptyState icon="♙" title="Add roster players first" text="Games need a team roster before you can select a Playing XI or XII." action="Go to team roster" onAction={()=>location.reload()}/>;
  return <>{games.length?<div className="game-grid">{games.map((g,i)=><article className="game-card" key={g.id}><div><span className={g.status==="Completed"?"status complete":"status"}>{g.status}</span><span>GAME {i+1}</span></div><div className="game-date"><strong>{new Date(g.date+"T12:00").toLocaleDateString("en-US",{day:"2-digit"})}</strong><span>{new Date(g.date+"T12:00").toLocaleDateString("en-US",{month:"short"}).toUpperCase()}</span></div><h3>vs {g.opponent}</h3><p>{g.venue}</p><div className="selected-count"><strong>{g.players.length}</strong> selected <span className={g.players.length>=11?"valid":"invalid"}>{g.players.length>=11?"Ready":"Need more"}</span></div><button className="card-action" onClick={()=>setEditing(g.id)}>Edit Playing {g.players.length||"XI"} →</button></article>)}</div>:<EmptyState icon="◉" title="No games in this league" text="Add a fixture and select the 11 or 12 players taking part." action="Add first game" onAction={onAdd}/>}
  {game&&<div className="modal-backdrop"><div className="modal lineup-modal"><ModalHead eyebrow="EDIT LINEUP" title="Select Playing XI / XII" description={`${game.players.length} of 12 selected`} close={()=>setEditing(null)}/><div className="player-picker">{players.map(p=><button key={p.id} className={game.players.includes(p.id)?"picked":""} onClick={()=>toggle(p.id)}><span className="avatar" style={{background:p.color}}>{p.initials}</span><span>{p.name}</span><i>{game.players.includes(p.id)?"✓":"＋"}</i></button>)}</div><div className="modal-actions"><span className={game.players.length>=11?"ready":"warning"}>{game.players.length>=11?"✓ Lineup ready":"Select at least 11"}</span><button className="primary" disabled={game.players.length<11} onClick={()=>{setEditing(null);notify("Lineup saved")}}>Save lineup</button></div></div></div>}</>;
}

function ExpensesView({expenses,players,games,onAdd}:{expenses:Expense[];players:Player[];games:Game[];onAdd:()=>void}) {
  return expenses.length?<div className="table-panel"><table><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Paid by</th><th>Split among</th><th>Amount</th></tr></thead><tbody>{expenses.slice().reverse().map(e=><tr key={e.id}><td>{new Date(e.date+"T12:00").toLocaleDateString()}</td><td><strong>{e.label}</strong></td><td><span className="category-chip">{e.category}</span></td><td>{players.find(p=>p.id===e.paidBy)?.name}</td><td>{e.split==="team"?`Full roster (${players.length})`:`Playing team (${games.find(g=>g.id===e.gameId)?.players.length||0})`}</td><td><strong>{money.format(e.amount)}</strong></td></tr>)}</tbody></table></div>:<EmptyState icon="↗" title="No expenses yet" text="Record the league fee or a match-day purchase and choose who should share it." action="Add first expense" onAction={onAdd}/>;
}

function SettlementView({balances,games,exportCsv}:{balances:(Player&{paid:number;share:number;balance:number})[];games:Game[];exportCsv:()=>void}) {
  if (!balances.length) return <EmptyState icon="⇄" title="Nothing to settle yet" text="Add players and expenses to calculate a final league settlement." />;
  return <><div className="view-toolbar"><div><h2>League settlement</h2><p>Player-by-player totals based on participation.</p></div><button className="primary" onClick={exportCsv}>↓ Download CSV</button></div><div className="table-panel"><table><thead><tr><th>Player</th><th>Games</th><th>Paid</th><th>Fair share</th><th>Balance</th></tr></thead><tbody>{balances.map(b=><tr key={b.id}><td><div className="player-cell"><span className="avatar" style={{background:b.color}}>{b.initials}</span><strong>{b.name}</strong></div></td><td>{games.filter(g=>g.players.includes(b.id)).length}</td><td>{money.format(b.paid)}</td><td>{money.format(b.share)}</td><td><strong className={b.balance>=0?"positive":"negative"}>{b.balance>=0?"+":"−"}{money.format(Math.abs(b.balance))}</strong></td></tr>)}</tbody></table></div></>;
}

function EmptyState({icon,title,text,action,onAction}:{icon:string;title:string;text:string;action?:string;onAction?:()=>void}) { return <div className="empty-state"><span>{icon}</span><h2>{title}</h2><p>{text}</p>{action&&<button className="primary" onClick={onAction}>{action} →</button>}</div>; }
function MiniEmpty({text}:{text:string}) { return <div className="mini-empty">{text}</div>; }
function ModalHead({eyebrow,title,description,close}:{eyebrow:string;title:string;description:string;close:()=>void}) { return <div className="modal-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={close}>×</button></div>; }

function NameModal({eyebrow,title,description,label,placeholder,onClose,onSave}:{eyebrow:string;title:string;description:string;label:string;placeholder:string;onClose:()=>void;onSave:(name:string)=>void}) {
  const [name,setName]=useState(""); return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={e=>{e.preventDefault();onSave(name)}}><ModalHead eyebrow={eyebrow} title={title} description={description} close={onClose}/><label>{label}<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder={placeholder}/></label><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary">Save</button></div></form></div>;
}
function LeagueModal({league,onClose,onSave}:{league?:League;onClose:()=>void;onSave:(name:string,season:string,status:"Active"|"Completed")=>void}) {
  const [name,setName]=useState(league?.name??""); const [season,setSeason]=useState(league?.season??new Date().getFullYear().toString()); const [status,setStatus]=useState<"Active"|"Completed">(league?.status??"Active"); return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={e=>{e.preventDefault();onSave(name,season,status)}}><ModalHead eyebrow={league?"EDIT LEAGUE":"NEW LEAGUE"} title={league?"Edit league details":"Create a league"} description={league?"Games, expenses, and settlement will remain unchanged.":"Games, expenses, and settlement stay separate per league."} close={onClose}/><div className="form-grid"><label className="wide">League name<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Summer League"/></label><label className="wide">Season / year<input required value={season} onChange={e=>setSeason(e.target.value)} placeholder="2026"/></label>{league&&<label className="wide">Status<select value={status} onChange={e=>setStatus(e.target.value as "Active"|"Completed")}><option>Active</option><option>Completed</option></select></label>}</div><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary">{league?"Save changes":"Create league"}</button></div></form></div>;
}
function PlayerModal({teamName,player,onClose,onSave}:{teamName:string;player?:Player;onClose:()=>void;onSave:(name:string,email:string)=>void}) {
  const [name,setName]=useState(player?.name??""); const [email,setEmail]=useState(player?.email??""); return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={e=>{e.preventDefault();onSave(name,email)}}><ModalHead eyebrow={`${teamName.toUpperCase()} ROSTER`} title={player?"Edit player":"Add a player"} description={player?"Their existing games, payments, and balances will stay linked.":"They’ll be available for every league and Playing XI / XII."} close={onClose}/><div className="form-grid"><label className="wide">Player name<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></label><label className="wide">Email (optional)<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="player@example.com"/></label></div><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary">{player?"Save changes":"Add player"}</button></div></form></div>;
}
function GameModal({players,onClose,onSave}:{players:Player[];onClose:()=>void;onSave:(g:Omit<Game,"id">)=>void}) {
  const [opponent,setOpponent]=useState(""); const [date,setDate]=useState(""); const [venue,setVenue]=useState(""); const [selected,setSelected]=useState<number[]>([]);
  return <div className="modal-backdrop"><form className="modal lineup-modal" onSubmit={e=>{e.preventDefault();if(selected.length>=11)onSave({opponent,date,venue,players:selected,status:"Upcoming"})}}><ModalHead eyebrow="NEW FIXTURE" title="Add game & lineup" description="Select 11 or 12 players who will share match expenses." close={onClose}/><div className="form-grid"><label>Opponent<input required value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="Team name"/></label><label>Date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="wide">Venue<input value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Ground or park"/></label></div><div className="player-picker compact">{players.map(p=><button type="button" key={p.id} className={selected.includes(p.id)?"picked":""} onClick={()=>setSelected(selected.includes(p.id)?selected.filter(x=>x!==p.id):selected.length<12?[...selected,p.id]:selected)}><span className="avatar" style={{background:p.color}}>{p.initials}</span><span>{p.name}</span><i>{selected.includes(p.id)?"✓":"＋"}</i></button>)}</div><div className="modal-actions"><span className={selected.length>=11?"ready":"warning"}>{selected.length}/12 selected</span><button className="primary" disabled={selected.length<11}>Save game</button></div></form></div>;
}
function ExpenseModal({players,games,onClose,onSave}:{players:Player[];games:Game[];onClose:()=>void;onSave:(e:Omit<Expense,"id">)=>void}) {
  const [label,setLabel]=useState(""); const [amount,setAmount]=useState(""); const [category,setCategory]=useState("Water"); const [paidBy,setPaidBy]=useState(players[0]?.id||0); const [gameId,setGameId]=useState(games[0]?.id||0); const [split,setSplit]=useState<"players"|"team">(games.length?"players":"team");
  return <div className="modal-backdrop"><form className="modal" onSubmit={e=>{e.preventDefault();onSave({label,amount:Number(amount),category,paidBy,gameId:split==="players"?gameId:undefined,split,date:new Date().toISOString().slice(0,10)})}}><ModalHead eyebrow="NEW PAYMENT" title="Add an expense" description="The league settlement will update automatically." close={onClose}/><div className="form-grid"><label className="wide">Description<input autoFocus required value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Water & ice"/></label><label>Amount ($)<input required min=".01" step=".01" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option>Water</option><option>Fruits</option><option>Team fund</option><option>League fee</option><option>Other</option></select></label><label>Paid by<select value={paidBy} onChange={e=>setPaidBy(Number(e.target.value))}>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Split rule<select value={split} onChange={e=>setSplit(e.target.value as "players"|"team")}><option value="team">Full team roster</option>{games.length>0&&<option value="players">Playing XI / XII</option>}</select></label>{split==="players"&&<label className="wide">Game<select value={gameId} onChange={e=>setGameId(Number(e.target.value))}>{games.map((g,i)=><option key={g.id} value={g.id}>Game {i+1} vs {g.opponent} · {g.players.length} players</option>)}</select></label>}</div><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary">Add & split</button></div></form></div>;
}
