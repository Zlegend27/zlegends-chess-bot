/* Inline-SVG icon for the label prefix that used to be a raw emoji (⚡)
   -- same fill="currentColor" convention as HomePage's ICONS, kept in its
   own file now that App.jsx is split up. */
export default function BoltIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 2v11h3v9l7-12h-4l4-8z" />
    </svg>
  );
}
