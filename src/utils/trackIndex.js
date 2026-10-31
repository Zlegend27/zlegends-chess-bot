/* Shared by manual next/prev and the "ended" auto-advance -- shuffle picks
   any other track at random, otherwise steps sequentially with wraparound. */
export function pickTrackIndex(current, len, delta, shuffle) {
  if (len <= 1) return 0;
  if (shuffle) {
    let next;
    do { next = Math.floor(Math.random() * len); } while (next === current);
    return next;
  }
  return ((current + delta) % len + len) % len;
}
