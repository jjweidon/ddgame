import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InsungQuote, { IInsungQuote } from '@/models/InsungQuote';
import { PlayerCode } from '@/models/Game';
import { getSessionPlayer, isValidPlayer, jsonError } from '@/server/insung/auth';
import {
  addVote,
  getKstToday,
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
      sort === 'top' ? { voteCount: -1, createdAt: 1 } : { createdAt: -1 };

    const [quotes, total, me] = await Promise.all([
      InsungQuote.find(filter).sort(sortSpec).skip(offset).limit(limit).lean<IInsungQuote[]>(),
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
  me: PlayerCode
): Promise<MergeResult> {
  const quoteId = String(existing._id);
  if (existing.author === me) return { status: 'duplicate', quoteId };
  const voted = await addVote(quoteId, me);
  return { status: voted ? 'merged' : 'duplicate', quoteId };
}

// 제보 등록 (+등록자 자동 투표, 중복 병합)
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

    if (!content) return jsonError('무슨 말이나 행동을 했는지 입력하세요.', 400);
    if (content.length > MAX_CONTENT_LENGTH) {
      return jsonError(`본문은 ${MAX_CONTENT_LENGTH}자 이하여야 합니다.`, 400);
    }
    if (!isValidPlayer(author)) return jsonError('누가 했는지 선택하세요.', 400);
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
      return NextResponse.json({ success: true, data: await mergeIntoExisting(existing, me) });
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
        voteCount: 0
      });
    } catch (error) {
      // 동시에 같은 제보가 등록된 경우
      if (!isDuplicateKeyError(error)) throw error;
      const raced = await InsungQuote.findOne({ normalizedContent, author }).lean<IInsungQuote>();
      if (!raced) throw error;
      return NextResponse.json({ success: true, data: await mergeIntoExisting(raced, me) });
    }

    // 등록 = 등록자의 투표 1개 (자수는 0점 시작)
    if (author !== me) await addVote(String(created._id), me);

    return NextResponse.json(
      { success: true, data: { status: 'created', quoteId: String(created._id) } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('인성 제보 등록 오류:', error);
    return jsonError(error.message || '제보 등록 중 오류가 발생했습니다.', 500);
  }
}
