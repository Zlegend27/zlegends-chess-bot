import { useEffect, useState } from "react";
import { postHandoffCode } from "../utils/authHandoff";

/* What the sign-in tab shows instead of the app. See utils/authHandoff.js. */
export default function HandoffLanding({ nonce, code }) {
  const [status, setStatus] = useState(code ? "sending" : "failed");

  useEffect(() => {
    if (!code) return;
    postHandoffCode(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, nonce, code)
      .then((ok) => setStatus(ok ? "done" : "failed"))
      .catch(() => setStatus("failed"));
  }, [nonce, code]);

  return (
    <div className="errBox">
      {status === "sending" && <h1>Signing you in…</h1>}
      {status === "done" && (
        <>
          <h1>You're signed in</h1>
          <p>Close this tab to go back to the app.</p>
        </>
      )}
      {status === "failed" && (
        <>
          <h1>Sign-in didn't finish</h1>
          <p>Close this tab and tap Login in the app to try again.</p>
        </>
      )}
    </div>
  );
}
