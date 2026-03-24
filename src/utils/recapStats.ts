import { IGame } from '../models/Game';
import { calculatePlayerStats, calculateTeamStats, getSortedPlayerStats, getSortedTeamStats, calculateWinrate } from './gameStats';
import { getTeamKey, getTeamName } from './teamOrder';

const getValidTeamKey = (team?: string[]): string | null => {
  if (!Array.isArray(team) || team.length !== 2) return null;
  return getTeamKey(team);
};

// 플레이어별 게임 기록 분석
export const analyzePlayerGames = (player: string, allGames: IGame[]) => {
  const sortedGames = [...allGames].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const playerGames: Array<{ game: IGame; isWin: boolean }> = [];
  
  sortedGames.forEach(game => {
    const isWin = Array.isArray(game.winningTeam) && game.winningTeam.includes(player);
    const isLose = Array.isArray(game.losingTeam) && game.losingTeam.includes(player);
    
    if (isWin || isLose) {
      playerGames.push({
        game,
        isWin
      });
    }
  });

  return playerGames;
};

// 최대 연승/연패 계산 (전체 기간)
export const calculateMaxStreak = (playerGames: Array<{ game: IGame; isWin: boolean }>) => {
  if (playerGames.length === 0) {
    return { maxWinStreak: 0, maxLoseStreak: 0, maxWinStreakGame: null, maxLoseStreakGame: null };
  }

  let maxWinStreak = 0;
  let maxLoseStreak = 0;
  let currentWinStreak = 0;
  let currentLoseStreak = 0;
  let maxWinStreakGame: IGame | null = null;
  let maxLoseStreakGame: IGame | null = null;

  playerGames.forEach(({ game, isWin }) => {
    if (isWin) {
      currentWinStreak++;
      currentLoseStreak = 0;
      if (currentWinStreak > maxWinStreak) {
        maxWinStreak = currentWinStreak;
        maxWinStreakGame = game;
      }
    } else {
      currentLoseStreak++;
      currentWinStreak = 0;
      if (currentLoseStreak > maxLoseStreak) {
        maxLoseStreak = currentLoseStreak;
        maxLoseStreakGame = game;
      }
    }
  });

  return { maxWinStreak, maxLoseStreak, maxWinStreakGame, maxLoseStreakGame };
};

// 팀별 게임 기록 분석
export const analyzeTeamGames = (team: string[], allGames: IGame[]) => {
  const sortedGames = [...allGames].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const teamGames: Array<{ game: IGame; isWin: boolean }> = [];
  const teamKey = getTeamKey(team);
  
  sortedGames.forEach(game => {
    const winningTeamKey = getValidTeamKey(game.winningTeam);
    const losingTeamKey = getValidTeamKey(game.losingTeam);
    
    if (winningTeamKey === teamKey) {
      teamGames.push({ game, isWin: true });
    } else if (losingTeamKey === teamKey) {
      teamGames.push({ game, isWin: false });
    }
  });

  return teamGames;
};

// 주차 계산 함수 (한국 시간 기준, 월요일을 주의 시작으로)
const getWeekOfYear = (date: Date): { year: number; month: number; week: number; startDate: Date; endDate: Date } => {
  const koreaDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
  const year = koreaDate.getFullYear();
  const month = koreaDate.getMonth() + 1;
  const dayOfMonth = koreaDate.getDate();
  const dayOfWeek = koreaDate.getDay(); // 0 (일) ~ 6 (토)
  
  // 월요일을 주의 시작으로 계산 (일요일이면 -6, 아니면 1 - dayOfWeek)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStartDate = new Date(year, month - 1, dayOfMonth + mondayOffset);
  weekStartDate.setHours(0, 0, 0, 0);
  
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  weekEndDate.setHours(23, 59, 59, 999);
  
  // 해당 월의 첫 번째 월요일 찾기
  const firstDay = new Date(year, month - 1, 1);
  const firstDayOfWeek = firstDay.getDay();
  const firstMondayDate = firstDayOfWeek === 0 
    ? 2  // 일요일이면 다음 날(월요일)
    : firstDayOfWeek === 1 
    ? 1  // 월요일이면 1일
    : 9 - firstDayOfWeek; // 그 외에는 다음 월요일
  
  // 해당 날짜가 속한 주가 그 달의 몇 번째 주인지 계산
  const weekNumber = Math.max(1, Math.floor((dayOfMonth - firstMondayDate) / 7) + 1);
  
  return { year, month, week: weekNumber, startDate: weekStartDate, endDate: weekEndDate };
};

// 기간별 통계 계산 (연속 플레이 기준)
export const calculatePeriodStats = (games: IGame[]) => {
  if (games.length === 0) return [];

  const sortedGames = [...games].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // 게임들을 연속 플레이 기준으로 그룹화
  // 1주일(7일) 이상 간격이 있으면 새로운 기간으로 구분
  const periods: IGame[][] = [];
  let currentPeriod: IGame[] = [];
  let lastGameDate: Date | null = null;
  
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  
  sortedGames.forEach((game, index) => {
    const gameDate = new Date(game.createdAt);
    
    if (index === 0) {
      // 첫 게임
      currentPeriod = [game];
      lastGameDate = gameDate;
    } else if (lastGameDate) {
      const daysDiff = gameDate.getTime() - lastGameDate.getTime();
      
      if (daysDiff > ONE_WEEK_MS) {
        // 1주일 이상 간격이 있으면 새로운 기간 시작
        periods.push(currentPeriod);
        currentPeriod = [game];
      } else {
        // 연속된 플레이
        currentPeriod.push(game);
      }
      lastGameDate = gameDate;
    }
  });
  
  // 마지막 기간 추가
  if (currentPeriod.length > 0) {
    periods.push(currentPeriod);
  }

  // 각 기간별 통계 계산
  const periodStats: Array<{
    periodKey: string;
    year: number;
    month: number;
    week: number;
    startDate: Date;
    endDate: Date;
    periodRanks: { [player: string]: number };
    cumulativeRanks: { [player: string]: number };
    games: IGame[];
  }> = [];

  const cumulativeGames: IGame[] = [];
  const validPlayers = ['잡', '큐', '지', '머', '웅'];

  periods.forEach((periodGames, index) => {
    if (periodGames.length === 0) return;
    
    // 기간의 시작일과 종료일 (한국 시간 기준으로 날짜만 추출)
    const getKoreaDateString = (date: Date) => {
      // createdAt이 UTC로 저장되어 있으므로, 한국 시간(UTC+9)으로 변환
      const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
      // 한국 시간 기준으로 날짜만 추출 (YYYY-MM-DD 형식)
      const year = koreaTime.getUTCFullYear();
      const month = String(koreaTime.getUTCMonth() + 1).padStart(2, '0');
      const day = String(koreaTime.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // 기간 내의 모든 게임 날짜를 한국 시간으로 변환하여 최소/최대 날짜 찾기
    const koreaDateStrings = periodGames.map(game => getKoreaDateString(new Date(game.createdAt)));
    const minDateString = koreaDateStrings.sort()[0];
    const maxDateString = koreaDateStrings.sort()[koreaDateStrings.length - 1];
    
    // 날짜 문자열을 Date 객체로 변환 (한국 시간 기준, UTC로 저장)
    const parseKoreaDate = (dateString: string): Date => {
      const [year, month, day] = dateString.split('-').map(Number);
      // 한국 시간 00:00:00을 UTC로 변환 (한국 시간 = UTC+9)
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (9 * 60 * 60 * 1000));
    };
    
    const koreaStartDate = parseKoreaDate(minDateString);
    const koreaEndDate = parseKoreaDate(maxDateString);
    
    const year = koreaStartDate.getFullYear();
    const month = koreaStartDate.getMonth() + 1;
    const periodKey = `period-${index + 1}`;
    
    // 해당 기간의 등수
    const periodPlayerStats = calculatePlayerStats(periodGames);
    const periodSortedPlayers = getSortedPlayerStats(periodPlayerStats);
    const periodRankMap = new Map<string, number>();
    periodSortedPlayers.forEach(([player], idx) => {
      periodRankMap.set(player, idx + 1);
    });
    
    const periodRanks: { [player: string]: number } = {};
    validPlayers.forEach(player => {
      periodRanks[player] = periodRankMap.get(player) || 5;
    });

    // 누적 등수
    cumulativeGames.push(...periodGames);
    const cumulativePlayerStats = calculatePlayerStats(cumulativeGames);
    const cumulativeSortedPlayers = getSortedPlayerStats(cumulativePlayerStats);
    const cumulativeRankMap = new Map<string, number>();
    cumulativeSortedPlayers.forEach(([player], idx) => {
      cumulativeRankMap.set(player, idx + 1);
    });
    
    const cumulativeRanks: { [player: string]: number } = {};
    validPlayers.forEach(player => {
      cumulativeRanks[player] = cumulativeRankMap.get(player) || 5;
    });

    periodStats.push({
      periodKey,
      year,
      month,
      week: index + 1, // 기간 번호
      startDate: koreaStartDate,
      endDate: koreaEndDate,
      periodRanks,
      cumulativeRanks,
      games: periodGames
    });
  });

  return periodStats;
};

// 기간 묶음 기준 플레이어 등수 비교
export const calculateRankChange = (periodStats: Array<{
  periodKey: string;
  year: number;
  month: number;
  week: number;
  startDate: Date;
  endDate: Date;
  periodRanks: { [player: string]: number };
  cumulativeRanks: { [player: string]: number };
  games: IGame[];
}>) => {
  if (periodStats.length === 0) {
    return { 
      rankChanges: {}, 
      firstPeriod: null, 
      lastPeriod: null 
    };
  }

  // 첫 기간과 마지막 기간
  const sortedPeriods = periodStats.slice().sort((a, b) => {
    const dateA = typeof a.startDate === 'string' ? new Date(a.startDate) : a.startDate;
    const dateB = typeof b.startDate === 'string' ? new Date(b.startDate) : b.startDate;
    return dateA.getTime() - dateB.getTime();
  });

  const firstPeriod = sortedPeriods[0];
  const lastPeriod = sortedPeriods[sortedPeriods.length - 1];

  // 등수 변동 계산 (기간별 순서대로 비교하여 전 기간 대비 이후 기간의 변동 계산)
  const rankChanges: { 
    [player: string]: { 
      best: number;  // 최고 등수 (낮은 숫자 = 높은 등수)
      worst: number; // 최저 등수 (높은 숫자 = 낮은 등수)
      change: number; // best - worst (양수면 상승, 음수면 하락)
      bestPeriod: typeof firstPeriod | null;
      worstPeriod: typeof firstPeriod | null;
      // 하위 호환성을 위한 필드
      early: number;
      late: number;
      earlyPeriod: typeof firstPeriod | null;
      latePeriod: typeof lastPeriod | null;
    } 
  } = {};
  const validPlayers = ['잡', '큐', '지', '머', '웅'];
  
  validPlayers.forEach(player => {
    // 기간별 순서대로 비교하여 가장 큰 변동 찾기
    let maxRise = 0; // 최대 상승폭 (양수)
    let maxFall = 0; // 최대 하락폭 (음수)
    let riseFromPeriod: typeof firstPeriod | null = null;
    let riseToPeriod: typeof firstPeriod | null = null;
    let fallFromPeriod: typeof firstPeriod | null = null;
    let fallToPeriod: typeof firstPeriod | null = null;
    
    // 연속된 기간 쌍을 비교 (i번째 vs i+1번째)
    for (let i = 0; i < sortedPeriods.length - 1; i++) {
      const prevPeriod = sortedPeriods[i];
      const nextPeriod = sortedPeriods[i + 1];
      const prevRank = prevPeriod.cumulativeRanks[player] || 5;
      const nextRank = nextPeriod.cumulativeRanks[player] || 5;
      
      // change = 이전 등수 - 이후 등수
      // 양수면 상승 (예: 3위 -> 1위, change = 3-1 = 2)
      // 음수면 하락 (예: 1위 -> 3위, change = 1-3 = -2)
      const change = prevRank - nextRank;
      
      if (change > maxRise) {
        maxRise = change;
        riseFromPeriod = prevPeriod;
        riseToPeriod = nextPeriod;
      }
      
      if (change < maxFall) {
        maxFall = change;
        fallFromPeriod = prevPeriod;
        fallToPeriod = nextPeriod;
      }
    }
    
    // 하위 호환성을 위한 필드 (첫 기간과 마지막 기간)
    const earlyRank = firstPeriod ? firstPeriod.cumulativeRanks[player] || 5 : 5;
    const lateRank = lastPeriod ? lastPeriod.cumulativeRanks[player] || 5 : 5;
    
    // 가장 큰 변동 선택 (절댓값 기준)
    let bestRank: number;
    let worstRank: number;
    let bestPeriod: typeof firstPeriod | null;
    let worstPeriod: typeof firstPeriod | null;
    let change: number;
    
    if (Math.abs(maxFall) > maxRise) {
      // 하락이 더 큼
      worstRank = fallToPeriod ? fallToPeriod.cumulativeRanks[player] || 5 : lateRank;
      bestRank = fallFromPeriod ? fallFromPeriod.cumulativeRanks[player] || 5 : earlyRank;
      worstPeriod = fallToPeriod;
      bestPeriod = fallFromPeriod;
      change = maxFall; // 음수
    } else if (maxRise > 0) {
      // 상승이 더 큼
      worstRank = riseFromPeriod ? riseFromPeriod.cumulativeRanks[player] || 5 : earlyRank;
      bestRank = riseToPeriod ? riseToPeriod.cumulativeRanks[player] || 5 : lateRank;
      worstPeriod = riseFromPeriod;
      bestPeriod = riseToPeriod;
      change = maxRise; // 양수
    } else {
      // 변동 없음
      bestRank = lateRank;
      worstRank = earlyRank;
      bestPeriod = lastPeriod;
      worstPeriod = firstPeriod;
      change = earlyRank - lateRank;
    }
    
    rankChanges[player] = {
      best: bestRank,
      worst: worstRank,
      change: change, // 양수면 상승, 음수면 하락
      bestPeriod,
      worstPeriod,
      early: earlyRank,
      late: lateRank,
      earlyPeriod: firstPeriod,
      latePeriod: lastPeriod
    };
  });

  return { 
    rankChanges, 
    firstPeriod, 
    lastPeriod 
  };
};

// Recap 통계 계산
export const calculateRecapStats = (games: IGame[], year: number) => {
  if (games.length === 0) {
    return null;
  }

  const sortedGames = [...games].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const playerStats = calculatePlayerStats(sortedGames);
  const teamStats = calculateTeamStats(sortedGames);
  const sortedPlayerStats = getSortedPlayerStats(playerStats);
  const sortedTeamStats = getSortedTeamStats(teamStats);
  const validPlayers = ['잡', '큐', '지', '머', '웅'];

  // 올해의 VIP (승률 기준)
  const vipByWinrate = sortedPlayerStats[0] ? {
    player: sortedPlayerStats[0][0],
    winrate: calculateWinrate(sortedPlayerStats[0][1][0], sortedPlayerStats[0][1][1]),
    wins: sortedPlayerStats[0][1][0],
    total: sortedPlayerStats[0][1][1]
  } : null;

  // 올해의 꼴찌 (승률 기준)
  const worstByWinrate = sortedPlayerStats.length > 0 ? {
    player: sortedPlayerStats[sortedPlayerStats.length - 1][0],
    winrate: calculateWinrate(
      sortedPlayerStats[sortedPlayerStats.length - 1][1][0], 
      sortedPlayerStats[sortedPlayerStats.length - 1][1][1]
    ),
    wins: sortedPlayerStats[sortedPlayerStats.length - 1][1][0],
    total: sortedPlayerStats[sortedPlayerStats.length - 1][1][1]
  } : null;

  // 최고 승률 팀 (최강 팀 조합)
  const bestWinrateTeam = sortedTeamStats[0] ? {
    team: getTeamName(sortedTeamStats[0][0].split('')),
    teamKey: sortedTeamStats[0][0],
    winrate: calculateWinrate(sortedTeamStats[0][1][0], sortedTeamStats[0][1][1]),
    wins: sortedTeamStats[0][1][0],
    total: sortedTeamStats[0][1][1]
  } : null;

  // 기간별 통계 (먼저 계산하여 게임이 속한 기간을 찾을 수 있도록)
  const periodStats = calculatePeriodStats(sortedGames);
  const totalPeriods = periodStats.length;

  // 게임이 속한 기간 찾기
  const findPeriodForGame = (game: IGame): number => {
    const gameDate = new Date(game.createdAt).getTime();
    const sortedPeriods = periodStats.slice().sort((a, b) => {
      const dateA = typeof a.startDate === 'string' ? new Date(a.startDate) : a.startDate;
      const dateB = typeof b.startDate === 'string' ? new Date(b.startDate) : b.startDate;
      return dateA.getTime() - dateB.getTime();
    });
    
    for (let i = 0; i < sortedPeriods.length; i++) {
      const period = sortedPeriods[i];
      const periodGames = period.games || [];
      if (periodGames.some(g => g._id === game._id || new Date(g.createdAt).getTime() === gameDate)) {
        return i + 1;
      }
    }
    return 0;
  };

  // 플레이어별 최대 연승/연패
  const playerStreaks: Array<{
    player: string;
    maxWinStreak: number;
    maxLoseStreak: number;
    maxWinStreakPeriod: number;
    maxLoseStreakPeriod: number;
  }> = [];

  validPlayers.forEach(player => {
    const playerGames = analyzePlayerGames(player, sortedGames);
    const streaks = calculateMaxStreak(playerGames);
    playerStreaks.push({
      player,
      maxWinStreak: streaks.maxWinStreak,
      maxLoseStreak: streaks.maxLoseStreak,
      maxWinStreakPeriod: streaks.maxWinStreakGame ? findPeriodForGame(streaks.maxWinStreakGame) : 0,
      maxLoseStreakPeriod: streaks.maxLoseStreakGame ? findPeriodForGame(streaks.maxLoseStreakGame) : 0
    });
  });

  // 최대 연승 플레이어
  const maxWinStreakPlayer = playerStreaks.reduce((max, current) => 
    current.maxWinStreak > max.maxWinStreak ? current : max
  , playerStreaks[0] || { player: '', maxWinStreak: 0, maxLoseStreak: 0, maxWinStreakPeriod: 0, maxLoseStreakPeriod: 0 });

  // 최대 연패 플레이어
  const maxLoseStreakPlayer = playerStreaks.reduce((max, current) => 
    current.maxLoseStreak > max.maxLoseStreak ? current : max
  , playerStreaks[0] || { player: '', maxWinStreak: 0, maxLoseStreak: 0, maxWinStreakPeriod: 0, maxLoseStreakPeriod: 0 });

  // 팀별 최대 연승/연패
  const teamStreaks: Array<{
    team: string;
    teamKey: string;
    maxWinStreak: number;
    maxLoseStreak: number;
    maxWinStreakPeriod: number;
    maxLoseStreakPeriod: number;
  }> = [];

  Object.keys(teamStats).forEach(teamKey => {
    const teamPlayers = teamKey.split('');
    const teamGames = analyzeTeamGames(teamPlayers, sortedGames);
    const streaks = calculateMaxStreak(teamGames);
    teamStreaks.push({
      team: getTeamName(teamPlayers),
      teamKey,
      maxWinStreak: streaks.maxWinStreak,
      maxLoseStreak: streaks.maxLoseStreak,
      maxWinStreakPeriod: streaks.maxWinStreakGame ? findPeriodForGame(streaks.maxWinStreakGame) : 0,
      maxLoseStreakPeriod: streaks.maxLoseStreakGame ? findPeriodForGame(streaks.maxLoseStreakGame) : 0
    });
  });

  // 최장 연승 팀
  const longestWinStreakTeam = teamStreaks.reduce((max, current) => 
    current.maxWinStreak > max.maxWinStreak ? current : max
  , teamStreaks[0] || { team: '', teamKey: '', maxWinStreak: 0, maxLoseStreak: 0, maxWinStreakPeriod: 0, maxLoseStreakPeriod: 0 });

  // 최대 연패 팀
  const maxLoseStreakTeam = teamStreaks.reduce((max, current) => 
    current.maxLoseStreak > max.maxLoseStreak ? current : max
  , teamStreaks[0] || { team: '', teamKey: '', maxWinStreak: 0, maxLoseStreak: 0 });

  // 등수 변동 (기간 묶음 기준)
  const rankChangeData = calculateRankChange(periodStats);
  const rankChanges = rankChangeData.rankChanges;

  // 가장 많이 플레이한 팀 조합
  const teamPlayCounts = Object.entries(teamStats)
    .map(([teamKey, [wins, total]]) => ({
      team: getTeamName(teamKey.split('')),
      teamKey,
      total,
      wins,
      winrate: calculateWinrate(wins, total)
    }))
    .sort((a, b) => b.total - a.total);

  const mostPlayedTeam = teamPlayCounts[0] || null;

  // 월별 게임 수
  const monthlyGames: { [month: number]: number } = {};
  sortedGames.forEach(game => {
    const date = new Date(game.createdAt);
    const month = date.getMonth() + 1; // 1-12
    monthlyGames[month] = (monthlyGames[month] || 0) + 1;
  });

  // 가장 활발한 월
  const mostActiveMonth = Object.entries(monthlyGames).reduce((max, [month, count]) => 
    count > max.count ? { month: parseInt(month), count } : max
  , { month: 1, count: 0 });

  return {
    year,
    totalGames: sortedGames.length,
    totalPeriods,
    vipByWinrate,
    worstByWinrate,
    bestWinrateTeam,
    maxWinStreakPlayer,
    maxLoseStreakPlayer,
    longestWinStreakTeam,
    maxLoseStreakTeam,
    rankChanges,
    rankChangeData: {
      firstPeriod: rankChangeData.firstPeriod,
      lastPeriod: rankChangeData.lastPeriod
    },
    periodStats,
    mostPlayedTeam,
    monthlyGames,
    mostActiveMonth,
    playerStreaks,
    teamStreaks
  };
};

