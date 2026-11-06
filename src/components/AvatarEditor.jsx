/* Your look in the 1v1 lobby: your Discord picture on a pixel body, or a
   pixel character built from a few choices. Changes save to your account
   on their own, a moment after you stop clicking. */
import { useEffect, useRef, useState } from "react";
import PlayerSprite from "./PlayerSprite";
import { SKINS, HAIR_COLORS, SHIRTS, PANTS, HAIR_STYLES, normalizeAvatar } from "../utils/avatar";
import { getUiTheme } from "../utils/uiTheme";

const SAVE_DELAY_MS = 700;

function Swatches({ label, colors, value, onPick, T }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={"text-xs " + T.dimText}>{label}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {colors.map((c, i) => (
          <button key={c} type="button" role="radio" aria-checked={value === i} aria-label={`${label} ${i + 1}`}
            onClick={() => onPick(i)}
            className={"size-7 cursor-pointer rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 " + T.ring + (value === i ? " border-white" : " border-transparent")}
            style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

export default function AvatarEditor({ avatar, discordUrl, signedIn, onSave, sweetheart }) {
  const T = getUiTheme(sweetheart);
  const [draft, setDraft] = useState(() => normalizeAvatar(avatar));
  const [status, setStatus] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (patch) => {
    const next = normalizeAvatar({ ...draft, ...patch });
    setDraft(next);
    if (!signedIn) return;
    setStatus("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => setStatus((await onSave(next)) ? "Saved to your account." : "Couldn't save. Try again in a moment."), SAVE_DELAY_MS);
  };

  const tab = (kind, label) => (
    <button type="button" onClick={() => change({ kind })} aria-pressed={draft.kind === kind}
      className={"flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 " + T.ring + " "
        + (draft.kind === kind ? "border-cyan bg-cyan/10 " + T.ink : "border-violet/30 bg-transparent " + T.dimText)}>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className={"text-xs font-bold uppercase tracking-[0.14em] " + T.dimText}>Your look in the 1v1 lobby</div>
      <div className="flex items-center gap-4">
        <PlayerSprite avatar={draft} discordUrl={discordUrl} size={72} />
        {/* The choice only exists with a Discord picture to choose. */}
        {discordUrl && (
          <div className="flex flex-1 gap-2">
            {tab("discord", "Discord picture")}
            {tab("pixel", "Build a character")}
          </div>
        )}
      </div>

      {draft.kind === "pixel" && (
        <>
          <Swatches label="Skin" colors={SKINS} value={draft.skin} onPick={(skin) => change({ skin })} T={T} />
          <div className="flex flex-col gap-1.5">
            <span className={"text-xs " + T.dimText}>Hair</span>
            <div className="flex flex-wrap gap-1.5">
              {HAIR_STYLES.map((name, i) => (
                <button key={name} type="button" onClick={() => change({ hairStyle: i })} aria-pressed={draft.hairStyle === i}
                  className={"cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 " + T.ring + " "
                    + (draft.hairStyle === i ? "border-cyan bg-cyan/10 " + T.ink : "border-violet/30 bg-transparent " + T.dimText)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
          {draft.hairStyle !== 3 && <Swatches label="Hair colour" colors={HAIR_COLORS} value={draft.hair} onPick={(hair) => change({ hair })} T={T} />}
        </>
      )}
      <Swatches label="Shirt" colors={SHIRTS} value={draft.shirt} onPick={(shirt) => change({ shirt })} T={T} />
      <Swatches label="Trousers" colors={PANTS} value={draft.pants} onPick={(pants) => change({ pants })} T={T} />

      <p className={"m-0 text-xs " + T.dimText} role="status">
        {signedIn ? (status || "Changes save on their own.") : "Log in with Discord to save your look and play 1v1."}
      </p>
    </div>
  );
}
