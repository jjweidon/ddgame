import InsungRateLimit from '@/models/InsungRateLimit';
import { PlayerCode } from '@/models/Game';
import { jsonError } from '@/server/insung/auth';
import { isDuplicateKeyError } from '@/server/insung/quotes';
import {
  INSUNG_WRITE_LIMIT_PER_WINDOW,
  INSUNG_WRITE_LIMIT_WINDOW_SECONDS
} from '@/constants/insungPoints';

/**
 * 사용자별 쓰기 요청 제한. 넘으면 429 응답을, 아니면 null을 돌려준다.
 * 현재 윈도우 안이면 $inc 한 번, 윈도우가 지났으면 새 윈도우로 초기화한다.
 */
export async function enforceWriteRateLimit(player: PlayerCode) {
  const key = `write:${player}`;
  const now = new Date();
  const windowMs = INSUNG_WRITE_LIMIT_WINDOW_SECONDS * 1000;

  let doc = await InsungRateLimit.findOneAndUpdate(
    { key, windowStart: { $gt: new Date(now.getTime() - windowMs) } },
    { $inc: { count: 1 } },
    { new: true }
  );
  if (!doc) {
    try {
      doc = await InsungRateLimit.findOneAndUpdate(
        { key },
        { $set: { windowStart: now, count: 1 } },
        { new: true, upsert: true }
      );
    } catch (error) {
      // 동시에 첫 요청이 둘 들어온 경우: 이미 만들어진 문서에 더함
      if (!isDuplicateKeyError(error)) throw error;
      doc = await InsungRateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true });
    }
  }

  if (doc && doc.count > INSUNG_WRITE_LIMIT_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((doc.windowStart.getTime() + windowMs - now.getTime()) / 1000)
    );
    const response = jsonError(`요청이 너무 많습니다. ${retryAfterSeconds}초 후 다시 시도하세요.`, 429, {
      code: 'rate_limited',
      retryAfterSeconds
    });
    response.headers.set('Retry-After', String(retryAfterSeconds));
    return response;
  }
  return null;
}
