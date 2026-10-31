/* Shared chrome for every dismissable promoOv/promoBox modal in this
   file (Music, Puzzles, Settings, Rush, ...) -- backdrop-click and the
   close-X both call the same onClose, matching what every one of these
   blocks already did individually before this existed. Deliberately
   NOT used for the piece-promotion/color-pick pickers (mid-move
   required choices with no close X or backdrop-dismiss) or the Blind
   Chess loading skeleton (a status display, not a real dialog) -- both
   keep their own bespoke .promoOv/.promoBox markup since they're a
   genuinely different shape, not an oversight.

   role="dialog"/aria-modal/aria-label, the Tab focus trap, and the body
   scroll-lock are all still handled generically by the DOM-querying
   effect in ZlegendsBot (keyed off whichever .promoBox is actually
   mounted) rather than duplicated here -- this component only owns the
   JSX shape, not that behavior, so this stays a plain function rather
   than needing access to any of that state. */
export default function Modal({ open, onClose, closeLabel, zIndex = 50, minWidth = 260, maxWidth = 360, className, style, children }) {
  if (!open) return null;
  return (
    <div className="promoOv" style={{ position: "fixed", inset: 0, zIndex }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"promoBox" + (className ? " " + className : "")} style={{ flexDirection: "column", gap: 12, minWidth, maxWidth, padding: "20px 24px", ...style }}>
        <button className="modalCloseX" onClick={onClose} aria-label={closeLabel} title="Close">✕</button>
        {children}
      </div>
    </div>
  );
}
