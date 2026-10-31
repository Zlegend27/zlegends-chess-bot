/* Lichess's published move-accuracy curve: convert the eval to a win
   percentage before and after each move, and score how much winning
   chance the move burned. Using win% rather than raw centipawns is what
   keeps accuracy fair across positions -- dropping 100cp in a dead-even
   game matters, dropping it while up a queen doesn't. */
export const winPctOf = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
export const moveAccuracy = (wpBefore, wpAfter) => {
  const drop = Math.max(0, wpBefore - wpAfter);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
};
