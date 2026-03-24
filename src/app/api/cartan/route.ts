import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Game, { IGame, VALID_PLAYERS } from '@/models/Game';

type PlayerSummary = {
  player: string;
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
};

const getCartanPointsByContext = (playerCount: number, rank: number): number => {
  // 요구사항 기반 점수표:
  // 3인: 1위 3점, 2위 1점, 3위 -1점
  // 4인: 1위 3점, 2위 1점, 3위 0점, 4위 -1점
  // 5인: 1위 3점, 2위 1점, 3위 0점, 4위 -1점, 5위 -2점
  const pointTable: Record<number, Record<number, number>> = {
    3: { 1: 3, 2: 1, 3: -1 },
    4: { 1: 3, 2: 1, 3: 0, 4: -1 },
    5: { 1: 3, 2: 1, 3: 0, 4: -1, 5: -2 }
  };

  return pointTable[playerCount]?.[rank] ?? 0;
};

const calculateCartanStats = (games: IGame[]) => {
  const stats: Record<string, { totalPoints: number; totalGames: number; rankCounts: { 1: number; 2: number; 3: number; 4: number; 5: number } }> = {};

  VALID_PLAYERS.forEach((player) => {
    stats[player] = {
      totalPoints: 0,
      totalGames: 0,
      rankCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  });

  games.forEach((game) => {
    const entries = game.cartanResult?.rankEntries || [];
    const playerCount = entries.reduce((sum, entry) => sum + (entry.players?.length || 0), 0);

    entries.forEach((entry) => {
      const points = getCartanPointsByContext(playerCount, entry.rank);

      entry.players.forEach((player) => {
        if (!stats[player]) return;
        stats[player].totalGames += 1;
        stats[player].totalPoints += points;
        stats[player].rankCounts[entry.rank as 1 | 2 | 3 | 4 | 5] += 1;
      });
    });
  });

  const sorted = Object.entries(stats)
    .map(([player, value]) => ({
      player,
      totalPoints: value.totalPoints,
      totalGames: value.totalGames,
      rankCounts: value.rankCounts
    }))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return a.player.localeCompare(b.player);
    });

  let previousRank = 0;
  let previousPoints: number | null = null;
  const playerStats: PlayerSummary[] = sorted.map((item, index) => {
    const rank = previousPoints !== null && previousPoints === item.totalPoints ? previousRank : index + 1;
    previousPoints = item.totalPoints;
    previousRank = rank;
    return { ...item, rank };
  });

  return {
    totalGames: games.length,
    playerStats
  };
};

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    const query: Record<string, any> = { gameType: 'cartan' };
    if (year) {
      const yearNum = parseInt(year, 10);
      if (!isNaN(yearNum)) {
        query.createdAt = {
          $gte: new Date(`${yearNum}-01-01T00:00:00+09:00`),
          $lte: new Date(`${yearNum}-12-31T23:59:59+09:00`)
        };
      }
    }

    const games = await Game.find(query).sort({ createdAt: -1 });
    return NextResponse.json({
      success: true,
      data: {
        games,
        stats: calculateCartanStats(games)
      }
    });
  } catch (error) {
    console.error('카탄 데이터 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '카탄 데이터를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rankEntries } = body;

    if (!Array.isArray(rankEntries) || rankEntries.length === 0) {
      return NextResponse.json(
        { success: false, error: '등수 정보(rankEntries)가 필요합니다.' },
        { status: 400 }
      );
    }

    const allPlayers = rankEntries.flatMap((entry: any) => entry.players || []);
    const uniquePlayers = new Set(allPlayers);
    if (allPlayers.length < 3 || allPlayers.length > 5) {
      return NextResponse.json(
        { success: false, error: '카탄은 3명 이상 5명 이하만 참여할 수 있습니다.' },
        { status: 400 }
      );
    }
    if (allPlayers.length !== uniquePlayers.size) {
      return NextResponse.json(
        { success: false, error: '동일 플레이어가 중복 등록되었습니다.' },
        { status: 400 }
      );
    }
    for (const player of allPlayers) {
      if (!VALID_PLAYERS.includes(player)) {
        return NextResponse.json(
          { success: false, error: `유효하지 않은 플레이어: ${player}` },
          { status: 400 }
        );
      }
    }

    await dbConnect();
    const created = await Game.create({
      gameType: 'cartan',
      cartanResult: {
        rankEntries
      }
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    console.error('카탄 데이터 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '카탄 데이터를 저장하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
