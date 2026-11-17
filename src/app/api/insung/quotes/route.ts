import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InsungQuote, { IInsungQuote } from '@/models/InsungQuote';
import InsungVote from '@/models/InsungVote';
import { PlayerCode } from '@/models/Game';
import { getSessionPlayer, isValidPlayer, jsonError } from '@/server/insung/auth';
import { INSUNG_POINT_MAX, INSUNG_POINT_MIN } from '@/constants/insungPoints';
import { getPointBudget } from '@/server/insung/budget';
import {
  castVote,
  getKstToday,
  InsungVoteError,
  isValidPoints,
  POINT_TOTAL_EXPR,
  isDuplicateKeyError,
  MAX_CONTENT_LENGTH,
  MAX_CONTEXT_LENGTH,
  normalizeContent,
  withVoters
} from '@/server/insung/quotes';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// 제보 목록: ?author=&sort=latest|top&limit=&offset=
export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const author = searchParams.get('author');
    const sort = searchParams.get('sort') === 'top' ? 'top' : 'latest';
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    if (author && !isValidPlayer(author)) return jsonError('유효하지 않은 주인공입니다.', 400);

    const filter = author ? { author } : {};
    const sortSpec: Record<string, 1 | -1> =
      sort === 'top' ? { score: -1, createdAt: 1 } : { createdAt: -1 };

    const [quotes, total, me] = await Promise.all([
      InsungQuote.aggregate<IInsungQuote>([
        { $match: filter },
        { $addFields: { score: POINT_TOTAL_EXPR } },
        { $sort: sortSpec },
        { $skip: offset },
        { $limit: limit }
      ]),
      InsungQuote.countDocuments(filter),
      getSessionPlayer()
    ]);

    return NextResponse.json({
      success: true,
      data: { quotes: await withVoters(quotes, me), total, hasMore: offset + quotes.length < total }
    });
  } catch (error: any) {
    console.error('인성 제보 조회 오류:', error);
    return jsonError(error.message || '제보 조회 중 오류가 발생했습니다.', 500);
  }
}

type MergeResult = { status: 'merged' | 'duplicate'; quoteId: string };

/** 같은 주인공+본문 제보가 있으면 새로 만들지 않고 투표로 병합 */
async function mergeIntoExisting(
  existing: IInsungQuote,
  me: PlayerCode,
  points: number
): Promise<MergeResult> {
  const quoteId = String(existing._id);
  if (points === 0) return { status: 'duplicate', quoteId };
  if (await InsungVote.exists({ quoteId, voter: me })) return { status: 'duplicate', quoteId };
  await castVote(quoteId, me, points);
  return { status: 'merged', quoteId };
}

// 제보 등록 (+등록자가 고른 포인트로 투표, 0이면 투표 없이 등록, 중복 병합)
export async function POST(request: Request) {
  try {
    await dbConnect();
    const me = await getSessionPlayer();
    if (!me) return jsonError('로그인이 필요합니다.', 401, { requiresLogin: true });

    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const context = typeof body.context === 'string' ? body.context.trim() : '';
    const saidAt = typeof body.saidAt === 'string' && body.saidAt ? body.saidAt : undefined;
    const { author } = body;
    const points = body.points ?? INSUNG_POINT_MIN;

    if (!content) return jsonError('무슨 말이나 행동을 했는지 입력하세요.', 400);
    if (content.length > MAX_CONTENT_LENGTH) {
      return jsonError(`본문은 ${MAX_CONTENT_LENGTH}자 이하여야 합니다.`, 400);
    }
    if (!isValidPlayer(author)) return jsonError('누가 했는지 선택하세요.', 400);
    if (points !== 0 && !isValidPoints(points)) {
      return jsonError(`포인트는 0~${INSUNG_POINT_MAX} 사이여야 합니다.`, 400);
    }
    if (context.length > MAX_CONTEXT_LENGTH) {
      return jsonError(`상황 메모는 ${MAX_CONTEXT_LENGTH}자 이하여야 합니다.`, 400);
    }
    if (saidAt !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(saidAt) || Number.isNaN(Date.parse(saidAt))) {
        return jsonError('발생 날짜 형식이 올바르지 않습니다.', 400);
      }
      if (saidAt > getKstToday()) return jsonError('발생 날짜는 미래일 수 없습니다.', 400);
    }

    const normalizedContent = normalizeContent(content);
    const existing = await InsungQuote.findOne({ normalizedContent, author }).lean<IInsungQuote>();
    if (existing) {
      return NextResponse.json({ success: true, data: await mergeIntoExisting(existing, me, points) });
    }

    // 등록자 투표가 따라오면 포인트가 남는지 먼저 확인 (빈 제보가 생기지 않도록)
    if (points > 0) {
      const budget = await getPointBudget(me);
      if (points > budget.remaining) {
        return jsonError(`포인트가 부족합니다. (이번 달 남은 포인트 ${budget.remaining})`, 409, {
          code: 'insufficient_points'
        });
      }
    }

    let created;
    try {
      created = await InsungQuote.create({
        content,
        normalizedContent,
        author,
        context: context || undefined,
        saidAt,
        registrant: me,
        voteCount: 0,
        pointTotal: 0
      });
    } catch (error) {
      // 동시에 같은 제보가 등록된 경우
      if (!isDuplicateKeyError(error)) throw error;
      const raced = await InsungQuote.findOne({ normalizedContent, author }).lean<IInsungQuote>();
      if (!raced) throw error;
      return NextResponse.json({ success: true, data: await mergeIntoExisting(raced, me, points) });
    }

    // 등록자의 투표. 동시 요청으로 포인트가 모자라면 제보도 되돌림
    if (points > 0) {
      try {
        await castVote(String(created._id), me, points);
      } catch (error) {
        await InsungQuote.deleteOne({ _id: created._id });
        throw error;
      }
    }

    return NextResponse.json(
      { success: true, data: { status: 'created', quoteId: String(created._id) } },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof InsungVoteError) return jsonError(error.message, error.status, { code: error.code });
    console.error('인성 제보 등록 오류:', error);
    return jsonError(error.message || '제보 등록 중 오류가 발생했습니다.', 500);
  }
}
