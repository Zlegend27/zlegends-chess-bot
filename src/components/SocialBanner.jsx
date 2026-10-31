import SocialLinks from "./SocialLinks";

/** The "live" dot + ZLEGEND27 wordmark + YouTube/TikTok/Discord links --
 *  rendered at the bottom of Home. Every other page reaches the same links
 *  through the profile menu. */
export default function SocialBanner() {
  return (
    <div className="eyebrow" style={{ marginTop: 28, marginBottom: 4 }}>
      <span className="live" aria-hidden="true" />
      Zlegend27
      <SocialLinks />
    </div>
  );
}
