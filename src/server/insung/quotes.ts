import InsungQuote, { IInsungQuote } from '@/models/InsungQuote';
import InsungVote from '@/models/InsungVote';
import { PlayerCode } from '@/models/Game';

export const MAX_CONTENT_LENGTH = 500;
export const MAX_CONTEXT_LENGTH = 100;

export const normalizeContent = (content: string) => content.replace(/\s+/g, ' ').trim();

export const isDuplicateKeyError = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export const getKstToday = () =>
  new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * 투표 추가. 본인 멘트 투표는 호출 전에 막을 것.
 * @returns 새로 투표했으면 true, 이미 투표했으면 false
 */
export async function addVote(quoteId: string, voter: PlayerCode): Promise<boolean> {
  try {
    await InsungVote.create({ quoteId, voter });
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
  await InsungQuote.updateOne({ _id: quoteId }, { $inc: { voteCount: 1 } });
  return true;
}

/** @returns 취소된 투표가 있으면 true */
export async function removeVote(quoteId: string, voter: PlayerCode): Promise<boolean> {
  const result = await InsungVote.deleteOne({ quoteId, voter });
  if (result.deletedCount === 0) return false;
  await InsungQuote.updateOne({ _id: quoteId, voteCount: { $gt: 0 } }, { $inc: { voteCount: -1 } });
  return true;
}

/** 멘트 목록에 투표자 목록과 내 투표 여부를 붙여서 응답용으로 변환 */
export async function withVoters(quotes: IInsungQuote[], me: PlayerCode | null) {
  const ids = quotes.map((q) => q._id);
  const votes = await InsungVote.find({ quoteId: { $in: ids } })
    .sort({ createdAt: 1 })
    .select({ quoteId: 1, voter: 1 })
    .lean();

  const votersByQuote = new Map<string, PlayerCode[]>();
  votes.forEach((vote) => {
    const key = String(vote.quoteId);
    if (!votersByQuote.has(key)) votersByQuote.set(key, []);
    votersByQuote.get(key)?.push(vote.voter);
  });

  return quotes.map((quote) => {
    const voters = votersByQuote.get(String(quote._id)) || [];
    return {
      _id: String(quote._id),
      content: quote.content,
      author: quote.author,
      context: quote.context,
      saidAt: quote.saidAt,
      registrant: quote.registrant,
      voteCount: quote.voteCount,
      createdAt: quote.createdAt,
      voters,
      myVote: me ? voters.includes(me) : false
    };
  });
}
