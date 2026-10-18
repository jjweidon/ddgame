import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InsungUser from '@/models/InsungUser';
import {
  isValidPlayer,
  jsonError,
  MAX_PIN_FAILURES,
  PIN_LOCK_MINUTES,
  PIN_PATTERN,
  setSessionCookie,
  verifyPin
} from '@/server/insung/auth';

// PIN 로그인 (연속 실패 시 잠금)
export async function POST(request: Request) {
  try {
    await dbConnect();
    const { player, pin } = await request.json();

    if (!isValidPlayer(player)) return jsonError('유효하지 않은 이름입니다.', 400);
    if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
      return jsonError('PIN은 숫자 4자리여야 합니다.', 400);
    }

    const user = await InsungUser.findOne({ player });
    if (!user?.pinHash || !user.pinSalt) {
      return jsonError('아직 PIN이 설정되지 않은 이름입니다.', 404, { requiresSetup: true });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const remainingSeconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      return jsonError(
        `PIN을 ${MAX_PIN_FAILURES}회 틀려 잠겼습니다. ${Math.ceil(remainingSeconds / 60)}분 후 다시 시도하세요.`,
        423,
        { remainingSeconds }
      );
    }

    if (!verifyPin(pin, user.pinHash, user.pinSalt)) {
      const failedAttempts = (user.failedAttempts || 0) + 1;
      if (failedAttempts >= MAX_PIN_FAILURES) {
        user.failedAttempts = 0;
        user.lockedUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60 * 1000);
        await user.save();
        return jsonError(`PIN을 ${MAX_PIN_FAILURES}회 틀려 ${PIN_LOCK_MINUTES}분간 잠겼습니다.`, 423);
      }
      user.failedAttempts = failedAttempts;
      await user.save();
      return jsonError(`PIN이 올바르지 않습니다. (${failedAttempts}/${MAX_PIN_FAILURES})`, 401);
    }

    user.failedAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();

    const response = NextResponse.json({ success: true, data: { me: player } });
    setSessionCookie(response, player, user.pinVersion);
    return response;
  } catch (error: any) {
    console.error('인성 로그인 오류:', error);
    return jsonError(error.message || '로그인 중 오류가 발생했습니다.', 500);
  }
}
