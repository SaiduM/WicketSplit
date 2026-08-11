"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";

type Player = { id: number; name: string; initials: string; email?: string; phone?: string; color: string };
type Game = { id: number; date: string; opponent: string; venue: string; players: number[]; excludedFromSplit?: number[]; status: "Upcoming" | "Completed"; source?: "cricclubs"; externalId?: string; sourceUrl?: string };
type CricClubsMatch = { externalId:string;sourceUrl:string;seriesName:string;date:string;opponent:string;venue:string;result:string;players:Array<{externalId:string;name:string}> };
type CricClubsTeamConnection = { shortCode:string;teamName:string };
type CricClubsLeagueConnection = { seriesId:string;seriesName:string;teamId:string };
type CricClubsSeries = CricClubsLeagueConnection & { startDate:string };
type SplitMode = "players" | "team" | "custom";
type ExpenseSplitMode = SplitMode | "appearances";
type Expense = { id: number; date: string; label: string; category: string; amount: number; paidBy: number; gameId?: number; split: ExpenseSplitMode; participants?: number[]; submittedBy?: string };
type Credit = { id: number; date: string; label: string; amount: number; playerId: number; gameId?: number; split: SplitMode; participants?: number[]; kind?: "umpiring-waiver"; units?: number; rate?: number };
type SettlementPayment = { id: number; date: string; fromPlayerId: number; toPlayerId: number; amount: number; note?: string; recordedBy?: string };
type League = { id: number; name: string; season: string; status: "Active" | "Completed"; games: Game[]; expenses: Expense[]; credits?: Credit[]; payments?: SettlementPayment[]; cricclubs?: CricClubsLeagueConnection };
type Team = { id: number; name: string; sport: string; version?: number; players: Player[]; leagues: League[]; cricclubs?: CricClubsTeamConnection; access?: { role: "treasurer"|"member"; playerId?: number|null; isOwner?: boolean } };
type Account = { registered: boolean; name: string; teams: Team[] };
type View = "overview" | "roster" | "users" | "games" | "expenses" | "calculator" | "settlement" | "leagues";
type SaveState = "loading" | "saved" | "saving" | "error" | "conflict";
type ScreenshotPlayer = { name:string; playerId:number };
type ScreenshotSide = { heading:string; names:string[] };
type ScreenshotDraft = { id:number; fileName:string; date:string; side:"left"|"right"; left:ScreenshotSide; right:ScreenshotSide; opponent:string; players:ScreenshotPlayer[]; selected:boolean };
type TreasurerAccess = { email:string; playerId:number|null; isOwner:boolean; isCurrent:boolean; canRemove:boolean };
type TeamUser = {email:string|null;membershipEmail:string;role:"Owner"|"Co-treasurer"|"Player";playerId:number|null;playerName:string|null;joinedAt:string;accessType:string;isCurrent:boolean;canRemove:boolean};
type PendingTeamInvite = {playerId:number;playerName:string|null;role:string;email:string|null;createdBy:string;expiresAt:string};

const colors = ["#d9f99d","#bfdbfe","#fed7aa","#ddd6fe","#fecdd3","#bae6fd","#fde68a","#bbf7d0","#e9d5ff","#c7d2fe","#fbcfe8","#a7f3d0"];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const GAME_PAGE_SIZE = 12;
const LEDGER_PAGE_SIZE = 20;
const emptyAccount = (name: string): Account => ({ registered: false, name, teams: [] });
const initials = (name: string) => name.trim().split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase();
const playerShare = (amount:number,participants:number[],playerId:number) => participants.includes(playerId)&&participants.length ? amount/participants.length : 0;
const appearanceCategories = new Set(["League fee","League Fee","Fruits & Water","Fruits / Water","Fruits","Water"]);
const isLeagueFee = (category:string) => category==="League fee"||category==="League Fee";
const expenseCategoryForForm = (category?:string) => {
  if (!category||appearanceCategories.has(category)&&!isLeagueFee(category)) return "Fruits / Water";
  if (isLeagueFee(category)) return "League Fee";
  if (["Restaurant","Food","Night out","Party"].includes(category)) return "Restaurant";
  return "Other";
};
const usesAppearanceSplit = (expense:Pick<Expense,"category"|"split">) => expense.split==="appearances"||appearanceCategories.has(expense.category);
const isUmpiringWaiver = (credit:Credit) => credit.kind==="umpiring-waiver";
const creditDisplayLabel = (credit:Credit) => isUmpiringWaiver(credit)?credit.label.replace(/^Umpiring waiver/i,"Umpiring credit"):credit.label;
const splitEligiblePlayers = (game:Game) => game.players.filter(playerId=>!game.excludedFromSplit?.includes(playerId));
const splitAppearanceCount = (games:Game[]) => games.filter(game=>game.status==="Completed").reduce((total,game)=>total+splitEligiblePlayers(game).length,0);
const fundedGames = (games:Game[]) => games.filter(game=>game.status==="Completed"&&splitEligiblePlayers(game).length>0);
const gameSplitLabel = (games:Game[]) => { const count=fundedGames(games).length; return `Split equally by game · ${count} completed ${count===1?"game":"games"}`; };
const gameWeightedShare = (amount:number,playerId:number,games:Game[]) => {
  const completed=fundedGames(games);
  const costPerGame=completed.length?amount/completed.length:0;
  return completed.reduce((share,game)=>{
    const eligible=splitEligiblePlayers(game);
    return share+(eligible.includes(playerId)?costPerGame/eligible.length:0);
  },0);
};
const expenseParticipants = (expense:Expense,players:Player[],games:Game[]) =>
  expense.participants?.length ? expense.participants :
  expense.split==="players" ? games.find(g=>g.id===expense.gameId)?.players??[] : players.map(p=>p.id);
const splitDescription = (entry:{split:ExpenseSplitMode;category?:string;participants?:number[];gameId?:number;kind?:string},players:Player[],games:Game[]) => {
  if(entry.kind==="umpiring-waiver") return gameSplitLabel(games);
  if(entry.split==="appearances"||(entry.category&&appearanceCategories.has(entry.category))) return gameSplitLabel(games);
  const count=entry.participants?.length??(entry.split==="players"?games.find(g=>g.id===entry.gameId)?.players.length:players.length)??0;
  if(entry.split==="players") return `Game vs ${games.find(g=>g.id===entry.gameId)?.opponent??"Unknown"} (${count})`;
  return entry.split==="custom"?`Custom group (${count})`:`Full roster (${count})`;
};
const creditSplitDescription = (credit:Credit,players:Player[],games:Game[]) =>
  isUmpiringWaiver(credit) ? gameSplitLabel(games) : splitDescription(credit,players,games);

export default function Dashboard({ user }: { user: { name: string; email: string; provider?:"google"|"phone"|"password"|"team" } }) {
  const [account, setAccount] = useState<Account>(() => emptyAccount(user.name));
  const [teamId, setTeamId] = useState<number | null>(null);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [view, setView] = useState<View>("overview");
  const [modal, setModal] = useState<null | "team" | "league" | "player" | "game" | "expense" | "credit" | "payment" | "cricclubs" | "screenshots" | "member-access">(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editingLeague, setEditingLeague] = useState<League | null>(null);
  const [teamMenu, setTeamMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [loadFailed, setLoadFailed] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingCredit, setEditingCredit] = useState<Credit | null>(null);
  const [inviteTarget, setInviteTarget] = useState<Player | null>(null);
  const [invitePreview, setInvitePreview] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);
  const [treasurerAccesses, setTreasurerAccesses] = useState<TreasurerAccess[]>([]);
  const loaded = useRef(false);
  const saveSequence = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const teamVersions = useRef<Record<number,number>>({});
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const edgeSwipeStart = useRef<{x:number;y:number}|null>(null);

  useEffect(() => {
    fetch("/api/state").then(async r => {
      if (!r.ok) throw new Error("Workspace could not be loaded");
      return r.json();
    }).then(data => {
      const next = data?.registered ? data as Account : emptyAccount(user.name);
      teamVersions.current=Object.fromEntries(next.teams.filter(team=>team.version).map(team=>[team.id,team.version as number]));
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
    const payload = JSON.stringify({...account,teams:account.teams.map(team=>({...team,version:teamVersions.current[team.id]??team.version}))});
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(()=>undefined).then(async () => {
        try {
          const response = await fetch("/api/state", {
            method: "POST", headers: { "content-type": "application/json" }, body: payload,
          });
          if (!response.ok) throw new Error(response.status===409?"Workspace changed elsewhere":"Save failed");
          const result=await response.json() as {versions?:Record<string,number>};
          if(result.versions)for(const [teamId,version] of Object.entries(result.versions))teamVersions.current[Number(teamId)]=version;
          if (sequence === saveSequence.current) setSaveState("saved");
        } catch(error) {
          if (sequence === saveSequence.current) setSaveState((error as Error).message==="Workspace changed elsewhere"?"conflict":"error");
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [account]);

  useEffect(() => {
    if (!profileMenu) return;
    const closeOutside = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenu(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenu(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenu]);

  useEffect(()=>{
    history.replaceState({...history.state,wicketView:"overview"},"");
    const restoreView=(event:PopStateEvent)=>{
      const next=event.state?.wicketView as View|undefined;
      setView(next&&["overview","roster","leagues","games","expenses","calculator","settlement"].includes(next)?next:"overview");
      setMobileNavOpen(false);
    };
    addEventListener("popstate",restoreView);
    return()=>removeEventListener("popstate",restoreView);
  },[]);

  const team = account.teams.find(t => t.id === teamId) ?? account.teams[0];
  const league = team?.leagues.find(l => l.id === leagueId) ?? team?.leagues[0];
  const isTreasurer = !team?.access || team.access.role === "treasurer";
  const isSharedMember = user.provider==="team";
  const memberPlayerId = team?.access?.role==="member" ? team.access.playerId??undefined : undefined;
  const players = useMemo(()=>team?.players ?? [],[team]);
  const signedInPhone=user.email.startsWith("phone:")?user.email.slice(6).replace(/\D/g,""):"";
  const accountPlayer = players.find(player=>player.id===team?.access?.playerId)||players.find(player=>player.email?.toLowerCase()===user.email.toLowerCase())||players.find(player=>signedInPhone&&player.phone?.replace(/\D/g,"")===signedInPhone);
  const accountRole = team?.access?.role==="member"?"Player":team?.access?.isOwner===false?"Co-treasurer":"Treasurer";
  const accountDisplayName = accountPlayer?.name||account.name;
  const accountEmail = user.provider==="team"?"Shared team member access":user.email.startsWith("phone:")?"Not added":user.email;
  const accountPhone = accountPlayer?.phone||"Not added";
  const activeTeamId=team?.id;
  useEffect(()=>{if(!activeTeamId||!isTreasurer||isSharedMember)return;let active=true;fetch(`/api/team-treasurers?teamId=${activeTeamId}`).then(async response=>response.ok?response.json():null).then(result=>{if(active&&Array.isArray(result?.treasurers))setTreasurerAccesses(result.treasurers as TreasurerAccess[])}).catch(()=>undefined);return()=>{active=false}},[activeTeamId,isTreasurer,isSharedMember]);
  const games = useMemo(()=>league?.games ?? [],[league]);
  const expenses = useMemo(()=>league?.expenses ?? [],[league]);
  const credits = useMemo(()=>league?.credits ?? [],[league]);
  const payments = useMemo(()=>league?.payments ?? [],[league]);
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2200); };
  const invitePlayer = async (player: Player, role: "member"|"treasurer") => {
    if(!team)return;
    const response=await fetch("/api/invites",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({teamId:team.id,playerId:player.id,role})});
    if(!response.ok){const result=await response.json().catch(()=>({})) as {error?:string};notify(result.error??"Invitation could not be created");return}
    const {url}=await response.json() as {url:string};
    const access=role==="treasurer"
      ? "Co-treasurer access: manage the roster, leagues, games, expenses, settlements, and invitations."
      : `Team member access for ${player.name}: view team records and add expenses you paid.`;
    const restriction=player.email?` Sign in with ${player.email} to accept.`:"";
    const text=`You’re invited to join ${team.name} on WicketSplit.\n\n${access}\n\nThis private, single-use link expires in 7 days.${restriction}\n${url}`;
    setInvitePreview(text);
    notify("Invitation ready to review and copy");
  };

  const updateTeam = (updater: (team: Team) => Team) => {
    if (!team) return;
    setAccount(a => ({ ...a, teams: a.teams.map(t => t.id === team.id ? updater(t) : t) }));
  };
  const updateLeague = (updater: (league: League) => League) => updateTeam(t => ({
    ...t, leagues: t.leagues.map(l => l.id === league?.id ? updater(l) : l),
  }));
  const addPlayerFromExpense = (name: string) => {
    const id = Date.now();
    updateTeam(t => ({...t, players:[...t.players,{id,name,initials:initials(name),color:colors[t.players.length%colors.length]}]}));
    notify(`${name} added to the roster and selected`);
    return id;
  };
  const deletePlayer = async (player: Player) => {
    if(!team||!confirm(`Delete ${player.name} from ${team.name}? This is only allowed when they have no games, expenses, credits, settlement payments, or team access.`))return;
    const response=await fetch("/api/players",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({teamId:team.id,playerId:player.id})});
    const result=await response.json().catch(()=>({})) as {error?:string;version?:number};
    if(!response.ok){notify(result.error??"Player could not be deleted");return}
    if(result.version)teamVersions.current[team.id]=result.version;
    updateTeam(current=>({...current,players:current.players.filter(candidate=>candidate.id!==player.id)}));
    notify(`${player.name} deleted from the roster`);
  };
  const removeTreasurerAccess=async(access:TreasurerAccess,playerName:string)=>{
    if(!team||!access.canRemove||!confirm(`Remove co-treasurer access for ${playerName}? Their roster record and all financial history will remain.`))return;
    const response=await fetch("/api/team-treasurers",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({teamId:team.id,email:access.email})});
    const result=await response.json().catch(()=>({})) as {error?:string};
    if(!response.ok){notify(result.error??"Co-treasurer access could not be removed");return}
    setTreasurerAccesses(current=>current.filter(candidate=>candidate.email!==access.email));notify(`${playerName}'s co-treasurer access removed`);
  };
  const deleteTeam = async () => {
    if(!team||!confirm(`Permanently delete ${team.name}? This removes its roster, leagues, games, expenses, credits, settlement payments, memberships, and invitations for everyone.`))return;
    const response=await fetch("/api/teams",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({teamId:team.id})});
    const result=await response.json().catch(()=>({})) as {error?:string};
    if(!response.ok){notify(result.error??"Team could not be deleted");return}
    const remaining=account.teams.filter(candidate=>candidate.id!==team.id);
    setAccount(current=>({...current,teams:current.teams.filter(candidate=>candidate.id!==team.id)}));
    setTeamId(remaining[0]?.id??null);setLeagueId(remaining[0]?.leagues[0]?.id??null);setView("overview");setTeamMenu(false);
    notify(`${team.name} deleted`);
  };
  const deleteLeague = (target: League) => {
    if(!team||!confirm(`Permanently delete ${target.name}? This removes all of its games, expenses, credits, and settlement payments. This cannot be undone.`))return;
    const remaining=team.leagues.filter(candidate=>candidate.id!==target.id);
    updateTeam(current=>({...current,leagues:current.leagues.filter(candidate=>candidate.id!==target.id)}));
    setEditingLeague(null);setLeagueId(remaining[0]?.id??null);setView("leagues");
    notify(`${target.name} deleted`);
  };
  const linkAccountPlayer=async(playerId:number)=>{
    if(!team)return;
    const response=await fetch("/api/account",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({teamId:team.id,playerId})});
    const result=await response.json().catch(()=>({})) as {error?:string};
    if(!response.ok){notify(result.error??"Account could not be linked");return}
    setAccount(current=>({...current,teams:current.teams.map(candidate=>candidate.id===team.id?{...candidate,access:{role:candidate.access?.role??"treasurer",isOwner:candidate.access?.isOwner,playerId}}:candidate)}));
    notify("Your account is now linked to this roster player");
  };

  const balances = useMemo(() => players.map(player => {
    const paid = expenses.filter(e => e.paidBy === player.id).reduce((s,e) => s + e.amount, 0);
    const credit = credits.filter(e => e.playerId === player.id).reduce((s,e) => s + e.amount, 0);
    const expenseShare = expenses.reduce((sum,e) => {
      if(usesAppearanceSplit(e)) return sum+gameWeightedShare(e.amount,player.id,games);
      return sum+playerShare(e.amount,expenseParticipants(e,players,games),player.id);
    }, 0);
    const creditShare = credits.reduce((sum,e) => sum + (isUmpiringWaiver(e)?gameWeightedShare(e.amount,player.id,games):playerShare(e.amount,e.participants??[],player.id)),0);
    const share = expenseShare + creditShare;
    const sent = payments.filter(payment=>payment.fromPlayerId===player.id).reduce((sum,payment)=>sum+payment.amount,0);
    const received = payments.filter(payment=>payment.toPlayerId===player.id).reduce((sum,payment)=>sum+payment.amount,0);
    const originalBalance = paid + credit - share;
    return { ...player, paid, credit, share, sent, received, originalBalance, balance: originalBalance + sent - received };
  }), [players, games, expenses, credits, payments]);

  if (saveState === "loading") return <main className="workspace-loading"><span className="brand-mark">W</span><strong>Loading your workspace…</strong><p>Syncing your teams and leagues.</p></main>;
  if (loadFailed) return <main className="workspace-loading load-error"><span>!</span><strong>We couldn’t load your workspace.</strong><p>Your saved data has not been changed.</p><button className="primary" onClick={()=>location.reload()}>Try again</button></main>;

  if (!account.registered) {
    if(isSharedMember)return <main className="workspace-loading load-error"><span>!</span><strong>This team access is no longer available.</strong><p>Ask your treasurer for the current team link and PIN.</p><a className="primary" href="/api/auth/logout">Return to sign in</a></main>;
    return <Registration user={user} onRegister={(name, teamName, leagueName) => {
      const id = Date.now(); const firstLeagueId = id + 1;
      const next: Account = { registered: true, name, teams: [{
        id, name: teamName, sport: "Cricket", players: [], leagues: [{
          id: firstLeagueId, name: leagueName, season: new Date().getFullYear().toString(),
          status: "Active", games: [], expenses: [], credits: [], payments: [],
        }],
      }] };
      setAccount(next); setTeamId(id); setLeagueId(firstLeagueId); notify("Your team workspace is ready");
    }} />;
  }

  function selectTeam(id: number) {
    const selected = account.teams.find(t => t.id === id)!;
    setTeamId(id); setLeagueId(selected.leagues[0]?.id ?? null); setView("overview"); setTeamMenu(false); setMobileNavOpen(false);
  }

  function exportCsv() {
    if (!team || !league) return;
    const exportBalances = balances.filter(b => Math.abs(b.paid) > .005 || Math.abs(b.credit) > .005 || Math.abs(b.share) > .005 || Math.abs(b.sent) > .005 || Math.abs(b.received) > .005);
    const completedGames=games.filter(game=>game.status==="Completed");
    const appearancePool=expenses.filter(usesAppearanceSplit).reduce((sum,expense)=>sum+expense.amount,0)+credits.filter(isUmpiringWaiver).reduce((sum,credit)=>sum+credit.amount,0);
    const fundedGameCount=fundedGames(completedGames).length;
    const perGame=fundedGameCount?appearancePool/fundedGameCount:0;
    const rows = [["Team",team.name],["League",league.name],["Season",league.season],[],
      ["PLAYER SETTLEMENT"],["Player","Games Played","Split-eligible Appearances","Cash Paid","Credits","Fair Share","Settlement Sent","Settlement Received","Remaining Balance"],
      ...exportBalances.map(b => [b.name,games.filter(g=>g.status==="Completed"&&g.players.includes(b.id)).length,games.filter(g=>g.status==="Completed"&&splitEligiblePlayers(g).includes(b.id)).length,b.paid.toFixed(2),b.credit.toFixed(2),b.share.toFixed(2),b.sent.toFixed(2),b.received.toFixed(2),b.balance.toFixed(2)]),
      [],["PER-GAME BREAKDOWN"],["Game","Players","Payers","Excluded","Allocated Cost","Cost per Payer"],
      ...completedGames.map((game,index)=>{const eligible=splitEligiblePlayers(game);const excluded=(game.excludedFromSplit??[]).map(id=>players.find(player=>player.id===id)?.name).filter(Boolean).join(", ");return [`Game ${index+1}: ${game.opponent}`,game.players.length,eligible.length,excluded,(eligible.length?perGame:0).toFixed(2),(eligible.length?perGame/eligible.length:0).toFixed(2)]}),
      [],["SUGGESTED PAYMENTS"],["From","To","Amount"],
      ...settlementTransfers(exportBalances).map(t=>[t.from,t.to,t.amount.toFixed(2)]),
      [],["CONFIRMED SETTLEMENT PAYMENTS"],["Date","From","To","Amount","Note","Recorded by"],
      ...payments.map(payment=>[payment.date,players.find(player=>player.id===payment.fromPlayerId)?.name??"Unknown",players.find(player=>player.id===payment.toPlayerId)?.name??"Unknown",payment.amount.toFixed(2),payment.note??"",payment.recordedBy??""]),
      [],["EXPENSE DETAILS"],["Date","Description","Category","Paid by","Split among","Amount"],
      ...expenses.map(e=>[e.date,e.label,e.category,players.find(p=>p.id===e.paidBy)?.name??"Unknown",
        splitDescription(e,players,games),e.amount.toFixed(2)]),
      [],["TEAM-FUNDED CREDIT DETAILS"],["Date","Description","Credited player","Shared by","Amount"],
      ...credits.map(c=>[c.date,creditDisplayLabel(c),players.find(p=>p.id===c.playerId)?.name??"Unknown",creditSplitDescription(c,players,games),c.amount.toFixed(2)])];
    const safeCell=(value:unknown)=>{const text=String(value);return /^[=+\-@]/.test(text)?`'${text}`:text};
    const csv = rows.map(r => r.map(c => `"${safeCell(c).replaceAll('"','""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    link.download = `${team.name}-${league.name}-settlement.csv`.replaceAll(" ","-").toLowerCase(); link.click();
    URL.revokeObjectURL(link.href); notify("Settlement CSV downloaded");
  }

  const toggleNavigation=()=>window.matchMedia("(max-width: 760px)").matches?setMobileNavOpen(open=>!open):setSidebarCollapsed(collapsed=>!collapsed);
  const chooseView=(next:View)=>{
    if(next!==view)history.pushState({...history.state,wicketView:next},"");
    setView(next);setMobileNavOpen(false);
  };
  const goBack=()=>view==="overview"?undefined:history.back();
  const beginEdgeSwipe=(event:TouchEvent)=>{const touch=event.touches[0];edgeSwipeStart.current=touch.clientX<=28?{x:touch.clientX,y:touch.clientY}:null};
  const finishEdgeSwipe=(event:TouchEvent)=>{const start=edgeSwipeStart.current;edgeSwipeStart.current=null;if(!start||(navigator as Navigator&{standalone?:boolean}).standalone!==true)return;const touch=event.changedTouches[0];const horizontal=touch.clientX-start.x;const vertical=Math.abs(touch.clientY-start.y);if(horizontal>=75&&horizontal>vertical*1.35)goBack()};
  const navigationItems:ReadonlyArray<readonly [View,string,string]>=isSharedMember
    ? [["overview","▦","Home"],["games","◉","Games"],["expenses","↗","Expenses"],["settlement","⇄","My breakdown"]]
    : [
        ["overview","▦","Home"],["roster","♙","Team roster"],["leagues","▤","Leagues"],["games","◉","Games"],
        ["expenses","↗","Expenses"],["calculator","÷","Calculator"],["settlement","⇄","Settlement"],
        ...(isTreasurer?[["users","◎","Team users"] as const]:[]),
      ];

  return <main className={`app-shell ${sidebarCollapsed?"sidebar-collapsed":""}`}>
    <button className="app-nav-trigger" type="button" aria-label="Toggle navigation" onClick={toggleNavigation}><span></span><span></span><span></span></button>
    {view!=="overview"&&<button className="mobile-back" type="button" aria-label="Go back" onClick={goBack}><span>‹</span> Back</button>}
    {mobileNavOpen&&<button className="nav-scrim" type="button" aria-label="Close navigation" onClick={()=>setMobileNavOpen(false)}/>}
    <aside className={`sidebar ${mobileNavOpen?"mobile-open":""} ${sidebarCollapsed?"desktop-collapsed":""}`}>
      <button className="sidebar-close" type="button" aria-label="Close navigation" onClick={()=>window.matchMedia("(max-width: 760px)").matches?setMobileNavOpen(false):setSidebarCollapsed(true)}>×</button>
      <a className="brand" href="/" aria-label="WicketSplit homepage"><span className="brand-mark">W</span><span>WicketSplit</span></a>
      <div className="team-switch-wrap">
        <button className="team-card team-switch" disabled={isSharedMember} onClick={()=>!isSharedMember&&setTeamMenu(!teamMenu)}>
          <div><span className="eyebrow">CURRENT TEAM</span><strong>{team?.name ?? "Choose team"}</strong></div>{!isSharedMember&&<span>⌄</span>}
        </button>
        {teamMenu && <div className="team-menu">
          {account.teams.map(t=><button className={t.id===team?.id?"selected":""} key={t.id} onClick={()=>selectTeam(t.id)}><span>{initials(t.name)}</span><div><strong>{t.name}</strong><small>{t.players.length} players · {t.leagues.length} leagues</small></div>{t.id===team?.id&&<i>✓</i>}</button>)}
          {!isSharedMember&&<button className="add-team-link" onClick={()=>{setModal("team");setTeamMenu(false)}}>＋ Register another team</button>}
          {team&&isTreasurer&&team.access?.isOwner!==false&&<button className="delete-team-link" onClick={deleteTeam}>Delete {team.name}</button>}
        </div>}
      </div>
      <nav aria-label="Main navigation">
        {navigationItems.map(([id,icon,label])=>
          <button key={id} className={`${view===id?"active":""} ${!isSharedMember&&id==="calculator"?"mobile-secondary-nav":""}`.trim()} onClick={()=>chooseView(id)}><span>{icon}</span>{label}</button>)}
      </nav>
      <div className="side-bottom">
        <div className="profile-wrap" ref={profileMenuRef}>
          {profileMenu&&<div className="profile-menu"><div className="profile-menu-title"><strong>Account</strong><span>{team?.name}</span></div><dl><div><dt>Name</dt><dd>{accountDisplayName}</dd></div><div><dt>Role</dt><dd><span className="account-role">{accountRole}</span></dd></div><div><dt>Email</dt><dd>{accountEmail}</dd></div><div><dt>Phone</dt><dd>{accountPhone}</dd></div></dl><a href="/api/auth/logout" aria-label="Log out"><span>↪</span>Log out</a></div>}
          <div className="profile"><div className="avatar dark">{initials(account.name)}</div><div><strong>{account.name}</strong><small>{user.provider==="team"?"Team member access":user.email.startsWith("phone:")?user.email.slice(6):user.email}</small></div><button type="button" aria-label="Open account menu" aria-expanded={profileMenu} onClick={()=>setProfileMenu(open=>!open)}>•••</button></div>
        </div>
      </div>
    </aside>

    <section className="workspace" onTouchStart={beginEdgeSwipe} onTouchEnd={finishEdgeSwipe}>
      <header>
        <div>
          <div className="league-picker">
            {league ? <>
              <div className="league-select-label"><span className="eyebrow">CURRENT LEAGUE</span><span className={`league-status-dot ${league.status.toLowerCase()}`}>{league.status}</span></div>
              <div className="league-select-shell">
                <span className="league-icon">▤</span>
                <select aria-label="Current league" value={league.id} onChange={e=>setLeagueId(Number(e.target.value))}>{team?.leagues.map(l=><option key={l.id} value={l.id}>{l.name} · {l.season}</option>)}</select>
                <span className="league-chevron">⌄</span>
              </div>
            </> : <span className="season-pill"><i /> NO LEAGUE SELECTED</span>}
          </div>
          <h1>{view==="overview"?`Welcome back, ${accountDisplayName.split(" ")[0]}.`:isSharedMember&&view==="settlement"?"My breakdown":title(view)}</h1>
          <p>{team?.name}{league ? ` · ${league.name}` : " · Create a league to begin"}</p>
        </div>
        <div className="header-actions">
          {saveState==="conflict"
            ? <button className="save-retry" onClick={()=>location.reload()}>Team updated elsewhere · Reload latest</button>
            : saveState==="error"
            ? <button className="save-retry" onClick={()=>setAccount(current=>({...current}))}>Not saved · Retry</button>
            : <span className={`save-state ${saveState}`}>{saveState==="saving"?"Saving…":"✓ Saved"}</span>}
          {view==="roster" && isTreasurer && <><button className="ghost" onClick={()=>setModal("member-access")}>🔗 Team member access</button><button className="primary" onClick={()=>setModal("player")}>＋ Add player</button></>}
          {view==="leagues" && isTreasurer && <button className="primary" onClick={()=>setModal("league")}>＋ Create league</button>}
        </div>
      </header>

      {!team ? <EmptyState icon="♙" title={isSharedMember?"Team unavailable":"Register your first team"} text={isSharedMember?"Ask your treasurer for the current team link and PIN.":"Create a team workspace, add its roster, then organize expenses by league."} action={isSharedMember?undefined:"Register team"} onAction={isSharedMember?undefined:()=>setModal("team")}/> :
       !league && view!=="roster" && view!=="users" && view!=="leagues" ? <EmptyState icon="▤" title={isSharedMember?"No league available":"Create your first league"} text={isSharedMember?"Your treasurer has not created a league yet.":"A team can have as many leagues and seasons as you need."} action={isSharedMember?undefined:"Create league"} onAction={isSharedMember?undefined:()=>setModal("league")}/> : <>
        {view==="overview" && league && <PersonalHome player={accountPlayer} players={players} games={games} credits={credits} balances={balances} onLink={linkAccountPlayer} setView={chooseView} onPlayer={()=>setModal("player")}/>}
        {view==="roster" && <RosterView team={team} canManage={isTreasurer} treasurerAccesses={treasurerAccesses} onInvite={player=>{setInviteTarget(player);setInvitePreview("")}} onRemoveAccess={removeTreasurerAccess} onAdd={()=>setModal("player")} onEdit={setEditingPlayer} onDelete={deletePlayer}/>}
        {view==="users" && isTreasurer && <TeamUsersView team={team} currentEmail={user.email} onManageLink={()=>setModal("member-access")} onRoster={()=>chooseView("roster")} notify={notify}/>}
        {view==="leagues" && <LeaguesView team={team} canManage={isTreasurer} activeId={league?.id} onSelect={id=>{setLeagueId(id);chooseView("overview")}} onAdd={()=>setModal("league")} onSync={()=>setModal("cricclubs")} onEdit={setEditingLeague}/>}
        {view==="games" && league && <GamesView games={games} expenses={expenses} credits={credits} players={players} canManage={isTreasurer} onAdd={()=>setModal("game")} onScreenshots={()=>setModal("screenshots")} onSync={()=>setModal("cricclubs")} onRoster={()=>chooseView("roster")} onChange={next=>updateLeague(l=>({...l,games:next}))} notify={notify}/>}
        {view==="expenses" && league && <ExpensesView expenses={expenses} credits={credits} players={players} games={games} canManage={isTreasurer} memberEmail={user.email} onAdd={()=>setModal("expense")} onCredit={()=>setModal("credit")} onRoster={()=>chooseView("roster")} onEdit={setEditingExpense} onDelete={expense=>{if(confirm(`Delete “${expense.label}”? This will recalculate every balance.`)){updateLeague(current=>({...current,expenses:current.expenses.filter(entry=>entry.id!==expense.id)}));notify("Expense deleted and balances recalculated")}}} onEditCredit={setEditingCredit}/>}
        {view==="calculator" && league && <CalculatorView players={players} games={games} expenses={expenses} credits={credits} balances={balances}/>}
        {view==="settlement" && league && <SettlementView team={team} league={league} balances={balances} games={games} expenses={expenses} credits={credits} payments={payments} players={players} canManage={isTreasurer} viewerPlayerId={isSharedMember?memberPlayerId:undefined} onRecord={()=>setModal("payment")} onDelete={payment=>{if(confirm(`Delete this ${money.format(payment.amount)} payment record? Remaining balances will be recalculated.`)){updateLeague(current=>({...current,payments:(current.payments??[]).filter(entry=>entry.id!==payment.id)}));notify("Payment record deleted and balances restored")}}} exportCsv={exportCsv} notify={notify}/>}
      </>}
    </section>

    {modal==="team" && !isSharedMember && <NameModal eyebrow="NEW TEAM" title="Register a team" description="Each team gets its own roster, leagues, games, and finances." label="Team name" placeholder="e.g. Wolfpacks" onClose={()=>setModal(null)} onSave={name=>{const id=Date.now();setAccount(a=>({...a,teams:[...a.teams,{id,name,sport:"Cricket",players:[],leagues:[]}]}));setTeamId(id);setLeagueId(null);setModal(null);setView("leagues");notify(`${name} registered — import from CricClubs or create a league`)}}/>}
    {modal==="league" && team && isTreasurer && <LeagueModal onClose={()=>setModal(null)} onSave={(name,season)=>{const id=Date.now();updateTeam(t=>({...t,leagues:[...t.leagues,{id,name,season,status:"Active",games:[],expenses:[],credits:[],payments:[]}]}));setLeagueId(id);setModal(null);setView("overview");notify(`${name} created`)}}/>}
    {editingLeague && team && <LeagueModal league={editingLeague} onClose={()=>setEditingLeague(null)} onDelete={()=>deleteLeague(editingLeague)} onSave={(name,season,status)=>{updateTeam(t=>({...t,leagues:t.leagues.map(l=>l.id===editingLeague.id?{...l,name,season,status}:l)}));setEditingLeague(null);notify("League details updated")}}/>}
    {modal==="player" && team && <PlayerModal teamName={team.name} onClose={()=>setModal(null)} onSave={(name,email,phone)=>{const id=Date.now();updateTeam(t=>({...t,players:[...t.players,{id,name,email,phone,initials:initials(name),color:colors[t.players.length%colors.length]}]}));setModal(null);notify(`${name} added to ${team.name}`)}}/>}
    {editingPlayer && team && <PlayerModal teamName={team.name} player={editingPlayer} onClose={()=>setEditingPlayer(null)} onSave={(name,email,phone)=>{updateTeam(t=>({...t,players:t.players.map(p=>p.id===editingPlayer.id?{...p,name,email,phone,initials:initials(name)}:p)}));setEditingPlayer(null);notify("Player details updated")}}/>}
    {modal==="game" && league && <GameModal suggestedPlayers={games.at(-1)?.players} players={players} onClose={()=>setModal(null)} onSave={game=>{updateLeague(l=>({...l,games:[...l.games,{...game,id:Date.now()}]}));setModal(null);notify("Game and lineup added")}}/>}
    {modal==="member-access" && team && <TeamMemberAccessModal team={team} onClose={()=>setModal(null)} notify={notify}/>}
    {modal==="screenshots" && team && league && <ScreenshotImportModal teamName={team.name} players={players} onClose={()=>setModal(null)} onImport={drafts=>{const base=Date.now();let nextId=base;updateTeam(current=>{const roster=[...current.players];const byName=new Map(roster.map(player=>[normalizeOcrText(player.name),player]));const imported:Game[]=[];for(const draft of drafts){const lineup=draft.players.map(selection=>{if(selection.playerId)return selection.playerId;const key=normalizeOcrText(selection.name);let player=byName.get(key);if(!player){player={id:++nextId,name:selection.name.trim(),initials:initials(selection.name),color:colors[roster.length%colors.length]};roster.push(player);byName.set(key,player)}return player.id});imported.push({id:++nextId,date:draft.date,opponent:draft.opponent.trim(),venue:"",players:lineup,status:"Completed"})}return {...current,players:roster,leagues:current.leagues.map(item=>item.id===league.id?{...item,games:[...item.games,...imported]}:item)}});setModal(null);notify(`${drafts.length} ${drafts.length===1?"game":"games"} imported from screenshots`)}}/>}
    {modal==="cricclubs" && team && <CricClubsImportModal teamName={team.name} connection={team.cricclubs} leagues={team.leagues} currentLeague={league} players={players} onClose={()=>setModal(null)} onLink={(connection,leagueConnection,targetLeagueId)=>{updateTeam(current=>({...current,cricclubs:connection,leagues:current.leagues.map(item=>item.id===targetLeagueId?{...item,cricclubs:leagueConnection}:item)}));notify(`${leagueConnection.seriesName} linked`)}} onImport={(imported,connection,leagueConnection,newPlayers,targetLeagueId)=>{const base=Date.now();const savedGames=imported.map((game,index)=>({...game,id:base+index}));if(targetLeagueId){updateTeam(current=>({...current,cricclubs:connection,players:[...current.players,...newPlayers],leagues:current.leagues.map(item=>item.id===targetLeagueId?{...item,cricclubs:leagueConnection,games:[...item.games,...savedGames]}:item)}));setLeagueId(targetLeagueId)}else{const id=base+imported.length+1;const season=leagueConnection.seriesName.match(/\b(20\d{2}(?:-\d{2})?)\b/)?.[1]??new Date().getFullYear().toString();updateTeam(current=>({...current,cricclubs:connection,players:[...current.players,...newPlayers],leagues:[...current.leagues,{id,name:leagueConnection.seriesName,season,status:"Active",games:savedGames,expenses:[],credits:[],payments:[],cricclubs:leagueConnection}]}));setLeagueId(id)}setView("games");setModal(null);notify(`${newPlayers.length?`${newPlayers.length} roster players added · `:""}${targetLeagueId?`${imported.length} new ${imported.length===1?"game":"games"} imported`:`${leagueConnection.seriesName} created with ${imported.length} ${imported.length===1?"game":"games"}`}`)}}/>}
    {modal==="expense" && league && isTreasurer && <ExpenseModal existingExpenses={expenses} leagueFeeExists={expenses.some(e=>isLeagueFee(e.category))} players={players} games={games} onAddPlayer={addPlayerFromExpense} onClose={()=>setModal(null)} onSave={expense=>{updateLeague(l=>({...l,expenses:[...l.expenses,{...expense,id:Date.now(),submittedBy:user.email.toLowerCase()}]}));setModal(null);notify("Expense added and split recalculated")}}/>}
    {editingExpense && league && <ExpenseModal expense={editingExpense} memberPlayerId={isTreasurer?undefined:memberPlayerId} existingExpenses={expenses} leagueFeeExists={expenses.some(e=>isLeagueFee(e.category)&&e.id!==editingExpense.id)} players={players} games={games} onAddPlayer={isTreasurer?addPlayerFromExpense:undefined} onClose={()=>setEditingExpense(null)} onDelete={()=>{if(confirm(`Delete “${editingExpense.label}”? This will recalculate every balance.`)){updateLeague(l=>({...l,expenses:l.expenses.filter(e=>e.id!==editingExpense.id)}));setEditingExpense(null);notify("Expense deleted and balances recalculated")}}} onSave={expense=>{updateLeague(l=>({...l,expenses:l.expenses.map(e=>e.id===editingExpense.id?{...expense,id:e.id,submittedBy:e.submittedBy}:e)}));setEditingExpense(null);notify("Expense updated and split recalculated")}}/>}
    {modal==="credit" && league && <CreditModal players={players} games={games} onClose={()=>setModal(null)} onSave={entries=>{const base=Date.now();updateLeague(l=>({...l,credits:[...(l.credits??[]),...entries.map((entry,index)=>({...entry,id:base+index}))]}));setModal(null);notify(`${entries.length} team-funded umpiring ${entries.length===1?"credit":"credits"} added`)}}/>}
    {modal==="payment" && league && <SettlementPaymentModal players={players} balances={balances} suggestions={settlementTransfers(balances)} onClose={()=>setModal(null)} onSave={payment=>{updateLeague(l=>({...l,payments:[...(l.payments??[]),{...payment,id:Date.now(),recordedBy:user.email.toLowerCase()}]}));setModal(null);notify("Payment confirmed and remaining balances recalculated")}}/>}
    {editingCredit && league && <CreditModal credit={editingCredit} players={players} games={games} onClose={()=>setEditingCredit(null)} onDelete={()=>{if(confirm(`Delete credit “${editingCredit.label}”? This will recalculate every balance.`)){updateLeague(l=>({...l,credits:(l.credits??[]).filter(c=>c.id!==editingCredit.id)}));setEditingCredit(null);notify("Credit deleted and balances recalculated")}}} onSave={entries=>{const updated=entries[0];if(!updated)return;updateLeague(l=>({...l,credits:(l.credits??[]).map(c=>c.id===editingCredit.id?{...updated,id:c.id}:c)}));setEditingCredit(null);notify("Team-funded umpiring credit updated")}}/>}
    {inviteTarget&&team&&<InviteAccessModal player={inviteTarget} teamName={team.name} preview={invitePreview} onClose={()=>{setInviteTarget(null);setInvitePreview("")}} onInvite={role=>invitePlayer(inviteTarget,role)} onCopy={async()=>{try{await navigator.clipboard.writeText(invitePreview);notify("Invitation copied — paste it into your team chat")}catch{notify("Could not copy automatically — select the message and copy it")}}}/>}
    {toast && <div className="toast">✓ {toast}</div>}
  </main>;
}

function title(view: View) { return ({roster:"Team roster",users:"Team users",leagues:"Leagues",games:"Games",expenses:"Expenses",calculator:"Calculator",settlement:"Settlement",overview:"Home"})[view]; }

function Registration({user,onRegister}:{user:{name:string;email:string};onRegister:(name:string,team:string,league:string)=>void}) {
  const [name,setName]=useState(user.name); const [team,setTeam]=useState(""); const [league,setLeague]=useState("");
  return <main className="registration-page"><section className="registration-brand"><div className="brand"><span className="brand-mark">W</span><span>WicketSplit</span></div><div><span className="eyebrow">BUILT FOR TEAM TREASURERS</span><h1>Every game.<br/>Every expense.<br/><em>Fairly split.</em></h1><p>Pick the Playing XI or XII, record who paid, and finish every league with a settlement everyone can understand.</p></div><div className="registration-points"><span>✓ One roster, many leagues</span><span>✓ Automatic player shares</span><span>✓ Clean CSV settlement</span></div></section>
  <section className="registration-form-wrap"><form className="registration-form" onSubmit={e=>{e.preventDefault();onRegister(name,team,league)}}><span className="step-badge">1 minute setup</span><h2>Create your workspace</h2><p>You’re signed in as <strong>{user.email.startsWith("phone:")?user.email.slice(6):user.email}</strong>. Start with your first cricket team and league.</p><label>Your name<input required value={name} onChange={e=>setName(e.target.value)} /></label><label>First team name<input autoFocus required value={team} onChange={e=>setTeam(e.target.value)} placeholder="e.g. Wolfpacks"/></label><label>First league name<input required value={league} onChange={e=>setLeague(e.target.value)} placeholder="e.g. Summer League 2026"/></label><button className="primary">Create team workspace →</button><small>You can register more teams and create multiple leagues after setup.</small></form></section></main>;
}

function PersonalHome({player,players,games,credits,balances,onLink,setView,onPlayer}:{player?:Player;players:Player[];games:Game[];credits:Credit[];balances:PlayerBalance[];onLink:(playerId:number)=>Promise<void>;setView:(view:View)=>void;onPlayer:()=>void}) {
  const [selectedPlayerId,setSelectedPlayerId]=useState(players[0]?.id??0);
  const [linking,setLinking]=useState(false);
  if(!players.length)return <EmptyState icon="♙" title="Build your team roster" text="Add yourself and your teammates so WicketSplit can create a personal dashboard for every player." action="Add first player" onAction={onPlayer}/>;
  if(!player)return <section className="personal-link-card"><span className="eyebrow">ONE-TIME SETUP</span><h2>Which roster player are you?</h2><p>Link your signed-in account to your roster entry. This controls only your personal Home view and does not change team roles or finance records.</p><label>Your roster player<select value={selectedPlayerId} onChange={event=>setSelectedPlayerId(Number(event.target.value))}>{[...players].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true})).map(candidate=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label><button className="primary" disabled={!selectedPlayerId||linking} onClick={async()=>{setLinking(true);await onLink(selectedPlayerId);setLinking(false)}}>{linking?"Linking…":"Link my account"}</button><small>Each roster player can be linked to only one account.</small></section>;
  const balance=balances.find(entry=>entry.id===player.id);
  if(!balance)return <MiniEmpty text="Your player balance is not available yet."/>;
  const myGames=games.filter(game=>game.players.includes(player.id)).sort((a,b)=>b.date.localeCompare(a.date));
  const completedGames=myGames.filter(game=>game.status==="Completed").length;
  const umpiringCredit=credits.filter(credit=>credit.playerId===player.id&&isUmpiringWaiver(credit)).reduce((sum,credit)=>sum+credit.amount,0);
  const myTransfers=settlementTransfers(balances).filter(transfer=>transfer.fromPlayerId===player.id||transfer.toPlayerId===player.id);
  const balanceState=balance.balance<-.005?{label:"You need to pay",tone:"owes",amount:-balance.balance}:balance.balance>.005?{label:"You will receive",tone:"due",amount:balance.balance}:{label:"You’re fully settled",tone:"settled",amount:0};
  return <div className="personal-home"><section className={`my-balance-hero ${balanceState.tone}`}><div><span className="eyebrow">MY BALANCE</span><h2>{balanceState.label}</h2><strong>{money.format(balanceState.amount)}</strong><p>After all recorded expenses, team-funded umpiring credits, and confirmed payments.</p></div><div className="personal-home-actions"><button className="ghost" onClick={()=>setView("settlement")}>View settlement details →</button></div></section>
    <section className="my-stats"><div><span>My fair share</span><strong>{money.format(balance.share)}</strong><small>Costs assigned to you</small></div><div><span>I paid for the team</span><strong>{money.format(balance.paid)}</strong><small>Recorded expenses you covered</small></div><div><span>Umpiring credit</span><strong>{money.format(umpiringCredit)}</strong><small>Full credit earned; funded equally by game</small></div><div><span>My completed games</span><strong>{completedGames}</strong><small>{myGames.length} selected in total</small></div></section>
    <section className="personal-grid"><div className="panel my-settlement"><div className="panel-head"><div><h2>My settlement</h2><p>Who you should pay or receive money from</p></div></div>{myTransfers.length?<div className="my-transfer-list">{myTransfers.map((transfer,index)=><div key={`${transfer.fromPlayerId}-${transfer.toPlayerId}-${index}`}><span>{transfer.fromPlayerId===player.id?"Pay":"Receive from"}</span><strong>{transfer.fromPlayerId===player.id?transfer.to:transfer.from}</strong><b>{money.format(transfer.amount)}</b></div>)}</div>:<MiniEmpty text="You have nothing left to settle."/>}</div>
    <div className="panel my-games-panel"><div className="panel-head"><div><h2>My games</h2><p>Games where you are in the selected lineup</p></div><button onClick={()=>setView("games")}>View team games →</button></div>{myGames.length?<div className="my-game-list">{myGames.map(game=><div key={game.id}><div className="my-game-date"><strong>{game.date?new Date(game.date+"T12:00").toLocaleDateString("en-US",{day:"2-digit"}):"—"}</strong><span>{game.date?new Date(game.date+"T12:00").toLocaleDateString("en-US",{month:"short"}).toUpperCase():"NO DATE"}</span></div><div><strong>vs {game.opponent}</strong><small>{game.venue||"Venue not specified"} · {game.players.length===12?"Playing XII":"Playing XI"}</small></div><span className={game.status==="Completed"?"status complete":"status"}>{game.status}</span></div>)}</div>:<MiniEmpty text="You have not been selected for a game in this league yet."/>}</div></section>
  </div>;
}

function TeamUsersView({team,currentEmail,onManageLink,onRoster,notify}:{team:Team;currentEmail:string;onManageLink:()=>void;onRoster:()=>void;notify:(message:string)=>void}){
  const [users,setUsers]=useState<TeamUser[]>([]);const [invites,setInvites]=useState<PendingTeamInvite[]>([]);const [lastUpdate,setLastUpdate]=useState<string|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [reload,setReload]=useState(0);
  useEffect(()=>{let active=true;fetch(`/api/team-users?teamId=${team.id}`).then(async response=>{const result=await response.json() as {users?:TeamUser[];pendingInvites?:PendingTeamInvite[];lastTeamUpdate?:string|null;error?:string};if(!response.ok)throw new Error(result.error??"Team users could not be loaded");if(active){setUsers(result.users??[]);setInvites(result.pendingInvites??[]);setLastUpdate(result.lastTeamUpdate??null)}}).catch(problem=>{if(active)setError((problem as Error).message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[team.id,reload]);
  const removePlayerSession=async(user:TeamUser)=>{if(!confirm(`Sign ${user.playerName??"this player"} out of ${team.name}? They can join again later with the current team link and PIN.`))return;const response=await fetch("/api/team-users",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({teamId:team.id,membershipEmail:user.membershipEmail})});const result=await response.json().catch(()=>({})) as {error?:string};if(!response.ok){notify(result.error??"Player access could not be removed");return}setUsers(current=>current.filter(candidate=>candidate.membershipEmail!==user.membershipEmail));notify(`${user.playerName??"Player"} signed out of the team`)};
  const authenticated=users.filter(user=>user.accessType==="Authenticated account");const teamLinkUsers=users.filter(user=>user.accessType==="Team link + PIN");
  if(loading)return <div className="team-users-loading">Loading team users…</div>;
  if(error)return <div className="team-users-error"><strong>Team users could not be loaded</strong><span>{error}</span><button onClick={()=>{setError("");setLoading(true);setReload(value=>value+1)}}>Try again</button></div>;
  return <div className="team-users-view"><section className="team-users-summary"><div><span>Authenticated accounts</span><strong>{authenticated.length}</strong><small>Owner and co-treasurers</small></div><div><span>Team-link players</span><strong>{teamLinkUsers.length}</strong><small>Active shared sessions</small></div><div><span>Pending invitations</span><strong>{invites.length}</strong><small>Not accepted yet</small></div><div><span>Last team update</span><strong>{lastUpdate?new Date(lastUpdate).toLocaleDateString():"—"}</strong><small>Latest saved team change</small></div></section>
    <div className="view-toolbar"><div><h2>Who can access {team.name}</h2><p>Team owners and co-treasurers can view this page. Login credentials, PINs, hashes, and tokens are never displayed.</p></div><div className="toolbar-actions"><button className="ghost" onClick={onRoster}>Manage co-treasurers</button><button className="primary" onClick={onManageLink}>Manage team link</button></div></div>
    <section className="access-list"><div className="panel-head"><div><h2>Current access</h2><p>{users.length} active {users.length===1?"membership":"memberships"}</p></div></div>{users.map(user=><article key={user.membershipEmail}><div className="avatar" style={{background:user.role==="Owner"?"#d9f99d":user.role==="Co-treasurer"?"#bfdbfe":"#eee"}}>{initials(user.playerName??user.email??"Player")}</div><div><strong>{user.playerName??user.email??"Team player"}</strong><span>{user.email??"Joined with the shared team link"}</span><small>Joined {new Date(user.joinedAt).toLocaleDateString()} · {user.accessType}</small></div><span className={`access-role ${user.role.toLowerCase().replaceAll("-","")}`}>{user.role}{user.email?.toLowerCase()===currentEmail.toLowerCase()?" · You":""}</span>{user.canRemove&&<button className="table-delete" onClick={()=>removePlayerSession(user)}>Sign out</button>}</article>)}</section>
    <section className="access-list pending-access"><div className="panel-head"><div><h2>Pending invitations</h2><p>Invitations disappear after acceptance or expiry</p></div></div>{invites.length?invites.map((invite,index)=><article key={`${invite.playerId}-${invite.expiresAt}-${index}`}><div className="avatar">{initials(invite.playerName??invite.email??"Invite")}</div><div><strong>{invite.playerName??"Roster player"}</strong><span>{invite.email??"No email attached"}</span><small>Expires {new Date(invite.expiresAt).toLocaleDateString()} · Sent by {invite.createdBy}</small></div><span className="access-role pending">{invite.role}</span></article>):<MiniEmpty text="No pending invitations."/>}</section>
  </div>;
}

function RosterView({team,canManage,treasurerAccesses,onInvite,onRemoveAccess,onAdd,onEdit,onDelete}:{team:Team;canManage:boolean;treasurerAccesses:TreasurerAccess[];onInvite:(player:Player)=>void;onRemoveAccess:(access:TreasurerAccess,playerName:string)=>void;onAdd:()=>void;onEdit:(player:Player)=>void;onDelete:(player:Player)=>void}) {
  return <>{team.players.length?<><div className="roster-summary"><div><span className="eyebrow">FULL SQUAD</span><strong>{team.players.length}</strong><small>roster players</small></div><p>{canManage?"Players use the shared team link. Active owner and co-treasurer roles are shown on their roster cards.":`You joined ${team.name} as a team member. Shared records are visible to everyone on the team.`}</p></div><div className="roster-grid">{team.players.map((p,i)=>{const access=treasurerAccesses.find(candidate=>candidate.playerId===p.id);return <article className="player-card" key={p.id}><span className="squad-no">{String(i+1).padStart(2,"0")}</span><div className="avatar large" style={{background:p.color}}>{p.initials}</div><h3>{p.name}</h3>{access&&<span className={`roster-role ${access.isOwner?"owner":""}`}>{access.isOwner?"Team owner":"Co-treasurer"}</span>}<p>{[p.email,p.phone].filter(Boolean).join(" · ")||"No contact details added"}</p>{canManage&&<div className="player-actions"><button className="edit-player" onClick={()=>onEdit(p)}>✎ Edit</button>{access?<button className={`invite-player ${access.canRemove?"remove-access":""}`} disabled={!access.canRemove} onClick={()=>onRemoveAccess(access,p.name)}>{access.canRemove?"Remove access":access.isOwner?"Owner protected":"Current access"}</button>:<button className="invite-player" onClick={()=>onInvite(p)}>↗ Co-treasurer</button>}<button className="delete-player" onClick={()=>onDelete(p)}>Delete</button></div>}</article>})}</div></>:<EmptyState icon="♙" title="Your roster is empty" text={`Add all ${team.name} players here. The roster will be available across every league.`} action={canManage?"Add first player":undefined} onAction={canManage?onAdd:undefined}/>}</>;
}

function LeaguesView({team,canManage,activeId,onSelect,onAdd,onSync,onEdit}:{team:Team;canManage:boolean;activeId?:number;onSelect:(id:number)=>void;onAdd:()=>void;onSync:()=>void;onEdit:(league:League)=>void}) {
  return <><section className="cricclubs-league-cta"><div><span className="eyebrow">FASTEST SETUP</span><h2>Import leagues, games & roster from CricClubs</h2><p>Find this team by club code and name. Review completed lineups, then create the league and add missing players automatically.</p></div>{canManage&&<button className="primary" onClick={onSync}>↻ Sync completed games from CricClubs</button>}</section>{team.leagues.length?<div className="league-grid">{team.leagues.map(l=><article className={`league-card ${l.id===activeId?"current":""}`} key={l.id}><div><span className={l.status==="Active"?"status complete":"status"}>{l.status}</span>{canManage&&<button className="edit-league" onClick={()=>onEdit(l)}>✎ Edit</button>}</div><h3>{l.name}</h3><p>{l.season} · {l.games.length} games · {l.expenses.length} expenses · {l.credits?.length??0} credits</p><div className="league-metrics"><div><strong>{money.format(l.expenses.reduce((s,e)=>s+e.amount,0)+(l.credits??[]).reduce((s,e)=>s+e.amount,0))}</strong><span>Total cost</span></div><div><strong>{l.games.length}</strong><span>Games</span></div></div><button className="card-action" onClick={()=>onSelect(l.id)}>{l.id===activeId?"Open current league":"Switch to league"} →</button></article>)}{canManage&&<button className="new-league-card" onClick={onAdd}><span>＋</span><strong>Create another league</strong><small>New season or tournament</small></button>}</div>:<EmptyState icon="▤" title="No leagues yet" text="Import from CricClubs above to create the league, games, and roster together—or create one manually." action={canManage?"Create manually":undefined} onAction={canManage?onAdd:undefined}/>}</>;
}

function GamesView({games,expenses,credits,players,canManage,onAdd,onScreenshots,onSync,onRoster,onChange,notify}:{games:Game[];expenses:Expense[];credits:Credit[];players:Player[];canManage:boolean;onAdd:()=>void;onScreenshots:()=>void;onSync:()=>void;onRoster:()=>void;onChange:(g:Game[])=>void;notify:(s:string)=>void}) {
  const [editing,setEditing]=useState<number|null>(null); const game=games.find(g=>g.id===editing);
  const [page,setPage]=useState(1);
  const totalPages=Math.max(1,Math.ceil(games.length/GAME_PAGE_SIZE));
  const currentPage=Math.min(page,totalPages);
  const pageStart=(currentPage-1)*GAME_PAGE_SIZE;
  const visibleGames=games.slice(pageStart,pageStart+GAME_PAGE_SIZE);
  const deleteGame=(target:Game)=>{if(expenses.some(expense=>expense.gameId===target.id)||credits.some(credit=>credit.gameId===target.id)){notify("Delete linked expenses or credits before deleting this game");return}if(confirm(`Delete the game vs ${target.opponent}? Appearance-based league fees will be recalculated.`)){onChange(games.filter(candidate=>candidate.id!==target.id));setEditing(null);notify("Game deleted and league shares recalculated")}};
  if (!players.length) return <EmptyState icon="♙" title="Add roster players first" text="Games need a team roster before you can select a Playing XI or XII." action="Go to team roster" onAction={onRoster}/>;
  return <>{games.length?<><div className="view-toolbar"><div><h2>League games</h2><p>{games.length} {games.length===1?"game":"games"} recorded in this league.</p></div>{canManage&&<div className="game-toolbar-actions"><button className="ghost" onClick={onScreenshots}>▧ Import screenshots</button><button className="ghost" onClick={onSync}>↻ Sync CricClubs</button><button className="primary" onClick={onAdd}>＋ Add game</button></div>}</div><div className="game-grid">{visibleGames.map((g,i)=>{const lineup=g.players.map(id=>players.find(player=>player.id===id)).filter((player):player is Player=>Boolean(player)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true}));const lineupTitle=g.players.length===11?"Playing XI":g.players.length===12?"Playing XII":`Playing ${g.players.length}`;const excluded=new Set(g.excludedFromSplit??[]);return <article className="game-card" key={g.id}><div><span className={g.status==="Completed"?"status complete":"status"}>{g.status}</span><span>GAME {pageStart+i+1}</span></div><div className="game-date"><strong>{g.date?new Date(g.date+"T12:00").toLocaleDateString("en-US",{day:"2-digit"}):"—"}</strong><span>{g.date?new Date(g.date+"T12:00").toLocaleDateString("en-US",{month:"short"}).toUpperCase():"DATE NOT ADDED"}</span></div><h3>vs {g.opponent}</h3><p>{g.venue||"Venue not specified"}</p>{g.source==="cricclubs"&&<a className="source-link" href={g.sourceUrl} target="_blank" rel="noreferrer">Imported from CricClubs ↗</a>}<div className="selected-count"><strong>{g.players.length}</strong> selected <span className={g.players.length>=11?"valid":"invalid"}>{g.players.length>=11?"Ready":"Need more"}</span></div>{excluded.size>0&&<div className="split-count">{g.players.length-excluded.size} included in fair split · {excluded.size} excluded</div>}<details className="game-lineup"><summary>View {lineupTitle}<span>⌄</span></summary><ol>{lineup.map(player=><li key={player.id}><span className="avatar" style={{background:player.color}}>{player.initials}</span><strong>{player.name}</strong>{excluded.has(player.id)&&<small>Not included in split</small>}</li>)}</ol></details>{canManage&&<button className="card-action" onClick={()=>setEditing(g.id)}>Edit game & {lineupTitle} →</button>}</article>})}</div><Pagination page={currentPage} totalPages={totalPages} totalItems={games.length} itemLabel="games" onPage={setPage}/></>:<div className="empty-sync-wrap"><EmptyState icon="◉" title="No games in this league" text="Add a game manually or import completed lineups from screenshots or CricClubs." action={canManage?"Import screenshots":undefined} onAction={canManage?onScreenshots:undefined}/>{canManage&&<button className="ghost sync-empty" onClick={onSync}>↻ Sync completed games from CricClubs</button>}</div>}
  {game&&<GameModal game={game} players={players} onClose={()=>setEditing(null)} onDelete={()=>deleteGame(game)} onSave={updated=>{onChange(games.map(g=>g.id===game.id?{...updated,id:g.id}:g));setEditing(null);notify("Game and lineup updated")}}/>}</>;
}

function ExpensesView({expenses,credits,players,games,canManage,memberEmail,onAdd,onCredit,onRoster,onEdit,onDelete,onEditCredit}:{expenses:Expense[];credits:Credit[];players:Player[];games:Game[];canManage:boolean;memberEmail:string;onAdd:()=>void;onCredit:()=>void;onRoster:()=>void;onEdit:(expense:Expense)=>void;onDelete:(expense:Expense)=>void;onEditCredit:(credit:Credit)=>void}) {
  const [query,setQuery]=useState(""); const [kind,setKind]=useState<"all"|"expense"|"credit">("all");
  const [page,setPage]=useState(1);
  const entries=[...expenses.map(entry=>({kind:"expense" as const,entry})),...credits.map(entry=>({kind:"credit" as const,entry}))].sort((a,b)=>b.entry.date.localeCompare(a.entry.date)||b.entry.id-a.entry.id);
  const filtered=entries.filter(item=>(kind==="all"||item.kind===kind)&&item.entry.label.toLowerCase().includes(query.trim().toLowerCase()));
  const totalPages=Math.max(1,Math.ceil(filtered.length/LEDGER_PAGE_SIZE));
  const currentPage=Math.min(page,totalPages);
  const visibleEntries=filtered.slice((currentPage-1)*LEDGER_PAGE_SIZE,currentPage*LEDGER_PAGE_SIZE);
  if (!players.length) return <EmptyState icon="♙" title="Add roster players first" text="Every payment needs a team member who paid it." action="Go to team roster" onAction={onRoster}/>;
  return entries.length?<><div className="view-toolbar"><div><h2>League finance ledger</h2><p>{expenses.length} expenses · {credits.length} team-funded credits.</p></div>{canManage&&<div className="toolbar-actions"><button className="ghost" onClick={onCredit}>＋ Add credit</button><button className="primary" onClick={onAdd}>＋ Add expense</button></div>}</div><div className="ledger-filters"><input aria-label="Search entries" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="Search expenses…"/><select aria-label="Filter entries" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setPage(1)}}><option value="all">All entries</option><option value="expense">Expenses only</option><option value="credit">Credits only</option></select></div>{filtered.length?<><div className="table-panel"><table><thead><tr><th>Date</th><th>Entry</th><th>Type</th><th>Paid / credited to</th><th>Shared by</th><th>Amount</th><th></th></tr></thead><tbody>{visibleEntries.map(item=>item.kind==="expense"?<tr key={`e-${item.entry.id}`}><td>{new Date(item.entry.date+"T12:00").toLocaleDateString()}</td><td><strong>{item.entry.label}</strong>{item.entry.submittedBy===memberEmail.toLowerCase()&&<small className="submitted-label">Submitted by you</small>}</td><td><span className="category-chip">{item.entry.category}</span></td><td>{players.find(p=>p.id===item.entry.paidBy)?.name??"Unknown player"}</td><td>{splitDescription(item.entry,players,games)}</td><td><strong>{money.format(item.entry.amount)}</strong></td><td>{(canManage||item.entry.submittedBy===memberEmail.toLowerCase())&&<div className="row-actions"><button className="table-edit" onClick={()=>onEdit(item.entry)}>Edit</button><button className="table-delete" onClick={()=>onDelete(item.entry)}>Delete</button></div>}</td></tr>:<tr className="credit-row" key={`c-${item.entry.id}`}><td>{new Date(item.entry.date+"T12:00").toLocaleDateString()}</td><td><strong>{item.entry.label}</strong></td><td><span className="category-chip credit">Umpiring credit</span></td><td>{players.find(p=>p.id===item.entry.playerId)?.name??"Unknown player"}</td><td>{splitDescription(item.entry,players,games)}</td><td><strong>+{money.format(item.entry.amount)}</strong></td><td>{canManage&&<button className="table-edit" onClick={()=>onEditCredit(item.entry)}>Edit</button>}</td></tr>)}</tbody></table></div><Pagination page={currentPage} totalPages={totalPages} totalItems={filtered.length} itemLabel="entries" onPage={setPage}/></>:<MiniEmpty text="No entries match this filter."/>}</>:<div className="start-grid"><EmptyState icon="↗" title="No expenses yet" text={canManage?"Record a payment and choose exactly who should share it.":"Your treasurer has not recorded any expenses yet."} action={canManage?"Add expense":undefined} onAction={canManage?onAdd:undefined}/>{canManage&&<EmptyState icon="◇" title="No credits yet" text="Credit players for outside umpiring; the team funds it equally across completed games." action="Add umpiring credit" onAction={onCredit}/>}</div>;
}

type PlayerBalance = Player&{paid:number;credit:number;share:number;sent:number;received:number;originalBalance:number;balance:number};

function CalculatorView({players,games,expenses,credits,balances}:{players:Player[];games:Game[];expenses:Expense[];credits:Credit[];balances:PlayerBalance[]}) {
  const completed=games.filter(game=>game.status==="Completed");
  const totalAppearances=splitAppearanceCount(completed);
  const weightedExpenses=expenses.filter(usesAppearanceSplit);
  const umpiringTotal=credits.filter(isUmpiringWaiver).reduce((sum,credit)=>sum+credit.amount,0);
  const leagueFeeTotal=weightedExpenses.filter(expense=>isLeagueFee(expense.category)).reduce((sum,expense)=>sum+expense.amount,0);
  const refreshmentTotal=weightedExpenses.filter(expense=>!isLeagueFee(expense.category)).reduce((sum,expense)=>sum+expense.amount,0);
  const weightedTotal=leagueFeeTotal+refreshmentTotal+umpiringTotal;
  const fundedGameCount=fundedGames(completed).length;
  const costPerGame=fundedGameCount?weightedTotal/fundedGameCount:0;
  const perGame=completed.map((game,index)=>{
    const eligibleIds=splitEligiblePlayers(game);
    const excludedNames=(game.excludedFromSplit??[]).map(id=>players.find(player=>player.id===id)?.name).filter((name):name is string=>Boolean(name)).sort((a,b)=>a.localeCompare(b));
    const ratio=fundedGameCount&&eligibleIds.length?1/fundedGameCount:0;
    return {game,index,eligibleCount:eligibleIds.length,excludedNames,cost:weightedTotal*ratio,costPerPlayer:eligibleIds.length?weightedTotal*ratio/eligibleIds.length:0,leagueFee:leagueFeeTotal*ratio,refreshments:refreshmentTotal*ratio,umpiring:umpiringTotal*ratio};
  });
  const rows=players.map(player=>{
    const gamesPlayed=completed.filter(game=>game.players.includes(player.id)).length;
    const appearances=completed.filter(game=>splitEligiblePlayers(game).includes(player.id)).length;
    const umpiringCredits=credits.filter(credit=>credit.playerId===player.id&&isUmpiringWaiver(credit));
    const umpiringCredit=umpiringCredits.reduce((sum,credit)=>sum+credit.amount,0);
    const expenseShare=expenses.reduce((sum,expense)=>sum+(usesAppearanceSplit(expense)?gameWeightedShare(expense.amount,player.id,games):playerShare(expense.amount,expenseParticipants(expense,players,games),player.id)),0);
    const teamFundedCreditShare=credits.reduce((sum,credit)=>sum+(isUmpiringWaiver(credit)?gameWeightedShare(credit.amount,player.id,games):playerShare(credit.amount,credit.participants??[],player.id)),0);
    const totalExpenseShare=expenseShare+teamFundedCreditShare;
    return {player,gamesPlayed,appearances,umpiringCredit,totalExpenseShare,netShare:totalExpenseShare-umpiringCredit};
  }).filter(row=>row.gamesPlayed||row.umpiringCredit>.004||row.totalExpenseShare>.004);
  return <>
    <div className="view-toolbar"><div><h2>League share calculator</h2><p>See exactly how games played, split eligibility, and team-funded umpiring credits affect each player.</p></div></div>
    <section className="calculator-formula"><div><span>Completed games</span><strong>{completed.length}</strong></div><div><span>Split-eligible appearances</span><strong>{totalAppearances}</strong></div><div><span>Game-funded team costs</span><strong>{money.format(weightedTotal)}</strong></div><p><b>Formula</b> The full team cost pool is split equally across {fundedGameCount} completed {fundedGameCount===1?"game":"games"} ({money.format(costPerGame)} per game). Each game’s cost is then divided equally among that game’s eligible players. A player’s final share is the sum of their per-game shares.</p></section>
    {totalAppearances===0&&weightedTotal>0&&<div className="calculator-warning"><strong>No eligible completed games yet</strong><span>Mark games Completed and include at least one lineup player before adding game-funded credits.</span></div>}
    {perGame.length>0&&<section className="per-game-breakdown"><div className="panel-head"><div><h2>Per-game breakdown</h2><p>Each completed game receives an equal part of the team cost pool, then its eligible players share that game’s cost.</p></div></div><div className="table-panel"><table><thead><tr><th>Game</th><th>Players</th><th>Payers</th><th>Excluded</th><th>Game cost</th><th>$/payer</th></tr></thead><tbody>{perGame.map(row=><tr key={row.game.id}><td><strong>Game {row.index+1}: {row.game.opponent}</strong><small>{[row.leagueFee>.004&&`League ${money.format(row.leagueFee)}`,row.refreshments>.004&&`Fruits / Water ${money.format(row.refreshments)}`,row.umpiring>.004&&`Umpiring ${money.format(row.umpiring)}`].filter(Boolean).join(" · ")||"No game-funded costs"}</small></td><td>{row.game.players.length}</td><td><strong>{row.eligibleCount}</strong></td><td>{row.excludedNames.length?<span className="excluded-list">{row.excludedNames.join(", ")}</span>:"—"}</td><td><strong>{money.format(row.cost)}</strong></td><td>{money.format(row.costPerPlayer)}</td></tr>)}</tbody><tfoot><tr><td colSpan={4}>Team cost pool represented</td><td><strong>{money.format(perGame.reduce((sum,row)=>sum+row.cost,0))}</strong></td><td>{fundedGameCount} games</td></tr></tfoot></table></div></section>}
    {rows.length?<div className="table-panel calculator-table simple-calculator-table"><table><thead><tr><th>Player</th><th>Games played</th><th>Eligible games</th><th>Combined expense share</th><th>Umpiring credit</th><th>Net share</th></tr></thead><tbody>{rows.map(row=><tr key={row.player.id}><td><div className="player-cell"><span className="avatar" style={{background:row.player.color}}>{row.player.initials}</span><strong>{row.player.name}</strong></div></td><td>{row.gamesPlayed}</td><td>{row.appearances}</td><td><strong>{money.format(row.totalExpenseShare)}</strong><small>All league, refreshments, umpiring, and other shared costs</small></td><td className="positive">−{money.format(row.umpiringCredit)}</td><td><strong className={row.netShare>=0?"negative":"positive"}>{row.netShare>=0?money.format(row.netShare):`Credit ${money.format(Math.abs(row.netShare))}`}</strong></td></tr>)}</tbody><tfoot><tr><td colSpan={3}>Combined fair shares</td><td><strong>{money.format(balances.reduce((sum,balance)=>sum+balance.share,0))}</strong></td><td colSpan={2}>Credits reduce each player’s net share</td></tr></tfoot></table></div>:<MiniEmpty text="Add completed games and expenses to calculate player shares."/>}
  </>;
}

function SettlementView({team,league,balances,games,expenses,credits,payments,players,canManage,viewerPlayerId,onRecord,onDelete,exportCsv,notify}:{team:Team;league:League;balances:PlayerBalance[];games:Game[];expenses:Expense[];credits:Credit[];payments:SettlementPayment[];players:Player[];canManage:boolean;viewerPlayerId?:number;onRecord:()=>void;onDelete:(payment:SettlementPayment)=>void;exportCsv:()=>void;notify:(s:string)=>void}){
  const [detail,setDetail]=useState<number|null>(null);const [balanceFilter,setBalanceFilter]=useState<"all"|"pending">("all");
  if(!balances.length)return <EmptyState icon="⇄" title="Nothing to settle yet" text="Add players and expenses to calculate a final league settlement."/>;
  const playerView=!canManage&&viewerPlayerId!==undefined;const transfers=settlementTransfers(balances);const visibleTransfers=playerView?transfers.filter(transfer=>transfer.fromPlayerId===viewerPlayerId||transfer.toPlayerId===viewerPlayerId):transfers;const shown=playerView?balances.filter(balance=>balance.id===viewerPlayerId):balances.filter(balance=>balanceFilter==="all"||Math.abs(balance.balance)>.005);const visiblePayments=playerView?payments.filter(payment=>payment.fromPlayerId===viewerPlayerId||payment.toPlayerId===viewerPlayerId):payments;
  const shareSettlement=async()=>{const lines=[`${team.name} — ${league.name} settlement`,...transfers.map(transfer=>`${transfer.from} pays ${transfer.to}: ${money.format(transfer.amount)}`),transfers.length?"":"Everyone is settled."];try{if(navigator.share)await navigator.share({title:`${league.name} settlement`,text:lines.join("\n")});else{await navigator.clipboard.writeText(lines.join("\n"));notify("Settlement copied — paste it in your team chat")}}catch(error){if((error as Error).name!=="AbortError")notify("Could not share the settlement")}};
  const paidTotal=visiblePayments.reduce((sum,payment)=>sum+payment.amount,0);const remainingTotal=playerView?Math.abs(shown[0]?.balance??0):balances.filter(balance=>balance.balance<-.005).reduce((sum,balance)=>sum+Math.abs(balance.balance),0);
  return <><div className="view-toolbar"><div><h2>{playerView?"My settlement breakdown":"League settlement"}</h2><p>{playerView?"See exactly how your costs, credits, and payments produce your balance.":"Every positive contribution and every shared cost is shown in the calculation."}</p></div>{!playerView&&<div className="toolbar-actions">{canManage&&transfers.length>0&&<button className="primary" onClick={onRecord}>✓ Record payment</button>}<button className="ghost" onClick={shareSettlement}>↗ Share remaining</button><button className="ghost" onClick={exportCsv}>↓ Download CSV</button></div>}</div>
    <section className="settlement-progress"><div><span>Confirmed payments</span><strong>{money.format(paidTotal)}</strong></div><div><span>Still to settle</span><strong>{money.format(remainingTotal)}</strong></div><p><b>Remaining = expenses paid + umpiring credits + sent − fair share − received.</b> Positive means receive; negative means pay.</p></section>
    {playerView?<div className="settlement-filter player-filter-spacer" aria-hidden="true"/>:<div className="settlement-filter"><span>Show</span><div className="balance-filter" role="group" aria-label="Filter settlement balances"><button className={balanceFilter==="pending"?"active":""} onClick={()=>setBalanceFilter("pending")}>Pending only</button><button className={balanceFilter==="all"?"active":""} onClick={()=>setBalanceFilter("all")}>All players</button></div></div>}
    {shown.length?<div className="table-panel settlement-ledger"><table><thead><tr><th>Player</th><th>Fair share</th><th>Expenses paid</th><th>Umpiring credit</th><th>Sent</th><th>Received</th><th>Remaining</th><th></th></tr></thead><tbody>{shown.map(balance=><tr key={balance.id}><td><div className="player-cell"><span className="avatar" style={{background:balance.color}}>{balance.initials}</span><strong>{balance.name}</strong></div></td><td className="negative">−{money.format(balance.share)}</td><td className="positive">+{money.format(balance.paid)}</td><td className="positive">+{money.format(balance.credit)}</td><td className="positive">+{money.format(balance.sent)}</td><td className="negative">−{money.format(balance.received)}</td><td><strong className={balance.balance>=0?"positive":"negative"}>{balance.balance>=0?"+":"−"}{money.format(Math.abs(balance.balance))}</strong></td><td><button className="table-edit" onClick={()=>setDetail(balance.id)}>Details</button></td></tr>)}</tbody></table></div>:<MiniEmpty text="Everyone is fully settled."/>}
    {visibleTransfers.length>0&&<section className="transfer-panel"><h2>{playerView?"What I should do now":"Who should pay whom now"}</h2><p>These suggestions already account for expenses paid, credits earned, and confirmed payments.</p>{visibleTransfers.map((transfer,index)=><div key={index}><strong>{transfer.from}</strong><span>pays</span><strong>{transfer.to}</strong><b>{money.format(transfer.amount)}</b></div>)}</section>}
    <section className="payment-history"><div className="panel-head"><div><h2>{playerView?"My confirmed payments":"Confirmed payment history"}</h2><p>{visiblePayments.length} {visiblePayments.length===1?"payment":"payments"} recorded</p></div></div>{visiblePayments.length?<div className="table-panel"><table><thead><tr><th>Date</th><th>From</th><th>To</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>{[...visiblePayments].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).map(payment=><tr key={payment.id}><td>{new Date(payment.date+"T12:00").toLocaleDateString()}</td><td>{players.find(player=>player.id===payment.fromPlayerId)?.name??"Unknown"}</td><td>{players.find(player=>player.id===payment.toPlayerId)?.name??"Unknown"}</td><td><strong>{money.format(payment.amount)}</strong></td><td>{payment.note||"—"}</td><td>{canManage&&<button className="table-delete" onClick={()=>onDelete(payment)}>Delete</button>}</td></tr>)}</tbody></table></div>:<MiniEmpty text="No confirmed repayments recorded yet."/>}</section>
    {detail!==null&&<TransparentPlayerBreakdown player={balances.find(balance=>balance.id===detail)!} expenses={expenses} credits={credits} games={games} players={players} onClose={()=>setDetail(null)}/>}</>;
}

function TransparentPlayerBreakdown({player,expenses,credits,games,players,onClose}:{player:PlayerBalance;expenses:Expense[];credits:Credit[];games:Game[];players:Player[];onClose:()=>void}){
  const expenseCosts=expenses.map(expense=>({label:expense.label,amount:usesAppearanceSplit(expense)?gameWeightedShare(expense.amount,player.id,games):playerShare(expense.amount,expenseParticipants(expense,players,games),player.id)})).filter(row=>row.amount>.004);
  const creditCosts=credits.map(credit=>({label:`${creditDisplayLabel(credit)} · team-funded cost`,amount:isUmpiringWaiver(credit)?gameWeightedShare(credit.amount,player.id,games):playerShare(credit.amount,credit.participants??[],player.id)})).filter(row=>row.amount>.004);
  const paidExpenses=expenses.filter(expense=>expense.paidBy===player.id).map(expense=>({label:`Paid: ${expense.label}`,amount:expense.amount}));
  const earnedCredits=credits.filter(credit=>credit.playerId===player.id).map(credit=>({label:creditDisplayLabel(credit),amount:credit.amount}));
  return <div className="modal-backdrop"><section className="modal breakdown-modal transparent-breakdown"><ModalHead eyebrow="PLAYER CALCULATION" title={player.name} description="How shared costs, contributions, credits, and payments produce the remaining balance." close={onClose}/>
    <div className="balance-equation"><span className="positive">+{money.format(player.paid)} paid</span><b>+</b><span className="positive">+{money.format(player.credit)} credits</span><b>+</b><span className="positive">+{money.format(player.sent)} sent</span><b>−</b><span className="negative">{money.format(player.share)} fair share</span><b>−</b><span className="negative">{money.format(player.received)} received</span><b>=</b><strong className={player.balance>=0?"positive":"negative"}>{player.balance>=0?"+":"−"}{money.format(Math.abs(player.balance))}</strong></div>
    <div className="breakdown-summary"><div><span>Fair share owed</span><strong className="negative">−{money.format(player.share)}</strong></div><div><span>Expenses paid</span><strong className="positive">+{money.format(player.paid)}</strong></div><div><span>Umpiring credits</span><strong className="positive">+{money.format(player.credit)}</strong></div><div><span>Payments sent</span><strong className="positive">+{money.format(player.sent)}</strong></div><div><span>Payments received</span><strong className="negative">−{money.format(player.received)}</strong></div><div><span>Remaining</span><strong className={player.balance>=0?"positive":"negative"}>{player.balance>=0?"+":"−"}{money.format(Math.abs(player.balance))}</strong></div></div>
    <div className="breakdown-sections"><div className="breakdown-list"><div><strong>Fair-share costs</strong><span>Amount owed</span></div>{[...expenseCosts,...creditCosts].map((row,index)=><div key={`${row.label}-${index}`}><span>{row.label}</span><b className="negative">−{money.format(row.amount)}</b></div>)}</div><div className="breakdown-list earnings-list"><div><strong>Positive contributions</strong><span>Amount earned</span></div>{[...paidExpenses,...earnedCredits].map((row,index)=><div key={`${row.label}-${index}`}><span>{row.label}</span><b className="positive">+{money.format(row.amount)}</b></div>)}{!paidExpenses.length&&!earnedCredits.length&&<p>No expenses paid or umpiring credits earned.</p>}</div></div>
    <div className="modal-actions"><button className="primary" onClick={onClose}>Done</button></div></section></div>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacySettlementView({team,league,balances,games,expenses,credits,payments,players,canManage,onRecord,onDelete,exportCsv,notify}:{team:Team;league:League;balances:PlayerBalance[];games:Game[];expenses:Expense[];credits:Credit[];payments:SettlementPayment[];players:Player[];canManage:boolean;onRecord:()=>void;onDelete:(payment:SettlementPayment)=>void;exportCsv:()=>void;notify:(s:string)=>void}) {
  const [detail,setDetail]=useState<number|null>(null);
  const [balanceFilter,setBalanceFilter]=useState<"all"|"pending">("pending");
  if (!balances.length) return <EmptyState icon="⇄" title="Nothing to settle yet" text="Add players and expenses to calculate a final league settlement." />;
  const transfers=settlementTransfers(balances);
  const shownBalances=balances.filter(b=>balanceFilter==="all"||Math.abs(b.balance)>.005);
  const shareSettlement=async()=>{const lines=[`${team.name} — ${league.name} settlement`,...transfers.map(t=>`${t.from} pays ${t.to}: ${money.format(t.amount)}`),transfers.length?"":"Everyone is settled."];const text=lines.join("\n");try{if(navigator.share)await navigator.share({title:`${league.name} settlement`,text});else{await navigator.clipboard.writeText(text);notify("Settlement copied — paste it in your team chat")}}catch(error){if((error as Error).name!=="AbortError")notify("Could not share the settlement")}};
  const paidTotal=payments.reduce((sum,payment)=>sum+payment.amount,0);
  const remainingTotal=balances.filter(balance=>balance.balance<-.005).reduce((sum,balance)=>sum+Math.abs(balance.balance),0);
  return <><div className="view-toolbar"><div><h2>League settlement</h2><p>Confirmed repayments reduce what is still owed without changing expense history.</p></div><div className="toolbar-actions">{canManage&&transfers.length>0&&<button className="primary" onClick={onRecord}>✓ Record payment</button>}<button className="ghost" onClick={shareSettlement}>↗ Share remaining</button><button className="ghost" onClick={exportCsv}>↓ Download CSV</button></div></div><section className="settlement-progress"><div><span>Confirmed payments</span><strong>{money.format(paidTotal)}</strong></div><div><span>Still to settle</span><strong>{money.format(remainingTotal)}</strong></div><p>Record a payment only after the receiver confirms the money arrived. The audit history remains separate from expenses.</p></section><div className="settlement-filter"><span>Show</span><div className="balance-filter" role="group" aria-label="Filter settlement balances"><button className={balanceFilter==="pending"?"active":""} onClick={()=>setBalanceFilter("pending")}>Pending only</button><button className={balanceFilter==="all"?"active":""} onClick={()=>setBalanceFilter("all")}>All players</button></div></div>{shownBalances.length?<div className="table-panel"><table><thead><tr><th>Player</th><th>Fair share</th><th>Sent</th><th>Received</th><th>Remaining</th><th></th></tr></thead><tbody>{shownBalances.map(b=><tr key={b.id}><td><div className="player-cell"><span className="avatar" style={{background:b.color}}>{b.initials}</span><strong>{b.name}</strong></div></td><td>{money.format(b.share)}</td><td>{money.format(b.sent)}</td><td>{money.format(b.received)}</td><td><strong className={b.balance>=0?"positive":"negative"}>{b.balance>=0?"+":"−"}{money.format(Math.abs(b.balance))}</strong></td><td><button className="table-edit" onClick={()=>setDetail(b.id)}>Details</button></td></tr>)}</tbody></table></div>:<MiniEmpty text="Everyone is fully settled."/>}{transfers.length>0&&<section className="transfer-panel"><h2>Who should pay whom now</h2><p>These suggestions already account for every confirmed payment.</p>{transfers.map((t,i)=><div key={i}><strong>{t.from}</strong><span>pays</span><strong>{t.to}</strong><b>{money.format(t.amount)}</b></div>)}</section>}<section className="payment-history"><div className="panel-head"><div><h2>Confirmed payment history</h2><p>{payments.length} {payments.length===1?"payment":"payments"} recorded · audit trail for this league</p></div></div>{payments.length?<div className="table-panel"><table><thead><tr><th>Date</th><th>From</th><th>To</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>{[...payments].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).map(payment=><tr key={payment.id}><td>{new Date(payment.date+"T12:00").toLocaleDateString()}</td><td>{players.find(player=>player.id===payment.fromPlayerId)?.name??"Unknown"}</td><td>{players.find(player=>player.id===payment.toPlayerId)?.name??"Unknown"}</td><td><strong>{money.format(payment.amount)}</strong></td><td>{payment.note||"—"}</td><td>{canManage&&<button className="table-delete" onClick={()=>onDelete(payment)}>Delete</button>}</td></tr>)}</tbody></table></div>:<MiniEmpty text="No confirmed repayments recorded yet."/>}</section>{detail!==null&&<PlayerBreakdown player={balances.find(b=>b.id===detail)!} expenses={expenses} credits={credits} games={games} players={players} onClose={()=>setDetail(null)}/>}</>;
}

function PlayerBreakdown({player,expenses,credits,games,players,onClose}:{player:PlayerBalance;expenses:Expense[];credits:Credit[];games:Game[];players:Player[];onClose:()=>void}) {
  const expenseRows=expenses.map(expense=>{const share=usesAppearanceSplit(expense)?gameWeightedShare(expense.amount,player.id,games):playerShare(expense.amount,expenseParticipants(expense,players,games),player.id);return {label:expense.label,share}}).filter(row=>row.share>.004);
  const creditRows=credits.flatMap(credit=>isUmpiringWaiver(credit)
    ? [{label:`${creditDisplayLabel(credit)} · team-funded share`,share:gameWeightedShare(credit.amount,player.id,games)},...(credit.playerId===player.id?[{label:`${creditDisplayLabel(credit)} · credit received`,share:-credit.amount}]:[])]
    : [{label:`${credit.label} contribution`,share:playerShare(credit.amount,credit.participants??[],player.id)}]).filter(row=>Math.abs(row.share)>.004);
  return <div className="modal-backdrop"><section className="modal breakdown-modal"><ModalHead eyebrow="PLAYER CALCULATION" title={player.name} description="Every amount included in this player’s remaining balance." close={onClose}/><div className="breakdown-summary"><div><span>Original balance</span><strong>{money.format(player.originalBalance)}</strong></div><div><span>Sent</span><strong>{money.format(player.sent)}</strong></div><div><span>Received</span><strong>{money.format(player.received)}</strong></div><div><span>Remaining</span><strong className={player.balance>=0?"positive":"negative"}>{player.balance>=0?"+":"−"}{money.format(Math.abs(player.balance))}</strong></div></div><div className="breakdown-list"><div><strong>Shared costs</strong><span>Amount</span></div>{[...expenseRows,...creditRows].map((row,i)=><div key={`${row.label}-${i}`}><span>{row.label}</span><b>{money.format(row.share)}</b></div>)}{!expenseRows.length&&!creditRows.length&&<p>No costs currently assigned to this player.</p>}</div><div className="modal-actions"><button className="primary" onClick={onClose}>Done</button></div></section></div>;
}

function settlementTransfers(balances:(Player&{balance:number})[]) {
  const debtors=balances.filter(b=>b.balance<-.005).map(b=>({id:b.id,name:b.name,amount:-b.balance}));
  const creditors=balances.filter(b=>b.balance>.005).map(b=>({id:b.id,name:b.name,amount:b.balance}));
  const result:{from:string;to:string;fromPlayerId:number;toPlayerId:number;amount:number}[]=[]; let d=0; let c=0;
  while(d<debtors.length&&c<creditors.length){const amount=Math.min(debtors[d].amount,creditors[c].amount);result.push({from:debtors[d].name,to:creditors[c].name,fromPlayerId:debtors[d].id,toPlayerId:creditors[c].id,amount});debtors[d].amount-=amount;creditors[c].amount-=amount;if(debtors[d].amount<.005)d++;if(creditors[c].amount<.005)c++}
  return result;
}

function EmptyState({icon,title,text,action,onAction}:{icon:string;title:string;text:string;action?:string;onAction?:()=>void}) { return <div className="empty-state"><span>{icon}</span><h2>{title}</h2><p>{text}</p>{action&&<button className="primary" onClick={onAction}>{action} →</button>}</div>; }
function MiniEmpty({text}:{text:string}) { return <div className="mini-empty">{text}</div>; }
function Pagination({page,totalPages,totalItems,itemLabel,onPage}:{page:number;totalPages:number;totalItems:number;itemLabel:string;onPage:(page:number)=>void}) {
  if(totalPages<=1)return null;
  return <nav className="pagination" aria-label={`${itemLabel} pagination`}><span>{totalItems} {itemLabel} · Page {page} of {totalPages}</span><div><button type="button" disabled={page===1} onClick={()=>onPage(page-1)}>← Previous</button><button type="button" disabled={page===totalPages} onClick={()=>onPage(page+1)}>Next →</button></div></nav>;
}
function ModalHead({eyebrow,title,description,close}:{eyebrow:string;title:string;description:string;close:()=>void}) { return <div className="modal-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div><button type="button" onClick={close}>×</button></div>; }

function NameModal({eyebrow,title,description,label,placeholder,onClose,onSave}:{eyebrow:string;title:string;description:string;label:string;placeholder:string;onClose:()=>void;onSave:(name:string)=>void}) {
  const [name,setName]=useState(""); return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={e=>{e.preventDefault();onSave(name)}}><ModalHead eyebrow={eyebrow} title={title} description={description} close={onClose}/><label>{label}<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder={placeholder}/></label><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary">Save</button></div></form></div>;
}
function LeagueModal({league,onClose,onSave,onDelete}:{league?:League;onClose:()=>void;onSave:(name:string,season:string,status:"Active"|"Completed")=>void;onDelete?:()=>void}) {
  const [name,setName]=useState(league?.name??""); const [season,setSeason]=useState(league?.season??new Date().getFullYear().toString()); const [status,setStatus]=useState<"Active"|"Completed">(league?.status??"Active"); return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={e=>{e.preventDefault();onSave(name,season,status)}}><ModalHead eyebrow={league?"EDIT LEAGUE":"NEW LEAGUE"} title={league?"Edit league details":"Create a league"} description={league?"Games, expenses, and settlement will remain unchanged.":"Games, expenses, and settlement stay separate per league."} close={onClose}/><div className="form-grid"><label className="wide">League name<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Summer League"/></label><label className="wide">Season / year<input required value={season} onChange={e=>setSeason(e.target.value)} placeholder="2026"/></label>{league&&<label className="wide">Status<select value={status} onChange={e=>setStatus(e.target.value as "Active"|"Completed")}><option>Active</option><option>Completed</option></select></label>}</div><div className="modal-actions">{onDelete&&<button type="button" className="danger-action" onClick={onDelete}>Delete league</button>}<button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary">{league?"Save changes":"Create league"}</button></div></form></div>;
}
function PlayerModal({teamName,player,onClose,onSave}:{teamName:string;player?:Player;onClose:()=>void;onSave:(name:string,email:string,phone:string)=>void}) {
  const [name,setName]=useState(player?.name??""); const [email,setEmail]=useState(player?.email??""); const [phone,setPhone]=useState(player?.phone??""); return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={e=>{e.preventDefault();onSave(name.trim(),email.trim().toLowerCase(),phone.trim())}}><ModalHead eyebrow={`${teamName.toUpperCase()} ROSTER`} title={player?"Edit player":"Add a player"} description={player?"Their existing games, payments, and balances will stay linked.":"Add contact details now to make invitations easier later."} close={onClose}/><div className="form-grid"><label className="wide">Player name<input autoFocus required value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/></label><label className="wide">Email (optional)<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="player@example.com"/></label><label className="wide">Phone number (optional)<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 480 555 0123"/></label></div><div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary">{player?"Save changes":"Add player"}</button></div></form></div>;
}
function TeamMemberAccessModal({team,onClose,notify}:{team:Team;onClose:()=>void;notify:(message:string)=>void}){
  const [creating,setCreating]=useState(false);const [loading,setLoading]=useState(true);const [replacementRequired,setReplacementRequired]=useState(false);const [access,setAccess]=useState<{url:string;pin:string}|null>(null);
  useEffect(()=>{let active=true;fetch(`/api/team-access?teamId=${team.id}`).then(async response=>({response,result:await response.json().catch(()=>({})) as {url?:string;pin?:string;replacementRequired?:boolean}})).then(({response,result})=>{if(!active)return;if(response.ok&&result.url&&result.pin)setAccess({url:result.url,pin:result.pin});else if(response.ok&&result.replacementRequired)setReplacementRequired(true)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[team.id]);
  const message=access?`🏏 Join ${team.name} on WicketSplit\n\nOpen this private link:\n${access.url}\n\nTeam PIN: ${access.pin}\n\nChoose your own name from the roster to view games, expenses, and your settlement. Please do not forward this link or PIN.`:"";
  const create=async(replace=false)=>{if(replace&&!confirm(`Replace the link and PIN for ${team.name}? Everyone using shared access will be signed out.`))return;setCreating(true);const response=await fetch("/api/team-access",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({teamId:team.id,replace})});const result=await response.json().catch(()=>({})) as {url?:string;pin?:string;reused?:boolean;error?:string};setCreating(false);if(!response.ok||!result.url||!result.pin){notify(result.error??"Team member access could not be created");return}setAccess({url:result.url,pin:result.pin});setReplacementRequired(false);notify(result.reused?"Existing team invitation loaded":replace?"Link and PIN replaced — old access is now invalid":"Team member link and PIN created")};
  const copy=async()=>{try{await navigator.clipboard.writeText(message);notify("Team member invitation copied")}catch{notify("Select and copy the invitation manually")}};
  const revoke=async()=>{if(!confirm(`Revoke shared member access for ${team.name}? Existing team-member sessions will be signed out.`))return;const response=await fetch("/api/team-access",{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({teamId:team.id})});if(!response.ok){const result=await response.json().catch(()=>({})) as {error?:string};notify(result.error??"Access could not be revoked");return}setAccess(null);setReplacementRequired(false);notify("Shared team member access revoked")};
  return <div className="modal-backdrop"><section className="modal small-modal member-access-modal"><ModalHead eyebrow="TEAM MEMBER MODE" title="Share one team link" description="Players use a private link and 6-digit PIN, select their roster name, and enter without creating an account." close={onClose}/>{loading?<div className="member-access-intro"><strong>Loading your team invitation…</strong></div>:access?<div className="invite-preview"><label>Reusable WhatsApp message<textarea readOnly value={message} onFocus={event=>event.currentTarget.select()}/></label><small>Keep reusing this message. Replace the link and PIN only if they were shared outside the team or you need to sign everyone out.</small></div>:<div className="member-access-intro"><strong>{replacementRequired?"Replace the existing link once":"Create access once, then reuse it"}</strong><p>{replacementRequired?"Your current access was created before reusable invitation storage was added. Replace it once to display and reuse the same message here.":"Members can view team records and add only expenses paid by the player they select. They cannot change rosters, leagues, games, credits, settlements, or invitations."}</p><div><span>1</span>Create the private link and PIN once</div><div><span>2</span>Reuse the same WhatsApp message</div><div><span>3</span>Replace only when access should be reset</div></div>}<div className="modal-actions">{access&&<button type="button" className="danger-action" onClick={revoke}>Revoke access</button>}<button type="button" className="ghost" onClick={onClose}>Done</button>{access?<><button type="button" className="ghost" disabled={creating} onClick={()=>create(true)}>{creating?"Replacing…":"Replace link & PIN"}</button><button type="button" className="primary" onClick={copy}>Copy same message</button></>:!loading&&<button type="button" className="primary" disabled={creating||!team.players.length} onClick={()=>create(replacementRequired)}>{creating?"Creating…":replacementRequired?"Replace existing access":"Create link & PIN"}</button>}</div></section></div>;
}
function InviteAccessModal({player,teamName,preview,onClose,onInvite,onCopy}:{player:Player;teamName:string;preview:string;onClose:()=>void;onInvite:(role:"member"|"treasurer")=>Promise<void>;onCopy:()=>Promise<void>}) {
  const [creating,setCreating]=useState(false);
  return <div className="modal-backdrop"><form className="modal small-modal" onSubmit={async e=>{e.preventDefault();setCreating(true);await onInvite("treasurer");setCreating(false)}}><ModalHead eyebrow="CO-TREASURER INVITE" title={preview?"Invitation ready":`Invite ${player.name}`} description={preview?"Review the exact message below, then copy and send it using your preferred app.":player.email?`The single-use link will expire in 7 days and only ${player.email} can accept it.`:`Add ${player.name}’s email to the roster before granting co-treasurer access for ${teamName}.`} close={onClose}/>{preview?<div className="invite-preview"><label>Message being sent<textarea readOnly value={preview} onFocus={event=>event.currentTarget.select()} /></label><small>This private link is single-use and expires after 7 days.</small></div>:<><div className="access-options"><label className={`selected ${!player.email?"disabled":""}`}><input type="radio" checked readOnly disabled={!player.email}/><span><strong>Co-treasurer</strong><small>{player.email?"Full access to roster, leagues, games, expenses, settlements, and invitations.":"Edit this roster player and add their email first."}</small></span></label></div><div className="invite-security-note">Co-treasurers use their own authenticated account. The invitation is private, single-use, email-restricted, and expires after 7 days.</div></>}<div className="modal-actions"><button type="button" className="ghost" onClick={onClose}>{preview?"Done":"Cancel"}</button>{preview?<button type="button" className="primary" onClick={onCopy}>Copy invitation</button>:<button className="primary" disabled={creating||!player.email}>{creating?"Creating…":"Invite co-treasurer"}</button>}</div></form></div>;
}
function SettlementPaymentModal({players,balances,suggestions,onClose,onSave}:{players:Player[];balances:PlayerBalance[];suggestions:ReturnType<typeof settlementTransfers>;onClose:()=>void;onSave:(payment:Omit<SettlementPayment,"id"|"recordedBy">)=>void}) {
  const localToday=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`};
  const debtors=balances.filter(balance=>balance.balance<-.005);
  const creditors=balances.filter(balance=>balance.balance>.005);
  const first=suggestions[0];
  const [fromPlayerId,setFromPlayerId]=useState(first?.fromPlayerId??debtors[0]?.id??0);
  const [toPlayerId,setToPlayerId]=useState(first?.toPlayerId??creditors[0]?.id??0);
  const [amount,setAmount]=useState(first?first.amount.toFixed(2):"");
  const [date,setDate]=useState(localToday());
  const [note,setNote]=useState("");
  const fromBalance=balances.find(balance=>balance.id===fromPlayerId);
  const toBalance=balances.find(balance=>balance.id===toPlayerId);
  const maximum=Math.max(0,Math.min(-(fromBalance?.balance??0),toBalance?.balance??0));
  const numericAmount=Number(amount);
  const valid=fromPlayerId!==toPlayerId&&maximum>.005&&numericAmount>0&&numericAmount<=maximum+.005;
  const chooseSuggestion=(index:number)=>{const suggestion=suggestions[index];if(!suggestion)return;setFromPlayerId(suggestion.fromPlayerId);setToPlayerId(suggestion.toPlayerId);setAmount(suggestion.amount.toFixed(2))};
  return <div className="modal-backdrop"><form className="modal lineup-modal" onSubmit={event=>{event.preventDefault();if(valid)onSave({date,fromPlayerId,toPlayerId,amount:numericAmount,note:note.trim()})}}><ModalHead eyebrow="CONFIRMED REPAYMENT" title="Record a received payment" description="Use this only after the receiver confirms the money arrived. It reduces both players’ remaining settlement balances." close={onClose}/>{suggestions.length>0&&<div className="payment-suggestions"><strong>Current suggestions</strong><div>{suggestions.map((suggestion,index)=><button type="button" key={`${suggestion.fromPlayerId}-${suggestion.toPlayerId}`} onClick={()=>chooseSuggestion(index)}><span>{suggestion.from} → {suggestion.to}</span><b>{money.format(suggestion.amount)}</b></button>)}</div></div>}<div className="form-grid"><label>Money sent by<select required value={fromPlayerId} onChange={event=>{const id=Number(event.target.value);setFromPlayerId(id);const next=balances.find(balance=>balance.id===id);setAmount(Math.min(-(next?.balance??0),toBalance?.balance??0).toFixed(2))}}>{debtors.map(player=><option key={player.id} value={player.id}>{player.name} · owes {money.format(-player.balance)}</option>)}</select></label><label>Money received by<select required value={toPlayerId} onChange={event=>{const id=Number(event.target.value);setToPlayerId(id);const next=balances.find(balance=>balance.id===id);setAmount(Math.min(-(fromBalance?.balance??0),next?.balance??0).toFixed(2))}}>{creditors.map(player=><option key={player.id} value={player.id}>{player.name} · due {money.format(player.balance)}</option>)}</select></label><label>Amount received ($)<input required min=".01" max={maximum.toFixed(2)} step=".01" type="number" value={amount} onChange={event=>setAmount(event.target.value)}/><small className="field-help">Maximum for this pair: {money.format(maximum)}</small></label><label>Received date<input required type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><label className="wide">Reference / note (optional)<input maxLength={240} value={note} onChange={event=>setNote(event.target.value)} placeholder="e.g. Zelle received, bank reference, cash"/></label></div><div className="payment-confirmation"><strong>This records confirmation—it does not move money.</strong><span>{valid?`${players.find(player=>player.id===fromPlayerId)?.name} will owe ${money.format(Math.max(0,-(fromBalance?.balance??0)-numericAmount))} after this payment.`:"Choose a valid payer, receiver, and amount within their remaining balances."}</span></div><div className="modal-actions"><span className={valid?"ready":"warning"}>{valid?"Ready to confirm":"Check payment"}</span><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!valid}>Confirm payment received</button></div></form></div>;
}
function CricClubsImportModal({teamName,connection:initialConnection,leagues,currentLeague,players,onClose,onLink,onImport}:{teamName:string;connection?:CricClubsTeamConnection;leagues:League[];currentLeague?:League;players:Player[];onClose:()=>void;onLink:(connection:CricClubsTeamConnection,league:CricClubsLeagueConnection,targetLeagueId:number)=>void;onImport:(games:Array<Omit<Game,"id">>,connection:CricClubsTeamConnection,league:CricClubsLeagueConnection,newPlayers:Player[],targetLeagueId?:number)=>void}) {
  const [clubCode,setClubCode]=useState(initialConnection?.shortCode??"");
  const [searchTeamName,setSearchTeamName]=useState(initialConnection?.teamName??teamName);
  const [connection,setConnection]=useState(initialConnection);
  const [linkedLeague,setLinkedLeague]=useState(currentLeague?.cricclubs);
  const [targetLeagueId,setTargetLeagueId]=useState<number|undefined>(currentLeague?.cricclubs?currentLeague.id:undefined);
  const [series,setSeries]=useState<CricClubsSeries[]>([]);
  const [selectedSeriesId,setSelectedSeriesId]=useState(currentLeague?.cricclubs?.seriesId??"");
  const [matches,setMatches]=useState<CricClubsMatch[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [mapping,setMapping]=useState<Record<string,number>>({});
  const [pendingPlayers,setPendingPlayers]=useState<Player[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const sortedPlayers=useMemo(()=>[...players,...pendingPlayers].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true})),[players,pendingPlayers]);
  const normalized=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");
  const mappingKey=(matchId:string,externalId:string)=>`${matchId}:${externalId}`;
  const prepareMatches=(remoteMatches:CricClubsMatch[])=>{
    const existingGames=leagues.flatMap(item=>item.games);
    const incoming=remoteMatches.filter(match=>!existingGames.some(game=>game.source==="cricclubs"&&game.externalId===match.externalId));
    const remoteNames=[...new Set(incoming.flatMap(match=>match.players.map(player=>player.name)))];
    const missing=remoteNames.filter(name=>!players.some(player=>normalized(player.name)===normalized(name))).map((name,index)=>({id:Date.now()+index,name,initials:initials(name),color:colors[(players.length+index)%colors.length]}));
    setPendingPlayers(missing);
    const available=[...players,...missing];
    const nextMapping:Record<string,number>={};
    for(const match of incoming)for(const remote of match.players){
      const local=available.find(player=>normalized(player.name)===normalized(remote.name));
      if(local)nextMapping[mappingKey(match.externalId,remote.externalId)]=local.id;
    }
    setMapping(nextMapping);setMatches(incoming);setSelected(incoming.map(match=>match.externalId));
  };
  const discover=async()=>{
    setLoading(true);setError("");setMatches([]);
    try{
      const requestedConnection=connection??{shortCode:clubCode.trim(),teamName:searchTeamName.trim()};
      const response=await fetch("/api/cricclubs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"discover",connection:requestedConnection})});
      const result=await response.json() as {connection?:CricClubsTeamConnection;series?:CricClubsSeries[];error?:string};
      if(!response.ok||!result.connection)throw new Error(result.error??"CricClubs leagues could not be checked");
      setConnection(result.connection);setSeries(result.series??[]);
      const preferred=(result.series??[]).find(item=>item.seriesId===linkedLeague?.seriesId)??(result.series??[])[0];
      setSelectedSeriesId(preferred?.seriesId??"");
      if(!(result.series??[]).length)setError(`No recent CricClubs leagues were found for ${result.connection.teamName}.`);
    }catch(reason){setError((reason as Error).message)}finally{setLoading(false)}
  };
  const check=async(nextConnection=connection,nextLeague=linkedLeague)=>{
    if(!nextConnection||!nextLeague){setError("Choose a CricClubs league to link first.");return}
    setLoading(true);setError("");setMatches([]);
    try{
      const response=await fetch("/api/cricclubs",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"matches",connection:nextConnection,league:nextLeague})});
      const result=await response.json() as {matches?:CricClubsMatch[];error?:string};
      if(!response.ok)throw new Error(result.error??"CricClubs sync failed");
      prepareMatches(result.matches??[]);
    }catch(reason){setError((reason as Error).message)}finally{setLoading(false)}
  };
  const linkAndCheck=async()=>{
    const next=series.find(item=>item.seriesId===selectedSeriesId);
    if(!connection||!next)return;
    const leagueLink:CricClubsLeagueConnection={seriesId:next.seriesId,seriesName:next.seriesName,teamId:next.teamId};
    const existingLeague=leagues.find(item=>item.cricclubs?.seriesId===next.seriesId);
    const destinationId=existingLeague?.id;
    setTargetLeagueId(destinationId);setLinkedLeague(leagueLink);
    if(destinationId)onLink(connection,leagueLink,destinationId);
    await check(connection,leagueLink);
  };
  const selectedMatches=matches.filter(match=>selected.includes(match.externalId));
  const mappedIds=(match:CricClubsMatch)=>match.players.map(remote=>mapping[mappingKey(match.externalId,remote.externalId)]).filter((id):id is number=>Boolean(id));
  const invalid=selectedMatches.some(match=>{const ids=mappedIds(match);return ids.length<11||ids.length>12||new Set(ids).size!==ids.length});
  const importGames=()=>{if(connection&&linkedLeague)onImport(selectedMatches.map(match=>({date:match.date,opponent:match.opponent,venue:match.venue,players:mappedIds(match),status:"Completed",source:"cricclubs",externalId:match.externalId,sourceUrl:match.sourceUrl})),connection,linkedLeague,pendingPlayers,targetLeagueId)};
  return <div className="modal-backdrop"><section className="modal cricclubs-modal"><ModalHead eyebrow="CRICCLUBS IMPORT" title="Sync completed games" description="Connect the team once, discover its CricClubs leagues, and link the right series to this WicketSplit league." close={onClose}/>
    <div className="cricclubs-source">
      {connection?<div className="cricclubs-connection"><span>CONNECTED TEAM</span><strong>{connection.teamName}</strong><small>cricclubs.com/{connection.shortCode}</small></div>:<div className="cricclubs-team-search"><label>CricClubs club code<input maxLength={30} value={clubCode} onChange={event=>setClubCode(event.target.value)} placeholder="e.g. CL"/></label><label>Team name<input maxLength={160} value={searchTeamName} onChange={event=>setSearchTeamName(event.target.value)} placeholder="e.g. Wolfpacks"/></label></div>}
      <button className="ghost" disabled={loading||(!connection&&(!clubCode.trim()||!searchTeamName.trim()))} onClick={discover}>{loading?"Checking…":connection?"Check for new leagues":"Find my leagues"}</button>
      {series.length>0&&<label>CricClubs league<select value={selectedSeriesId} onChange={event=>setSelectedSeriesId(event.target.value)}>{series.map(item=><option key={item.seriesId} value={item.seriesId}>{item.seriesName}{item.startDate?` · ${item.startDate}`:""}</option>)}</select></label>}
      {series.length>0&&<button className="primary" disabled={loading||!selectedSeriesId} onClick={linkAndCheck}>{leagues.some(item=>item.cricclubs?.seriesId===selectedSeriesId)?"Check linked league":"Create league & check games"}</button>}
      {!series.length&&connection&&linkedLeague&&<button className="primary" disabled={loading} onClick={()=>check()}>{loading?"Checking…":"Check completed games"}</button>}
    </div>
    {linkedLeague&&<div className="sync-linked"><span>{targetLeagueId?`Importing into ${leagues.find(item=>item.id===targetLeagueId)?.name??"linked league"}`:"A new WicketSplit league will be created when you import"}</span><strong>{linkedLeague.seriesName}</strong></div>}
    {pendingPlayers.length>0&&<div className="sync-roster-note"><strong>{pendingPlayers.length} missing roster players will be added automatically</strong><span>{pendingPlayers.map(player=>player.name).join(" · ")}</span></div>}
    {error&&<div className="sync-error">{error}</div>}
    {!loading&&!error&&matches.length===0&&<div className="sync-guidance">{connection?"Use “Check for new leagues” whenever a new season starts. Select it once, then future game checks reuse the saved connection.":"Enter the short code shown after cricclubs.com in your league URL and confirm the team name. WicketSplit will remember both after the first import."}</div>}
    {matches.length>0&&<div className="sync-match-list">{matches.map(match=>{const ids=mappedIds(match);const valid=ids.length>=11&&ids.length<=12&&new Set(ids).size===ids.length;return <article key={match.externalId} className={selected.includes(match.externalId)?"selected":""}><label className="sync-match-head"><input type="checkbox" checked={selected.includes(match.externalId)} onChange={()=>setSelected(current=>current.includes(match.externalId)?current.filter(id=>id!==match.externalId):[...current,match.externalId])}/><span><strong>{match.date} · vs {match.opponent}</strong><small>{match.seriesName} · {match.venue||"Venue not specified"} · {match.result}</small></span><b className={valid?"matched":"unmatched"}>{ids.length}/{match.players.length} matched</b></label>{selected.includes(match.externalId)&&<div className="sync-player-map">{match.players.map(remote=><label key={remote.externalId}><span>{remote.name}</span><select aria-label={`Match ${remote.name} to roster`} value={mapping[mappingKey(match.externalId,remote.externalId)]??""} onChange={event=>setMapping(current=>({...current,[mappingKey(match.externalId,remote.externalId)]:Number(event.target.value)}))}><option value="">Select roster player…</option>{sortedPlayers.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></label>)}</div>}</article>})}</div>}
    <div className="modal-actions"><span className={selectedMatches.length&&!invalid?"ready":"warning"}>{selectedMatches.length?invalid?"Match all 11 or 12 unique players":`${selectedMatches.length} ready to import`:"No new games selected"}</span><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!selectedMatches.length||invalid} onClick={importGames}>{targetLeagueId?"Import new games":"Create league & import games"}</button></div>
  </section></div>;
}
function normalizeOcrText(value:string){return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g,"")}
function editDistance(a:string,b:string){const row=Array.from({length:b.length+1},(_,index)=>index);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const saved=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=saved}}return row[b.length]}
function closestRosterPlayer(name:string,players:Player[]){const target=normalizeOcrText(name);if(!target)return 0;const exact=players.find(player=>normalizeOcrText(player.name)===target);if(exact)return exact.id;let best:Player|undefined;let score=0;for(const player of players){const candidate=normalizeOcrText(player.name);const next=1-editDistance(target,candidate)/Math.max(target.length,candidate.length,1);if(next>score){score=next;best=player}}return score>=.82?best?.id??0:0}
function cleanOcrLine(value:string){return value.replace(/[|©®™•·_]+/g," ").replace(/\s+/g," ").replace(/^[^A-Za-z]+|[^A-Za-z0-9.' -]+$/g,"").trim()}
function parseSquadText(text:string):ScreenshotSide{
  const lines=text.split(/\r?\n/).map(cleanOcrLine).filter(Boolean);
  const marker=lines.findIndex(line=>/(play\w*|ying)\s+sq\w*/i.test(line));
  const ignored=/^(league matches|scorecard|comms|squads?|analysis|mvp|playing squad|share|settings?)$/i;
  const plausible=(line:string)=>line.length>=2&&line.length<=60&&/[A-Za-z]/.test(line)&&!ignored.test(line)&&!/(scorecard|comms|squads?|analysis|mvp|league matches)/i.test(line);
  const before=(marker>=0?lines.slice(0,marker):lines.slice(0,8)).filter(plausible);
  const heading=(before.at(-1)??"").replace(/^\s*\d+\s*/,"").split(/\s+/).filter(token=>token.length>2).join(" ");
  const after=(marker>=0?lines.slice(marker+1):lines).filter(line=>plausible(line)&&normalizeOcrText(line)!==normalizeOcrText(heading));
  const names=after.map(line=>line.replace(/\s+\d+$/,"" )).filter(line=>line.split(/\s+/).length<=6&&!/^(captain|wicket keeper|substitute)$/i.test(line)).slice(0,12);
  return {heading,names};
}
async function cropScreenshot(file:File,side:"left"|"right"){
  const url=URL.createObjectURL(file);
  try{
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const element=new Image();element.onload=()=>resolve(element);element.onerror=()=>reject(new Error("Screenshot could not be opened"));element.src=url});
    const canvas=document.createElement("canvas");const width=Math.floor(image.naturalWidth*.55);const left=side==="left"?0:image.naturalWidth-width;canvas.width=width;canvas.height=image.naturalHeight;
    const context=canvas.getContext("2d");if(!context)throw new Error("Screenshot could not be read");
    context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,left,0,width,image.naturalHeight,0,0,width,image.naturalHeight);
    return canvas;
  }finally{URL.revokeObjectURL(url)}
}
function selectionsFor(side:ScreenshotSide,players:Player[]){return side.names.map(name=>({name,playerId:closestRosterPlayer(name,players)}))}

function ScreenshotImportModal({teamName,players,onClose,onImport}:{teamName:string;players:Player[];onClose:()=>void;onImport:(drafts:ScreenshotDraft[])=>void}){
  const [drafts,setDrafts]=useState<ScreenshotDraft[]>([]);const [processing,setProcessing]=useState(false);const [progress,setProgress]=useState(0);const [message,setMessage]=useState("");
  const selected=drafts.filter(draft=>draft.selected);const valid=selected.length>0&&selected.every(draft=>draft.opponent.trim()&&draft.players.length>=11&&draft.players.length<=12&&draft.players.every(player=>player.name.trim())&&new Set(draft.players.map(player=>player.playerId?`id:${player.playerId}`:`name:${normalizeOcrText(player.name)}`)).size===draft.players.length);
  const updateDraft=(id:number,change:(draft:ScreenshotDraft)=>ScreenshotDraft)=>setDrafts(current=>current.map(draft=>draft.id===id?change(draft):draft));
  const chooseSide=(draft:ScreenshotDraft,side:"left"|"right")=>{const ours=draft[side];const theirs=draft[side==="left"?"right":"left"];return {...draft,side,opponent:theirs.heading,players:selectionsFor(ours,players)}};
  const processFiles=async(files:FileList|null)=>{
    if(!files?.length)return;const images=Array.from(files).filter(file=>file.type.startsWith("image/")).slice(0,10);if(!images.length){setMessage("Choose screenshot image files.");return}
    setProcessing(true);setProgress(0);setMessage("Preparing private on-device text recognition…");let worker:Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>|undefined;
    try{
      const {createWorker}=await import("tesseract.js");worker=await createWorker("eng",1,{logger:event=>{if(event.status==="recognizing text")setProgress(Math.round(event.progress*100))}});
      const next:ScreenshotDraft[]=[];
      for(let index=0;index<images.length;index++){
        setMessage(`Reading screenshot ${index+1} of ${images.length}…`);
        const leftCanvas=await cropScreenshot(images[index],"left");const rightCanvas=await cropScreenshot(images[index],"right");
        const leftText=(await worker.recognize(leftCanvas)).data.text;const rightText=(await worker.recognize(rightCanvas)).data.text;const left=parseSquadText(leftText);const right=parseSquadText(rightText);
        const teamKey=normalizeOcrText(teamName);const side:"left"|"right"=normalizeOcrText(leftText).includes(teamKey)?"left":"right";
        const ours=side==="left"?left:right;const theirs=side==="left"?right:left;
        next.push({id:Date.now()+index,fileName:images[index].name,date:"",side,left,right,opponent:theirs.heading,players:selectionsFor(ours,players),selected:true});
      }
      setDrafts(next);setMessage("Review every opponent and lineup before importing.");
    }catch{setMessage("The screenshots could not be read. Try clearer, uncropped squad screenshots or add the game manually.")}finally{await worker?.terminate();setProcessing(false);setProgress(0)}
  };
  return <div className="modal-backdrop"><section className="modal screenshot-modal"><ModalHead eyebrow="PRIVATE SCREENSHOT IMPORT" title="Import squad screenshots" description={`WicketSplit reads each image on this device, keeps only ${teamName}’s confirmed lineup, and never uploads or saves the screenshot.`} close={onClose}/>
    {!drafts.length?<div className="screenshot-drop"><span>▧</span><h3>Select one screenshot per game</h3><p>You may select up to 10 screenshots together. Each should show both team names and the Playing Squad columns.</p><label className={`primary ${processing?"disabled":""}`}>Choose screenshots<input disabled={processing} type="file" accept="image/*" multiple onChange={event=>processFiles(event.target.files)}/></label>{processing&&<div className="ocr-progress"><progress value={progress} max="100"/><small>{message} {progress}%</small></div>} {!processing&&message&&<small className="screenshot-error">{message}</small>}<small>Images remain in temporary browser memory only and are discarded when this window closes.</small></div>:
    <div className="screenshot-review"><div className="screenshot-review-head"><strong>{drafts.length} {drafts.length===1?"screenshot":"screenshots"} processed</strong><span>{message}</span></div>{drafts.map(draft=><article key={draft.id} className={draft.selected?"selected":""}><div className="screenshot-file"><label><input type="checkbox" checked={draft.selected} onChange={()=>updateDraft(draft.id,current=>({...current,selected:!current.selected}))}/><span><strong>{draft.fileName}</strong><small>Screenshot discarded after import or close</small></span></label><button type="button" onClick={()=>setDrafts(current=>current.filter(item=>item.id!==draft.id))}>Remove</button></div>{draft.selected&&<><div className="screenshot-fields"><label>Our team column<select value={draft.side} onChange={event=>updateDraft(draft.id,current=>chooseSide(current,event.target.value as "left"|"right"))}><option value="left">Left · {draft.left.heading||"team not detected"}</option><option value="right">Right · {draft.right.heading||"team not detected"}</option></select></label><label>Opponent<input required value={draft.opponent} onChange={event=>updateDraft(draft.id,current=>({...current,opponent:event.target.value}))} placeholder="Opponent team"/></label><label>Date (optional)<input type="date" value={draft.date} onChange={event=>updateDraft(draft.id,current=>({...current,date:event.target.value}))}/></label></div><div className="screenshot-lineup"><div><strong>{draft.players.length}/12 lineup</strong><button type="button" disabled={draft.players.length>=12} onClick={()=>updateDraft(draft.id,current=>({...current,players:[...current.players,{name:"",playerId:0}]}))}>＋ Add player</button></div>{draft.players.map((candidate,index)=><div className="screenshot-player" key={`${draft.id}-${index}`}><input aria-label={`Detected player ${index+1}`} value={candidate.name} onChange={event=>updateDraft(draft.id,current=>({...current,players:current.players.map((item,itemIndex)=>itemIndex===index?{name:event.target.value,playerId:closestRosterPlayer(event.target.value,players)}:item)}))}/><select aria-label={`Roster match for ${candidate.name||`player ${index+1}`}`} value={candidate.playerId} onChange={event=>updateDraft(draft.id,current=>({...current,players:current.players.map((item,itemIndex)=>itemIndex===index?{...item,playerId:Number(event.target.value)}:item)}))}><option value="0">Add as new roster player</option>{[...players].sort((a,b)=>a.name.localeCompare(b.name)).map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select><button type="button" aria-label={`Remove ${candidate.name||`player ${index+1}`}`} onClick={()=>updateDraft(draft.id,current=>({...current,players:current.players.filter((_,itemIndex)=>itemIndex!==index)}))}>×</button></div>)}</div></>}</article>)}</div>}
    <div className="modal-actions"><span className={valid?"ready":"warning"}>{drafts.length?(valid?`${selected.length} ready to import`:"Each selected game needs an opponent and 11 or 12 unique players"):"Screenshots are processed locally"}</span><button type="button" className="ghost" onClick={onClose}>Cancel</button>{drafts.length>0&&<button type="button" className="primary" disabled={!valid} onClick={()=>onImport(selected)}>Import {selected.length} {selected.length===1?"game":"games"}</button>}</div>
  </section></div>;
}

function GameModal({game,suggestedPlayers,players,onClose,onSave,onDelete}:{game?:Game;suggestedPlayers?:number[];players:Player[];onClose:()=>void;onSave:(g:Omit<Game,"id">)=>void;onDelete?:()=>void}) {
  const [opponent,setOpponent]=useState(game?.opponent??""); const [date,setDate]=useState(game?.date??""); const [venue,setVenue]=useState(game?.venue??""); const [selected,setSelected]=useState<number[]>(game?.players??[]);
  const [excludedFromSplit,setExcludedFromSplit]=useState<number[]>(game?.excludedFromSplit??[]);
  const [showSplitOptions,setShowSplitOptions]=useState(Boolean(game?.excludedFromSplit?.length));
  const [status,setStatus]=useState<Game["status"]>(game?.status??"Upcoming"); const [statusChanged,setStatusChanged]=useState(Boolean(game));
  const sortedPlayers=useMemo(()=>[...players].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true})),[players]);
  const selectedPlayers=sortedPlayers.filter(player=>selected.includes(player.id));
  const eligibleCount=selected.length-excludedFromSplit.filter(id=>selected.includes(id)).length;
  const today=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`};
  const chooseDate=(next:string)=>{setDate(next);if(!statusChanged)setStatus(next&&next<today()?"Completed":"Upcoming")};
  const togglePlayer=(playerId:number)=>{if(selected.includes(playerId)){setSelected(selected.filter(id=>id!==playerId));setExcludedFromSplit(excludedFromSplit.filter(id=>id!==playerId))}else if(selected.length<12)setSelected([...selected,playerId])};
  const copyPrevious=()=>{setSelected((suggestedPlayers??[]).filter(id=>players.some(player=>player.id===id)).slice(0,12));setExcludedFromSplit([]);setShowSplitOptions(false)};
  const valid=selected.length>=11&&eligibleCount>0;
  const lineupName=selected.length===11?"Playing XI":selected.length===12?"Playing XII":`${selected.length}/12 selected`;
  return <div className="modal-backdrop"><form className="modal lineup-modal" onSubmit={e=>{e.preventDefault();if(valid)onSave({opponent:opponent.trim(),date,venue:venue.trim(),players:selected,excludedFromSplit:excludedFromSplit.length?[...excludedFromSplit]:undefined,status,source:game?.source,externalId:game?.externalId,sourceUrl:game?.sourceUrl})}}><ModalHead eyebrow={game?"EDIT GAME":"NEW FIXTURE"} title={game?"Edit game & lineup":"Add game & lineup"} description="Add the opponent and select the 11 or 12 players who played. Saved lineups automatically update game-funded expense shares." close={onClose}/><div className="form-grid"><label>Opponent<input autoFocus={!game} required value={opponent} onChange={e=>setOpponent(e.target.value)} placeholder="Team name"/></label><label>Date (optional)<input type="date" value={date} onChange={e=>chooseDate(e.target.value)}/></label><label>Venue (optional)<input value={venue} onChange={e=>setVenue(e.target.value)} placeholder="Ground or park"/></label><label>Status<select value={status} onChange={e=>{setStatus(e.target.value as Game["status"]);setStatusChanged(true)}}><option>Upcoming</option><option>Completed</option></select></label></div>{!game&&Boolean(suggestedPlayers?.length)&&<div className="lineup-shortcut"><span>Most players same as the previous game?</span><button type="button" className="ghost" onClick={copyPrevious}>Use previous lineup</button></div>}<div className="player-picker compact">{sortedPlayers.map(p=><button type="button" key={p.id} className={selected.includes(p.id)?"picked":""} onClick={()=>togglePlayer(p.id)}><span className="avatar" style={{background:p.color}}>{p.initials}</span><span>{p.name}</span><i>{selected.includes(p.id)?"✓":"＋"}</i></button>)}</div>{selectedPlayers.length>0&&<div className="lineup-selection-summary"><div><strong>{lineupName}</strong><span>{excludedFromSplit.length?`${eligibleCount} share this game · ${excludedFromSplit.length} excluded`:"Everyone selected will share this game by default"}</span></div><button type="button" onClick={()=>setShowSplitOptions(current=>!current)}>{showSplitOptions?"Hide split options":"Adjust who shares (optional)"}</button></div>}{showSplitOptions&&selectedPlayers.length>0&&<section className="split-eligibility"><div><strong>Who shares this game?</strong><span>Only turn someone off when they played but should not share League Fee, Fruits / Water, IV, or umpiring-credit funding for this game.</span></div><div>{selectedPlayers.map(player=>{const included=!excludedFromSplit.includes(player.id);return <label key={player.id}><input type="checkbox" checked={included} onChange={()=>setExcludedFromSplit(included?[...excludedFromSplit,player.id]:excludedFromSplit.filter(id=>id!==player.id))}/><span className="avatar" style={{background:player.color}}>{player.initials}</span><strong>{player.name}</strong><small>{included?"Shares cost":"Excluded"}</small></label>})}</div></section>}<div className="modal-actions">{onDelete&&<button type="button" className="danger-action" onClick={onDelete}>Delete game</button>}<span className={valid?"ready":"warning"}>{valid?`${lineupName} ready · ${eligibleCount} sharing`:`${selected.length}/11 minimum selected`}</span><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!valid}>{game?"Save changes":"Save game"}</button></div></form></div>;
}
function ExpenseModal({expense,memberPlayerId,existingExpenses,leagueFeeExists,players,games,onAddPlayer,onClose,onSave,onDelete}:{expense?:Expense;memberPlayerId?:number;existingExpenses:Expense[];leagueFeeExists:boolean;players:Player[];games:Game[];onAddPlayer?:(name:string)=>number;onClose:()=>void;onSave:(e:Omit<Expense,"id">)=>void;onDelete?:()=>void}) {
  const localToday=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`};
  const sortedPlayers=useMemo(()=>[...players].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true})),[players]);
  const paidByOptions=memberPlayerId?sortedPlayers.filter(player=>player.id===memberPlayerId):sortedPlayers;
  const [label,setLabel]=useState(expense?.label??""); const [amount,setAmount]=useState(expense?String(expense.amount):""); const [category,setCategory]=useState(expense?expenseCategoryForForm(expense.category):""); const [paidBy,setPaidBy]=useState(expense?.paidBy??0); const [split,setSplit]=useState<ExpenseSplitMode|"">(expense?(usesAppearanceSplit(expense)?"appearances":"custom"):""); const [date,setDate]=useState(expense?.date??localToday()); const [customPlayers,setCustomPlayers]=useState<number[]>(expense?.participants??[]);
  const participants=split==="custom"?customPlayers:[];
  const totalAppearances=splitAppearanceCount(games); const fundedGameCount=fundedGames(games).length; const canSave=Boolean(category&&paidBy&&(split==="appearances"||participants.length>0));
  const duplicate=existingExpenses.find(entry=>entry.id!==expense?.id&&entry.date===date&&entry.amount===Number(amount)&&entry.label.trim().toLowerCase()===label.trim().toLowerCase());
  const appearanceCategory=appearanceCategories.has(category);
  return <div className="modal-backdrop"><form className="modal lineup-modal" onSubmit={e=>{e.preventDefault();if(canSave&&!duplicate)onSave({label:label.trim(),amount:Number(amount),category,paidBy,split,date,participants:split==="appearances"?undefined:[...participants]})}}>
    <ModalHead eyebrow={expense?"EDIT PAYMENT":"NEW PAYMENT"} title={expense?"Edit expense":"Add an expense"} description={memberPlayerId?"Record an expense you paid and choose who should share it.":"Choose who paid and exactly how this cost should be shared."} close={onClose}/>
    <div className="form-grid">
      <label className="wide">Description<input autoFocus required value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Practice ground rental"/></label>
      <label>Amount ($)<input required min=".01" step=".01" type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      <label>Expense date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label>Category<select required value={category} onChange={e=>{const next=e.target.value;setCategory(next);setSplit(next?(appearanceCategories.has(next)?"appearances":"custom"):"")}}><option value="" disabled>Select category</option><option>Fruits / Water</option><option disabled={leagueFeeExists||Boolean(memberPlayerId)}>League Fee{memberPlayerId?" (treasurer only)":leagueFeeExists?" (already recorded)":""}</option><option>Restaurant</option><option>Other</option></select></label>
      <label>Paid by<select required value={paidBy} onChange={e=>setPaidBy(Number(e.target.value))}><option value="0" disabled>Select who paid</option>{paidByOptions.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      {!appearanceCategory&&<SplitFields split={split} setSplit={setSplit}/>}
    </div>
    {duplicate&&<div className="duplicate-warning"><strong>Possible duplicate expense</strong><span>An entry with the same description, date, and amount already exists. Edit that entry instead.</span></div>}
    {split==="custom"&&<ParticipantPicker players={sortedPlayers} selected={customPlayers} setSelected={setCustomPlayers} onAddPlayer={onAddPlayer} title="Select everyone who should share this expense"/>}
    {split==="appearances"&&<div className={fundedGameCount?"split-note":"split-note warning"}><strong>Automatic game split · {fundedGameCount} completed {fundedGameCount===1?"game":"games"}</strong><span>{fundedGameCount?"Nothing else to select. WicketSplit divides this equally across completed games, then among each game’s included players. Adding or editing a lineup automatically recalculates every share.":"Add a completed game with its Playing XI/XII first; this expense will recalculate automatically."}</span></div>}
    <div className="modal-actions">{onDelete&&<button type="button" className="danger-action" onClick={onDelete}>Delete expense</button>}<span className={canSave&&!duplicate?"ready":"warning"}>{duplicate?"Duplicate found":split==="appearances"?`${fundedGameCount} games · ${totalAppearances} payers`: `${participants.length} sharing`}</span><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!canSave||Boolean(duplicate)}>{expense?"Save changes":"Add & split"}</button></div>
  </form></div>;
}

function CreditModal({credit,players,games,onClose,onSave,onDelete}:{credit?:Credit;players:Player[];games:Game[];onClose:()=>void;onSave:(credits:Omit<Credit,"id">[])=>void;onDelete?:()=>void}) {
  const sortedPlayers=useMemo(()=>[...players].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base",numeric:true})),[players]);
  const displayPlayers=credit?sortedPlayers.filter(player=>player.id===credit.playerId):sortedPlayers;
  const [rate,setRate]=useState(String(credit?.rate??(credit?.amount||"")));
  const [counts,setCounts]=useState<Record<number,string>>(()=>Object.fromEntries(displayPlayers.map(player=>[player.id,String(credit?.playerId===player.id?credit.units??1:0)])));
  const fixedRate=Number(rate);
  const today=(()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`})();
  const eligibleAppearances=splitAppearanceCount(games);
  const rows=displayPlayers.map(player=>{const units=Number(counts[player.id]||0);return {player,units,amount:units*fixedRate,valid:Number.isSafeInteger(units)&&units>=0&&units<=1_000}});
  const active=rows.filter(row=>row.units>0);
  const totalCredit=active.reduce((sum,row)=>sum+row.amount,0);
  const valid=fixedRate>0&&active.length>0&&eligibleAppearances>0&&rows.every(row=>row.valid);
  return <div className="modal-backdrop"><form className="modal lineup-modal" onSubmit={event=>{event.preventDefault();if(valid)onSave(active.map(({player,units,amount})=>({label:`Umpiring credit · ${units} ${units===1?"game":"games"}`,amount,playerId:player.id,date:today,split:"custom",kind:"umpiring-waiver",units,rate:fixedRate})))}}>
    <ModalHead eyebrow={credit?"EDIT UMPIRING CREDIT":"RECORD UMPIRING"} title={credit?"Edit umpiring credit":"Record umpiring for the team"} description={credit?"Update this player’s umpiring count or fixed rate.":"Enter the fixed rate once, then add the number of outside matches each player umpired."} close={onClose}/>
    <div className="umpiring-rate"><label>Fixed credit per game ($)<input autoFocus required min=".01" step=".01" type="number" value={rate} onChange={event=>setRate(event.target.value)} placeholder="e.g. 25.00"/></label><p>The player receives the full credit. That full amount is added to the team cost pool, split equally across {fundedGames(games).length} completed games, then divided among each game’s eligible players.</p></div>
    <div className="umpiring-grid"><div className="umpiring-row umpiring-header"><span>Player</span><span>Funded by</span><span>Games umpired</span><span>Credit</span></div>{rows.map(({player,amount,valid:rowValid})=><div className={`umpiring-row${!rowValid?" row-error":""}`} key={player.id}><strong>{player.name}</strong><span>Each game’s eligible players</span><label><span className="mobile-field-label">Games umpired</span><input aria-label={`${player.name} games umpired`} min="0" max="1000" step="1" type="number" value={counts[player.id]??"0"} onChange={event=>setCounts(current=>({...current,[player.id]:event.target.value}))}/></label><strong>{money.format(amount||0)}</strong>{!rowValid&&<small>Use a whole number from 0 to 1,000</small>}</div>)}</div>
    <div className="umpiring-summary"><strong>{active.length} {active.length===1?"player":"players"} · {money.format(totalCredit)} total credit</strong><span>{eligibleAppearances?"Only players with more than 0 games umpired will be saved.":"Add a completed game with eligible lineup players before recording team-funded credits."}</span></div>
    <div className="modal-actions">{onDelete&&<button type="button" className="danger-action" onClick={onDelete}>Delete credit</button>}<span className={valid?"ready":"warning"}>{valid?`${active.length} ${active.length===1?"credit":"credits"} ready`:eligibleAppearances?"Enter a rate and at least one valid game count":"No eligible completed appearances"}</span><button type="button" className="ghost" onClick={onClose}>Cancel</button><button className="primary" disabled={!valid}>{credit?"Save changes":"Save umpiring credits"}</button></div>
  </form></div>;
}

function SplitFields({split,setSplit}:{split:ExpenseSplitMode|"";setSplit:(split:ExpenseSplitMode|"")=>void}) {
  return <label>How it is shared<select required value={split} onChange={e=>setSplit(e.target.value as ExpenseSplitMode|"")}><option value="" disabled>Select sharing method</option><option value="appearances">By games played</option><option value="custom">Custom players</option></select></label>;
}

function ParticipantPicker({players,selected,setSelected,title,onAddPlayer}:{players:Player[];selected:number[];setSelected:(ids:number[])=>void;title:string;onAddPlayer?:(name:string)=>number}) {
  const [newPlayerName,setNewPlayerName]=useState("");
  const addPlayer=()=>{const name=newPlayerName.trim();if(!name||!onAddPlayer)return;const id=onAddPlayer(name);setSelected([...selected,id]);setNewPlayerName("")};
  return <section className="custom-participants"><div><strong>{title}</strong><span>{selected.length} selected</span></div>{onAddPlayer&&<div className="inline-player-add"><input aria-label="New player name" value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)} placeholder="Add a player not listed"/><button type="button" className="ghost" disabled={!newPlayerName.trim()} onClick={addPlayer}>＋ Add & select</button><small>This also adds the player to the team roster for future expenses.</small></div>}<div className="player-picker compact">{players.map(p=><button type="button" key={p.id} className={selected.includes(p.id)?"picked":""} onClick={()=>setSelected(selected.includes(p.id)?selected.filter(id=>id!==p.id):[...selected,p.id])}><span className="avatar" style={{background:p.color}}>{p.initials}</span><span>{p.name}</span><i>{selected.includes(p.id)?"✓":"＋"}</i></button>)}</div></section>;
}
