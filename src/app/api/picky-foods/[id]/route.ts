import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import PickyFood from '@/models/PickyFood';
import { isAdminPassword } from '@/server/insung/auth';

// 삭제: 관리자 비밀번호 필요
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    if (!isAdminPassword(body.adminPassword)) {
      return NextResponse.json(
        { success: false, error: '관리자 비밀번호가 올바르지 않습니다.' },
        { status: 403 }
      );
    }

    const deleted = await PickyFood.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: '해당 음식을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: '삭제되었습니다.' });
  } catch (error: any) {
    console.error('편식 음식 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '음식을 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
