import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import InsungQuote from '@/models/InsungQuote';
import { getSessionPlayer, jsonError } from '@/server/insung/auth';
import { addVote, removeVote } from '@/server/insung/quotes';

type RouteContext = { params: Promise<{ id: string }> };

async function resolveVoteRequest({ params }: RouteContext) {
  await dbConnect();
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { error: jsonError('유효하지 않은 제보 ID입니다.', 400) };
  }
  const me = await getSessionPlayer();
  if (!me) return { error: jsonError('로그인이 필요합니다.', 401, { requiresLogin: true }) };

  const quote = await InsungQuote.findById(id).select({ author: 1 });
  if (!quote) return { error: jsonError('해당 제보를 찾을 수 없습니다.', 404) };
  return { id, me, quote };
}

// 공감 투표
export async function POST(_request: Request, context: RouteContext) {
  try {
    const resolved = await resolveVoteRequest(context);
    if ('error' in resolved) return resolved.error;
    const { id, me, quote } = resolved;

    if (quote.author === me) return jsonError('본인이 주인공인 제보에는 투표할 수 없습니다.', 403);
    if (!(await addVote(id, me))) return jsonError('이미 투표한 제보입니다.', 409);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('인성 투표 오류:', error);
    return jsonError(error.message || '투표 중 오류가 발생했습니다.', 500);
  }
}

// 투표 취소
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const resolved = await resolveVoteRequest(context);
    if ('error' in resolved) return resolved.error;
    const { id, me } = resolved;

    if (!(await removeVote(id, me))) return jsonError('투표하지 않은 제보입니다.', 404);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('인성 투표 취소 오류:', error);
    return jsonError(error.message || '투표 취소 중 오류가 발생했습니다.', 500);
  }
}
