import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Game from '@/models/Game';
import { calculateRecapStats } from '@/utils/recapStats';

// GET: 해당 연도의 Recap 통계 데이터 제공
export async function GET(
  request: Request,
  { params }: { params: Promise<{ year: string }> }
) {
  try {
    await dbConnect();
    
    const { year: yearParam } = await params;
    const year = parseInt(yearParam);
    
    if (isNaN(year)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 연도입니다.' },
        { status: 400 }
      );
    }
    
    // 해당 연도의 게임 데이터 조회 (한국 시간 기준)
    const startDateTime = new Date(`${year}-01-01T00:00:00+09:00`);
    const endDateTime = new Date(`${year}-12-31T23:59:59+09:00`);
    
    const games = await Game.find({
      createdAt: {
        $gte: startDateTime,
        $lte: endDateTime
      }
    }).sort({ createdAt: 1 });
    
    if (games.length === 0) {
      return NextResponse.json(
        { success: false, error: '해당 연도의 게임 데이터가 없습니다.' },
        { status: 404 }
      );
    }
    
    // Recap 통계 계산
    const recapStats = calculateRecapStats(games, year);
    
    if (!recapStats) {
      return NextResponse.json(
        { success: false, error: '통계 계산 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: recapStats
    });
  } catch (error) {
    console.error('Recap 데이터 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: 'Recap 데이터를 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
