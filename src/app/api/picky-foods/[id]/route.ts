import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import PickyFood from '@/models/PickyFood';
import { isAdminPassword } from '@/server/insung/auth';

// 졸업 처리/취소
export async function PATCH(
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
    if (typeof body.graduated !== 'boolean') {
      return NextResponse.json({ success: false, error: 'graduated 값이 필요합니다.' }, { status: 400 });
    }

    const updated = await PickyFood.findByIdAndUpdate(
      id,
      { $set: { graduatedAt: body.graduated ? new Date() : null } },
      { new: true }
    ).select({ normalizedName: 0 });

    if (!updated) {
      return NextResponse.json({ success: false, error: '해당 음식을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('편식 음식 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '음식 상태를 바꾸는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

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
