import { useEffect } from "react";
import StarField from "./StarField";
import { overlayOpen } from "../utils/routes";
import { getUiTheme } from "../utils/uiTheme";

/** A page one level below a section, like the Openings Library. It keeps the
 *  .promoBox surface so a themed box looks the way it always has, with one
 *  back arrow at the top left as the way out. */
export default function SubPage({ onBack, boxClass = "", flush, sweetheart, children }) {
  const T = getUiTheme(sweetheart);
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape" && !overlayOpen()) onBack(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  return (
    <div className="root">
      <StarField sweetheart={sweetheart} />
      <div className="relative z-10 flex w-full max-w-md flex-col">
        <button
          type="button"
          onClick={onBack}
          className={`mb-2 inline-flex h-11 items-center gap-1.5 self-start border-0 bg-transparent text-sm font-bold ${T.dimText} ${T.hoverInk} focus-visible:outline-none focus-visible:ring-2 ${T.ring}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
          Back
        </button>
        <div className={"promoBox subPageBox " + boxClass} style={flush ? { padding: 0 } : undefined}>{children}</div>
      </div>
    </div>
  );
}
