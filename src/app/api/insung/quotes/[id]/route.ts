import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import InsungQuote from '@/models/InsungQuote';
import InsungVote from '@/models/InsungVote';
import { getSessionPlayer, isAdminPassword, jsonError } from '@/server/insung/auth';

// 멘트 삭제: 등록자 본인 또는 관리자 비밀번호
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return jsonError('유효하지 않은 멘트 ID입니다.', 400);

    const body = await request.json().catch(() => ({}));
    const quote = await InsungQuote.findById(id).select({ registrant: 1 });
    if (!quote) return jsonError('해당 멘트를 찾을 수 없습니다.', 404);

    const me = await getSessionPlayer();
    const isRegistrant = me !== null && quote.registrant === me;
    if (!isRegistrant && !isAdminPassword(body.adminPassword)) {
      return jsonError('등록자 본인이거나 관리자 비밀번호가 필요합니다.', 403, { requiresAdmin: true });
    }

    await InsungVote.deleteMany({ quoteId: id });
    await InsungQuote.deleteOne({ _id: id });

    return NextResponse.json({ success: true, message: '멘트가 삭제되었습니다.' });
  } catch (error: any) {
    console.error('인성 멘트 삭제 오류:', error);
    return jsonError(error.message || '멘트 삭제 중 오류가 발생했습니다.', 500);
  }
}
