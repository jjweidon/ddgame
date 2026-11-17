import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getSessionPlayer, jsonError } from '@/server/insung/auth';
import { getPointBudget } from '@/server/insung/budget';

export const dynamic = 'force-dynamic';

// 내 이번 달 포인트 (지급·이월·사용·잔액). 로그인 안 했으면 null
export async function GET() {
  try {
    await dbConnect();
    const me = await getSessionPlayer();
    return NextResponse.json({ success: true, data: me ? await getPointBudget(me) : null });
  } catch (error: any) {
    console.error('인성 포인트 조회 오류:', error);
    return jsonError(error.message || '포인트 조회 중 오류가 발생했습니다.', 500);
  }
}
