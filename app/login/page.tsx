"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { FormEvent, useEffect, useRef, useState } from "react";
import { FirebaseApp, FirebaseError, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  createUserWithEmailAndPassword,
  getAuth,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const GOOGLE_CLIENT_ID = "308356327840-71gu5gabl7tt14st4pvo43t0ksv4n2m3.apps.googleusercontent.com";
type EmailMode = "signin" | "register" | "reset";

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
  const authRef = useRef<Auth | null>(null);
  const [firebaseEnabled, setFirebaseEnabled] = useState(false);
  const [mode, setMode] = useState<EmailMode>(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("reset") ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const safeReturnTo = () => {
    const value = new URLSearchParams(window.location.search).get("return_to") || "/app";
    return value.startsWith("/") && !value.startsWith("//") ? value : "/app";
  };

  useEffect(() => {
    const setupGoogle = () => {
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
    if (existing) setupGoogle();
    else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true; script.defer = true; script.onload = setupGoogle;
      script.onerror = () => setError("Google sign-in is temporarily unavailable.");
      document.head.appendChild(script);
    }
    fetch("/api/auth/firebase-config").then(response => response.json()).then(({ enabled, config }) => {
      if (!enabled) return;
      const app: FirebaseApp = getApps().length ? getApp() : initializeApp(config);
      authRef.current = getAuth(app);
      setFirebaseEnabled(true);
    }).catch(() => {});
  }, []);

  function switchMode(next: EmailMode) {
    setMode(next); setError(""); setNotice(""); setPassword(""); setConfirmPassword("");
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (!authRef.current) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === "reset") {
        await sendPasswordResetEmail(authRef.current, normalizedEmail);
        setNotice("If an account exists for this email, Firebase has sent password-reset instructions.");
        return;
      }
      if (mode === "register") {
        if (password.length < 8) throw new FirebaseError("auth/weak-password", "Use at least 8 characters");
        if (password !== confirmPassword) throw new FirebaseError("auth/password-mismatch", "Passwords do not match");
        const credential = await createUserWithEmailAndPassword(authRef.current, normalizedEmail, password);
        await sendEmailVerification(credential.user);
        await signOut(authRef.current);
        setNotice("Account created. Open the verification email from Firebase, then return here to sign in.");
        setMode("signin"); setPassword(""); setConfirmPassword("");
        return;
      }
      const credential = await signInWithEmailAndPassword(authRef.current, normalizedEmail, password);
      await credential.user.reload();
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        await signOut(authRef.current);
        setNotice("Verify your email first. Firebase has sent a new verification message.");
        return;
      }
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch("/api/auth/email", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }),
      });
      if (!response.ok) throw new Error("Session could not be created");
      window.location.assign(safeReturnTo());
    } catch (reason) {
      const code = reason instanceof FirebaseError ? reason.code : "";
      const messages: Record<string, string> = {
        "auth/invalid-email": "Enter a valid email address.",
        "auth/weak-password": "Use a password with at least 8 characters.",
        "auth/password-mismatch": "The passwords do not match.",
        "auth/email-already-in-use": "An account already exists. Sign in or reset the password.",
        "auth/operation-not-allowed": "Email/password sign-in must be enabled in Firebase.",
        "auth/too-many-requests": "Too many attempts were made. Please wait and try again.",
      };
      setError(messages[code] ?? (mode === "signin" ? "Email or password is incorrect." : "This request could not be completed. Please try again."));
    } finally { setBusy(false); }
  }

  return <main className="google-login-page">
    <a className="public-brand" href="/"><span>W</span>WicketSplit</a>
    <section className="google-login-card">
      <span className="hero-kicker">SECURE TEAM WORKSPACE</span>
      <h1>Welcome to WicketSplit</h1>
      <p>Continue with Google, or use any verified email address.</p>
      <div className="google-button" ref={buttonRef} />
      {firebaseEnabled && <>
        <div className="login-divider"><span>or</span></div>
        <div className="email-mode-tabs" role="tablist" aria-label="Email account options">
          <button type="button" className={mode==="signin"?"active":""} onClick={()=>switchMode("signin")}>Sign in</button>
          <button type="button" className={mode==="register"?"active":""} onClick={()=>switchMode("register")}>Create account</button>
        </div>
        <form className="email-login" onSubmit={submitEmail}>
          <label>Email address<input type="email" inputMode="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@example.com" /></label>
          {mode !== "reset" && <label>Password<input type="password" autoComplete={mode==="register"?"new-password":"current-password"} required minLength={8} value={password} onChange={event=>setPassword(event.target.value)} placeholder="At least 8 characters" /></label>}
          {mode === "register" && <label>Confirm password<input type="password" autoComplete="new-password" required minLength={8} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} placeholder="Enter it again" /></label>}
          <button className="primary" disabled={busy}>{busy ? "Please wait…" : mode==="register" ? "Create free account" : mode==="reset" ? "Send reset email" : "Sign in with email"}</button>
          {mode === "signin" && <button className="email-help" type="button" onClick={()=>switchMode("reset")}>Forgot password?</button>}
          {mode === "reset" && <button className="email-help" type="button" onClick={()=>switchMode("signin")}>← Back to sign in</button>}
        </form>
      </>}
      {error && <div className="login-error">{error}</div>}
      {notice && <div className="login-notice">{notice}</div>}
      <small>Firebase securely manages passwords and verification. WicketSplit never receives or stores your password.</small>
      <div className="login-legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/data-deletion">Data deletion</a></div>
    </section>
  </main>;
}
