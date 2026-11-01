import { PANEL_RAYS, PANEL_CHORDS, HEART_RAYS, HEART_CHORDS } from "../utils/rushShatter";

/* Shared background for the two Rush screens that are explicitly her
   corner of the app end to end (the heartbreak screen and the duration
   picker, see .rushThemeBox in App.css) -- a full shattered-glass field
   radiating from a corner "impact point," a heart clipped out of the red
   gradient at that same corner, and her sprite balancing it in the
   opposite corner. Real branching crack paths (with a few large
   low-opacity facet polygons for "different shards catch light
   differently") rather than a repeating CSS pattern, which read as even/
   mechanical instead of an actual fracture. Static markup, so this is a
   plain function rather than needing any props. */
export default function RushThemeArt() {
  return (
    <>
      <svg className="rushThemeShatter" viewBox="0 0 400 460" preserveAspectRatio="none" aria-hidden="true">
        {PANEL_CHORDS.map((d, i) => <path key={"c" + i} className="crack" d={d} />)}
        {PANEL_RAYS.map((d, i) => <path key={"r" + i} className="crack main" d={d} />)}
      </svg>
      <div className="rushThemeHeart" aria-hidden="true">
        <svg viewBox="0 0 150 150" preserveAspectRatio="none">
          {HEART_CHORDS.map((d, i) => <path key={"c" + i} className="crack" d={d} />)}
          {HEART_RAYS.map((d, i) => <path key={"r" + i} className="crack main" d={d} />)}
        </svg>
      </div>
      <img src="/sweetheart-sprite.webp" alt="" className="rushThemeSprite" />
    </>
  );
}
