import { useEffect, useState } from "react";
import { postHandoffCode, isIosHomeScreenApp } from "../utils/authHandoff";

/* What the sign-in page shows instead of the app. See utils/authHandoff.js.

   iOS doesn't always open it in a separate tab: it can land inside the
   home-screen app itself, where there is no tab to close and no reload
   button, which left players stuck until they swiped the app away. So
   inside the app it goes straight back to the game (the app then collects
   the code from the mailbox as usual), and everywhere else a button does
   the same. */
const backToGame = () => {
  /* A tab that the app opened can close itself; if that's not allowed,
     open the game here instead. */
  window.close();
  setTimeout(() => window.location.replace("/"), 300);
};

export default function HandoffLanding({ nonce, code }) {
  const [status, setStatus] = useState(code ? "sending" : "failed");

  useEffect(() => {
    if (!code) return;
    postHandoffCode(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, nonce, code)
      .then((ok) => setStatus(ok ? "done" : "failed"))
      .catch(() => setStatus("failed"));
  }, [nonce, code]);

  /* Inside the home-screen app: just go back to the game. */
  useEffect(() => {
    if (status === "done" && isIosHomeScreenApp()) window.location.replace("/");
  }, [status]);

  return (
    <div className="errBox">
      {status === "sending" && <h1>Signing you in…</h1>}
      {status === "done" && (
        <>
          <h1>You're signed in</h1>
          <p>Head back to the game. If this stays open, tap Done or close it.</p>
          <button type="button" className="btn" onClick={backToGame}>Back to the game</button>
        </>
      )}
      {status === "failed" && (
        <>
          <h1>Sign-in didn't finish</h1>
          <p>Go back to the game and tap Login to try again.</p>
          <button type="button" className="btn" onClick={backToGame}>Back to the game</button>
        </>
      )}
    </div>
  );
}
