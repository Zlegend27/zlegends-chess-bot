/* Memories: famous moments of chess history, played with ghost pieces.

   Story (game-plan §9): as the pieces and the player grow closer, they
   remember the great games, and in each one they learn something about the
   soul of chess. A memory wakes when a world's boss is beaten, and stays in
   the Memories page to replay. It can't be failed: a wrong move gets a
   gentle "not that", and a hint after two.

   Each: the position, whose moves the player plays, then the line in SAN,
   the player's moves and the ghosts' answers in turn (checked against the
   game's own engine in memories.test.js). All public-record games. */
import { loadSetting, saveSetting } from "../utils/storage.js";

export const MEMORIES = [
  {
    id: "opera",
    world: 0,
    title: "The Opera Game",
    where: "Paris, 1858",
    who: "Paul Morphy, in a box at the opera, against the Duke of Brunswick and Count Isouard.",
    play: "Play Morphy's moves, as White.",
    fen: "3rkb1r/p2nqppp/5n2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR3R w k - 3 13",
    moves: ["Rxd7", "Rxd7", "Rd1", "Qe6", "Bxd7+", "Nxd7", "Qb8+", "Nxb8", "Rd8#"],
    lesson: "Morphy gave up a rook, a bishop and his queen, and the last rook still won. The pieces learn what a sacrifice is: giving something up so the others can get through.",
    motto: "give something up, and the others get through",
  },
  {
    id: "reti",
    world: 1,
    title: "The King Who Walked Two Roads",
    where: "Richard Réti's study, 1921",
    who: "A king that looks hopelessly far from everything, and isn't.",
    play: "Play the white king's walk, as White.",
    fen: "7K/8/k1P5/7p/8/8/8/8 w - - 0 1",
    moves: ["Kg7", "h4", "Kf6", "h3", "Ke7", "h2", "c7", "Kb7", "Kd7"],
    lesson: "Every step chased the pawn and helped his own at the same time, so he was never too late. The pieces learn patience: the right road can lead two places at once.",
    motto: "the right road leads two places at once",
  },
  {
    id: "immortal",
    world: 2,
    title: "The Immortal Game",
    where: "London, 1851",
    who: "Adolf Anderssen against Lionel Kieseritzky, in an afternoon game.",
    play: "Play Anderssen's moves, as White.",
    fen: "rnb1k1nr/p2p1ppp/5q2/1pb2N1P/4PBP1/2NP1Q2/PPP5/R4KR1 w kq - 3 17",
    moves: ["Nd5", "Qxb2", "Bd6", "Bxg1", "e5", "Qxa1+", "Ke2", "Na6", "Nxg7+", "Kd8", "Qf6+", "Nxf6", "Be7#"],
    lesson: "Both rooks, a bishop and the queen, all given, and three small pieces finished it. The pieces learn courage: it isn't how much you keep, it's what you do with what's left.",
    motto: "it's not how much you keep, it's what you do with what's left",
  },
  {
    id: "century",
    world: 3,
    title: "The Game of the Century",
    where: "New York, 1956",
    who: "Thirteen-year-old Bobby Fischer, as Black, against Donald Byrne.",
    play: "Play Fischer's moves, as Black.",
    fen: "r3r1k1/pp3pbp/1qp3p1/2B5/2BP2b1/Q1n2N2/P4PPP/3R1K1R b - - 3 17",
    moves: ["Be6", "Bxb6", "Bxc4+", "Kg1", "Ne2+", "Kf1", "Nxd4+", "Kg1", "Ne2+", "Kf1", "Nc3+", "Kg1", "axb6"],
    lesson: "A boy gave his queen to a master and took everything back, piece by piece. The pieces learn the soul of chess: not the pieces, but the trust between the one who plays and the ones who move.",
    motto: "the trust between the one who plays and the ones who move",
  },
  /* Memories a piece brings back itself, once its bond with you is strong
     (bond level 3): one for each kind of piece. */
  {
    id: "saavedra", kind: "pawn", level: 3,
    title: "The Pawn Who Chose Less",
    where: "The Saavedra position, 1895",
    who: "A lone pawn racing a rook to the last rank.",
    play: "Play the pawn's side, as White.",
    fen: "8/8/1KP5/3r4/8/8/8/k7 w - - 0 1",
    moves: ["c7", "Rd6+", "Kb5", "Rd5+", "Kb4", "Rd4+", "Kb3", "Rd3+", "Kc2", "Rd4", "c8=R", "Ra4", "Kb3"],
    lesson: "Becoming a queen would only have drawn: Black had a stalemate trap waiting. The pawn became a rook, and won. The pawns learn that the humble choice can be the right one.",
  },
  {
    id: "philidor", kind: "knight", level: 3,
    title: "Philidor's Legacy",
    where: "A pattern known since 1749",
    who: "A king hiding behind his own pieces, and a knight that knows the way in.",
    play: "Play the knight's mate, as White.",
    fen: "r6k/6pp/8/6N1/2Q5/8/8/6K1 w - - 0 1",
    moves: ["Nf7+", "Kg8", "Nh6+", "Kh8", "Qg8+", "Rxg8", "Nf7#"],
    lesson: "The queen gave herself so the king's own rook would wall him in, and the knight came round the corner. The knights learn that the way in is never straight.",
  },
  {
    id: "retitartakower", kind: "bishop", level: 3,
    title: "Réti's Twin Bishops",
    where: "Vienna, 1910",
    who: "Richard Réti against Savielly Tartakower, eleven moves in.",
    play: "Play Réti's moves, as White.",
    fen: "rnb1kb1r/pp3ppp/2p5/4q3/4n3/3Q4/PPPB1PPP/2KR1BNR w kq - 0 9",
    moves: ["Qd8+", "Kxd8", "Bg5+", "Kc7", "Bd8#"],
    lesson: "The queen opened the door and the bishops walked through it, side by side. The bishops learn that two who see the same far line can do what one can't.",
  },
  {
    id: "lucena", kind: "rook", level: 3,
    title: "Building a Bridge",
    where: "The Lucena position, 1497",
    who: "A king trapped in front of his own pawn, and a rook that builds him a shelter.",
    play: "Play the rook and king, as White.",
    fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
    moves: ["Rd1+", "Ke7", "Rd4", "Ra1", "Kc7", "Rc1+", "Kb6", "Rb1+", "Kc6", "Rc1+", "Kb5", "Rb1+", "Rb4"],
    lesson: "The rook stepped back to step in at the right moment, and the checks ran out. The rooks learn that protecting someone sometimes means waiting where you're needed.",
  },
  {
    id: "paulsen", kind: "queen", level: 3,
    title: "Morphy's Queen",
    where: "New York, 1857",
    who: "Paul Morphy, as Black, against Louis Paulsen.",
    play: "Play Morphy's moves, as Black.",
    fen: "4r1k1/p1pb1ppp/Qbp1r3/8/1P6/2Pq1B2/R2P1PPP/2B2RK1 b - - 4 17",
    moves: ["Qxf3", "gxf3", "Rg6+", "Kh1", "Bh3", "Rd1", "Bg2+", "Kg1", "Bxf3+", "Kf1", "Bg2+", "Kg1", "Bh3+", "Kh1", "Bxf2", "Qf1", "Bxf1", "Rxf1", "Re2"],
    lesson: "The strongest piece gave herself first, so everyone else could finish what she began. The queens learn that strength is for spending on the others.",
  },
  {
    id: "laskerthomas", kind: "king", level: 3,
    title: "The King Who Came to Fight",
    where: "London, 1912",
    who: "Edward Lasker against George Thomas, and a king hunt across the whole board.",
    play: "Play Lasker's moves, as White.",
    fen: "rn3rk1/pbppq1pp/1p2pb2/4N2Q/3PN3/3B4/PPP2PPP/R3K2R w KQ - 6 11",
    moves: ["Qxh7+", "Kxh7", "Nxf6+", "Kh6", "Neg4+", "Kg5", "h4+", "Kf4", "g3+", "Kf3", "Be2+", "Kg2", "Rh2+", "Kg1", "Kd2#"],
    lesson: "The black king was driven across the board, and the last blow came from the white king himself. The kings learn that the one everyone protects can step forward too.",
  },
];

const KEY = "tacticaMemories";

/** Ids of the memories woken on this device (or brought from the account). */
export function loadMemories() {
  const saved = loadSetting(KEY, []);
  return Array.isArray(saved) ? saved.filter((id) => MEMORIES.some((m) => m.id === id)) : [];
}
export const saveMemories = (ids) => saveSetting(KEY, [...new Set(ids)]);

/** Which memories are open: woken ones; every world's before the furthest
 *  reached (its boss was beaten to get there), all of them once the story
 *  is beaten; and each piece's own once its bond level (`levels`, by kind)
 *  is high enough. */
export function openMemories({ woken = loadMemories(), reached = 0, beaten = false, levels = {} } = {}) {
  return MEMORIES.filter((m) => woken.includes(m.id) || (m.world != null && (beaten || m.world < reached)) || (m.kind && (levels[m.kind] ?? 0) >= m.level)).map((m) => m.id);
}

/** The world memory the pieces learned just before world `world`, if open:
 *  its lesson is recalled when the next boss is met. */
export function lessonBefore(world, open) {
  const m = MEMORIES.find((x) => x.world === world - 1);
  return m && open.includes(m.id) ? m : null;
}

/** Wakes the memory of world `world`; returns it if it is new, else null. */
export function wakeMemory(world) {
  const memory = MEMORIES.find((m) => m.world === world);
  if (!memory) return null;
  const woken = loadMemories();
  if (woken.includes(memory.id)) return null;
  saveMemories([...woken, memory.id]);
  return memory;
}
