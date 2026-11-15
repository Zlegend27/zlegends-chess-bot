import { useEffect, useState } from "react";
import SubPage from "./SubPage";
import { getUiTheme } from "../utils/uiTheme";
import AccountAvatar, { FaceAvatar } from "./AccountAvatar";
import AccountSection from "./AccountSection";

/* Your profile: your name, your profile picture (your account's photo or
   the avatar you built; the builder is its own page), your games, and your
   account (which logins open it; see AccountSection). The rating isn't
   shown here; it stays hidden until it's calibrated. */
export default function ProfilePage({ profile, account, rating, displayName, onSaveName, onBack, onSignIn, onSignOut, onYourGames, avatar, onSaveAvatar, onEditAvatar, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const [draft, setDraft] = useState(displayName);
  const [saved, setSaved] = useState(false);
  const dirty = draft.trim() !== displayName;
  /* Which picture is chosen, shown at once while the account catches up. */
  const [kind, setKind] = useState(avatar.kind);
  useEffect(() => setKind(avatar.kind), [avatar.kind]);
  const [picNote, setPicNote] = useState(null);

  const save = () => {
    onSaveName(draft.trim());
    setSaved(true);
  };
  const choose = async (next) => {
    if (next === kind) return;
    setKind(next);
    setPicNote(null);
    if (!(await onSaveAvatar({ ...avatar, kind: next }))) { setKind(avatar.kind); setPicNote("Couldn't save. Try again in a moment."); }
  };

  const label = "text-xs font-bold uppercase tracking-[0.14em] " + T.dimText;
  const shown = { ...avatar, kind };
  const option = (id, title, picture) => (
    <button
      type="button" role="radio" aria-checked={kind === id} onClick={() => choose(id)}
      className={"flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-2xl border bg-transparent p-3 focus-visible:outline-none focus-visible:ring-2 " + T.ring + " "
        + (kind === id ? "border-cyan bg-cyan/10" : "border-violet/30")}
    >
      {picture}
      <span className={"text-sm font-bold " + (kind === id ? T.ink : T.dimText)}>{title}</span>
    </button>
  );

  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <AccountAvatar profile={profile} avatar={shown} size={56} />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate">{profile ? profile.name : displayName || "Challenger"}</span>
          {account?.email && <span className={"truncate text-xs font-normal normal-case tracking-normal " + T.dimText}>{account.email}</span>}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="profile-name" className={label}>Your name</label>
        <div className="flex gap-2">
          <input
            id="profile-name"
            type="text"
            value={draft}
            maxLength={24}
            placeholder="Challenger"
            onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
            onKeyDown={(e) => { if (e.key === "Enter" && dirty) save(); }}
            className="modalInput min-w-0 flex-1"
          />
          <button type="button" className="btn gold" onClick={save} disabled={!dirty}>Save</button>
        </div>
        <p className={"m-0 text-xs " + T.dimText} role="status">
          {saved ? "Saved. It shows on your board and the Rush leaderboard." : "Shown on your board and the Puzzle Rush leaderboard."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className={label}>Profile picture</div>
        {profile?.avatarUrl ? (
          <div className="flex gap-3" role="radiogroup" aria-label="Profile picture">
            {option("discord", "Your photo", <img src={profile.avatarUrl} alt="" className="size-16 rounded-full object-cover" />)}
            {option("pixel", "Your avatar", <FaceAvatar avatar={avatar} size={64} />)}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <FaceAvatar avatar={avatar} size={64} />
            <p className={"m-0 text-sm " + T.dimText}>Your avatar&apos;s face is your picture across the site.</p>
          </div>
        )}
        <button type="button" className="btn ghost" style={{ width: "100%" }} onClick={onEditAvatar}>{profile ? "Edit your avatar" : "Build an avatar"}</button>
        {picNote && <p className="m-0 text-sm" role="alert" style={{ color: "var(--magenta)" }}>{picNote}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <div className={label}>Rating</div>
        <p className={"m-0 text-sm " + T.ink}>
          {rating != null ? <><b style={{ color: "var(--cyan)" }}>~{rating} Elo</b>. </> : "Unrated so far. "}
          <span className={T.dimText}>It comes from games against Rank Bot and ranked 1v1 games; nothing else changes it.</span>
        </p>
      </div>

      <button type="button" className="btn ghost" style={{ width: "100%" }} onClick={onYourGames}>Game history</button>

      <AccountSection account={account} onSignIn={onSignIn} onSignOut={onSignOut} T={T} />
    </SubPage>
  );
}
