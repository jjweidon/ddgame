import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import InsungQuote, { IInsungQuote } from '@/models/InsungQuote';
import { PlayerCode } from '@/models/Game';
import { getSessionPlayer, jsonError } from '@/server/insung/auth';
import {
  castVote,
  InsungVoteError,
  isValidPoints,
  removeVote,
  withVoters
} from '@/server/insung/quotes';
import { getPointBudget, PointBudget } from '@/server/insung/budget';
import { enforceWriteRateLimit } from '@/server/insung/rateLimit';
import { INSUNG_POINT_MAX, INSUNG_POINT_MIN } from '@/constants/insungPoints';

type RouteContext = { params: Promise<{ id: string }> };

async function resolveVoteRequest({ params }: RouteContext) {
  await dbConnect();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { error: jsonError('유효하지 않은 제보 ID입니다.', 400) };
  }
  const me = await getSessionPlayer();
  if (!me) return { error: jsonError('로그인이 필요합니다.', 401, { requiresLogin: true }) };

  const limited = await enforceWriteRateLimit(me);
  if (limited) return { error: limited };

  const quote = await InsungQuote.exists({ _id: id });
  if (!quote) return { error: jsonError('해당 제보를 찾을 수 없습니다.', 404) };
  return { id, me };
}

/** 화면이 목록·잔액을 다시 부르지 않도록 바뀐 제보와 잔액을 함께 돌려줌 */
async function voteResponse(id: string, me: PlayerCode, budget: PointBudget, extra: Record<string, unknown> = {}) {
  const quote = await InsungQuote.findById(id).lean<IInsungQuote>();
  const [withVotes] = quote ? await withVoters([quote], me) : [null];
  return NextResponse.json({ success: true, data: { ...extra, quote: withVotes, budget } });
}

const voteErrorResponse = (error: unknown, fallback: string) => {
  if (error instanceof InsungVoteError) return jsonError(error.message, error.status, { code: error.code });
  console.error(fallback, error);
  return jsonError((error as Error)?.message || fallback, 500);
};

// 투표 또는 점수 변경: { points: 1~5 }
export async function POST(request: Request, context: RouteContext) {
  try {
    const resolved = await resolveVoteRequest(context);
    if ('error' in resolved) return resolved.error;
    const { id, me } = resolved;

    const body = await request.json().catch(() => ({}));
    const points = body.points ?? INSUNG_POINT_MIN;
    if (!isValidPoints(points)) {
      return jsonError(`포인트는 ${INSUNG_POINT_MIN}~${INSUNG_POINT_MAX} 사이여야 합니다.`, 400);
    }

    const { status, budget } = await castVote(id, me, points);
    return voteResponse(id, me, budget, { status });
  } catch (error) {
    return voteErrorResponse(error, '투표 중 오류가 발생했습니다.');
  }
}

// 투표 취소 (언제 한 투표든 가능, 포인트는 투표했던 달로 환불)
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const resolved = await resolveVoteRequest(context);
    if ('error' in resolved) return resolved.error;
    const { id, me } = resolved;

    if (!(await removeVote(id, me))) return jsonError('투표하지 않은 제보입니다.', 404);

    return voteResponse(id, me, await getPointBudget(me));
  } catch (error) {
    return voteErrorResponse(error, '투표 취소 중 오류가 발생했습니다.');
  }
}
