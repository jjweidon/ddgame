import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InsungUser from '@/models/InsungUser';
import { VALID_PLAYERS } from '@/models/Game';
import { getSessionPlayer, jsonError } from '@/server/insung/auth';

export const dynamic = 'force-dynamic';

// 5명의 PIN 설정 여부 + 현재 세션 사용자
export async function GET() {
  try {
    await dbConnect();
    const users = await InsungUser.find({ pinHash: { $exists: true } }).select({ player: 1 }).lean();
    const withPin = new Set(users.map((user) => user.player));
    const me = await getSessionPlayer();

    return NextResponse.json({
      success: true,
      data: {
        me,
        players: VALID_PLAYERS.map((player) => ({ player, hasPin: withPin.has(player) }))
      }
    });
  } catch (error: any) {
    console.error('인성 인증 상태 조회 오류:', error);
    return jsonError(error.message || '인증 상태 조회 중 오류가 발생했습니다.', 500);
  }
}
