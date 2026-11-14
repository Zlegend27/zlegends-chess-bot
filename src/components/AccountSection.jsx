import { useEffect, useState } from "react";
import { PROVIDERS, linkProvider, unlinkProvider, takeLinkResult } from "../utils/auth";

/* The Account part of the profile page: which logins open this account,
   connecting another one, and logging out. One person, one account: logins
   that share an email are joined by themselves; this is where one with a
   different email gets connected. */
const SUPPORT = "support@zlegend2700.com";

export default function AccountSection({ account, onSignIn, onSignOut, T }) {
  const [busy, setBusy] = useState(null); // provider id being connected or removed
  const [note, setNote] = useState(null); // { ok, text }
  const [removing, setRemoving] = useState(null); // provider id awaiting a second tap

  /* Back from connecting a login: say how it went, once. */
  useEffect(() => {
    const result = takeLinkResult(account);
    if (result) setNote(result);
  }, [account]);

  const label = "text-xs font-bold uppercase tracking-[0.14em] " + T.dimText;

  if (!account) {
    return (
      <div className="flex flex-col gap-2">
        <div className={label}>Account</div>
        <p className={"m-0 text-sm " + T.ink}>Log in to keep your games on every device and play 1v1. It takes a few seconds with Google, Discord or your email.</p>
        <button type="button" className="btn gold" style={{ width: "100%" }} onClick={onSignIn}>Log in</button>
      </div>
    );
  }

  const connect = async (id) => {
    setBusy(id);
    setNote(null);
    const { error } = await linkProvider(id);
    /* On success the page leaves for the provider. */
    if (error) { setNote({ ok: false, text: error }); setBusy(null); }
  };
  const remove = async (id) => {
    if (removing !== id) { setRemoving(id); return; }
    setBusy(id);
    setNote(null);
    const { error } = await unlinkProvider(id);
    setBusy(null);
    setRemoving(null);
    setNote(error ? { ok: false, text: error } : { ok: true, text: "Removed. You can connect it again any time." });
  };

  const linkedCount = account.linked.length;
  const row = "flex min-h-11 items-center justify-between gap-3";
  const small = { minHeight: 32, padding: "4px 12px", fontSize: 12 };

  return (
    <div className="flex flex-col gap-2">
      <div className={label}>Ways to log in</div>
      <p className={"m-0 text-xs " + T.dimText}>All of these open this same account, with the same games and name.</p>

      <div className="flex flex-col">
        {PROVIDERS.map((p) => {
          const linked = account.linked.includes(p.id);
          return (
            <div key={p.id} className={row}>
              <span className={"text-sm font-bold " + T.ink}>{p.label}</span>
              {linked ? (
                <span className="flex items-center gap-2">
                  <span className={"text-xs " + T.dimText}>Connected</span>
                  {linkedCount > 1 && (
                    <button type="button" className="btn ghost" style={small} disabled={!!busy} onClick={() => remove(p.id)}>
                      {busy === p.id ? "Removing…" : removing === p.id ? "Tap again to remove" : "Remove"}
                    </button>
                  )}
                </span>
              ) : (
                <button type="button" className="btn ghost" style={small} disabled={!!busy} onClick={() => connect(p.id)}>
                  {busy === p.id ? "Opening…" : "Connect"}
                </button>
              )}
            </div>
          );
        })}
        {account.email && (
          <div className={row}>
            <span className={"text-sm font-bold " + T.ink}>Email code</span>
            <span className={"min-w-0 truncate text-xs " + T.dimText}>{account.email}</span>
          </div>
        )}
      </div>

      {note && <p className="m-0 text-sm" role="status" style={{ color: note.ok ? "var(--cyan)" : "var(--magenta)" }}>{note.text}</p>}

      <button type="button" className="btn ghost" style={{ width: "100%" }} onClick={onSignOut}>Log out</button>
      <p className={"m-0 text-xs " + T.dimText}>
        To delete your account and everything saved with it, email <a href={`mailto:${SUPPORT}?subject=Delete%20my%20account`} style={{ color: "var(--cyan)" }}>{SUPPORT}</a>.
      </p>
    </div>
  );
}
