import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Game from '@/models/Game';
import mongoose from 'mongoose';

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
        { error: '유효하지 않은 게임 ID입니다.' },
        { status: 400 }
      );
    }
    
    // 게임 기록 조회
    const game = await Game.findById(id);
    
    // 삭제할 게임이 없는 경우
    if (!game) {
      return NextResponse.json(
        { error: '해당 ID의 게임을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    // 7일 지난 기록인지 확인
    const gameDate = new Date(game.createdAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff >= 7) {
      return NextResponse.json(
        { error: '7일이 지난 게임 기록은 삭제할 수 없습니다.' },
        { status: 403 }
      );
    }
    
    // 데이터베이스에서 게임 기록 삭제
    await Game.findByIdAndDelete(id);
    
    return NextResponse.json(
      { success: true, message: '게임 기록이 성공적으로 삭제되었습니다.' },
      { status: 200 }
    );
    
  } catch (error) {
    console.error('게임 기록 삭제 오류:', error);
    return NextResponse.json(
      { error: '서버 오류로 게임 기록을 삭제할 수 없습니다.' },
      { status: 500 }
    );
  }
}
