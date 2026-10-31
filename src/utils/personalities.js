/* Named weight presets on evaluate()'s existing material/position/king-safety
   terms — same eval function, different personality, no engine duplication.
   The bot picks and adapts its own style (see pickPersonality below) rather
   than exposing it as a player-facing setting. */
export const PERSONALITIES = [
  { label: "Balanced", material: 1, pawnValue: 1, position: 1, kingSafety: 1 },
  { label: "Aggressive", material: 0.95, pawnValue: 1, position: 1.3, kingSafety: 0.6 },
  { label: "Positional", material: 1, pawnValue: 1, position: 1.35, kingSafety: 1 },
  { label: "Defensive", material: 1.15, pawnValue: 1.05, position: 0.85, kingSafety: 1.7 },
  { label: "Tactical", material: 0.9, pawnValue: 0.85, position: 1.15, kingSafety: 0.9 },
  { label: "Gambit", material: 1, pawnValue: 0.65, position: 1.2, kingSafety: 0.8 },
  { label: "Endgame", material: 1.05, pawnValue: 1.15, position: 1.1, kingSafety: 0.9 },
];
export const byStyle = label => PERSONALITIES.find(p => p.label === label);
export const BALANCED = byStyle("Balanced");
/* One style is rolled per game (its "personality of the day"), then nudged
   situationally: complicate when losing badly, play it safe when winning
   big, switch to technique once the game reaches a long endgame. */
export const GAME_STYLES = ["Aggressive", "Positional", "Defensive", "Tactical", "Gambit"];
export const randomStyle = () => byStyle(GAME_STYLES[(Math.random() * GAME_STYLES.length) | 0]);
export function pickPersonality(baseStyle, plyCount, botAdvantagePawns) {
  if (plyCount > 40) return byStyle("Endgame");
  if (botAdvantagePawns <= -2.5) return byStyle("Tactical");
  if (botAdvantagePawns >= 3) return byStyle("Defensive");
  return baseStyle;
}
