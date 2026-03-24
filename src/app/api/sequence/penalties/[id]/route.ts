import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Penalty from '@/models/Penalty';
import mongoose from 'mongoose';

// DELETE: 특정 패널티 데이터 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    const { id } = await params;
    
    // ID 유효성 검사
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 패널티 ID입니다.' },
        { status: 400 }
      );
    }
    
    // 패널티 기록 조회
    const penalty = await Penalty.findById(id);
    
    // 삭제할 패널티가 없는 경우
    if (!penalty) {
      return NextResponse.json(
        { success: false, error: '해당 ID의 패널티를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 7일 지난 기록인지 확인
    const penaltyDate = new Date(penalty.createdAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - penaltyDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff >= 7) {
      return NextResponse.json(
        { success: false, error: '7일이 지난 패널티 기록은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }
    
    // 데이터베이스에서 패널티 기록 삭제
    await Penalty.findByIdAndDelete(id);
    
    return NextResponse.json(
      { success: true, message: '패널티가 삭제되었습니다.' }
    );
  } catch (error: any) {
    console.error('패널티 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '패널티를 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
