/**
 * The five rows the Score Rush board shows.
 *
 * The board is five long and the signed-in player always has to be on it, but
 * only pinning them to the bottom would be a lie when they actually placed in
 * the top five — a third place would read as if it were fifth. So: if they are
 * already inside the top five, the board is just the top five with their real
 * row in its real spot. Only when they placed below it does the last row get
 * given up to them, under the top four.
 */
export function buildLeaderboardRows<T extends { userId: string }>(
  topPlayers: T[],
  currentPlayer: T | null,
): T[] {
  const topFive = topPlayers.slice(0, 5);

  if (!currentPlayer) {
    return topFive;
  }

  if (topFive.some((entry) => entry.userId === currentPlayer.userId)) {
    return topFive;
  }

  return [
    ...topPlayers
      .filter((entry) => entry.userId !== currentPlayer.userId)
      .slice(0, 4),
    currentPlayer,
  ];
}
