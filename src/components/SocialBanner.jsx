import SocialLinks from "./SocialLinks";

/** The "live" dot + ZLEGEND27 wordmark + YouTube/TikTok/Discord links --
 *  used to sit only in the home hero's .eyebrow row. Now shared and
 *  rendered at the bottom of every page (home, Play, Leaderboard, ...)
 *  instead, so it's one component rather than copy-pasted markup. */
export default function SocialBanner() {
  return (
    <div className="eyebrow" style={{ marginTop: 28, marginBottom: 4 }}>
      <span className="live" aria-hidden="true" />
      Zlegend27
      <SocialLinks />
    </div>
  );
}
