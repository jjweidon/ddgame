import { NextResponse } from 'next/server';
import Game from '@/models/Game';
import { RECORD_SUBMISSION_LOCK_MINUTES } from '@/constants/recordSubmission';

const MIN_TIME_BETWEEN_RECORDS_MS = RECORD_SUBMISSION_LOCK_MINUTES * 60 * 1000;
const RECORD_OVERRIDE_PASSWORD_ENV = 'RECORD_SUBMISSION_OVERRIDE_PASSWORD';

type GuardOk = { ok: true };
type GuardError = { ok: false; response: NextResponse };

export async function enforceRecordSubmissionLock(
  overridePassword?: string
): Promise<GuardOk | GuardError> {
  const latestGame = await Game.findOne().sort({ createdAt: -1 }).select({ createdAt: 1 });
  if (!latestGame?.createdAt) {
    return { ok: true };
  }

  const elapsedMs = Date.now() - new Date(latestGame.createdAt).getTime();
  if (elapsedMs >= MIN_TIME_BETWEEN_RECORDS_MS) {
    return { ok: true };
  }

  const expectedPassword = process.env[RECORD_OVERRIDE_PASSWORD_ENV];
  if (expectedPassword && overridePassword === expectedPassword) {
    return { ok: true };
  }

  const remainingMs = Math.max(0, MIN_TIME_BETWEEN_RECORDS_MS - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);

  return {
    ok: false,
    response: NextResponse.json(
      {
        success: false,
        requiresPassword: true,
        remainingSeconds,
        error: `마지막 기록 후 ${RECORD_SUBMISSION_LOCK_MINUTES}분 이내에는 새 기록을 저장할 수 없습니다. (${remainingSeconds}초 남음) 비밀번호를 입력하면 저장할 수 있습니다.`
      },
      { status: 403 }
    )
  };
}
