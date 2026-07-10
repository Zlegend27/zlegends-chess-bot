import SocialLinks from "./SocialLinks";

/** Compact top bar for the Play screen -- the big hero (avatar, gradient
 *  title, tagline, stat pills) is home-page-only now (see HomePage.jsx);
 *  once you're actually playing, all that branding was just eating
 *  vertical space above the board every time. This is the "you're
 *  inside the app" header: small wordmark + a way back home + socials,
 *  nothing else.
 *
 *  Deliberately NOT position:sticky/edge-to-edge -- it lives inside
 *  .root, whose padding (calc()'d with safe-area insets for the old
 *  static hero) would fight a sticky child that wants to sit flush at
 *  the true viewport top. Normal in-flow bar, same padding rules as
 *  everything else in .root, for now. */
export default function SiteHeader({ onHome }) {
  return (
    <header className="mb-4 flex h-12 w-full max-w-4xl items-center justify-between rounded-2xl border border-[#8B2FC966] bg-[#1D1038F0] px-4">
      <button
        onClick={onHome}
        className="flex items-center gap-2.5 rounded-lg border-0 bg-transparent py-1 pr-2 text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3EE7F5]"
        aria-label="Back to home"
      >
        <span className="size-2 shrink-0 animate-pulse rounded-full bg-[#FF4B4B]" aria-hidden="true" />
        <span className="select-none font-['Arial_Black',Impact,sans-serif] text-sm font-bold italic tracking-tight text-[#F4EFFF]">
          ZLEGEND&apos;S CHESS BOT
        </span>
      </button>
      <SocialLinks />
    </header>
  );
}
