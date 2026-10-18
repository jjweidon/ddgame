import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import InsungUser from '@/models/InsungUser';
import { isAdminPassword, isValidPlayer, jsonError } from '@/server/insung/auth';

// 관리자 비밀번호로 PIN 리셋 → 본인이 다시 설정
export async function POST(request: Request) {
  try {
    await dbConnect();
    const { player, adminPassword } = await request.json();

    if (!isValidPlayer(player)) return jsonError('유효하지 않은 이름입니다.', 400);
    if (!isAdminPassword(adminPassword)) return jsonError('관리자 비밀번호가 올바르지 않습니다.', 403);

    await InsungUser.updateOne(
      { player },
      {
        $unset: { pinHash: 1, pinSalt: 1, lockedUntil: 1 },
        $set: { failedAttempts: 0 },
        $inc: { pinVersion: 1 }
      }
    );

    return NextResponse.json({ success: true, message: 'PIN이 리셋되었습니다. 다시 설정하세요.' });
  } catch (error: any) {
    console.error('인성 PIN 리셋 오류:', error);
    return jsonError(error.message || 'PIN 리셋 중 오류가 발생했습니다.', 500);
  }
}
