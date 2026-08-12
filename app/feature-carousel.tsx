"use client";

import { useEffect, useRef, useState } from "react";

const features = [
  { number:"01", kicker:"PLAYING XI / XII", title:"Add who played—once.", copy:"Create the game, select the lineup, and optionally exclude a player from that game’s fair split without removing their appearance.", accent:"lineup", stat:"12 selected", detail:"11 sharing" },
  { number:"02", kicker:"FAIR TEAM COSTS", title:"Every game carries an equal share.", copy:"League fees, Fruits / Water, IV, and umpiring funding are divided by completed game, then among the eligible players in that game.", accent:"split", stat:"$120.58 / game", detail:"Transparent math" },
  { number:"03", kicker:"EXPENSES + CREDITS", title:"One ledger for the whole league.", copy:"Record who paid, use custom groups when needed, and credit players for outside umpiring without forcing the amount below what they owe.", accent:"ledger", stat:"+$50.00 credit", detail:"Automatically reconciled" },
  { number:"04", kicker:"PERSONAL SETTLEMENT", title:"Everyone understands their number.", copy:"Players open one private team link and PIN to see their games, fair share, expenses paid, credits, and remaining balance—no account required.", accent:"balance", stat:"$74.60 to pay", detail:"Full breakdown" },
  { number:"05", kicker:"FASTER LINEUPS", title:"Import instead of retyping.", copy:"Sync completed CricClubs matches or review up to ten lineup screenshots locally on your device. Missing roster players can be added automatically.", accent:"import", stat:"3 games ready", detail:"Review before saving" },
];

export default function FeatureCarousel(){
  const [active,setActive]=useState(0);const [paused,setPaused]=useState(false);const touch=useRef<number|null>(null);
  const go=(index:number)=>setActive((index+features.length)%features.length);
  useEffect(()=>{if(paused)return;const timer=setInterval(()=>go(active+1),6500);return()=>clearInterval(timer)},[active,paused]);
  return <section className="feature-carousel-section" id="features" aria-roledescription="carousel" aria-label="WicketSplit features" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false)}} onTouchStart={event=>{touch.current=event.touches[0]?.clientX??null}} onTouchEnd={event=>{if(touch.current===null)return;const delta=(event.changedTouches[0]?.clientX??touch.current)-touch.current;if(Math.abs(delta)>45)go(active+(delta<0?1:-1));touch.current=null}} onKeyDown={event=>{if(event.key==="ArrowRight")go(active+1);if(event.key==="ArrowLeft")go(active-1)}} tabIndex={0}>
    <div className="carousel-heading"><div><span className="hero-kicker">BUILT AROUND THE LEAGUE</span><h2>One focused workflow.<br/>Five jobs handled.</h2></div><p>Swipe or use the arrows to see how WicketSplit takes your team from lineup to settlement.</p></div>
    <div className="carousel-window"><div className="carousel-track" style={{transform:`translateX(-${active*100}%)`}}>{features.map((feature,index)=><article className={`feature-slide ${feature.accent}`} key={feature.number} aria-hidden={active!==index}><div className="slide-copy"><span>{feature.number} / 05</span><small>{feature.kicker}</small><h3>{feature.title}</h3><p>{feature.copy}</p></div><div className="slide-visual"><div className="slide-orbit"><i/><i/><i/></div><small>{feature.detail}</small><strong>{feature.stat}</strong><span>{feature.accent==="lineup"?"XI":feature.accent==="split"?"÷":feature.accent==="ledger"?"↗":feature.accent==="balance"?"⇄":"＋"}</span></div></article>)}</div></div>
    <div className="carousel-controls"><button type="button" onClick={()=>go(active-1)} aria-label="Previous feature">←</button><div>{features.map((feature,index)=><button type="button" key={feature.number} className={active===index?"active":""} onClick={()=>go(index)} aria-label={`Show feature ${index+1}`} aria-current={active===index?"true":undefined}/>)}</div><span>{String(active+1).padStart(2,"0")} / 05</span><button type="button" onClick={()=>go(active+1)} aria-label="Next feature">→</button></div>
  </section>;
}
