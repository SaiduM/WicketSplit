"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useState } from "react";

export default function DataDeletion() {
  const [status,setStatus]=useState("");
  const remove=async()=>{if(!confirm("Permanently delete every team, league, game, expense, and credit in your WicketSplit account? This cannot be undone."))return;setStatus("Deleting…");const response=await fetch("/api/account",{method:"DELETE"});if(response.ok)location.assign("/?deleted=1");else if(response.status===401)location.assign("/login?return_to=/data-deletion");else setStatus("Deletion failed. Please try again.")};
  return <main className="legal-page"><nav className="legal-nav"><a className="public-brand" href="/"><span>W</span>WicketSplit</a><a href="/">← Back home</a></nav><article className="legal-card"><span className="hero-kicker">ACCOUNT CONTROL</span><h1>Delete your WicketSplit data</h1><p className="legal-updated">Last updated: July 29, 2026</p><div className="legal-content"><section><h2>What will be deleted</h2><p>This permanently removes your WicketSplit workspace, including all teams, player details, leagues, games, expenses, credits, and calculated settlements associated with your signed-in Google or phone identity.</p></section><section><h2>What happens next</h2><p>Your WicketSplit session will be cleared immediately. This does not delete or modify your Google or phone-provider account. If you sign in again later, WicketSplit will start with a new empty workspace.</p></section><section className="deletion-warning"><h2>This cannot be undone</h2><p>Download any CSV records you need before continuing.</p><button className="delete-account-button" onClick={remove}>Permanently delete my data</button>{status&&<strong>{status}</strong>}</section></div></article><footer className="legal-footer"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/data-deletion">Data deletion</a></footer></main>;
}
