export function buildPgn(moveList, resultText) {
  const parts = [];
  for (let i = 0; i < moveList.length; i += 2) {
    const num = i / 2 + 1;
    const white = moveList[i];
    const black = moveList[i + 1];
    parts.push(black ? `${num}. ${white} ${black}` : `${num}. ${white}`);
  }
  const movesText = parts.join(" ");
  return resultText ? `${movesText} ${resultText}`.trim() : movesText;
}
