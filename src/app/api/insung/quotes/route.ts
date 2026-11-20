import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InsungQuote, { IInsungQuote } from '@/models/InsungQuote';
import InsungVote from '@/models/InsungVote';
import { PlayerCode } from '@/models/Game';
import { getSessionPlayer, isValidPlayer, jsonError } from '@/server/insung/auth';
import { INSUNG_POINT_MAX, INSUNG_POINT_MIN } from '@/constants/insungPoints';
import { getPointBudget } from '@/server/insung/budget';
import { enforceWriteRateLimit } from '@/server/insung/rateLimit';
import {
  castVote,
  InsungVoteError,
  isDuplicateKeyError,
  isValidPoints,
  parseQuoteFields,
  POINT_TOTAL_EXPR,
  withVoters
} from '@/server/insung/quotes';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

// 제보 목록: ?author=&sort=latest|top&voted=me|<이름코드>&limit=&offset=
export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const author = searchParams.get('author');
    const sort = searchParams.get('sort') === 'top' ? 'top' : 'latest';
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    if (author && !isValidPlayer(author)) return jsonError('유효하지 않은 주인공입니다.', 400);

    const me = await getSessionPlayer();

    // ?voted=: 그 사람이 투표한 제보 (투표 이력)
    const voted = searchParams.get('voted');
    if (voted) {
      if (voted === 'me' && !me) return jsonError('로그인이 필요합니다.', 401, { requiresLogin: true });
      const voter = voted === 'me' ? me : voted;
      if (!isValidPlayer(voter)) return jsonError('유효하지 않은 이름입니다.', 400);
      return NextResponse.json({ success: true, data: await votedQuotes(voter, me, sort, offset, limit) });
    }

    const filter: Record<string, unknown> = author ? { author } : {};
    const sortSpec: Record<string, 1 | -1> =
      sort === 'top' ? { score: -1, createdAt: 1 } : { createdAt: -1 };

    const [quotes, total] = await Promise.all([
      InsungQuote.aggregate<IInsungQuote>([
        { $match: filter },
        { $addFields: { score: POINT_TOTAL_EXPR } },
        { $sort: sortSpec },
        { $skip: offset },
        { $limit: limit }
      ]),
      InsungQuote.countDocuments(filter)
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

/**
 * 한 사람이 투표한 제보. top은 준 점수순, latest는 투표한 순 (동점이면 최근 투표가 위).
 * 5명이 쓰는 앱이라 그 사람의 투표를 전부 읽어 정렬한 뒤 페이지만큼 제보를 불러온다.
 */
async function votedQuotes(voter: PlayerCode, me: PlayerCode | null, sort: 'top' | 'latest', offset: number, limit: number) {
  const votes = await InsungVote.find({ voter }).select({ quoteId: 1, points: 1, createdAt: 1 }).lean();
  const rows = votes.map((vote) => ({
    quoteId: String(vote.quoteId),
    points: vote.points ?? 1,
    votedAt: new Date(vote.createdAt).getTime()
  }));
  rows.sort((a, b) => (sort === 'top' && b.points !== a.points ? b.points - a.points : b.votedAt - a.votedAt));

  const page = rows.slice(offset, offset + limit);
  const found = await InsungQuote.find({ _id: { $in: page.map((row) => row.quoteId) } }).lean<IInsungQuote[]>();
  const byId = new Map(found.map((quote) => [String(quote._id), quote]));
  const ordered = page.map((row) => byId.get(row.quoteId)).filter((quote): quote is IInsungQuote => Boolean(quote));
  const pointsById = new Map(page.map((row) => [row.quoteId, row.points]));

  return {
    quotes: (await withVoters(ordered, me)).map((quote) => ({ ...quote, voterPoints: pointsById.get(quote._id) ?? 0 })),
    total: rows.length,
    hasMore: offset + page.length < rows.length
  };
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
    const limited = await enforceWriteRateLimit(me);
    if (limited) return limited;

    const body = await request.json();
    const parsed = parseQuoteFields(body);
    if ('error' in parsed) return jsonError(parsed.error, 400);
    const { content, normalizedContent, author, context, saidAt } = parsed.fields;
    const points = body.points ?? INSUNG_POINT_MIN;
    if (points !== 0 && !isValidPoints(points)) {
      return jsonError(`포인트는 0~${INSUNG_POINT_MAX} 사이여야 합니다.`, 400);
    }

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
        context,
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
