"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useMemo, useRef, useState } from "react";

type Player = { id: number; name: string; initials: string; email?: string; color: string };
type Game = { id: number; date: string; opponent: string; venue: string; players: number[]; status: "Upcoming" | "Completed" };
type SplitMode = "players" | "team" | "custom";
type Expense = { id: number; date: string; label: string; category: string; amount: number; paidBy: number; gameId?: number; split: SplitMode; participants?: number[] };
type Credit = { id: number; date: string; label: string; amount: number; playerId: number; gameId?: number; split: SplitMode; participants: number[] };
type League = { id: number; name: string; season: string; status: "Active" | "Completed"; games: Game[]; expenses: Expense[]; credits?: Credit[] };
type Team = { id: number; name: string; sport: string; players: Player[]; leagues: League[] };
type Account = { registered: boolean; name: string; teams: Team[] };
type View = "overview" | "roster" | "games" | "expenses" | "settlement" | "leagues";
type SaveState = "loading" | "saved" | "saving" | "error";

const colors = ["#d9f99d","#bfdbfe","#fed7aa","#ddd6fe","#fecdd3","#bae6fd","#fde68a","#bbf7d0","#e9d5ff","#c7d2fe","#fbcfe8","#a7f3d0"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const emptyAccount = (name: string): Account => ({ registered: false, name, teams: [] });
const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
const playerShare = (amount:number,participants:number[],playerId:number) => participants.includes(playerId)&&participants.length ? amount/participants.length : 0;
const expenseParticipants = (expense:Expense,players:Player[],games:Game[]) =>
  expense.participants?.length ? expense.participants :
  expense.split==="players" ? games.find(g=>g.id===expense.gameId)?.players??[] : players.map(p=>p.id);
const splitDescription = (entry:{split:SplitMode;participants?:number[];gameId?:number},players:Player[],games:Game[]) => {
  const count=entry.participants?.length??(entry.split==="players"?games.find(g=>g.id===entry.gameId)?.players.length:players.length)??0;
  if(entry.split==="players") return `Game vs ${games.find(g=>g.id===entry.gameId)?.opponent??"Unknown"} (${count})`;
  return entry.split==="custom"?`Custom group (${count})`:`Full roster (${count})`;
};

export default function Dashboard({ user }: { user: { name: string; email: string } }) {
  const [account, setAccount] = useState<Account>(() => emptyAccount(user.name));
  const [teamId, setTeamId] = useState<number | null>(null);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [view, setView] = useState<View>("overview");
  const [modal, setModal] = useState<null | "team" | "league" | "player" | "game" | "expense" | "credit">(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [teamMenu, setTeamMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [loadFailed, setLoadFailed] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
  const loaded = useRef(false);
  const saveSequence = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    fetch("/api/state").then(async r => {
      if (!r.ok) throw new Error("Workspace could not be loaded");
      return r.json();
    }).then(data => {
      const next = data?.registered ? data as Account : emptyAccount(user.name);
      setAccount(next);
      setTeamId(next.teams[0]?.id ?? null);
      setLeagueId(next.teams[0]?.leagues[0]?.id ?? null);
      loaded.current = true;
      setSaveState("saved");
    }).catch(() => { setLoadFailed(true); setSaveState("error"); });
  }, [user.name]);

  useEffect(() => {
    if (!loaded.current) return;
    const sequence = ++saveSequence.current;
    setSaveState("saving");
    const payload = JSON.stringify(account);
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(()=>undefined).then(async () => {
        try {
          const response = await fetch("/api/state", {
            method: "POST", headers: { "content-type": "application/json" }, body: payload,
          });
          if (!response.ok) throw new Error("Save failed");
          if (sequence === saveSequence.current) setSaveState("saved");
        } catch {
          if (sequence === saveSequence.current) setSaveState("error");
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [account]);

  const team = account.teams.find(t => t.id === teamId) ?? account.teams[0];
  const league = team?.leagues.find(l => l.id === leagueId) ?? team?.leagues[0];
  const players = useMemo(()=>team?.players ?? [],[team]);
  const games = useMemo(()=>league?.games ?? [],[league]);
  const expenses = useMemo(()=>league?.expenses ?? [],[league]);
  const credits = useMemo(()=>league?.credits ?? [],[league]);
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
    const credit = credits.filter(e => e.playerId === player.id).reduce((s,e) => s + e.amount, 0);
    const expenseShare = expenses.reduce((sum,e) => sum + playerShare(e.amount, expenseParticipants(e,players,games), player.id), 0);
    const creditShare = credits.reduce((sum,e) => sum + playerShare(e.amount,e.participants,player.id),0);
    const share = expenseShare + creditShare;
    return { ...player, paid, credit, share, balance: paid + credit - share };
  }), [players, games, expenses, credits]);

  if (!account.registered) {
    return <Registration user={user} onRegister={(name, teamName, leagueName) => {
      const id = Date.now(); const firstLeagueId = id + 1;
      const next: Account = { registered: true, name, teams: [{
        id, name: teamName, sport: "Cricket", players: [], leagues: [{
          id: firstLeagueId, name: leagueName, season: new Date().getFullYear().toString(),
          status: "Active", games: [], expenses: [], credits: [],
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
    const rows = [["Team",team.name],["League",league.name],["Season",league.season],[],
      ["PLAYER SETTLEMENT"],["Player","Games Played","Cash Paid","Credits","Fair Share","Balance"],
      ...balances.map(b => [b.name,games.filter(g=>g.players.includes(b.id)).length,b.paid.toFixed(2),b.credit.toFixed(2),b.share.toFixed(2),b.balance.toFixed(2)]),
      [],["SUGGESTED PAYMENTS"],["From","To","Amount"],
      ...settlementTransfers(balances).map(t=>[t.from,t.to,t.amount.toFixed(2)]),
      [],["EXPENSE DETAILS"],["Date","Description","Category","Paid by","Split among","Amount"],
      ...expenses.map(e=>[e.date,e.label,e.category,players.find(p=>p.id===e.paidBy)?.name??"Unknown",
        splitDescription(e,players,games),e.amount.toFixed(2)]),
      [],["CREDIT / WAIVER DETAILS"],["Date","Description","Credited player","Shared by","Amount"],
      ...credits.map(c=>[c.date,c.label,players.find(p=>p.id===c.playerId)?.name??"Unknown",splitDescription(c,players,games),c.amount.toFixed(2)])];
    const safeCell=(value:unknown)=>{const text=String(value);return /^[=+\-@]/.test(text)?`'${text}`:text};
    const csv = rows.map(r => r.map(c => `"${safeCell(c).replaceAll('"','""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    link.download = `${team.name}-${league.name}-settlement.csv`.replaceAll(" ","-").toLowerCase(); link.click();
    URL.revokeObjectURL(link.href); notify("Settlement CSV downloaded");
  }

  const total = expenses.reduce((s,e)=>s+e.amount,0) + credits.reduce((s,e)=>s+e.amount,0);
  const outstanding = balances.filter(b=>b.balance<0).reduce((s,b)=>s+Math.abs(b.balance),0);

  if (saveState === "loading") return <main className="workspace-loading"><span className="brand-mark">W</span><strong>Loading your workspace…</strong></main>;
  if (loadFailed) return <main className="workspace-loading load-error"><span>!</span><strong>We couldn’t load your workspace.</strong><p>Your saved data has not been changed.</p><button className="primary" onClick={()=>location.reload()}>Try again</button></main>;

  return <main className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="WicketSplit homepage"><span className="brand-mark">W</span><span>WicketSplit</span></a>
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
        <a className="side-logout" href="/api/auth/logout"><span>↪</span>Log out</a>
        <div className="profile"><div className="avatar dark">{initials(account.name)}</div><div><strong>{account.name}</strong><small>{user.email}</small></div><span>•••</span></div>
      </div>
    </aside>

    <section className="workspace">
      <header>
        <div>
          <div className="league-picker">
            {league ? <>
              <div className="league-select-label"><span className="eyebrow">CURRENT LEAGUE</span><span className={`league-status-dot ${league.status.toLowerCase()}`}>{league.status}</span></div>
              <div className="league-select-shell">
                <span className="league-icon">▤</span>
                <select aria-label="Current league" value={league.id} onChange={e=>{setLeagueId(Number(e.target.value));setView("overview")}}>{team?.leagues.map(l=><option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}</select>
                <span className="league-chevron">⌄</span>
              </div>
            </> : <span className="season-pill"><i /> NO LEAGUE SELECTED</span>}
          </div>
          <h1>{view==="overview"?`Welcome back, ${account.name.split(" ")[0]}.`:title(view)}</h1>
          <p>{team?.name}{league ? ` · ${league.name}` : " · Create a league to begin"}</p>
        </div>
        <div className="header-actions">
          <span className={`save-state ${saveState}`}>{saveState==="saving"?"Saving…":saveState==="error"?"Not saved":"✓ Saved"}</span>
          {view==="roster" && <button className="primary" onClick={()=>setModal("player")}>＋ Add player</button>}
          {view==="leagues" && <button className="primary" onClick={()=>setModal("league")}>＋ Create league</button>}
          {["overview","expenses"].includes(view) && league && players.length>0 && <><button className="ghost" onClick={()=>setModal("credit")}>＋ Add credit</button><button className="primary" onClick={()=>setModal("expense")}>＋ Add expense</button></>}
          <a className="ghost logout-header" href="/api/auth/logout">Log out</a>
        </div>
      </header>

      {!team ? <EmptyState icon="♙" title="Register your first team" text="Create a team workspace, add its roster, then organize expenses by league." action="Register team" onAction={()=>setModal("team")}/> :
       !league && view!=="roster" && view!=="leagues" ? <EmptyState icon="▤" title="Create your first league" text="A team can have as many leagues and seasons as you need." action="Create league" onAction={()=>setModal("league")}/> : <>
        {view==="overview" && league && <Overview total={total} outstanding={outstanding} players={players} games={games} expenses={expenses} credits={credits} balances={balances} setView={setView} onPlayer={()=>setModal("player")} onGame={()=>setModal("game")} onExpense={()=>setModal("expense")}/>}
        {view==="roster" && <RosterView team={team} onAdd={()=>setModal("player")} onEdit={setEditingPlayer}/>}
        {view==="leagues" && <LeaguesView team={team} activeId={league?.id} onSelect={id=>{setLeagueId(id);setView("overview")}} onAdd={()=>setModal("league")} onEdit={setEditingLeague}/>}
        {view==="games" && league && <GamesView games={games} players={players} onAdd={()=>setModal("game")} onRoster={()=>setView("roster")} onChange={next=>updateLeague(l=>({...l,games:next}))} notify={notify}/>}
        {view==="expenses" && league && <ExpensesView expenses={expenses} credits={credits} players={players} games={games} onAdd={()=>setModal("expense")} onCredit={()=>setModal("credit")} onRoster={()=>setView("roster")} onEdit={setEditingExpense} onEditCredit={setEditingCredit}/>}
        {view==="settlement" && league && <SettlementView balances={balances} games={games} exportCsv={exportCsv}/>}
      </>}
    </section>

    {modal==="team" && <NameModal eyebrow="NEW TEAM" title="Register a team" description="Each team gets its own roster, leagues, games, and finances." label="Team name" placeholder="e.g. Wolfpacks" onClose={()=>setModal(null)} onSave={name=>{const id=Date.now();setAccount(a=>({...a,teams:[...a.teams,{id,name,sport:"Cricket",players:[],leagues:[]}]}));setTeamId(id);setLeagueId(null);setModal(null);setView("roster");notify(`${name} registered`)}}/>}
    {modal==="league" && team && <LeagueModal onClose={()=>setModal(null)} onSave={(name,season)=>{const id=Date.now();updateTeam(t=>({...t,leagues:[...t.leagues,{id,name,season,status:"Active",games:[],expenses:[],credits:[]}]}));setLeagueId(id);setModal(null);setView("overview");notify(`${name} created`)}}/>}
    {editingLeague && team && <LeagueModal league={editingLeague} onClose={()=>setEditingLeague(null)} onSave={(name,season,status)=>{updateTeam(t=>({...t,leagues:t.leagues.map(l=>l.id===editingLeague.id?{...l,name,season,status}:l)}));setEditingLeague(null);notify("League details updated")}}/>}
    {modal==="player" && team && <PlayerModal teamName={team.name} onClose={()=>setModal(null)} onSave={(name,email)=>{const id=Date.now();updateTeam(t=>({...t,players:[...t.players,{id,name,email,initials:initials(name),color:colors[t.players.length%colors.length]}]}));setModal(null);notify(`${name} added to ${team.name}`)}}/>}
    {editingPlayer && team && <PlayerModal teamName={team.name} player={editingPlayer} onClose={()=>setEditingPlayer(null)} onSave={(name,email)=>{updateTeam(t=>({...t,players:t.players.map(p=>p.id===editingPlayer.id?{...p,name,email,initials:initials(name)}:p)}));setEditingPlayer(null);notify("Player details updated")}}/>}
    {modal==="game" && league && <GameModal players={players} onClose={()=>setModal(null)} onSave={game=>{updateLeague(l=>({...l,games:[...l.games,{...game,id:Date.now()}]}));setModal(null);notify("Game and lineup added")}}/>}
    {modal==="expense" && league && <ExpenseModal players={players} games={games} onClose={()=>setModal(null)} onSave={expense=>{updateLeague(l=>({...l,expenses:[...l.expenses,{...expense,id:Date.now()}]}));setModal(null);notify("Expense added and split recalculated")}}/>}
    {editingExpense && league && <ExpenseModal expense={editingExpense} players={players} games={games} onClose={()=>setEditingExpense(null)} onDelete={()=>{if(confirm(`Delete “${editingExpense.label}”? This will recalculate every balance.`)){updateLeague(l=>({...l,expenses:l.expenses.filter(e=>e.id!==editingExpense.id)}));setEditingExpense(null);notify("Expense deleted and balances recalculated")}}} onSave={expense=>{updateLeague(l=>({...l,expenses:l.expenses.map(e=>e.id===editingExpense.id?{...expense,id:e.id}:e)}));setEditingExpense(null);notify("Expense updated and split recalculated")}}/>}
    {modal==="credit" && league && <CreditModal players={players} games={games} onClose={()=>setModal(null)} onSave={credit=>{updateLeague(l=>({...l,credits:[...(l.credits??[]),{...credit,id:Date.now()}]}));setModal(null);notify("Player credit added and settlement recalculated")}}/>}
    {editingCredit && league && <CreditModal credit={editingCredit} players={players} games={games} onClose={()=>setEditingCredit(null)} onDelete={()=>{if(confirm(`Delete credit “${editingCredit.label}”? This will recalculate every balance.`)){updateLeague(l=>({...l,credits:(l.credits??[]).filter(c=>c.id!==editingCredit.id)}));setEditingCredit(null);notify("Credit deleted and balances recalculated")}}} onSave={credit=>{updateLeague(l=>({...l,credits:(l.credits??[]).map(c=>c.id===editingCredit.id?{...credit,id:c.id}:c)}));setEditingCredit(null);notify("Credit updated and settlement recalculated")}}/>}
    {toast && <div className="toast">✓ {toast}</div>}
  </main>;
}

function title(view: View) { return ({roster:"Team roster",leagues:"Leagues",games:"Games",expenses:"Expenses",settlement:"Settlement",overview:"Overview"})[view]; }

function Registration({user,onRegister}:{user:{name:string;email:string};onRegister:(name:string,team:string,league:string)=>void}) {
  const [name,setName]=useState(user.name); const [team,setTeam]=useState(""); const [league,setLeague]=useState("");
  return <main className="registration-page"><section className="registration-brand"><div className="brand"><span className="brand-mark">W</span><span>WicketSplit</span></div><div><span className="eyebrow">BUILT FOR TEAM TREASURERS</span><h1>Every game.<br/>Every expense.<br/><em>Fairly split.</em></h1><p>Pick the Playing XI or XII, record who paid, and finish every league with a settlement everyone can understand.</p></div><div className="registration-points"><span>✓ One roster, many leagues</span><span>✓ Automatic player shares</span><span>✓ Clean CSV settlement</span></div></section>
  <section className="registration-form-wrap"><form className="registration-form" onSubmit={e=>{e.preventDefault();onRegister(name,team,league)}}><span className="step-badge">1 minute setup</span><h2>Create your workspace</h2><p>You’re signed in as <strong>{user.email}</strong>. Start with your first cricket team and league.</p><label>Your name<input required value={name} onChange={e=>setName(e.target.value)} /></label><label>First team name<input autoFocus required value={team} onChange={e=>setTeam(e.target.value)} placeholder="e.g. Wolfpacks"/></label><label>First league name<input required value={league} onChange={e=>setLeague(e.target.value)} placeholder="e.g. Summer League 2026"/></label><button className="primary">Create team workspace →</button><small>You can register more teams and create multiple leagues after setup.</small></form></section></main>;
}

function Overview({total,outstanding,players,games,expenses,credits,balances,setView,onPlayer,onGame,onExpense}:{total:number;outstanding:number;players:Player[];games:Game[];expenses:Expense[];credits:Credit[];balances:(Player&{paid:number;share:number;balance:number})[];setView:(v:View)=>void;onPlayer:()=>void;onGame:()=>void;onExpense:()=>void}) {
  if (!players.length) return <EmptyState icon="♙" title="Build your team roster" text="Add every squad member once. They’ll be available when selecting the Playing XI or XII for any league game." action="Add first player" onAction={onPlayer}/>;
  if (!games.length && !expenses.length && !credits.length) return <div className="start-grid"><EmptyState icon="◉" title="Add your first game" text="Choose the Playing XI or XII so match expenses split only among participants." action="Add game" onAction={onGame}/><EmptyState icon="↗" title="Record a league fee" text="Add a full-team fee or wait until match-day costs arrive." action="Add expense" onAction={onExpense}/></div>;
  const recent=[...expenses.map(entry=>({kind:"expense" as const,entry})),...credits.map(entry=>({kind:"credit" as const,entry}))].sort((a,b)=>b.entry.date.localeCompare(a.entry.date)||b.entry.id-a.entry.id).slice(0,5);
  return <><section className="stats"><div><span>Total league cost <b>↗</b></span><strong>{money.format(total)}</strong><small>Expenses and player credits</small></div><div><span>Players <b>♙</b></span><strong>{players.length}</strong><small>On the full team roster</small></div><div><span>Still to collect <b className="amber">!</b></span><strong className="amber-text">{money.format(outstanding)}</strong><small>Across {balances.filter(b=>b.balance<-.01).length} players</small></div><div><span>Games <b>◉</b></span><strong>{games.length}</strong><small>{games.filter(g=>g.status==="Completed").length} completed</small></div></section>
  <section className="content-grid"><div className="panel"><div className="panel-head"><div><h2>Recent entries</h2><p>Expenses, credits, and waivers</p></div><button onClick={()=>setView("expenses")}>View all →</button></div>{recent.length?<div className="expense-list">{recent.map(item=><div className="expense-row" key={`${item.kind}-${item.entry.id}`}><span className={`cat ${item.kind==="credit"?"credit":""}`}>{item.kind==="credit"?"◇":"↗"}</span><div><strong>{item.entry.label}</strong><small>{new Date(item.entry.date+"T12:00").toLocaleDateString()} · {item.kind==="credit"?"Player credit":item.entry.category}</small></div><strong>{item.kind==="credit"?"+":""}{money.format(item.entry.amount)}</strong><span className="split-label">÷ {item.entry.participants?.length??players.length}</span></div>)}</div>:<MiniEmpty text="No finance entries recorded yet."/>}</div>
  <div className="panel"><div className="panel-head"><div><h2>Player balances</h2><p>Who owes and who gets back</p></div><button onClick={()=>setView("settlement")}>Settlement →</button></div><div className="balance-list">{balances.slice().sort((a,b)=>a.balance-b.balance).slice(0,6).map(b=><div key={b.id}><div className="avatar" style={{background:b.color}}>{b.initials}</div><div><strong>{b.name}</strong><small>{games.filter(g=>g.players.includes(b.id)).length} games</small></div><span className={b.balance>=0?"positive":"negative"}>{b.balance>=0?"+":"−"}{money.format(Math.abs(b.balance))}</span></div>)}</div></div></section></>;
}

function RosterView({team,onAdd,onEdit}:{team:Team;onAdd:()=>void;onEdit:(player:Player)=>void}) {
  return <>{team.players.length?<><div className="roster-summary"><div><span className="eyebrow">FULL SQUAD</span><strong>{team.players.length}</strong><small>active players</small></div><p>This roster is shared across all <strong>{team.leagues.length} leagues</strong> for {team.name}. Select 11 or 12 from this list for each game.</p></div><div className="roster-grid">{team.players.map((p,i)=><article className="player-card" key={p.id}><span className="squad-no">{String(i+1).padStart(2,"0")}</span><div className="avatar large" style={{background:p.color}}>{p.initials}</div><h3>{p.name}</h3><p>{p.email||"No email added"}</p><div><span>Available for selection</span><i>Active</i></div><button className="edit-player" onClick={()=>onEdit(p)}>✎ Edit player</button></article>)}</div></>:<EmptyState icon="♙" title="Your roster is empty" text={`Add all ${team.name} players here. The roster will be available across every league.`} action="Add first player" onAction={onAdd}/>}</>;
}

function LeaguesView({team,activeId,onSelect,onAdd,onEdit}:{team:Team;activeId?:number;onSelect:(id:number)=>void;onAdd:()=>void;onEdit:(league:League)=>void}) {
  return <>{team.leagues.length?<div className="league-grid">{team.leagues.map(l=><article className={`league-card ${l.id===activeId?"current":""}`} key={l.id}><div><span className={l.status==="Active"?"status complete":"status"}>{l.status}</span><button className="edit-league" onClick={()=>onEdit(l)}>✎ Edit</button></div><h3>{l.name}</h3><p>{l.season} · {l.games.length} games · {l.expenses.length} expenses · {l.credits?.length??0} credits</p><div className="league-metrics"><div><strong>{money.format(l.expenses.reduce((s,e)=>s+e.amount,0)+(l.credits??[]).reduce((s,e)=>s+e.amount,0))}</strong><span>Total cost</span></div><div><strong>{l.games.length}</strong><span>Games</span></div></div><button className="card-action" onClick={()=>onSelect(l.id)}>{l.id===activeId?"Open current league":"Switch to league"} →</button></article>)}<button className="new-league-card" onClick={onAdd}><span>＋</span><strong>Create another league</strong><small>New season or tournament</small></button></div>:<EmptyState icon="▤" title="No leagues yet" text={`${team.name} can have multiple leagues, seasons, and tournaments—each with separate expenses.`} action="Create first league" onAction={onAdd}/>}</>;
}

function GamesView({games,players,onAdd,onRoster,onChange,notify}:{games:Game[];players:Player[];onAdd:()=>void;onRoster:()=>void;onChange:(g:Game[])=>void;notify:(s:string)=>void}) {
  const [editing,setEditing]=useState<number|null>(null); const game=games.find(g=>g.id===editing);
  if (!players.length) return <EmptyState icon="♙" title="Add roster players first" text="Games need a team roster before you can select a Playing XI or XII." action="Go to team roster" onAction={onRoster}/>;
  return <>{games.length?<><div className="view-toolbar"><div><h2>League games</h2><p>{games.length} {games.length===1?"game":"games"} recorded in this league.</p></div><button className="primary" onClick={onAdd}>＋ Add game</button></div><div className="game-grid">{games.map((g,i)=><article className="game-card" key={g.id}><div><span className={g.status==="Completed"?"status complete":"status"}>{g.status}</span><span>GAME {i+1}</span></div><div className="game-date"><strong>{new Date(g.date+"T12:00").toLocaleDateString("en-US",{day:"2-digit"})}</strong><span>{new Date(g.date+"T12:00").toLocaleDateString("en-US",{month:"short"}).toUpperCase()}</span></div><h3>vs {g.opponent}</h3><p>{g.venue||"Venue not specified"}</p><div className="selected-count"><strong>{g.players.length}</strong> selected <span className={g.players.length>=11?"valid":"invalid"}>{g.players.length>=11?"Ready":"Need more"}</span></div><button className="card-action" onClick={()=>setEditing(g.id)}>Edit game & Playing {g.players.length||"XI"} →</button></article>)}</div></>:<EmptyState icon="◉" title="No games in this league" text="Add a fixture and select the 11 or 12 players taking part." action="Add first game" onAction={onAdd}/>}
  {game&&<GameModal game={game} players={players} onClose={()=>setEditing(null)} onSave={updated=>{onChange(games.map(g=>g.id===game.id?{...updated,id:g.id}:g));setEditing(null);notify("Game and lineup updated")}}/>}</>;
}

function ExpensesView({expenses,credits,players,games,onAdd,onCredit,onRoster,onEdit,onEditCredit}:{expenses:Expense[];credits:Credit[];players:Player[];games:Game[];onAdd:()=>void;onCredit:()=>void;onRoster:()=>void;onEdit:(expense:Expense)=>void;onEditCredit:(credit:Credit)=>void}) {
  if (!players.length) return <EmptyState icon="♙" title="Add roster players first" text="Every payment needs a team member who paid it." action="Go to team roster" onAction={onRoster}/>;
  const entries=[...expenses.map(entry=>({kind:"expense" as const,entry})),...credits.map(entry=>({kind:"credit" as const,entry}))].sort((a,b)=>b.entry.date.localeCompare(a.entry.date)||b.entry.id-a.entry.id);
  return entries.length?<><div className="view-toolbar"><div><h2>League finance ledger</h2><p>{expenses.length} expenses · {credits.length} credits or waivers.</p></div><div className="toolbar-actions"><button className="ghost" onClick={onCredit}>＋ Add credit</button><button className="primary" onClick={onAdd}>＋ Add expense</button></div></div><div className="table-panel"><table><thead><tr><th>Date</th><th>Entry</th><th>Type</th><th>Paid / credited to</th><th>Shared by</th><th>Amount</th><th></th></tr></thead><tbody>{entries.map(item=>item.kind==="expense"?<tr key={`e-${item.entry.id}`}><td>{new Date(item.entry.date+"T12:00").toLocaleDateString()}</td><td><strong>{item.entry.label}</strong></td><td><span className="category-chip">{item.entry.category}</span></td><td>{players.find(p=>p.id===item.entry.paidBy)?.name??"Unknown player"}</td><td>{splitDescription(item.entry,players,games)}</td><td><strong>{money.format(item.entry.amount)}</strong></td><td><button className="table-edit" onClick={()=>onEdit(item.entry)}>Edit</button></td></tr>:<tr className="credit-row" key={`c-${item.entry.id}`}><td>{new Date(item.entry.date+"T12:00").toLocaleDateString()}</td><td><strong>{item.entry.label}</strong></td><td><span className="category-chip credit">Credit / waiver</span></td><td>{players.find(p=>p.id===item.entry.playerId)?.name??"Unknown player"}</td><td>{splitDescription(item.entry,players,games)}</td><td><strong>+{money.format(item.entry.amount)}</strong></td><td><button className="table-edit" onClick={()=>onEditCredit(item.entry)}>Edit</button></td></tr>)}</tbody></table></div></>:<div className="start-grid"><EmptyState icon="↗" title="No expenses yet" text="Record a payment and choose exactly who should share it." action="Add expense" onAction={onAdd}/><EmptyState icon="◇" title="No credits yet" text="Credit a player for umpiring or another contribution and choose who funds it." action="Add credit / waiver" onAction={onCredit}/></div>;
}

function SettlementView({balances,games,exportCsv}:{balances:(Player&{paid:number;credit:number;share:number;balance:number})[];games:Game[];exportCsv:()=>void}) {
  if (!balances.length) return <EmptyState icon="⇄" title="Nothing to settle yet" text="Add players and expenses to calculate a final league settlement." />;
  const transfers=settlementTransfers(balances);
  return <><div className="view-toolbar"><div><h2>League settlement</h2><p>Cash payments, player credits, and each person’s selected shares.</p></div><button className="primary" onClick={exportCsv}>↓ Download CSV</button></div><div className="table-panel"><table><thead><tr><th>Player</th><th>Games</th><th>Cash paid</th><th>Credits</th><th>Fair share</th><th>Balance</th></tr></thead><tbody>{balances.map(b=><tr key={b.id}><td><div className="player-cell"><span className="avatar" style={{background:b.color}}>{b.initials}</span><strong>{b.name}</strong></div></td><td>{games.filter(g=>g.players.includes(b.id)).length}</td><td>{money.format(b.paid)}</td><td className="positive">{money.format(b.credit)}</td><td>{money.format(b.share)}</td><td><strong className={b.balance>=0?"positive":"negative"}>{b.balance>=0?"+":"−"}{money.format(Math.abs(b.balance))}</strong></td></tr>)}</tbody></table></div>{transfers.length>0&&<section className="transfer-panel"><h2>Suggested payments</h2><p>Use these transfers to settle the league with the fewest practical payments.</p>{transfers.map((t,i)=><div key={i}><strong>{t.from}</strong><span>pays</span><strong>{t.to}</strong><b>{money.format(t.amount)}</b></div>)}</section>}</>;
}

function settlementTransfers(balances:(Player&{balance:number})[]) {
  const debtors=balances.filter(b=>b.balance<-.005).map(b=>({name:b.name,amount:-b.balance}));
  const creditors=balances.filter(b=>b.balance>.005).map(b=>({name:b.name,amount:b.balance}));
  const result:{from:string;to:string;amount:number}[]=[]; let d=0; let c=0;
  while(d<debtors.length&&c<creditors.length){const amount=Math.min(debtors[d].amount,creditors[c].amount);result.push({from:debtors[d].name,to:creditors[c].name,amount});debtors[d].amount-=amount;creditors[c].amount-=amount;if(debtors[d].amount<.005)d++;if(creditors[c].amount<.005)c++}
  return result;
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
function GameModal({game,players,onClose,onSave}:{game?:Game;players:Player[];onClose:()=>void;onSave:(g:Omit<Game,"id">)=>void}) {
  const [opponent,setOpponent]=useState(game?.opponent??""); const [date,setDate]=useState(game?.date??""); const [venue,setVenue]=useState(game?.venue??""); const [selected,setSelected]=useState<number[]>(game?.players??[]);
  const [status,setStatus]=useState<Game["status"]>(game?.status??"Upcoming"); const [statusChanged,setStatusChanged]=useState(Boolean(game));
  const sortedPlayers=useMemo(()=>[...players].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true})),[players]);
  const today=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`};
  const chooseDate=(next:string)=>{setDate(next);if(!statusChanged)setStatus(next&&next<today()?"Completed":"Upcoming")};
  return <div className="modal-backdrop"><form className="modal lineup-modal" onSubmit={e=>{e.preventDefault();if(selected.length>=11)onSave({opponent:opponent.trim(),date,venue:venue.trim(),players:selected,status})}}><ModalHead eyebrow={game?"EDIT GAME":"NEW FIXTURE"} title={game?"Edit game & lineup":"Add game & lineup"} description="Past dates are marked completed automatically. You can override the status." close={onClose}/><div className="form-grid"><label>Opponent<input autoFocus={!game} required value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="Team name"/></label><label>Date<input required type="date" value={date} onChange={e=>chooseDate(e.target.value)}/></label><label>Venue (optional)<input value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Ground or park"/></label><label>Status<select value={status} onChange={e=>{setStatus(e.target.value as Game["status"]);setStatusChanged(true)}}><option>Upcoming</option><option>Completed</option></select></label></div><div className="player-picker compact">{sortedPlayers.map(p=><button type="button" key={p.id} className={selected.includes(p.id)?"picked":""} onClick={()=>setSelected(selected.includes(p.id)?selected.filter(x=>x!==p.id):selected.length<12?[...selected,p.id]:selected)}><span className="avatar" style={{background:p.color}}>{p.initials}</span><span>{p.name}</span><i>{selected.includes(p.id)?"✓":"＋"}</i></button>)}</div><div className="modal-actions"><span className={selected.length>=11?"ready":"warning"}>{selected.length}/12 selected</span><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={selected.length<11}>{game?"Save changes":"Save game"}</button></div></form></div>;
}
function ExpenseModal({expense,players,games,onClose,onSave,onDelete}:{expense?:Expense;players:Player[];games:Game[];onClose:()=>void;onSave:(e:Omit<Expense,"id">)=>void;onDelete?:()=>void}) {
  const localToday=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`};
  const sortedPlayers=useMemo(()=>[...players].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true})),[players]);
  const [label,setLabel]=useState(expense?.label??""); const [amount,setAmount]=useState(expense?String(expense.amount):""); const [category,setCategory]=useState(expense?.category??"Water"); const [paidBy,setPaidBy]=useState(expense?.paidBy??sortedPlayers[0]?.id??0); const [gameId,setGameId]=useState(expense?.gameId??games[0]?.id??0); const [split,setSplit]=useState<SplitMode>(expense?.split??(games.length?"players":"team")); const [date,setDate]=useState(expense?.date??localToday()); const [customPlayers,setCustomPlayers]=useState<number[]>(expense?.split==="custom"?expense.participants??[]:[]);
  const participants=split==="team"?players.map(p=>p.id):split==="players"?games.find(g=>g.id===gameId)?.players??[]:customPlayers;
  return <div className="modal-backdrop"><form className="modal lineup-modal" onSubmit={e=>{e.preventDefault();if(participants.length)onSave({label:label.trim(),amount:Number(amount),category,paidBy,gameId:split==="players"?gameId:undefined,split,date,participants:[...participants]})}}><ModalHead eyebrow={expense?"EDIT PAYMENT":"NEW PAYMENT"} title={expense?"Edit expense":"Add an expense"} description="Choose who paid and exactly which players should share it." close={onClose}/><div className="form-grid"><label className="wide">Description<input autoFocus required value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Practice ground rental"/></label><label>Amount ($)<input required min=".01" step=".01" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Expense date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option>Water</option><option>Fruits</option><option>IV</option><option>Practice</option><option>Team fund</option><option>League fee</option><option>Other</option></select></label><label>Paid by<select required value={paidBy} onChange={e=>setPaidBy(Number(e.target.value))}>{sortedPlayers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><SplitFields split={split} setSplit={setSplit} gameId={gameId} setGameId={setGameId} games={games}/></div>{split==="custom"&&<ParticipantPicker players={sortedPlayers} selected={customPlayers} setSelected={setCustomPlayers} title="Select everyone who should share this expense"/>}<div className="modal-actions">{onDelete&&<button type="button" className="danger-action" onClick={onDelete}>Delete expense</button>}<span className={participants.length?"ready":"warning"}>{participants.length} sharing</span><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!participants.length}>{expense?"Save changes":"Add & split"}</button></div></form></div>;
}

function CreditModal({credit,players,games,onClose,onSave,onDelete}:{credit?:Credit;players:Player[];games:Game[];onClose:()=>void;onSave:(credit:Omit<Credit,"id">)=>void;onDelete?:()=>void}) {
  const localToday=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`};
  const sortedPlayers=useMemo(()=>[...players].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true})),[players]);
  const [label,setLabel]=useState(credit?.label??""); const [amount,setAmount]=useState(credit?String(credit.amount):""); const [playerId,setPlayerId]=useState(credit?.playerId??sortedPlayers[0]?.id??0); const [date,setDate]=useState(credit?.date??localToday()); const [split,setSplit]=useState<SplitMode>(credit?.split??"team"); const [gameId,setGameId]=useState(credit?.gameId??games[0]?.id??0); const [customPlayers,setCustomPlayers]=useState<number[]>(credit?.split==="custom"?credit.participants:[]);
  const participants=split==="team"?players.map(p=>p.id):split==="players"?games.find(g=>g.id===gameId)?.players??[]:customPlayers;
  return <div className="modal-backdrop"><form className="modal lineup-modal" onSubmit={e=>{e.preventDefault();if(participants.length)onSave({label:label.trim(),amount:Number(amount),playerId,date,split,gameId:split==="players"?gameId:undefined,participants:[...participants]})}}><ModalHead eyebrow={credit?"EDIT CREDIT":"PLAYER CREDIT / WAIVER"} title={credit?"Edit player credit":"Credit a contribution"} description="Use this for umpiring or other work. The selected group funds the credit." close={onClose}/><div className="form-grid"><label className="wide">Reason<input autoFocus required value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Umpiring vs SuperKings"/></label><label>Credit amount ($)<input required min=".01" step=".01" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Credit to player<select required value={playerId} onChange={e=>setPlayerId(Number(e.target.value))}>{sortedPlayers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><SplitFields split={split} setSplit={setSplit} gameId={gameId} setGameId={setGameId} games={games}/></div>{split==="custom"&&<ParticipantPicker players={sortedPlayers} selected={customPlayers} setSelected={setCustomPlayers} title="Select the players who should fund this credit"/>}<div className="modal-actions">{onDelete&&<button type="button" className="danger-action" onClick={onDelete}>Delete credit</button>}<span className={participants.length?"ready":"warning"}>{participants.length} sharing</span><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!participants.length}>{credit?"Save changes":"Add credit"}</button></div></form></div>;
}

function SplitFields({split,setSplit,gameId,setGameId,games}:{split:SplitMode;setSplit:(split:SplitMode)=>void;gameId:number;setGameId:(id:number)=>void;games:Game[]}) {
  return <><label>Who shares it?<select value={split} onChange={e=>setSplit(e.target.value as SplitMode)}><option value="team">Full team roster</option>{games.length>0&&<option value="players">A game lineup</option>}<option value="custom">Custom players</option></select></label>{split==="players"&&<label>Game<select required value={gameId} onChange={e=>setGameId(Number(e.target.value))}>{games.map((g,i)=><option key={g.id} value={g.id}>Game {i+1} vs {g.opponent} · {g.players.length} players</option>)}</select></label>}</>;
}

function ParticipantPicker({players,selected,setSelected,title}:{players:Player[];selected:number[];setSelected:(ids:number[])=>void;title:string}) {
  return <section className="custom-participants"><div><strong>{title}</strong><span>{selected.length} selected</span></div><div className="player-picker compact">{players.map(p=><button type="button" key={p.id} className={selected.includes(p.id)?"picked":""} onClick={()=>setSelected(selected.includes(p.id)?selected.filter(id=>id!==p.id):[...selected,p.id])}><span className="avatar" style={{background:p.color}}>{p.initials}</span><span>{p.name}</span><i>{selected.includes(p.id)?"✓":"＋"}</i></button>)}</div></section>;
}
