"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Player = { id: number; name: string; initials: string; color: string };
type Game = { id: number; date: string; opponent: string; venue: string; players: number[]; status: string };
type Expense = { id: number; date: string; label: string; category: string; amount: number; paidBy: number; gameId?: number; split: "players" | "team" };

const initialPlayers: Player[] = [
  { id: 1, name: "Sai Mallela", initials: "SM", color: "#d9f99d" },
  { id: 2, name: "Arjun Rao", initials: "AR", color: "#bfdbfe" },
  { id: 3, name: "Kiran Patel", initials: "KP", color: "#fed7aa" },
  { id: 4, name: "Vikram Singh", initials: "VS", color: "#ddd6fe" },
  { id: 5, name: "Rohan Shah", initials: "RS", color: "#fecdd3" },
  { id: 6, name: "Nikhil Reddy", initials: "NR", color: "#bae6fd" },
  { id: 7, name: "Amit Kumar", initials: "AK", color: "#fde68a" },
  { id: 8, name: "Deepak Joshi", initials: "DJ", color: "#bbf7d0" },
  { id: 9, name: "Rahul Verma", initials: "RV", color: "#e9d5ff" },
  { id: 10, name: "Manoj Gupta", initials: "MG", color: "#c7d2fe" },
  { id: 11, name: "Sandeep Nair", initials: "SN", color: "#fbcfe8" },
  { id: 12, name: "Aditya Mehta", initials: "AM", color: "#a7f3d0" },
  { id: 13, name: "Varun Iyer", initials: "VI", color: "#fdba74" },
  { id: 14, name: "Pranav Das", initials: "PD", color: "#c4b5fd" },
];

const initialGames: Game[] = [
  { id: 1, date: "2026-04-12", opponent: "Desert Strikers", venue: "Pecos Park", players: [1,2,3,4,5,6,7,8,9,10,11], status: "Completed" },
  { id: 2, date: "2026-04-19", opponent: "Phoenix Kings", venue: "Cactus Yards", players: [1,2,3,4,5,6,7,8,9,10,12,13], status: "Completed" },
  { id: 3, date: "2026-04-26", opponent: "Tempe Titans", venue: "Pecos Park", players: [1,2,3,4,5,6,7,8,9,11,12], status: "Completed" },
  { id: 4, date: "2026-05-03", opponent: "Chandler XI", venue: "Snedigar Park", players: [1,2,3,4,5,6,7,8,9,10,11], status: "Upcoming" },
];

const initialExpenses: Expense[] = [
  { id: 1, date: "2026-04-01", label: "Summer League Registration", category: "League fee", amount: 2400, paidBy: 1, split: "team" },
  { id: 2, date: "2026-04-12", label: "Water & ice", category: "Water", amount: 34.50, paidBy: 3, gameId: 1, split: "players" },
  { id: 3, date: "2026-04-12", label: "Bananas & oranges", category: "Fruits", amount: 28.75, paidBy: 5, gameId: 1, split: "players" },
  { id: 4, date: "2026-04-19", label: "Water cases", category: "Water", amount: 31.20, paidBy: 2, gameId: 2, split: "players" },
  { id: 5, date: "2026-04-19", label: "Match balls", category: "Team fund", amount: 72, paidBy: 1, gameId: 2, split: "players" },
  { id: 6, date: "2026-04-26", label: "Fruit tray", category: "Fruits", amount: 42.30, paidBy: 7, gameId: 3, split: "players" },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function Home() {
  const [view, setView] = useState<"overview" | "games" | "expenses" | "settlement">("overview");
  const [players, setPlayers] = useState(initialPlayers);
  const [games, setGames] = useState(initialGames);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showExpense, setShowExpense] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [toast, setToast] = useState("");
  const loaded = useRef(false);

  useEffect(() => {
    fetch("/api/state").then(response => response.ok ? response.json() : null).then(data => {
      if (data?.players?.length) {
        setPlayers(data.players);
        setGames(data.games);
        setExpenses(data.expenses);
      }
      loaded.current = true;
    }).catch(() => { loaded.current = true; });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => {
      fetch("/api/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ players, games, expenses }),
      }).catch(() => undefined);
    }, 350);
    return () => clearTimeout(timer);
  }, [players, games, expenses]);

  const balances = useMemo(() => players.map(player => {
    const paid = expenses.filter(e => e.paidBy === player.id).reduce((sum, e) => sum + e.amount, 0);
    const share = expenses.reduce((sum, e) => {
      if (e.split === "team") return sum + e.amount / players.length;
      const game = games.find(g => g.id === e.gameId);
      return game?.players.includes(player.id) ? sum + e.amount / game.players.length : sum;
    }, 0);
    return { ...player, paid, share, balance: paid - share };
  }), [players, games, expenses]);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const outstanding = balances.filter(b => b.balance < 0).reduce((sum, b) => sum + Math.abs(b.balance), 0);
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2400); };

  function exportCsv() {
    const rows = [["Player","Games Played","Amount Paid","Fair Share","Balance"], ...balances.map(b => [
      b.name,
      games.filter(g => g.players.includes(b.id)).length,
      b.paid.toFixed(2),
      b.share.toFixed(2),
      b.balance.toFixed(2),
    ])];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replaceAll('"','""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "wolfpacks-summer-league-settlement.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    notify("Settlement CSV downloaded");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">W</span><span>WicketSplit</span></div>
        <div className="team-card">
          <div><span className="eyebrow">CURRENT TEAM</span><strong>Wolfpacks</strong></div>
          <button aria-label="Switch team">⌄</button>
        </div>
        <nav aria-label="Main navigation">
          {([["overview","▦","Overview"],["games","◉","Games"],["expenses","↗","Expenses"],["settlement","⇄","Settlement"]] as const).map(([id,icon,label]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><span>{icon}</span>{label}</button>
          ))}
        </nav>
        <div className="side-bottom">
          <button onClick={() => setShowPlayer(true)}><span>♙</span>Team roster</button>
          <button><span>⚙</span>Settings</button>
          <div className="profile"><div className="avatar dark">SM</div><div><strong>Sai Mallela</strong><small>Team treasurer</small></div><span>•••</span></div>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <div>
            <span className="season-pill"><i /> SUMMER LEAGUE 2026</span>
            <h1>{view === "overview" ? "Good afternoon, Sai." : view[0].toUpperCase() + view.slice(1)}</h1>
            <p>{view === "overview" ? "Here’s where the Wolfpacks’ season money stands." : "Wolfpacks · Summer League 2026"}</p>
          </div>
          <div className="header-actions">
            <button className="ghost" onClick={exportCsv}>↓ Export CSV</button>
            <button className="primary" onClick={() => setShowExpense(true)}>＋ Add expense</button>
          </div>
        </header>

        {view === "overview" && <>
          <section className="stats">
            <div><span>Total league cost <b>↗</b></span><strong>{money.format(total)}</strong><small>League fee + match expenses</small></div>
            <div><span>Collected <b className="blue">✓</b></span><strong>{money.format(total - outstanding)}</strong><small>{Math.round((total - outstanding) / total * 100)}% of total covered</small><progress value={total-outstanding} max={total}/></div>
            <div><span>Still to collect <b className="amber">!</b></span><strong className="amber-text">{money.format(outstanding)}</strong><small>Across {balances.filter(b => b.balance < -0.01).length} players</small></div>
            <div><span>Games played <b>◉</b></span><strong>{games.filter(g => g.status === "Completed").length} <em>/ {games.length}</em></strong><small>Next: May 3 vs Chandler XI</small></div>
          </section>

          <section className="content-grid">
            <div className="panel recent">
              <div className="panel-head"><div><h2>Recent expenses</h2><p>Latest team spending</p></div><button onClick={() => setView("expenses")}>View all →</button></div>
              <div className="expense-list">{expenses.slice().reverse().slice(0,5).map(e => {
                const payer = players.find(p => p.id === e.paidBy)!;
                return <div className="expense-row" key={e.id}><span className={`cat ${e.category.toLowerCase().replace(" ","-")}`}>{e.category === "Water" ? "≈" : e.category === "Fruits" ? "●" : e.category === "League fee" ? "◇" : "✦"}</span><div><strong>{e.label}</strong><small>{new Date(e.date+"T12:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} · Paid by {payer.name.split(" ")[0]}</small></div><strong>{money.format(e.amount)}</strong><span className="split-label">{e.split === "team" ? `÷ ${players.length}` : `÷ ${games.find(g=>g.id===e.gameId)?.players.length || 0}`}</span></div>
              })}</div>
            </div>
            <div className="panel balances">
              <div className="panel-head"><div><h2>Player balances</h2><p>Who owes and who gets back</p></div><button onClick={() => setView("settlement")}>Full settlement →</button></div>
              <div className="balance-list">{balances.sort((a,b)=>a.balance-b.balance).slice(0,6).map(b => <div key={b.id}><div className="avatar" style={{background:b.color}}>{b.initials}</div><div><strong>{b.name}</strong><small>{games.filter(g=>g.players.includes(b.id)).length} games</small></div><span className={b.balance >= 0 ? "positive" : "negative"}>{b.balance >= 0 ? "+" : "−"}{money.format(Math.abs(b.balance))}</span></div>)}</div>
              <div className="legend"><span><i className="green"/>Gets back</span><span><i className="red"/>Owes</span></div>
            </div>
          </section>
          <section className="next-game">
            <div className="date-block"><strong>03</strong><span>MAY</span></div>
            <div><span className="eyebrow">NEXT GAME · GAME 4</span><h3>Wolfpacks <i>vs</i> Chandler XI</h3><p>Sunday, 7:30 AM · Snedigar Park, Field 2</p></div>
            <div className="lineup-preview"><span>{games[3].players.length} selected</span><div>{games[3].players.slice(0,5).map(id => {const p=players.find(x=>x.id===id)!; return <i key={id} style={{background:p.color}}>{p.initials}</i>})}<i className="more">+{games[3].players.length-5}</i></div></div>
            <button onClick={()=>{setView("games");notify("Game 4 lineup is ready to edit")}}>Edit playing XI →</button>
          </section>
        </>}

        {view === "games" && <GamesView games={games} players={players} setGames={setGames} onAdd={()=>setShowGame(true)} notify={notify}/>}
        {view === "expenses" && <ExpensesView expenses={expenses} players={players} games={games} onAdd={()=>setShowExpense(true)}/>}
        {view === "settlement" && <SettlementView balances={balances} games={games} exportCsv={exportCsv}/>}
      </section>

      {showExpense && <ExpenseModal players={players} games={games} onClose={()=>setShowExpense(false)} onSave={e=>{setExpenses([...expenses,{...e,id:Date.now()}]);setShowExpense(false);notify("Expense added and shares recalculated")}}/>}
      {showGame && <GameModal players={players} onClose={()=>setShowGame(false)} onSave={g=>{setGames([...games,{...g,id:Date.now()}]);setShowGame(false);notify("Game and Playing XI added")}}/>}
      {showPlayer && <PlayerModal onClose={()=>setShowPlayer(false)} onSave={name=>{const parts=name.trim().split(/\s+/);setPlayers([...players,{id:Date.now(),name,initials:(parts[0][0]+(parts[1]?.[0]||"")).toUpperCase(),color:"#d9f99d"}]);setShowPlayer(false);notify(`${name} added to Wolfpacks`)}}/>}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}

function GamesView({games,players,setGames,onAdd,notify}:{games:Game[];players:Player[];setGames:(g:Game[])=>void;onAdd:()=>void;notify:(s:string)=>void}) {
  const [editing,setEditing]=useState<number|null>(null);
  const game=games.find(g=>g.id===editing);
  const toggle=(id:number)=>game&&setGames(games.map(g=>g.id===game.id?{...g,players:g.players.includes(id)?g.players.filter(x=>x!==id):g.players.length<12?[...g.players,id]:g.players}:g));
  return <><div className="view-toolbar"><div><h2>League games</h2><p>Select exactly 11 or 12 players for each match.</p></div><button className="primary" onClick={onAdd}>＋ Add game</button></div>
  <div className="game-grid">{games.map(g=><article className="game-card" key={g.id}><div><span className={g.status==="Completed"?"status complete":"status"}>{g.status}</span><span>GAME {g.id}</span></div><div className="game-date"><strong>{new Date(g.date+"T12:00").toLocaleDateString("en-US",{day:"2-digit"})}</strong><span>{new Date(g.date+"T12:00").toLocaleDateString("en-US",{month:"short"}).toUpperCase()}</span></div><h3>vs {g.opponent}</h3><p>{g.venue}</p><div className="selected-count"><strong>{g.players.length}</strong> players selected <span className={g.players.length>=11?"valid":"invalid"}>{g.players.length>=11?"Ready":"Need more"}</span></div><button className="card-action" onClick={()=>setEditing(g.id)}>Edit Playing {g.players.length} →</button></article>)}</div>
  {game&&<div className="modal-backdrop"><div className="modal lineup-modal"><div className="modal-head"><div><span className="eyebrow">GAME {game.id}</span><h2>Select Playing XI / XII</h2><p>vs {game.opponent} · {game.players.length} of 12 selected</p></div><button onClick={()=>setEditing(null)}>×</button></div><div className="player-picker">{players.map(p=><button key={p.id} className={game.players.includes(p.id)?"picked":""} onClick={()=>toggle(p.id)}><span className="avatar" style={{background:p.color}}>{p.initials}</span><span>{p.name}</span><i>{game.players.includes(p.id)?"✓":"＋"}</i></button>)}</div><div className="modal-actions"><span className={game.players.length>=11?"ready":"warning"}>{game.players.length>=11?"✓ Lineup ready":"Select at least 11 players"}</span><button className="primary" disabled={game.players.length<11} onClick={()=>{setEditing(null);notify("Playing lineup saved")}}>Save lineup</button></div></div></div>}</>;
}

function ExpensesView({expenses,players,games,onAdd}:{expenses:Expense[];players:Player[];games:Game[];onAdd:()=>void}) {
  return <><div className="view-toolbar"><div><h2>All expenses</h2><p>Every payment, payer, and split rule in one ledger.</p></div><button className="primary" onClick={onAdd}>＋ Add expense</button></div><div className="table-panel"><table><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Paid by</th><th>Split among</th><th>Amount</th></tr></thead><tbody>{expenses.slice().reverse().map(e=><tr key={e.id}><td>{new Date(e.date+"T12:00").toLocaleDateString()}</td><td><strong>{e.label}</strong></td><td><span className="category-chip">{e.category}</span></td><td>{players.find(p=>p.id===e.paidBy)?.name}</td><td>{e.split==="team"?`Full roster (${players.length})`:`Game ${e.gameId} (${games.find(g=>g.id===e.gameId)?.players.length})`}</td><td><strong>{money.format(e.amount)}</strong></td></tr>)}</tbody></table></div></>;
}

function SettlementView({balances,games,exportCsv}:{balances:(Player&{paid:number;share:number;balance:number})[];games:Game[];exportCsv:()=>void}) {
  return <><div className="view-toolbar"><div><h2>Final settlement</h2><p>Transparent player-by-player totals for the whole league.</p></div><button className="primary" onClick={exportCsv}>↓ Download CSV</button></div><div className="settle-summary"><div><span>Total paid</span><strong>{money.format(balances.reduce((s,b)=>s+b.paid,0))}</strong></div><div><span>Players included</span><strong>{balances.length}</strong></div><div><span>Games recorded</span><strong>{games.length}</strong></div></div><div className="table-panel"><table><thead><tr><th>Player</th><th>Games</th><th>Paid</th><th>Fair share</th><th>Final balance</th></tr></thead><tbody>{balances.map(b=><tr key={b.id}><td><div className="player-cell"><span className="avatar" style={{background:b.color}}>{b.initials}</span><strong>{b.name}</strong></div></td><td>{games.filter(g=>g.players.includes(b.id)).length}</td><td>{money.format(b.paid)}</td><td>{money.format(b.share)}</td><td><strong className={b.balance>=0?"positive":"negative"}>{b.balance>=0?"+":"−"}{money.format(Math.abs(b.balance))}</strong></td></tr>)}</tbody></table></div></>;
}

function ExpenseModal({players,games,onClose,onSave}:{players:Player[];games:Game[];onClose:()=>void;onSave:(e:Omit<Expense,"id">)=>void}) {
  const [label,setLabel]=useState(""); const [amount,setAmount]=useState(""); const [category,setCategory]=useState("Water"); const [paidBy,setPaidBy]=useState(players[0].id); const [gameId,setGameId]=useState(games[0].id); const [split,setSplit]=useState<"players"|"team">("players");
  return <div className="modal-backdrop"><form className="modal" onSubmit={e=>{e.preventDefault();onSave({label,amount:Number(amount),category,paidBy,gameId:split==="players"?gameId:undefined,split,date:new Date().toISOString().slice(0,10)})}}><div className="modal-head"><div><span className="eyebrow">NEW PAYMENT</span><h2>Add an expense</h2><p>We’ll recalculate every player’s share.</p></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid"><label className="wide">Description<input autoFocus required value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Water & ice"/></label><label>Amount ($)<input required min="0.01" step="0.01" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/></label><label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option>Water</option><option>Fruits</option><option>Team fund</option><option>League fee</option><option>Other</option></select></label><label>Paid by<select value={paidBy} onChange={e=>setPaidBy(Number(e.target.value))}>{players.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Split rule<select value={split} onChange={e=>setSplit(e.target.value as "players"|"team")}><option value="players">Playing XI / XII</option><option value="team">Full team roster</option></select></label>{split==="players"&&<label className="wide">For game<select value={gameId} onChange={e=>setGameId(Number(e.target.value))}>{games.map(g=><option value={g.id} key={g.id}>Game {g.id} vs {g.opponent} · {g.players.length} players</option>)}</select></label>}</div><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary">Add & split expense</button></div></form></div>;
}

function GameModal({players,onClose,onSave}:{players:Player[];onClose:()=>void;onSave:(g:Omit<Game,"id">)=>void}) {
  const [opponent,setOpponent]=useState(""); const [date,setDate]=useState(""); const [venue,setVenue]=useState(""); const [selected,setSelected]=useState<number[]>([]);
  return <div className="modal-backdrop"><form className="modal lineup-modal" onSubmit={e=>{e.preventDefault();if(selected.length>=11)onSave({opponent,date,venue,players:selected,status:"Upcoming"})}}><div className="modal-head"><div><span className="eyebrow">NEW FIXTURE</span><h2>Add game & lineup</h2><p>Select 11 or 12 players who will share match expenses.</p></div><button type="button" onClick={onClose}>×</button></div><div className="form-grid"><label>Opponent<input required value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="Team name"/></label><label>Date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="wide">Venue<input required value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Ground or park"/></label></div><div className="player-picker compact">{players.map(p=><button type="button" key={p.id} className={selected.includes(p.id)?"picked":""} onClick={()=>setSelected(selected.includes(p.id)?selected.filter(x=>x!==p.id):selected.length<12?[...selected,p.id]:selected)}><span className="avatar" style={{background:p.color}}>{p.initials}</span><span>{p.name}</span><i>{selected.includes(p.id)?"✓":"＋"}</i></button>)}</div><div className="modal-actions"><span className={selected.length>=11?"ready":"warning"}>{selected.length}/12 selected</span><button className="primary" disabled={selected.length<11}>Save game</button></div></form></div>;
}

function PlayerModal({onClose,onSave}:{onClose:()=>void;onSave:(name:string)=>void}) {
  const [name,setName]=useState(""); return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={e=>{e.preventDefault();onSave(name)}}><div className="modal-head"><div><span className="eyebrow">WOLFPACKS ROSTER</span><h2>Add a player</h2><p>They’ll be available for every Playing XI / XII.</p></div><button type="button" onClick={onClose}>×</button></div><label>Player name<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></label><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary">Add player</button></div></form></div>;
}
