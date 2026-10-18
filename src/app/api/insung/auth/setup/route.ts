import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InsungUser from '@/models/InsungUser';
import { hashPin, isValidPlayer, jsonError, PIN_PATTERN, setSessionCookie } from '@/server/insung/auth';
import { isDuplicateKeyError } from '@/server/insung/quotes';

// 최초 PIN 설정 (아직 PIN이 없는 이름만)
export async function POST(request: Request) {
  try {
    await dbConnect();
    const { player, pin } = await request.json();

    if (!isValidPlayer(player)) return jsonError('유효하지 않은 이름입니다.', 400);
    if (typeof pin !== 'string' || !PIN_PATTERN.test(pin)) {
      return jsonError('PIN은 숫자 4자리여야 합니다.', 400);
    }

    const { pinHash, pinSalt } = hashPin(pin);
    let user;
    try {
      // pinHash가 없는 문서만 갱신 → 이미 PIN이 있으면 upsert가 unique 충돌로 실패
      user = await InsungUser.findOneAndUpdate(
        { player, pinHash: { $exists: false } },
        {
          $set: { pinHash, pinSalt, failedAttempts: 0 },
          $unset: { lockedUntil: 1 },
          $inc: { pinVersion: 1 }
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) return jsonError('이미 PIN이 설정된 이름입니다.', 409);
      throw error;
    }

    const response = NextResponse.json({ success: true, data: { me: player } });
    setSessionCookie(response, player, user.pinVersion);
    return response;
  } catch (error: any) {
    console.error('인성 PIN 설정 오류:', error);
    return jsonError(error.message || 'PIN 설정 중 오류가 발생했습니다.', 500);
  }
}
