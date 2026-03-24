'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getPlayerDisplayName } from '@/utils/playerNames';

type PlayerCode = '잡' | '큐' | '지' | '머' | '웅';

type CartanGame = {
  _id: string;
  createdAt: string;
  cartanResult: {
    rankEntries: Array<{
      rank: number;
      players: PlayerCode[];
    }>;
  };
};

type CartanStats = {
  totalGames: number;
  playerStats: Array<{
    player: PlayerCode;
    totalPoints: number;
    totalGames: number;
    rankCounts: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
    rank: number;
  }>;
};

const PLAYERS: PlayerCode[] = ['잡', '큐', '지', '머', '웅'];

export default function CartanPage() {
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerCode[]>([]);
  const [playerRanks, setPlayerRanks] = useState<Record<PlayerCode, number>>({
    잡: 1,
    큐: 1,
    지: 1,
    머: 1,
    웅: 1
  });
  const [games, setGames] = useState<CartanGame[]>([]);
  const [stats, setStats] = useState<CartanStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editingPlayerRanks, setEditingPlayerRanks] = useState<Record<string, number>>({});
  const [historyEditMode, setHistoryEditMode] = useState<boolean>(false);

  const selectedCount = selectedPlayers.length;

  const groupedRankEntries = useMemo(() => {
    const rankMap = new Map<number, PlayerCode[]>();
    selectedPlayers.forEach((player) => {
      const rank = playerRanks[player];
      if (!rankMap.has(rank)) rankMap.set(rank, []);
      rankMap.get(rank)?.push(player);
    });
    return Array.from(rankMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rank, players]) => ({ rank, players }));
  }, [selectedPlayers, playerRanks]);

  const getAvailableRanksForIndex = (index: number): number[] => {
    if (index <= 0) return [1];
    const prevPlayer = selectedPlayers[index - 1];
    const prevRank = playerRanks[prevPlayer];
    const candidates = [prevRank, Math.min(5, prevRank + 1)];
    return Array.from(new Set(candidates)).sort((a, b) => a - b);
  };

  const getRankTextColorClass = (rank: number): string => {
    if (rank === 1) return 'text-lime-400';
    if (rank === 2) return 'text-emerald-400';
    if (rank === 3) return 'text-amber-400';
    if (rank === 4) return 'text-orange-400';
    return 'text-rose-400';
  };

  const getRankBorderColorClass = (rank: number): string => {
    if (rank === 1) return 'border-lime-400';
    if (rank === 2) return 'border-emerald-400';
    if (rank === 3) return 'border-amber-400';
    if (rank === 4) return 'border-orange-400';
    return 'border-rose-400';
  };

  const getCurrentYear = () => {
    const now = new Date();
    const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return koreaTime.getFullYear();
  };

  const fetchCartanData = async () => {
    try {
      const year = getCurrentYear();
      const response = await fetch(`/api/cartan?year=${year}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '카탄 데이터를 불러오지 못했습니다.');
      }
      setGames(data.data.games || []);
      setStats(data.data.stats || null);
    } catch (fetchError: any) {
      setError(fetchError.message || '카탄 데이터를 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    fetchCartanData();
  }, []);

  useEffect(() => {
    if (!error && !success) return;
    const timer = setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [error, success]);

  useEffect(() => {
    if (selectedPlayers.length === 0) return;

    setPlayerRanks((prev) => {
      const next = { ...prev };
      let changed = false;

      selectedPlayers.forEach((player, index) => {
        const allowed = index === 0 ? [1] : (() => {
          const prevPlayer = selectedPlayers[index - 1];
          const prevRank = next[prevPlayer];
          const candidates = [prevRank, Math.min(5, prevRank + 1)];
          return Array.from(new Set(candidates)).sort((a, b) => a - b);
        })();

        if (!allowed.includes(next[player])) {
          next[player] = allowed[allowed.length - 1];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [selectedPlayers, playerRanks]);

  const togglePlayer = (player: PlayerCode) => {
    setSelectedPlayers((prev) => {
      if (prev.includes(player)) {
        return prev.filter((p) => p !== player);
      }
      if (prev.length >= 5) return prev;

      // 선택 순서 기반 자동 순위: 직전 플레이어 등수 + 1
      const prevPlayer = prev[prev.length - 1];
      const prevRank = prevPlayer ? playerRanks[prevPlayer] : 0;
      const nextRank = prev.length === 0 ? 1 : Math.min(5, prevRank + 1);
      setPlayerRanks((old) => ({ ...old, [player]: nextRank }));
      return [...prev, player];
    });
  };

  const resetForm = () => {
    setSelectedPlayers([]);
    setPlayerRanks({ 잡: 1, 큐: 1, 지: 1, 머: 1, 웅: 1 });
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (selectedCount < 3 || selectedCount > 5) {
      setError('카탄 참여 인원은 3명~5명이어야 합니다.');
      return;
    }

    if (!groupedRankEntries.some((entry) => entry.rank === 1)) {
      setError('반드시 1위를 지정해야 합니다.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/cartan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rankEntries: groupedRankEntries
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '카탄 기록 저장에 실패했습니다.');
      }
      setSuccess('카탄 기록이 저장되었습니다.');
      resetForm();
      fetchCartanData();
    } catch (submitError: any) {
      setError(submitError.message || '카탄 기록 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const startEditGame = (game: CartanGame) => {
    const rankMap: Record<string, number> = {};
    game.cartanResult.rankEntries.forEach((entry) => {
      entry.players.forEach((player) => {
        rankMap[player] = entry.rank;
      });
    });
    setEditingPlayerRanks(rankMap);
    setEditingGameId(game._id);
  };

  const cancelEditGame = () => {
    setEditingGameId(null);
    setEditingPlayerRanks({});
  };

  const buildRankEntriesFromEditMap = () => {
    const rankMap = new Map<number, PlayerCode[]>();
    Object.entries(editingPlayerRanks).forEach(([player, rank]) => {
      const playerCode = player as PlayerCode;
      if (!rankMap.has(rank)) rankMap.set(rank, []);
      rankMap.get(rank)?.push(playerCode);
    });
    return Array.from(rankMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rank, players]) => ({ rank, players }));
  };

  const handleSaveEditGame = async (gameId: string) => {
    try {
      const rankEntries = buildRankEntriesFromEditMap();
      const response = await fetch(`/api/cartan/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankEntries })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '카탄 기록 수정에 실패했습니다.');
      }
      setSuccess('카탄 기록이 수정되었습니다.');
      cancelEditGame();
      fetchCartanData();
    } catch (editError: any) {
      setError(editError.message || '카탄 기록 수정에 실패했습니다.');
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!confirm('이 카탄 기록을 삭제하시겠습니까?')) return;
    try {
      const response = await fetch(`/api/cartan/${gameId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '카탄 기록 삭제에 실패했습니다.');
      }
      setSuccess('카탄 기록이 삭제되었습니다.');
      if (editingGameId === gameId) {
        cancelEditGame();
      }
      fetchCartanData();
    } catch (deleteError: any) {
      setError(deleteError.message || '카탄 기록 삭제에 실패했습니다.');
    }
  };

  return (
    <main className="min-h-screen bg-page py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">뚱팸 카탄</h1>
            <p className="text-sm text-muted mt-1">카탄 플레이 결과를 기록합니다.</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-sm text-foreground hover:bg-surface-hover border border-border"
          >
            홈으로
          </Link>
        </div>

        <section className="bg-surface rounded-lg border border-border p-5 space-y-5">
          <h2 className="text-xl font-semibold text-foreground">카탄 기록 추가</h2>

          <div>
            <p className="text-sm text-muted mb-2">참여자 선택 ({selectedCount}/5)</p>
            <div className="grid grid-cols-5 gap-2">
              {PLAYERS.map((player) => {
                const selected = selectedPlayers.includes(player);
                return (
                  <button
                    key={player}
                    type="button"
                    onClick={() => togglePlayer(player)}
                    className={`h-10 rounded-lg text-sm font-semibold ${selected ? 'bg-accent-gradient text-white' : 'border border-border text-foreground hover:bg-surface-hover'}`}
                  >
                    {getPlayerDisplayName(player)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted mb-2">플레이어별 순위 기록</p>
            <div className="space-y-2">
              {selectedPlayers.map((player, index) => (
                <div key={player} className="flex items-center justify-center gap-6 bg-surface-hover rounded-lg px-3 py-2">
                  <select
                    value={playerRanks[player]}
                    onChange={(e) => {
                      const nextRank = Number(e.target.value);
                      const allowed = getAvailableRanksForIndex(index);
                      if (!allowed.includes(nextRank)) return;
                      setPlayerRanks((prev) => ({ ...prev, [player]: nextRank }));
                    }}
                    className={`bg-surface border border-border rounded-md px-2 py-1 text-sm font-semibold ${getRankTextColorClass(playerRanks[player])}`}
                  >
                    {getAvailableRanksForIndex(index).map((rank) => (
                      <option key={rank} value={rank} className={getRankTextColorClass(rank)}>
                        {rank}위
                      </option>
                    ))}
                  </select>
                  <span className="font-semibold text-foreground min-w-16 text-left">
                    {getPlayerDisplayName(player)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-accent-gradient text-white font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? '저장 중...' : '카탄 결과 저장'}
          </button>
        </section>

        <section className="bg-surface rounded-lg border border-border p-5">
          <h2 className="text-xl font-semibold text-foreground mb-3">카탄 개인 통계</h2>
          {!stats ? (
            <p className="text-sm text-muted">통계를 불러오는 중...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted">총 게임 수: {stats.totalGames}</p>
              {stats.playerStats.map((player, index) => {
                let displayRank = index + 1;
                if (index > 0 && stats.playerStats[index - 1].totalPoints === player.totalPoints) {
                  let back = index - 1;
                  while (back > 0 && stats.playerStats[back - 1].totalPoints === player.totalPoints) {
                    back--;
                  }
                  displayRank = back + 1;
                }
                return (
                <div key={player.player} className="bg-surface-hover rounded-lg px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {displayRank}위 {getPlayerDisplayName(player.player)}
                    </span>
                    <span className="text-xl font-bold text-accent inline-flex items-center">
                      <span className="mr-3">🏆</span>
                      <span>{player.totalPoints}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <span className="text-muted">총 {player.totalGames}회</span>
                    {player.rankCounts[1] > 0 && <span className={getRankTextColorClass(1)}>1위 {player.rankCounts[1]}</span>}
                    {player.rankCounts[2] > 0 && <span className={getRankTextColorClass(2)}>2위 {player.rankCounts[2]}</span>}
                    {player.rankCounts[3] > 0 && <span className={getRankTextColorClass(3)}>3위 {player.rankCounts[3]}</span>}
                    {player.rankCounts[4] > 0 && <span className={getRankTextColorClass(4)}>4위 {player.rankCounts[4]}</span>}
                    {player.rankCounts[5] > 0 && <span className={getRankTextColorClass(5)}>5위 {player.rankCounts[5]}</span>}
                  </div>
                </div>
              )})}
            </div>
          )}
        </section>

        <section className="bg-surface rounded-lg border border-border p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">카탄 히스토리</h2>
            <button
              type="button"
              onClick={() =>
                setHistoryEditMode((prev) => {
                  const next = !prev;
                  if (!next) {
                    cancelEditGame();
                  }
                  return next;
                })
              }
              className={`p-2 rounded-md border transition-colors duration-200 ${
                historyEditMode
                  ? 'bg-accent-gradient text-white border-transparent shadow-sm'
                  : 'border-border text-muted hover:text-foreground hover:bg-surface-hover'
              }`}
              title="히스토리 편집"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.414 2.586a2 2 0 010 2.828l-9.9 9.9a1 1 0 01-.42.243l-4 1a1 1 0 01-1.213-1.213l1-4a1 1 0 01.243-.42l9.9-9.9a2 2 0 012.828 0zM15 5l-1-1-9.193 9.193-.5 2 2-.5L15 5z" />
              </svg>
            </button>
          </div>
          {games.length === 0 ? (
            <p className="text-sm text-muted">아직 기록이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {games.slice(0, 15).map((game) => (
                <div key={game._id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted">
                      {new Date(game.createdAt).toLocaleString()}
                    </div>
                    {(historyEditMode || editingGameId === game._id) && (
                      <div className="flex items-center gap-2">
                        {editingGameId === game._id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEditGame(game._id)}
                            className="px-2 py-1 text-xs rounded-md bg-accent-gradient text-white"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditGame}
                            className="px-2 py-1 text-xs rounded-md border border-border text-foreground"
                          >
                            취소
                          </button>
                        </>
                        ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditGame(game)}
                            className="px-2 py-1 text-xs rounded-md border border-border text-foreground"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGame(game._id)}
                            className="px-2 py-1 text-xs rounded-md border border-rose-300 text-rose-600"
                          >
                            삭제
                          </button>
                        </>
                        )}
                      </div>
                    )}
                  </div>
                  {editingGameId === game._id ? (
                    <div className="space-y-2">
                      {Object.entries(editingPlayerRanks).map(([player, rank]) => (
                        <div key={`${game._id}-${player}`} className="flex items-center justify-between bg-surface-hover rounded-md px-2 py-2">
                          <span className="text-sm font-medium text-foreground">
                            {getPlayerDisplayName(player)}
                          </span>
                          <select
                            value={rank}
                            onChange={(e) =>
                              setEditingPlayerRanks((prev) => ({
                                ...prev,
                                [player]: Number(e.target.value)
                              }))
                            }
                            className="bg-surface border border-border rounded-md px-2 py-1 text-sm"
                          >
                            {[1, 2, 3, 4, 5].map((r) => (
                              <option key={r} value={r}>
                                {r}위
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {game.cartanResult.rankEntries
                        .sort((a, b) => a.rank - b.rank)
                        .map((entry) => (
                          <span
                            key={`${game._id}-${entry.rank}`}
                            className={`text-sm bg-surface-hover rounded-md px-2 py-1 border ${getRankBorderColorClass(entry.rank)}`}
                          >
                            {entry.rank}위: {entry.players.join(', ')}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {error && (
        <div className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 animate-fadeIn">
          <div className="rounded-lg border border-rose-300/70 bg-rose-100/20 backdrop-blur-sm px-6 py-4 text-center text-sm font-medium text-rose-400 shadow-lg">
            {error}
          </div>
        </div>
      )}
      {success && (
        <div className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 animate-fadeIn">
          <div className="rounded-lg border border-emerald-300/70 bg-emerald-100/20 backdrop-blur-sm px-6 py-4 text-center text-sm font-medium text-emerald-400 shadow-lg">
            {success}
          </div>
        </div>
      )}
    </main>
  );
}
