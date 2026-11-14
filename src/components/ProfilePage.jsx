import { useState } from "react";
import SubPage from "./SubPage";
import PixelAvatar, { ZPAL, ZPIX } from "./PixelAvatar";
import { getUiTheme } from "../utils/uiTheme";
import AvatarEditor from "./AvatarEditor";
import AccountAvatar from "./AccountAvatar";
import AccountSection from "./AccountSection";

/* Your profile: who you are on this site, your name and look, your games,
   and your account (which logins open it; see AccountSection). The rating
   isn't shown here; it stays hidden until it's calibrated. */
export default function ProfilePage({ profile, account, displayName, onSaveName, onBack, onSignIn, onSignOut, onYourGames, avatar, onSaveAvatar, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const [draft, setDraft] = useState(displayName);
  const [saved, setSaved] = useState(false);
  const dirty = draft.trim() !== displayName;

  const save = () => {
    onSaveName(draft.trim());
    setSaved(true);
  };

  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <div className="boxHead" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {profile ? <AccountAvatar profile={profile} size={56} /> : <PixelAvatar rows={ZPIX} pal={ZPAL} size={44} />}
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate">{profile ? profile.name : displayName}</span>
          {account?.email && <span className={"truncate text-xs font-normal normal-case tracking-normal " + T.dimText}>{account.email}</span>}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="profile-name" className={"text-xs font-bold uppercase tracking-[0.14em] " + T.dimText}>Your name</label>
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

      <AvatarEditor avatar={avatar} discordUrl={profile?.avatarUrl} signedIn={!!profile} onSave={onSaveAvatar} sweetheart={sweetheart} />

      <div className="flex flex-col gap-2">
        <button type="button" className="btn ghost" style={{ width: "100%" }} onClick={onYourGames}>Your games</button>
      </div>

      <AccountSection account={account} onSignIn={onSignIn} onSignOut={onSignOut} T={T} />
    </SubPage>
  );
}
