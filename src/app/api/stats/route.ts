import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Game from '@/models/Game';
import Penalty from '@/models/Penalty';
import { 
  calculatePlayerStats, 
  calculateTeamStats, 
  getSortedPlayerStats, 
  getSortedTeamStats, 
  getSortedPlayerStatsByWins,
  calculateWinrate
} from '@/utils/gameStats';
import { getTeamName } from '@/utils/teamOrder';

// GET: 게임 통계 데이터 제공
export async function GET(request: Request) {
  try {
    await dbConnect();
    
    // URL 파라미터에서 기간 정보 추출
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = searchParams.get('year');
    
    // 쿼리 조건 구성
    let query: any = {};
    
    // 연도 필터링 (우선순위: year > startDate/endDate)
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
    } else if (startDate && endDate) {
      // 한국 시간 기준으로 날짜 범위 설정
      // startDate의 00:00:00 (한국 시간) = UTC로는 전날 15:00:00
      // endDate의 23:59:59 (한국 시간) = UTC로는 다음날 14:59:59
      const startDateTime = new Date(startDate + 'T00:00:00+09:00');
      const endDateTime = new Date(endDate + 'T23:59:59+09:00');
      
      query.createdAt = {
        $gte: startDateTime,
        $lte: endDateTime
      };
    }

    // 기존 sequence 통계 하위 호환 (gameType 없는 문서 포함)
    query.$or = [{ gameType: 'sequence' }, { gameType: { $exists: false } }];
    
    const games = await Game.find(query).sort({ createdAt: -1 });
    
    // 패널티 데이터 가져오기 (같은 기간 필터 적용)
    const penalties = await Penalty.find(query).sort({ createdAt: -1 });
    
    // 통계 계산
    let playerStats, teamStats, sortedPlayerStatsByWinrate, sortedTeamStatsByWinrate, sortedPlayerStatsByWins;
    
    try {
      playerStats = calculatePlayerStats(games, penalties);
      teamStats = calculateTeamStats(games);
      
      // 정렬된 통계
      sortedPlayerStatsByWinrate = getSortedPlayerStats(playerStats);
      sortedTeamStatsByWinrate = getSortedTeamStats(teamStats);
      sortedPlayerStatsByWins = getSortedPlayerStatsByWins(playerStats);
    } catch (statsError) {
      console.error('통계 계산 오류:', statsError);
      throw new Error(`통계 계산 중 오류 발생: ${statsError instanceof Error ? statsError.message : String(statsError)}`);
    }
    
    // 포맷팅된 통계 데이터 (동위 처리 포함)
    let formattedPlayerWinrates, formattedTeamWinrates, formattedPlayerWins;
    
    try {
      formattedPlayerWinrates = sortedPlayerStatsByWinrate.reduce((acc, [player, [wins, total]], index) => {
      let rank = index + 1;
      
      // 동위 처리: 이전 항목과 비교하여 같은 값이면 같은 순위 부여
      if (index > 0) {
        const prev = sortedPlayerStatsByWinrate[index - 1];
        const prevWinrate = calculateWinrate(prev[1][0], prev[1][1]);
        const prevWins = prev[1][0];
        const prevLosses = prev[1][1] - prev[1][0];
        const currentWinrate = calculateWinrate(wins, total);
        const currentLosses = total - wins;
        
        // 승률, 승리 횟수, 패배 횟수가 모두 같으면 동위
        if (prevWinrate === currentWinrate && prevWins === wins && prevLosses === currentLosses) {
          // 이전 항목의 순위 사용
          rank = acc[acc.length - 1].rank;
        }
      }
      
      acc.push({
        rank,
        player,
        winrate: calculateWinrate(wins, total),
        wins,
        total
      });
      
      return acc;
    }, [] as Array<{ rank: number; player: string; winrate: number; wins: number; total: number }>);
    
    formattedTeamWinrates = sortedTeamStatsByWinrate.reduce((acc, [teamKey, [wins, total]], index) => {
      // 팀 키를 플레이어 배열로 변환하여 표시 이름 가져오기
      const teamPlayers = teamKey.split('').filter(p => p.trim() !== '');
      let displayName: string;
      if (teamPlayers.length !== 2) {
        console.error(`잘못된 팀 키 형식: ${teamKey}, 플레이어: ${teamPlayers}`);
        // 잘못된 형식이면 팀 키를 그대로 사용
        displayName = teamKey;
      } else {
        displayName = getTeamName(teamPlayers);
      }
      
      // 동위 처리: 이전 항목과 비교하여 같은 값이면 같은 순위 부여
      let rank = index + 1;
      if (index > 0) {
        const prev = sortedTeamStatsByWinrate[index - 1];
        const prevWinrate = calculateWinrate(prev[1][0], prev[1][1]);
        const prevWins = prev[1][0];
        const prevLosses = prev[1][1] - prev[1][0];
        const currentWinrate = calculateWinrate(wins, total);
        const currentLosses = total - wins;
        
        // 승률, 승리 횟수, 패배 횟수가 모두 같으면 동위
        if (prevWinrate === currentWinrate && prevWins === wins && prevLosses === currentLosses) {
          // 이전 항목의 순위 사용
          rank = acc[acc.length - 1].rank;
        }
      }
      
      acc.push({
        rank,
        team: displayName,
        winrate: calculateWinrate(wins, total),
        wins,
        total
      });
      
      return acc;
    }, [] as Array<{ rank: number; team: string; winrate: number; wins: number; total: number }>);
    
      formattedPlayerWins = sortedPlayerStatsByWins.map(([player, [wins, total]], index) => ({
        rank: index + 1,
        player,
        wins,
        winrate: calculateWinrate(wins, total)
      }));
    } catch (formatError) {
      console.error('통계 포맷팅 오류:', formatError);
      throw new Error(`통계 포맷팅 중 오류 발생: ${formatError instanceof Error ? formatError.message : String(formatError)}`);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        totalGames: games.length,
        playerWinrates: formattedPlayerWinrates,
        teamWinrates: formattedTeamWinrates,
        playerWins: formattedPlayerWins
      }
    });
  } catch (error) {
    console.error('통계 데이터 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '통계 데이터를 조회하는 중 오류가 발생했습니다.'
      },
      { status: 500 }
    );
  }
} 