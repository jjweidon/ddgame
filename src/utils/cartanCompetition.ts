/** 카탄 순위: 경쟁 순위(동점이 k명이면 다음 순위는 +k, 예: 1·2·2·4) */

export const MAX_CARTAN_RANK = 5;

/** 선택 순서 기준, 마지막 인덱스부터 연속 동순위 인원 수 */
export function countTerminalTieRun<T extends string>(
  orderedPlayers: T[],
  playerRanks: Record<string, number>,
  lastIndex: number
): number {
  const lastRank = playerRanks[orderedPlayers[lastIndex]];
  let run = 0;
  for (let i = lastIndex; i >= 0; i--) {
    if (playerRanks[orderedPlayers[i]] === lastRank) run++;
    else break;
  }
  return run;
}

/**
 * 선택 순서상 i번째 플레이어가 가질 수 있는 순위:
 * 직전과 동순위이거나, 직전 동순위 블록 직후의 경쟁 순위.
 */
export function getCartanSelectionAllowedRanks<T extends string>(
  orderedPlayers: T[],
  playerRanks: Record<string, number>,
  index: number
): number[] {
  if (index <= 0) return [1];
  const prevRank = playerRanks[orderedPlayers[index - 1]];
  const tieRun = countTerminalTieRun(orderedPlayers, playerRanks, index - 1);
  const nextRank = Math.min(MAX_CARTAN_RANK, prevRank + tieRun);
  return Array.from(new Set([prevRank, nextRank])).sort((a, b) => a - b);
}

/** 새 참가자 기본 순위(동순위 없이 다음 자리) */
export function getDefaultRankForNextCartanPlayer<T extends string>(
  orderedPlayers: T[],
  playerRanks: Record<string, number>
): number {
  if (orderedPlayers.length === 0) return 1;
  const lastIdx = orderedPlayers.length - 1;
  const prevRank = playerRanks[orderedPlayers[lastIdx]];
  const tieRun = countTerminalTieRun(orderedPlayers, playerRanks, lastIdx);
  return Math.min(MAX_CARTAN_RANK, prevRank + tieRun);
}

export type CartanRankEntryInput = { rank: number; players: unknown[] };

/**
 * rankEntries가 경쟁 순위인지 검사 (오름차순 정렬 후 기대 순위와 일치 여부).
 */
export function validateCartanCompetitionRankEntries(
  rankEntries: CartanRankEntryInput[]
): { ok: true } | { ok: false; error: string } {
  if (!rankEntries.length) {
    return { ok: false, error: '등수 정보(rankEntries)가 필요합니다.' };
  }

  const sorted = [...rankEntries].sort((a, b) => a.rank - b.rank);
  let expectedRank = 1;
  const seen = new Set<number>();

  for (const entry of sorted) {
    if (!Array.isArray(entry.players) || entry.players.length === 0) {
      return { ok: false, error: '각 등수에는 최소 1명의 플레이어가 필요합니다.' };
    }
    if (seen.has(entry.rank)) {
      return { ok: false, error: '동일 순위 그룹이 중복되었습니다.' };
    }
    seen.add(entry.rank);
    if (entry.rank < 1 || entry.rank > MAX_CARTAN_RANK) {
      return { ok: false, error: `순위는 1~${MAX_CARTAN_RANK}위만 가능합니다.` };
    }
    if (entry.rank !== expectedRank) {
      return {
        ok: false,
        error: `경쟁 순위 규칙에 맞지 않습니다. ${expectedRank}위가 와야 하는데 ${entry.rank}위가 등록되었습니다. (동점 시 다음 순위 건너뜀: 예 1·2·2·4)`
      };
    }
    expectedRank = entry.rank + entry.players.length;
  }

  return { ok: true };
}

/** 인원별 순위 → 점수 (저장된 rank 숫자 그대로 사용) */
export function getCartanPointsByContext(playerCount: number, rank: number): number {
  const pointTable: Record<number, Record<number, number>> = {
    3: { 1: 3, 2: 1, 3: -1 },
    4: { 1: 3, 2: 1, 3: 0, 4: -1 },
    5: { 1: 3, 2: 1, 3: 0, 4: -1, 5: -2 }
  };
  return pointTable[playerCount]?.[rank] ?? 0;
}
