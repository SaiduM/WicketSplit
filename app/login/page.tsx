"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useEffect, useRef, useState } from "react";
import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, ConfirmationResult, RecaptchaVerifier, getAuth, signInWithPhoneNumber } from "firebase/auth";

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
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const authRef = useRef<Auth | null>(null);
  const [error, setError] = useState("");
  const [phoneEnabled, setPhoneEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);

  const safeReturnTo = () => {
    const value = new URLSearchParams(window.location.search).get("return_to") || "/app";
    return value.startsWith("/") && !value.startsWith("//") ? value : "/app";
  };

  useEffect(() => {
    const setup = () => {
      if (!window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setError("");
          const response = await fetch("/api/auth/google", {
            method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential }),
          });
          if (response.ok) window.location.assign(safeReturnTo());
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

    fetch("/api/auth/firebase-config").then(response => response.json()).then(({ enabled, config }) => {
      if (!enabled || !recaptchaRef.current) return;
      const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
      const auth = getAuth(app);
      authRef.current = auth;
      verifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, { size: "invisible" });
      setPhoneEnabled(true);
    }).catch(() => {});
    return () => {
      verifierRef.current?.clear();
      verifierRef.current = null;
    };
  }, []);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    if (!authRef.current || !verifierRef.current) return;
    setBusy(true); setError("");
    try {
      const normalized = phone.replace(/[^\d+]/g, "");
      if (!normalized.startsWith("+") || normalized.length < 9) throw new Error("Use a country code");
      setConfirmation(await signInWithPhoneNumber(authRef.current, normalized, verifierRef.current));
    } catch {
      setError("Could not send the code. Include the country code, such as +1.");
      verifierRef.current.clear();
      if (authRef.current && recaptchaRef.current) {
        verifierRef.current = new RecaptchaVerifier(authRef.current, recaptchaRef.current, { size: "invisible" });
      }
    } finally { setBusy(false); }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!confirmation) return;
    setBusy(true); setError("");
    try {
      const credential = await confirmation.confirm(code);
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/phone", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }),
      });
      if (!response.ok) throw new Error("Verification failed");
      window.location.assign(safeReturnTo());
    } catch {
      setError("That code could not be verified. Check it and try again.");
    } finally { setBusy(false); }
  }

  return <main className="google-login-page">
    <a className="public-brand" href="/"><span>W</span>WicketSplit</a>
    <section className="google-login-card">
      <span className="hero-kicker">SECURE TEAM WORKSPACE</span>
      <h1>Welcome to WicketSplit</h1>
      <p>Sign in with Google or use a one-time code sent to your phone.</p>
      <div className="google-button" ref={buttonRef} />
      {phoneEnabled && <>
        <div className="login-divider"><span>or</span></div>
        {!confirmation ? <form className="phone-login" onSubmit={sendCode}>
          <label>Mobile number<input type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+1 480 555 0123" /></label>
          <button className="primary" disabled={busy}>{busy ? "Sending…" : "Text me a code"}</button>
        </form> : <form className="phone-login" onSubmit={verifyCode}>
          <label>6-digit verification code<input inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,""))} placeholder="123456" /></label>
          <button className="primary" disabled={busy || code.length !== 6}>{busy ? "Verifying…" : "Verify & continue"}</button>
          <button className="phone-back" type="button" onClick={()=>{setConfirmation(null);setCode("");}}>Use a different number</button>
        </form>}
      </>}
      <div ref={recaptchaRef} />
      {error && <div className="login-error">{error}</div>}
      <small>WicketSplit never receives your Google password and never stores your SMS verification code. Standard messaging rates may apply.</small>
      <a className="help-link" href="https://accounts.google.com/signin/recovery">Can’t access your Google account?</a>
      <div className="login-legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/data-deletion">Data deletion</a></div>
    </section>
  </main>;
}
