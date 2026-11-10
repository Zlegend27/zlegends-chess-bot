/* Owl's Adventure: the Learn path, as six islands of short levels. The
   order follows how chess coaches teach children (the Dutch Steps Method,
   ChessKid's mini-games): one piece at a time through mini-games, then
   capturing and protecting, check and mate, the opening, tactics, and
   endgames. Each level gives up to 3 stars; stars open the next island,
   and every level on an open island can be played in any order.

   Level types (KidLevel.jsx plays them; AdventureMap.jsx draws the map):
   - how: the "How the Pieces Move" page
   - lesson: one of Owl's lesson chapters (kidLessons.js)
   - camp: an Opening Camp course (OpeningCamp.jsx)
   - stars: star hunts, one piece per round (kidMini.js)
   - pawnwars / queenhunt: mini-games against the computer (kidMini.js)
   - drill: positions from kidDrills.json, judged by kidRules.js
   - puzzles: real puzzles from the kid puzzle set, by theme and rating
   - quiz: questions with answer buttons
   - endgame: a real position against the engine, to mate or to promote */
import { courseStars } from "./kidCamp";

export const ISLANDS = [
  {
    id: "park", name: "Piece Park", emoji: "♟️", color: "#9BE38F", needs: 0,
    blurb: "How every piece moves, in mini-games",
    levels: [
      { id: "park-how", title: "How the pieces move", icon: "📖", type: "how" },
      { id: "park-rook", title: "Rook Road", icon: "♜", type: "stars", rounds: [
        { piece: "R", start: "a1", stars: ["a6", "f6", "f2"] },
        { piece: "R", start: "h8", stars: ["h1", "b1", "b5"], rocks: ["d1", "h4"] },
      ] },
      { id: "park-bishop", title: "Bishop Slide", icon: "♝", type: "stars", rounds: [
        { piece: "B", start: "c1", stars: ["a3", "e7", "h4"] },
        { piece: "B", start: "f8", stars: ["b4", "d2", "h2"], rocks: ["e3"] },
      ] },
      { id: "park-knight", title: "Knight Jumps", icon: "♞", type: "stars", rounds: [
        { piece: "N", start: "b1", stars: ["c3", "e4", "d6"] },
        { piece: "N", start: "g1", stars: ["f3", "g5", "e6", "c5"] },
      ] },
      { id: "park-queen", title: "Queen Dash", icon: "♛", type: "stars", rounds: [
        { piece: "Q", start: "d1", stars: ["d7", "a4", "h5", "a8"] },
        { piece: "Q", start: "a1", stars: ["h8", "b7", "g2", "c4"], rocks: ["d4", "e5"] },
      ] },
      { id: "park-king", title: "King's Walk", icon: "♚", type: "stars", rounds: [
        { piece: "K", start: "e1", stars: ["e3", "g4", "c5"], rocks: ["d4", "e4", "f4"] },
      ] },
      { id: "park-pawnwars", title: "Pawn Wars", icon: "⚔️", type: "pawnwars", depth: 2 },
      { id: "park-queenhunt", title: "Queen vs. 8 Pawns", icon: "👑", type: "queenhunt", depth: 3 },
      { id: "park-boss", title: "Pawn Wars Champion", icon: "🏆", type: "pawnwars", depth: 4, boss: true },
    ],
  },
  {
    id: "cove", name: "Capture Cove", emoji: "💰", color: "#FFD36B", needs: 4,
    blurb: "Capturing, protecting and fair trades",
    levels: [
      { id: "cove-free", title: "Free Lunch", icon: "🍪", type: "drill", set: "freeLunch", count: 5,
        intro: "One enemy piece is free for the taking. Find it!" },
      { id: "cove-values", title: "What's It Worth?", icon: "💎", type: "quiz", questions: [
        { q: "Which is worth more?", options: ["A rook ♜", "A bishop ♝"], answer: 0, why: "A rook is worth 5 pawns, a bishop 3." },
        { q: "How many pawns is a knight worth?", options: ["1", "3", "5"], answer: 1, why: "Knights and bishops are worth about 3 pawns each." },
        { q: "Which is the most powerful piece?", options: ["The king", "The queen", "The rook"], answer: 1, why: "The queen is worth 9! The king can't be traded at all." },
        { q: "Is it a good trade to give your queen for a rook?", options: ["Yes", "No"], answer: 1, why: "No: you give 9 and get only 5." },
        { q: "You can take a knight with your bishop, and they can take back. Is that fair?", options: ["Yes, it's an even trade", "No, I lose"], answer: 0, why: "Knight and bishop are both worth 3: an even trade." },
        { q: "Your queen can take a pawn, but their pawn takes your queen back. Should you?", options: ["Yes, a free pawn!", "No way!"], answer: 1, why: "You'd give 9 for 1. Always ask: can they take back?" },
      ] },
      { id: "cove-careful", title: "Look Before You Grab", icon: "👀", type: "drill", set: "careful", count: 5,
        intro: "Some captures are traps! Take only the one that wins." },
      { id: "cove-special", title: "Special Moves", icon: "✨", type: "lesson", chapter: "special-moves" },
      { id: "cove-boss", title: "Real Game Captures", icon: "🏴‍☠️", type: "puzzles", themes: ["hangingPiece"], max: 1100, count: 5, boss: true },
    ],
  },
  {
    id: "castle", name: "Check Castle", emoji: "🏰", color: "#FFA3C3", needs: 10,
    blurb: "Check, checkmate and finishing the game",
    levels: [
      { id: "castle-check", title: "Give Check", icon: "⚡", type: "drill", set: "giveCheck", count: 5,
        intro: "Attack the enemy king! Find a move that gives check." },
      { id: "castle-mate1", title: "Mate in One", icon: "🎯", type: "puzzles", themes: ["mateIn1"], max: 850, count: 5 },
      { id: "castle-patterns", title: "Checkmate Patterns", icon: "🧩", type: "lesson", chapter: "checkmate-patterns" },
      { id: "castle-backrank", title: "Back Rank", icon: "🚪", type: "puzzles", themes: ["backRankMate"], max: 1200, count: 4 },
      { id: "castle-queenmate", title: "Queen Mate", icon: "👑", type: "endgame", fen: "8/8/8/4k3/8/8/8/3QK3 w - - 0 1", goal: "mate", par: 10, limit: 30,
        intro: "Your king and queen against a lonely king. Push it to the edge and checkmate it!" },
      { id: "castle-boss", title: "Mate in Two", icon: "🏆", type: "puzzles", themes: ["mateIn2"], max: 1100, count: 4, boss: true },
    ],
  },
  {
    id: "camp", name: "Opening Camp", emoji: "⛺", color: "#C7B2FF", needs: 14,
    blurb: "How to start a game: your Vienna and your Two Knights",
    levels: [
      { id: "camp-habits", title: "Opening Habits", icon: "🌟", type: "lesson", chapter: "opening-habits" },
      { id: "camp-vienna-lesson", title: "The Vienna (lesson)", icon: "📘", type: "lesson", chapter: "vienna" },
      { id: "camp-vienna", title: "Vienna Camp", icon: "🌪️", type: "camp", course: "kid-vienna" },
      { id: "camp-e5-lesson", title: "Two Knights (lesson)", icon: "📗", type: "lesson", chapter: "two-knights" },
      { id: "camp-e5", title: "Two Knights Camp", icon: "🐴", type: "camp", course: "kid-e5" },
    ],
  },
  {
    id: "forest", name: "Trick Forest", emoji: "🌲", color: "#8FE0C4", needs: 24,
    blurb: "Forks, pins, skewers and sneaky attacks",
    levels: [
      { id: "forest-lesson", title: "Spot the Trick", icon: "🔍", type: "lesson", chapter: "spot-the-trick" },
      { id: "forest-fork", title: "Forks", icon: "🍴", type: "puzzles", themes: ["fork"], max: 1100, count: 5 },
      { id: "forest-pin", title: "Pins", icon: "📌", type: "puzzles", themes: ["pin"], max: 1300, count: 4 },
      { id: "forest-skewer", title: "Skewers", icon: "🍢", type: "puzzles", themes: ["skewer"], max: 1400, count: 4 },
      { id: "forest-discovered", title: "Surprise Attacks", icon: "🎁", type: "puzzles", themes: ["discoveredAttack"], max: 1400, count: 4 },
      { id: "forest-boss", title: "Trick Master", icon: "🏆", type: "puzzles", themes: ["fork", "pin", "skewer", "discoveredAttack"], max: 1500, count: 6, boss: true },
    ],
  },
  {
    id: "mountain", name: "Endgame Mountain", emoji: "🏔️", color: "#B9D6F2", needs: 34,
    blurb: "Winning when only a few pieces are left",
    levels: [
      { id: "mountain-lesson", title: "Endgame Basics", icon: "📙", type: "lesson", chapter: "endgame-basics" },
      { id: "mountain-race", title: "Pawn Race", icon: "🏃", type: "endgame", fen: "8/8/8/7P/8/k7/8/K7 w - - 0 1", goal: "promote", par: 3, limit: 10,
        intro: "Can their king catch your pawn? Run it to the end and make a queen!" },
      { id: "mountain-escort", title: "King Helps Pawn", icon: "🤝", type: "endgame", fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", goal: "promote", par: 5, limit: 15,
        intro: "Use your king to walk the pawn home. Make a queen!" },
      { id: "mountain-rookmate", title: "Rook Mate", icon: "♜", type: "endgame", fen: "8/8/8/4k3/8/8/8/R3K3 w - - 0 1", goal: "mate", par: 16, limit: 40,
        intro: "King and rook against a king. Box it in, step by step, then checkmate!" },
      { id: "mountain-puzzles", title: "Endgame Puzzles", icon: "🧗", type: "puzzles", themes: ["endgame"], max: 1000, count: 5 },
      { id: "mountain-boss", title: "Rook Endgames", icon: "🏆", type: "puzzles", themes: ["rookEndgame"], max: 1300, count: 4, boss: true },
    ],
  },
];

export const levelById = (id) => {
  for (const island of ISLANDS) {
    const level = island.levels.find((l) => l.id === id);
    if (level) return { island, level };
  }
  return null;
};

/** Stars for one level: lessons count once finished, camp courses use
 *  their own steps, the rest keep their best score. */
export function levelStars(level, { stars = {}, completedLessons = [], camp, campCards = {} }) {
  if (level.type === "lesson") return completedLessons.includes(level.chapter) ? 3 : 0;
  if (level.type === "camp") return camp ? courseStars(camp, level.course, campCards[level.course] ?? 0) : 0;
  return stars[level.id] ?? 0;
}
export const islandStars = (island, ctx) => island.levels.reduce((s, l) => s + levelStars(l, ctx), 0);
export const totalStars = (ctx) => ISLANDS.reduce((s, i) => s + islandStars(i, ctx), 0);
export const islandOpen = (island, ctx) => totalStars(ctx) >= island.needs;
/** The island she's working on: the last open one that isn't finished. */
export function currentIsland(ctx) {
  const open = ISLANDS.filter((i) => islandOpen(i, ctx));
  return open.find((i) => islandStars(i, ctx) < i.levels.length * 3) ?? open[open.length - 1];
}
