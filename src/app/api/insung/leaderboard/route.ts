import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InsungQuote from '@/models/InsungQuote';
import { VALID_PLAYERS } from '@/models/Game';
import { jsonError } from '@/server/insung/auth';

export const dynamic = 'force-dynamic';

// 주인공별 점수(받은 투표 합) · 제보 수 · 경쟁 순위 (동점 시 다음 순위 건너뜀)
export async function GET() {
  try {
    await dbConnect();
    const grouped = await InsungQuote.aggregate<{ _id: string; score: number; quoteCount: number }>([
      { $group: { _id: '$author', score: { $sum: '$voteCount' }, quoteCount: { $sum: 1 } } }
    ]);
    const byPlayer = new Map(grouped.map((row) => [row._id, row]));

    const rows = VALID_PLAYERS.map((player) => ({
      player,
      score: byPlayer.get(player)?.score ?? 0,
      quoteCount: byPlayer.get(player)?.quoteCount ?? 0
    })).sort((a, b) => b.score - a.score || b.quoteCount - a.quoteCount);

    const leaderboard = rows.map((row) => ({
      ...row,
      rank: rows.findIndex((other) => other.score === row.score) + 1
    }));

    return NextResponse.json({ success: true, data: leaderboard });
  } catch (error: any) {
    console.error('인성 랭킹 조회 오류:', error);
    return jsonError(error.message || '랭킹 조회 중 오류가 발생했습니다.', 500);
  }
}
