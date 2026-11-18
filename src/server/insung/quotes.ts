import { Types } from 'mongoose';
import InsungQuote, { IInsungQuote } from '@/models/InsungQuote';
import InsungVote from '@/models/InsungVote';
import { PlayerCode } from '@/models/Game';
import { INSUNG_POINT_MAX, INSUNG_POINT_MIN } from '@/constants/insungPoints';
import { getKstMonth, getPointBudget, PointBudget } from '@/server/insung/budget';
import { isValidPlayer } from '@/server/insung/auth';

export const MAX_CONTENT_LENGTH = 500;
export const MAX_CONTEXT_LENGTH = 100;

export const normalizeContent = (content: string) => content.replace(/\s+/g, ' ').trim();

export const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export const getKstToday = () =>
  new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

export type QuoteFields = {
  content: string;
  normalizedContent: string;
  author: PlayerCode;
  context?: string;
  saidAt?: string;
};

/** 등록·수정 공용 입력 검증. 실패하면 error 메시지 */
export function parseQuoteFields(body: Record<string, unknown>): { fields: QuoteFields } | { error: string } {
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const context = typeof body.context === 'string' ? body.context.trim() : '';
  const saidAt = typeof body.saidAt === 'string' && body.saidAt ? body.saidAt : undefined;
  const { author } = body;

  if (!content) return { error: '무슨 말이나 행동을 했는지 입력하세요.' };
  if (content.length > MAX_CONTENT_LENGTH) return { error: `본문은 ${MAX_CONTENT_LENGTH}자 이하여야 합니다.` };
  if (!isValidPlayer(author)) return { error: '누가 했는지 선택하세요.' };
  if (context.length > MAX_CONTEXT_LENGTH) return { error: `상황 메모는 ${MAX_CONTEXT_LENGTH}자 이하여야 합니다.` };
  if (saidAt !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saidAt) || Number.isNaN(Date.parse(saidAt))) {
      return { error: '발생 날짜 형식이 올바르지 않습니다.' };
    }
    if (saidAt > getKstToday()) return { error: '발생 날짜는 미래일 수 없습니다.' };
  }

  return {
    fields: {
      content,
      normalizedContent: normalizeContent(content),
      author,
      context: context || undefined,
      saidAt
    }
  };
}

export const isValidPoints = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= INSUNG_POINT_MIN && (value as number) <= INSUNG_POINT_MAX;

/** 포인트 합. pointTotal이 없는 포인트제 이전 문서는 득표 수 = 포인트 합 */
export const POINT_TOTAL_EXPR = { $ifNull: ['$pointTotal', '$voteCount'] };

/** 투표 규칙 위반. API에서 status와 message로 응답 */
export class InsungVoteError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

const budgetError = (remaining: number) =>
  new InsungVoteError(`포인트가 부족합니다. (이번 달 남은 포인트 ${remaining})`, 409, 'insufficient_points');

/** 제보의 득표 수·포인트 합을 투표 기록에서 다시 계산 ($inc 누적 오차 방지) */
export async function recalcQuoteTotals(quoteId: string) {
  const [row] = await InsungVote.aggregate<{ voteCount: number; pointTotal: number }>([
    { $match: { quoteId: new Types.ObjectId(quoteId) } },
    { $group: { _id: null, voteCount: { $sum: 1 }, pointTotal: { $sum: { $ifNull: ['$points', 1] } } } }
  ]);
  await InsungQuote.updateOne(
    { _id: quoteId },
    { $set: { voteCount: row?.voteCount ?? 0, pointTotal: row?.pointTotal ?? 0 } }
  );
}

export type CastVoteResult = {
  status: 'created' | 'changed' | 'unchanged';
  budget: PointBudget;
};

/**
 * 투표하거나, 이미 투표했으면 점수를 바꿈.
 * 지난달(또는 포인트제 이전) 투표의 점수를 바꾸면 이번 달 투표로 옮겨 이번 달 예산에서 전부 차감한다.
 * 먼저 저장하고 잔액을 한 번만 계산해서, 음수면(잔액 부족·동시 요청) 되돌린다.
 */
export async function castVote(quoteId: string, voter: PlayerCode, points: number): Promise<CastVoteResult> {
  const month = getKstMonth();
  const existing = await InsungVote.findOne({ quoteId, voter });

  if (existing) {
    const previous = existing.points ?? 1;
    if (previous === points) return { status: 'unchanged', budget: await getPointBudget(voter) };

    await InsungVote.updateOne({ _id: existing._id }, { $set: { points, month } });
    const budget = await getPointBudget(voter);
    if (budget.remaining < 0) {
      const restore = existing.month
        ? { $set: { points: previous, month: existing.month } }
        : { $set: { points: previous }, $unset: { month: 1 } };
      await InsungVote.updateOne({ _id: existing._id }, restore);
      throw budgetError((await getPointBudget(voter)).remaining);
    }
    await recalcQuoteTotals(quoteId);
    return { status: 'changed', budget };
  }

  let created;
  try {
    created = await InsungVote.create({ quoteId, voter, points, month });
  } catch (error) {
    // 동시에 두 번 눌러 이미 투표가 생긴 경우
    if (isDuplicateKeyError(error)) return castVote(quoteId, voter, points);
    throw error;
  }
  const budget = await getPointBudget(voter);
  if (budget.remaining < 0) {
    await InsungVote.deleteOne({ _id: created._id });
    throw budgetError(budget.remaining + points);
  }
  await recalcQuoteTotals(quoteId);
  return { status: 'created', budget };
}

/** 투표 취소. 언제 한 투표든 취소 가능하며, 포인트는 투표했던 달로 돌아감. @returns 취소된 투표가 있으면 true */
export async function removeVote(quoteId: string, voter: PlayerCode): Promise<boolean> {
  const result = await InsungVote.deleteOne({ quoteId, voter });
  if (result.deletedCount === 0) return false;
  await recalcQuoteTotals(quoteId);
  return true;
}

/** 제보 삭제. 그 제보에 준 포인트는 모두 돌려줌 */
export async function deleteQuote(quoteId: string) {
  await InsungVote.deleteMany({ quoteId });
  await InsungQuote.deleteOne({ _id: quoteId });
}

/** 제보 목록에 투표자별 포인트와 내 투표 상태를 붙여서 응답용으로 변환 */
export async function withVoters(quotes: IInsungQuote[], me: PlayerCode | null) {
  const ids = quotes.map((q) => q._id);
  const votes = await InsungVote.find({ quoteId: { $in: ids } })
    .sort({ createdAt: 1 })
    .select({ quoteId: 1, voter: 1, points: 1 })
    .lean();

  const votesByQuote = new Map<string, typeof votes>();
  votes.forEach((vote) => {
    const key = String(vote.quoteId);
    if (!votesByQuote.has(key)) votesByQuote.set(key, []);
    votesByQuote.get(key)?.push(vote);
  });

  return quotes.map((quote) => {
    const quoteVotes = votesByQuote.get(String(quote._id)) || [];
    const myVote = me ? quoteVotes.find((vote) => vote.voter === me) : undefined;
    return {
      _id: String(quote._id),
      content: quote.content,
      author: quote.author,
      context: quote.context,
      saidAt: quote.saidAt,
      registrant: quote.registrant,
      voteCount: quote.voteCount,
      pointTotal: quote.pointTotal ?? quote.voteCount,
      createdAt: quote.createdAt,
      voters: quoteVotes.map((vote) => ({ player: vote.voter, points: vote.points ?? 1 })),
      myPoints: myVote ? myVote.points ?? 1 : 0
    };
  });
}
