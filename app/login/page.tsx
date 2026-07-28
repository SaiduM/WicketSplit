"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = "308356327840-71gu5gabl7tt14st4pvo43t0ksv4n2m3.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement, options: Record<string, unknown>): void;
    } } };
  }
}

export default function Login() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const returnTo = new URLSearchParams(window.location.search).get("return_to") || "/app";
    const setup = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError("");
          const response = await fetch("/api/auth/google", {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential }),
          });
          if (response.ok) window.location.assign(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/app");
          else setError("Google sign-in could not be completed. Please try again.");
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard", theme: "outline", size: "large", shape: "rectangular", text: "continue_with", width: 340,
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) { setup(); return; }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true; script.defer = true; script.onload = setup;
    script.onerror = () => setError("Google sign-in is temporarily unavailable.");
    document.head.appendChild(script);
  }, []);

  return <main className="google-login-page">
    <a className="public-brand" href="/"><span>W</span>WicketSplit</a>
    <section className="google-login-card">
      <span className="hero-kicker">SECURE TEAM WORKSPACE</span>
      <h1>Welcome to WicketSplit</h1>
      <p>Continue with your Google account to create teams, manage leagues, and keep every expense private.</p>
      <div className="google-button" ref={buttonRef} />
      {error && <div className="login-error">{error}</div>}
      <small>We only receive your name, verified email, and profile image. WicketSplit never receives your Google password.</small>
      <a className="help-link" href="https://accounts.google.com/signin/recovery">Can’t access your Google account?</a>
    </section>
  </main>;
}
