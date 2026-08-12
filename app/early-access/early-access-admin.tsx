"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { useEffect, useState } from "react";

type AccessRequest={email:string;name:string;team_name:string;note:string;status:"pending"|"approved"|"rejected";requested_at:string;signupUrl?:string|null;approval_expires_at?:string|null;approval_used_at?:string|null};

export default function EarlyAccessAdmin(){
  const [requests,setRequests]=useState<AccessRequest[]>([]);
  const [admin,setAdmin]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [copied,setCopied]=useState("");
  useEffect(()=>{let active=true;fetch("/api/early-access").then(async response=>{const result=await response.json() as {error?:string;isAdmin?:boolean;requests?:AccessRequest[]};if(!response.ok)throw new Error(result.error??"Could not load requests");if(active){setAdmin(Boolean(result.isAdmin));setRequests(result.requests??[])}}).catch(reason=>{if(active)setError((reason as Error).message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
  const update=async(email:string,status:AccessRequest["status"])=>{setError("");const response=await fetch("/api/early-access",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({email,status})});const result=await response.json().catch(()=>({})) as {error?:string;signupUrl?:string|null;expiresAt?:string|null};if(!response.ok){setError(result.error??"Access could not be updated");return}setRequests(current=>current.map(item=>item.email===email?{...item,status,signupUrl:result.signupUrl??null,approval_expires_at:result.expiresAt??null,approval_used_at:null}:item))};
  const approvalMessage=(item:AccessRequest)=>`Hi ${item.name},\n\nYour early access to WicketSplit has been approved for ${item.team_name}.\n\nCreate your account using this private link:\n${item.signupUrl}\n\nSign in or register with ${item.email}. The link is single-use and expires in 7 days. After signing in, WicketSplit will guide you through creating your team and first league.\n\nI’d love to hear your feedback after you try it.`;
  const copyApproval=async(item:AccessRequest)=>{if(!item.signupUrl)return;setError("");try{await navigator.clipboard.writeText(approvalMessage(item));setCopied(item.email);setTimeout(()=>setCopied(current=>current===item.email?"":current),2200)}catch{setError("The message could not be copied. Check your browser clipboard permission.")}};
  const approvalEmailUrl=(item:AccessRequest)=>`mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent("Your WicketSplit early access is approved")}&body=${encodeURIComponent(approvalMessage(item))}`;
  return <main className="early-admin-page">
    <nav className="legal-nav"><a className="public-brand" href="/"><span>W</span>WicketSplit</a><a href="/app">Open workspace →</a></nav>
    <section className="early-admin-shell"><span className="hero-kicker">CONTROLLED ROLLOUT</span><h1>Early-access requests</h1><p>Visitors request access with their email and team name—no account required. Approval creates a private seven-day signup link. Copy the message or open a ready-to-send draft in your email app.</p>
      {loading?<div className="early-admin-empty">Loading requests…</div>:!admin?<div className="early-admin-empty">This page is available only to the WicketSplit early-access administrator.</div>:requests.length?<div className="early-request-list">{requests.map(item=><article key={item.email}>
        <div><strong>{item.name}</strong><span>{item.email}</span><b>{item.team_name}</b>{item.note&&<p>{item.note}</p>}<small>Requested {new Date(item.requested_at).toLocaleDateString()}{item.approval_expires_at&&item.signupUrl?` · Link expires ${new Date(item.approval_expires_at).toLocaleDateString()}`:""}{item.approval_used_at?" · Signup link used":""}</small></div>
        <div><span className={`access-status ${item.status}`}>{item.status}</span>{item.status==="approved"&&item.signupUrl?<><a className="ghost" href={approvalEmailUrl(item)}>Open email draft</a><button className="primary copy-approval" onClick={()=>copyApproval(item)}>{copied===item.email?"✓ Message copied":"Copy approval message"}</button></>:<button className="primary" onClick={()=>update(item.email,"approved")}>{item.status==="approved"?"Create new signup link":"Approve & create link"}</button>}<button className="ghost" disabled={item.status==="rejected"} onClick={()=>update(item.email,"rejected")}>Reject</button></div>
      </article>)}</div>:<div className="early-admin-empty">No early-access requests yet.</div>}
      {error&&<div className="early-access-error">{error}</div>}
    </section>
  </main>;
}
