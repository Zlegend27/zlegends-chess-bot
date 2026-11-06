/* Position key for the bundled opening book (openingBook-lichess.json).
   Shared by the generator (scripts/import-opening-book.mjs) and the app so
   both hash a position the same way. Keyed by position rather than by the
   move list so transpositions (1.d4 Nf6 2.c4 e6 vs 1.c4 Nf6 2.d4 e6) share
   one entry.
   Only the first four FEN fields count (pieces, side, castling, en
   passant): the move counters don't change what theory says. The text is
   then hashed (cyrb53, 53 bits) to keep the JSON small; with ~10^4 book
   positions an accidental match is around a 1-in-10^11 chance per lookup,
   and the engine worker still refuses a book move that isn't legal. */
export function bookKey(fen) {
  const epd = fen.split(" ").slice(0, 4).join(" ");
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < epd.length; i++) {
    const ch = epd.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
