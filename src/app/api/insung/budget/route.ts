import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionPlayer, isValidPlayer, jsonError } from '@/server/insung/auth';
import { getPointBudget } from '@/server/insung/budget';

export const dynamic = 'force-dynamic';

// 이번 달 포인트 (지급·이월·사용·잔액). ?player=가 있으면 그 사람, 없으면 나(로그인 안 했으면 null)
export async function GET(request: Request) {
  try {
    await dbConnect();
    const player = new URL(request.url).searchParams.get('player');
    if (player !== null) {
      if (!isValidPlayer(player)) return jsonError('유효하지 않은 이름입니다.', 400);
      return NextResponse.json({ success: true, data: await getPointBudget(player) });
    }
    const me = await getSessionPlayer();
    return NextResponse.json({ success: true, data: me ? await getPointBudget(me) : null });
  } catch (error: any) {
    console.error('인성 포인트 조회 오류:', error);
    return jsonError(error.message || '포인트 조회 중 오류가 발생했습니다.', 500);
  }
}
