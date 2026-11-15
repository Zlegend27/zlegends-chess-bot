/* The avatar builder: make a pixel character from a handful of choices.
   Its face becomes your profile picture; the whole character is you in
   the 1v1 lobby. Changes save to the account on their own, a moment after
   the last tap. Signed out, you can still play with it, but it isn't kept. */
import { useEffect, useRef, useState } from "react";
import SubPage from "./SubPage";
import PlayerSprite from "./PlayerSprite";
import { FaceAvatar } from "./AccountAvatar";
import { SKINS, HAIR_COLORS, SHIRTS, PANTS, HAIR_STYLES, EYES, MOUTHS, FACIAL, EXTRAS, BACKDROPS, normalizeAvatar, randomAvatar } from "../utils/avatar";
import { getUiTheme } from "../utils/uiTheme";

const SAVE_DELAY_MS = 700;

function Group({ label, children, T }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={"text-xs font-bold uppercase tracking-[0.14em] " + T.dimText}>{label}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>{children}</div>
    </div>
  );
}

function Swatches({ label, colors, value, onPick, T }) {
  return (
    <Group label={label} T={T}>
      {colors.map((c, i) => (
        <button key={c} type="button" role="radio" aria-checked={value === i} aria-label={`${label} ${i + 1}`}
          onClick={() => onPick(i)}
          className={"size-9 cursor-pointer rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 " + T.ring + (value === i ? " border-white" : " border-transparent")}
          style={{ background: c, boxShadow: value === i ? "0 0 0 2px var(--violet)" : "none" }} />
      ))}
    </Group>
  );
}

/* Each choice shows the face with that one thing changed, so the picture is the label. */
function Faces({ label, names, field, draft, onPick, T }) {
  return (
    <Group label={label} T={T}>
      {names.map((name, i) => (
        <button key={name} type="button" role="radio" aria-checked={draft[field] === i} aria-label={`${label}: ${name}`} title={name}
          onClick={() => onPick(i)}
          className={"flex cursor-pointer flex-col items-center gap-1 rounded-xl border bg-transparent p-1.5 focus-visible:outline-none focus-visible:ring-2 " + T.ring + " "
            + (draft[field] === i ? "border-cyan bg-cyan/10" : "border-transparent")}>
          <FaceAvatar avatar={{ ...draft, [field]: i }} size={44} />
          <span className={"text-[10px] font-bold " + (draft[field] === i ? T.ink : T.dimText)}>{name}</span>
        </button>
      ))}
    </Group>
  );
}

export default function AvatarBuilderPage({ avatar, signedIn, onSave, onBack, onSignIn, sweetheart }) {
  const T = getUiTheme(sweetheart);
  /* Building a character means using it: the photo choice is on the profile. */
  const [draft, setDraft] = useState(() => ({ ...normalizeAvatar(avatar), kind: "pixel" }));
  const [status, setStatus] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = (next) => {
    setDraft(next);
    if (!signedIn) return;
    setStatus("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => setStatus((await onSave(next)) ? "Saved to your account." : "Couldn't save. Try again in a moment."), SAVE_DELAY_MS);
  };
  const change = (patch) => apply(normalizeAvatar({ ...draft, ...patch, kind: "pixel" }));

  return (
    <SubPage onBack={onBack} sweetheart={sweetheart}>
      <h1 className="boxHead m-0">Your avatar</h1>

      <div className="flex items-center justify-center gap-6">
        <FaceAvatar avatar={draft} size={104} />
        <PlayerSprite avatar={draft} size={104} />
      </div>
      <p className={"m-0 text-center text-xs " + T.dimText}>The face is your profile picture. The whole character is you in the 1v1 lobby.</p>
      <button type="button" className="btn ghost" style={{ width: "100%" }} onClick={() => apply(randomAvatar())}>Surprise me</button>

      <Swatches label="Skin" colors={SKINS} value={draft.skin} onPick={(skin) => change({ skin })} T={T} />
      <Faces label="Hair" names={HAIR_STYLES} field="hairStyle" draft={draft} onPick={(hairStyle) => change({ hairStyle })} T={T} />
      {draft.hairStyle !== 3 && <Swatches label="Hair colour" colors={HAIR_COLORS} value={draft.hair} onPick={(hair) => change({ hair })} T={T} />}
      <Faces label="Eyes" names={EYES} field="eyes" draft={draft} onPick={(eyes) => change({ eyes })} T={T} />
      <Faces label="Mouth" names={MOUTHS} field="mouth" draft={draft} onPick={(mouth) => change({ mouth })} T={T} />
      <Faces label="Facial hair" names={FACIAL} field="facial" draft={draft} onPick={(facial) => change({ facial })} T={T} />
      <Faces label="Extras" names={EXTRAS} field="extra" draft={draft} onPick={(extra) => change({ extra })} T={T} />
      <Swatches label="Shirt" colors={SHIRTS} value={draft.shirt} onPick={(shirt) => change({ shirt })} T={T} />
      <Swatches label="Trousers" colors={PANTS} value={draft.pants} onPick={(pants) => change({ pants })} T={T} />
      <Swatches label="Picture background" colors={BACKDROPS} value={draft.bg} onPick={(bg) => change({ bg })} T={T} />

      {signedIn ? (
        <p className={"m-0 text-xs " + T.dimText} role="status">{status || "Changes save on their own."}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className={"m-0 text-sm " + T.ink}>Log in to keep this avatar and use it as your picture.</p>
          <button type="button" className="btn gold" style={{ width: "100%" }} onClick={onSignIn}>Log in</button>
        </div>
      )}
    </SubPage>
  );
}
