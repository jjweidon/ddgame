import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Penalty from '@/models/Penalty';

// GET: 모든 패널티 데이터 조회
export async function GET(request: Request) {
  try {
    await dbConnect();
    
    // URL 파라미터에서 연도 정보 추출
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    
    // 쿼리 조건 구성
    const query: any = {};
    
    if (year) {
      const yearNum = parseInt(year);
      if (!isNaN(yearNum)) {
        // 해당 연도의 시작일과 종료일 설정 (한국 시간 기준)
        const startDateTime = new Date(`${yearNum}-01-01T00:00:00+09:00`);
        const endDateTime = new Date(`${yearNum}-12-31T23:59:59+09:00`);
        
        query.createdAt = {
          $gte: startDateTime,
          $lte: endDateTime
        };
      }
    }
    
    const penalties = await Penalty.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: penalties });
  } catch (error) {
    console.error('패널티 데이터 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '패널티 데이터를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 패널티 데이터 저장
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { player, reason } = body;
    
    // 필수 필드 확인
    if (!player) {
      return NextResponse.json(
        { success: false, error: '플레이어 정보가 필요합니다.' },
        { status: 400 }
      );
    }
    
    // 유효한 플레이어 검사
    const validPlayers = ['잡', '큐', '지', '머', '웅'];
    if (!validPlayers.includes(player)) {
      return NextResponse.json(
        { success: false, error: `유효하지 않은 플레이어: ${player}` },
        { status: 400 }
      );
    }
    
    await dbConnect();
    
    const newPenalty = await Penalty.create({
      player,
      reason: reason || undefined
    });
    
    return NextResponse.json(
      { success: true, data: newPenalty },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('패널티 데이터 저장 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '패널티 데이터를 저장하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
