import { Types } from 'mongoose';
import InsungQuote, { IInsungQuote } from '@/models/InsungQuote';
import InsungVote from '@/models/InsungVote';
import { PlayerCode } from '@/models/Game';
import { INSUNG_POINT_MAX, INSUNG_POINT_MIN, INSUNG_POINT_START_MONTH } from '@/constants/insungPoints';
import { getKstMonth, getPointBudget } from '@/server/insung/budget';

export const MAX_CONTENT_LENGTH = 500;
export const MAX_CONTEXT_LENGTH = 100;

export const normalizeContent = (content: string) => content.replace(/\s+/g, ' ').trim();

export const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export const getKstToday = () =>
  new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

/** 저장 후 잔액이 음수면(동시 요청) 되돌리기 위해 다시 확인 */
async function isOverBudget(voter: PlayerCode) {
  return (await getPointBudget(voter)).remaining < 0;
}

/**
 * 투표하거나, 이미 투표했으면 점수를 바꿈.
 * 지난달(또는 포인트제 이전) 투표의 점수를 바꾸면 이번 달 투표로 옮겨 이번 달 예산에서 전부 차감한다.
 * @returns 새 투표면 'created', 점수 변경이면 'changed', 같은 점수면 'unchanged'
 */
export async function castVote(
  quoteId: string,
  voter: PlayerCode,
  points: number
): Promise<'created' | 'changed' | 'unchanged'> {
  const month = getKstMonth();
  const existing = await InsungVote.findOne({ quoteId, voter });

  if (existing) {
    const previous = existing.points ?? 1;
    if (previous === points) return 'unchanged';

    // 이번 달 투표면 차액만, 지난 투표면 새 점수 전부가 이번 달 예산에서 나감.
    // 포인트제 이전 투표(month 없음)는 예산 계산과 같게 시작 월 투표로 본다
    const voteMonth = existing.month ?? INSUNG_POINT_START_MONTH;
    const needed = voteMonth === month ? points - previous : points;
    const budget = await getPointBudget(voter);
    if (needed > budget.remaining) throw budgetError(budget.remaining);

    await InsungVote.updateOne({ _id: existing._id }, { $set: { points, month } });
    if (await isOverBudget(voter)) {
      const restore = existing.month
        ? { $set: { points: previous, month: existing.month } }
        : { $set: { points: previous }, $unset: { month: 1 } };
      await InsungVote.updateOne({ _id: existing._id }, restore);
      throw budgetError((await getPointBudget(voter)).remaining);
    }
    await recalcQuoteTotals(quoteId);
    return 'changed';
  }

  const budget = await getPointBudget(voter);
  if (points > budget.remaining) throw budgetError(budget.remaining);

  let created;
  try {
    created = await InsungVote.create({ quoteId, voter, points, month });
  } catch (error) {
    // 동시에 두 번 눌러 이미 투표가 생긴 경우
    if (isDuplicateKeyError(error)) return castVote(quoteId, voter, points);
    throw error;
  }
  if (await isOverBudget(voter)) {
    await InsungVote.deleteOne({ _id: created._id });
    throw budgetError((await getPointBudget(voter)).remaining);
  }
  await recalcQuoteTotals(quoteId);
  return 'created';
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
