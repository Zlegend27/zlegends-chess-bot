import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { signInWithProvider, sendEmailCode, verifyEmailCode, signInMethods } from "../utils/auth";
import { onSignInRequest } from "../utils/signInPrompt";

/* The one way in: Google, Discord, or an email code. Every "Log in" button
   on the site (and in Chess Tactica) opens this through openSignIn(), so
   it's mounted once next to the app (see main.jsx). Signing in with any of
   them makes an account the first time; the same email on two of them
   ends up as one account. */
const CODE_LENGTH = 6;
/* The theme's text colour (light on the dark theme, dark on Sweetheart). */
const TEXT = { color: "var(--white)" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInSheet() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("choose"); // choose | email | code
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  /* Only the ways in that are switched on; null while asking. */
  const [methods, setMethods] = useState(null);
  useEffect(() => { if (open) signInMethods().then(setMethods); }, [open]);

  useEffect(() => onSignInRequest(() => { setOpen(true); setStep("choose"); setError(null); setCode(""); }), []);
  useEffect(() => { if (open && step !== "choose") inputRef.current?.focus(); }, [open, step]);

  const close = () => { if (!busy) setOpen(false); };

  const provider = async (name) => {
    setBusy(true);
    setError(null);
    /* The page leaves for Google or Discord; if it doesn't, say so. */
    try { await signInWithProvider(name); } catch { setError("Couldn't reach the sign-in page. Try again."); }
    setBusy(false);
  };

  const send = async () => {
    const address = email.trim();
    if (!EMAIL.test(address)) { setError("That doesn't look like an email address."); return; }
    setBusy(true);
    setError(null);
    const { error: e } = await sendEmailCode(address);
    setBusy(false);
    if (e) { setError(e); return; }
    setCode("");
    setStep("code");
  };

  const verify = async (value = code) => {
    if (value.length !== CODE_LENGTH) return;
    setBusy(true);
    setError(null);
    const { error: e } = await verifyEmailCode(email.trim(), value);
    setBusy(false);
    if (e) { setError(e); return; }
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={close} closeLabel="Close sign-in" maxWidth={380} style={{ width: "min(380px, 92vw)" }}>
      <div className="boxHead">Log in</div>

      {step === "choose" && (
        <>
          <p className="m-0 text-sm" style={TEXT}>Keep your games on every device and play 1v1. New here? This makes your account.</p>
          {!methods && <p className="m-0 text-sm" style={TEXT} role="status">One moment…</p>}
          {methods?.google && <button type="button" className="btn gold" style={{ width: "100%" }} disabled={busy} onClick={() => provider("google")}>Continue with Google</button>}
          {methods?.discord && <button type="button" className="btn gold" style={{ width: "100%" }} disabled={busy} onClick={() => provider("discord")}>Continue with Discord</button>}
          {methods?.email && <button type="button" className="btn ghost" style={{ width: "100%" }} disabled={busy} onClick={() => { setError(null); setStep("email"); }}>Continue with email</button>}
        </>
      )}

      {step === "email" && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <label htmlFor="signin-email" className="m-0 text-sm" style={TEXT}>We&apos;ll email you a {CODE_LENGTH}-digit code. No password needed.</label>
          <input
            ref={inputRef} id="signin-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="modalInput"
          />
          <button type="submit" className="btn gold" style={{ width: "100%" }} disabled={busy || !email.trim()}>{busy ? "Sending…" : "Send the code"}</button>
          <button type="button" className="btn ghost" style={{ width: "100%" }} disabled={busy} onClick={() => { setError(null); setStep("choose"); }}>Back</button>
        </form>
      )}

      {step === "code" && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); verify(); }}>
          <label htmlFor="signin-code" className="m-0 text-sm" style={TEXT}>Type the code we sent to <b>{email.trim()}</b>. It can take a minute; check spam too.</label>
          <input
            ref={inputRef} id="signin-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={CODE_LENGTH}
            value={code} placeholder={"0".repeat(CODE_LENGTH)} className="modalInput"
            style={{ letterSpacing: "0.4em", textAlign: "center", fontSize: 20 }}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
              setCode(digits);
              /* A full code (typed, or filled in from the email) signs in straight away. */
              if (digits.length === CODE_LENGTH) verify(digits);
            }}
          />
          <button type="submit" className="btn gold" style={{ width: "100%" }} disabled={busy || code.length !== CODE_LENGTH}>{busy ? "Checking…" : "Log in"}</button>
          <div className="flex justify-between gap-2">
            <button type="button" className="btn ghost" disabled={busy} onClick={() => { setError(null); setStep("email"); }}>Change email</button>
            <button type="button" className="btn ghost" disabled={busy} onClick={send}>Send a new code</button>
          </div>
        </form>
      )}

      <p className="m-0 text-xs" style={{ color: "var(--dim)" }}>
        By logging in you agree to the <a href="/terms" target="_blank" rel="noopener">Terms</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
      </p>
      {error && <p className="m-0 text-sm" role="alert" style={{ color: "var(--magenta)" }}>{error}</p>}
    </Modal>
  );
}
