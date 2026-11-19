import InsungVote from '@/models/InsungVote';
import { PlayerCode } from '@/models/Game';
import {
  INSUNG_POINT_MONTHLY_GRANT,
  INSUNG_POINT_START_MONTH
} from '@/constants/insungPoints';

export type PointBudget = {
  month: string;
  granted: number;
  carriedOver: number;
  spent: number;
  remaining: number;
};

/** KST 기준 'YYYY-MM' */
export const getKstMonth = (date = new Date()) =>
  new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);

const nextMonth = (month: string) => {
  const [year, mon] = month.split('-').map(Number);
  return mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
};

/**
 * 이번 달 포인트 예산. 잔액은 저장하지 않고 시작 월부터 투표 기록으로 계산한다.
 * 포인트제 이전 투표(month 없음)는 1포인트로 시작 월에 쓴 것으로 친다.
 * 지난 투표를 취소하면 그 달 사용량이 줄어 이월로 돌아온다.
 */
export async function getPointBudget(player: PlayerCode): Promise<PointBudget> {
  const currentMonth = getKstMonth();
  const spentRows = await InsungVote.aggregate<{ _id: string; spent: number }>([
    { $match: { voter: player } },
    { $addFields: { budgetMonth: { $ifNull: ['$month', INSUNG_POINT_START_MONTH] } } },
    { $match: { budgetMonth: { $gte: INSUNG_POINT_START_MONTH, $lte: currentMonth } } },
    { $group: { _id: '$budgetMonth', spent: { $sum: { $ifNull: ['$points', 1] } } } }
  ]);
  const spentByMonth = new Map(spentRows.map((row) => [row._id, row.spent]));

  let carriedOver = 0;
  let month = INSUNG_POINT_START_MONTH;
  for (;;) {
    const spent = spentByMonth.get(month) ?? 0;
    const remaining = INSUNG_POINT_MONTHLY_GRANT + carriedOver - spent;
    if (month >= currentMonth) {
      return { month: currentMonth, granted: INSUNG_POINT_MONTHLY_GRANT, carriedOver, spent, remaining };
    }
    // 남은 포인트는 전부 이월. 음수 잔액은 다음 달로 넘기지 않는다
    carriedOver = Math.max(remaining, 0);
    month = nextMonth(month);
  }
}
