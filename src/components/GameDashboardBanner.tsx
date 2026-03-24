'use client';

import React, { useMemo } from 'react';
import { IGame } from '@/models/Game';
import { calculatePlayerStats, calculateWinrate, getSortedPlayerStats } from '@/utils/gameStats';
import { getTeamName, getTeamKey } from '@/utils/teamOrder';

// 플레이어 표시 이름 매핑
const playerDisplayNames: { [key: string]: string } = {
  '잡': '채림',
  '큐': '순규',
  '지': '진호',
  '머': '희림',
  '웅': '재웅'
};

export interface DashboardEvent {
  type: 'winStreak' | 'loseStreak' | 'comeback' | 'darkHorse' | 'fallFromGrace' | 'teamWinStreak' | 'teamLoseStreak';
  player: string;
  team?: string[]; // 팀 이벤트의 경우 팀 구성원
  message: string;
  subMessage: string;
  icon: string;
  color: string;
  bgColor: string;
  streakCount?: number;
}

interface GameDashboardBannerProps {
  games: IGame[];
  singleEventIndex?: number; // 단일 이벤트만 표시할 때 사용
  events?: DashboardEvent[]; // 캐러셀에서 계산된 이벤트를 전달받을 때 사용
}

const getValidTeamKey = (team?: string[]): string | null => {
  if (!Array.isArray(team) || team.length !== 2) return null;
  return getTeamKey(team);
};

const teamIncludesPlayer = (team: string[] | undefined, player: string): boolean => {
  return Array.isArray(team) && team.includes(player);
};

const GameDashboardBanner: React.FC<GameDashboardBannerProps> = ({ games, singleEventIndex, events: providedEvents }) => {
  // 플레이어별 게임 기록 분석
  const analyzePlayerGames = (player: string, allGames: IGame[]) => {
    // 시간순으로 정렬된 게임에서 플레이어의 승패 기록 추출
    const sortedGames = [...allGames].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const playerGames: Array<{ game: IGame; isWin: boolean }> = [];
    
    sortedGames.forEach(game => {
      const isWin = teamIncludesPlayer(game.winningTeam, player);
      const isLose = teamIncludesPlayer(game.losingTeam, player);
      
      if (isWin || isLose) {
        playerGames.push({
          game,
          isWin
        });
      }
    });

    return playerGames;
  };

  // 연승/연패 계산
  const calculateStreak = (playerGames: Array<{ game: IGame; isWin: boolean }>) => {
    if (playerGames.length === 0) {
      return { currentStreak: 0, isWinStreak: true, lastResult: null };
    }

    const lastGame = playerGames[playerGames.length - 1];
    let streak = 1;
    const isWinStreak = lastGame.isWin;

    // 마지막 게임부터 역순으로 연속된 승/패 계산
    for (let i = playerGames.length - 2; i >= 0; i--) {
      if (playerGames[i].isWin === isWinStreak) {
        streak++;
      } else {
        break;
      }
    }

    return {
      currentStreak: streak,
      isWinStreak,
      lastResult: lastGame.isWin
    };
  };

  // 역전 승리 감지 (연패 후 승리) - 연패 횟수 반환
  const detectComeback = (playerGames: Array<{ game: IGame; isWin: boolean }>) => {
    if (playerGames.length < 2) return 0;
    
    const lastGame = playerGames[playerGames.length - 1];
    // 마지막 게임이 승리인 경우에만 comeback 가능
    if (!lastGame.isWin) return 0;
    
    // 마지막 게임 이전부터 역순으로 연패 횟수 계산
    let loseStreak = 0;
    for (let i = playerGames.length - 2; i >= 0; i--) {
      if (!playerGames[i].isWin) {
        loseStreak++;
      } else {
        break;
      }
    }
    
    return loseStreak;
  };

  // 팀별 게임 기록 분석
  const analyzeTeamGames = (team: string[], allGames: IGame[]) => {
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

  // 팀별 연승/연패 계산
  const calculateTeamStreak = (teamGames: Array<{ game: IGame; isWin: boolean }>) => {
    if (teamGames.length === 0) {
      return { currentStreak: 0, isWinStreak: true, lastResult: null };
    }

    const lastGame = teamGames[teamGames.length - 1];
    let streak = 1;
    const isWinStreak = lastGame.isWin;

    // 마지막 게임부터 역순으로 연속된 승/패 계산
    for (let i = teamGames.length - 2; i >= 0; i--) {
      if (teamGames[i].isWin === isWinStreak) {
        streak++;
      } else {
        break;
      }
    }

    return {
      currentStreak: streak,
      isWinStreak,
      lastResult: lastGame.isWin
    };
  };

  // 이벤트 감지 및 생성 (useMemo로 메모이제이션)
  const detectEvents = useMemo((): DashboardEvent[] => {
    return calculateDashboardEvents(games);
  }, [games]);

  // 제공된 이벤트가 있으면 사용하고, 없으면 계산
  const allEvents = providedEvents || detectEvents;

  // 가장 중요한 이벤트 표시 (일반적으로 3개, 캐러셀에서는 5개까지)
  const topEvents = useMemo(() => {
    // singleEventIndex가 있으면 캐러셀 모드이므로 5개까지 허용
    const maxEvents = singleEventIndex !== undefined ? 5 : 3;
    return allEvents.slice(0, maxEvents);
  }, [allEvents, singleEventIndex]);

  if (topEvents.length === 0) {
    return null;
  }

  // 단일 이벤트만 표시하는 경우
  const displayEvents = singleEventIndex !== undefined 
    ? topEvents.slice(singleEventIndex, singleEventIndex + 1)
    : topEvents;


  // 이벤트 타입별 아이콘 애니메이션
  const getIconAnimation = (type: string) => {
    switch (type) {
        case 'fallFromGrace':
            return 'animate-icon-bounce-strong';
        case 'darkHorse':
            return 'animate-icon-rotate';
        case 'winStreak':
            return 'animate-icon-bounce-strong';
        case 'comeback':
            return 'animate-icon-sparkle';
        case 'loseStreak':
            return 'animate-icon-wobble';
        case 'teamWinStreak':
            return 'animate-icon-bounce-strong';
        case 'teamLoseStreak':
            return 'animate-icon-wobble';
        default:
            return '';
    }
  };

  // 이벤트 타입별 텍스트 애니메이션
  const getTextAnimation = (type: string) => {
    switch (type) {
      case 'fallFromGrace':
        return 'animate-text-shake';
      case 'darkHorse':
        return 'animate-text-glow';
      case 'winStreak':
        return 'animate-text-glow';
      case 'comeback':
        return 'animate-text-bounce';
      case 'loseStreak':
        return 'animate-text-pulse';
      case 'teamWinStreak':
        return 'animate-text-glow';
      case 'teamLoseStreak':
        return 'animate-text-shake';
      default:
        return '';
    }
  };

  // 이벤트 타입별 배지 애니메이션
  const getBadgeAnimation = (type: string) => {
    switch (type) {
      case 'fallFromGrace':
        return 'animate-badge-pulse';
      case 'darkHorse':
        return 'animate-badge-pulse';
      case 'winStreak':
        return 'animate-badge-pulse';
      case 'comeback':
        return 'animate-badge-pulse';
      case 'loseStreak':
        return 'animate-badge-pulse';
      case 'teamWinStreak':
        return 'animate-badge-pulse';
      case 'teamLoseStreak':
        return 'animate-badge-pulse';
      default:
        return '';
    }
  };

  return (
    <div className={`${singleEventIndex !== undefined ? 'mb-0' : 'mb-6'} space-y-3 w-full max-w-full`}>
      {displayEvents.map((event, index) => (
        <div
          key={`${event.team ? event.team.join('') : event.player}-${event.type}-${index}`}
          className={`${event.bgColor} border-x-0 border-y p-4 sm:p-6 shadow-lg relative overflow-hidden w-full max-w-full`}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* 배경 그라데이션 오버레이 */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50 pointer-events-none"></div>
          
          <div className="flex flex-col gap-3 w-full max-w-6xl mx-auto relative z-10 items-center">
            {/* icon과 message가 좌우로 배치되는 상단 영역 */}
            <div className="flex items-end gap-4 justify-center">
              <div className={`text-xl sm:text-3xl flex-shrink-0 ${getIconAnimation(event.type)} inline-block`}>
                {event.icon}
              </div>
              <div className="flex-shrink-0">
                <div className="flex items-end gap-2">
                  <h3 className={`font-bold text-xl sm:text-2xl ${event.color} drop-shadow-sm ${getTextAnimation(event.type)}`}>
                    {event.message}
                  </h3>
                  {event.streakCount && (
                    <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-bold ${event.color} bg-white/70 dark:bg-black/30 backdrop-blur-sm shadow-md ${getBadgeAnimation(event.type)}`}>
                      {event.streakCount}연속
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* subMessage가 하단에 배치되는 영역 */}
            <p className="text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-medium text-center">
              {event.subMessage}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

// 이벤트 계산 함수를 외부에서도 사용할 수 있도록 export
export const calculateDashboardEvents = (games: IGame[]): DashboardEvent[] => {
  if (games.length === 0) return [];

  const events: DashboardEvent[] = [];
  const playerStats = calculatePlayerStats(games);
  const sortedPlayers = getSortedPlayerStats(playerStats);
  const validPlayers = ['잡', '큐', '지', '머', '웅'];

  // 플레이어 순위 맵 생성 (1등부터 시작)
  const playerRankMap = new Map<string, number>();
  sortedPlayers.forEach(([player], index) => {
    playerRankMap.set(player, index + 1);
  });

  // 플레이어별 게임 기록 분석
  const analyzePlayerGames = (player: string, allGames: IGame[]) => {
    const sortedGames = [...allGames].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const playerGames: Array<{ game: IGame; isWin: boolean }> = [];
    sortedGames.forEach(game => {
      const isWin = teamIncludesPlayer(game.winningTeam, player);
      const isLose = teamIncludesPlayer(game.losingTeam, player);
      if (isWin || isLose) {
        playerGames.push({ game, isWin });
      }
    });
    return playerGames;
  };

  // 연승/연패 계산
  const calculateStreak = (playerGames: Array<{ game: IGame; isWin: boolean }>) => {
    if (playerGames.length === 0) {
      return { currentStreak: 0, isWinStreak: true, lastResult: null };
    }
    const lastGame = playerGames[playerGames.length - 1];
    let streak = 1;
    const isWinStreak = lastGame.isWin;
    for (let i = playerGames.length - 2; i >= 0; i--) {
      if (playerGames[i].isWin === isWinStreak) {
        streak++;
      } else {
        break;
      }
    }
    return { currentStreak: streak, isWinStreak, lastResult: lastGame.isWin };
  };

  // 역전 승리 감지
  const detectComeback = (playerGames: Array<{ game: IGame; isWin: boolean }>) => {
    if (playerGames.length < 2) return 0;
    const lastGame = playerGames[playerGames.length - 1];
    if (!lastGame.isWin) return 0;
    let loseStreak = 0;
    for (let i = playerGames.length - 2; i >= 0; i--) {
      if (!playerGames[i].isWin) {
        loseStreak++;
      } else {
        break;
      }
    }
    return loseStreak;
  };

  // 팀별 게임 기록 분석
  const analyzeTeamGames = (team: string[], allGames: IGame[]) => {
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

  // 팀별 연승/연패 계산
  const calculateTeamStreak = (teamGames: Array<{ game: IGame; isWin: boolean }>) => {
    if (teamGames.length === 0) {
      return { currentStreak: 0, isWinStreak: true, lastResult: null };
    }
    const lastGame = teamGames[teamGames.length - 1];
    let streak = 1;
    const isWinStreak = lastGame.isWin;
    for (let i = teamGames.length - 2; i >= 0; i--) {
      if (teamGames[i].isWin === isWinStreak) {
        streak++;
      } else {
        break;
      }
    }
    return { currentStreak: streak, isWinStreak, lastResult: lastGame.isWin };
  };

  validPlayers.forEach(player => {
    const [wins, total] = playerStats[player] || [0, 0];
    const playerGames = analyzePlayerGames(player, games);
    const streak = calculateStreak(playerGames);
    const rank = playerRankMap.get(player) || 5;
    const displayName = playerDisplayNames[player] || player;

    // 역전 승리
    const comebackLoseStreak = detectComeback(playerGames);
    if (comebackLoseStreak >= 5 && streak.isWinStreak && streak.currentStreak >= 1) {
      events.push({
        type: 'comeback',
        player,
        message: '연패 탈출',
        subMessage: `${displayName}님, ${comebackLoseStreak}연패 후 승리! 반전의 시작인가?!`,
        icon: '💫',
        color: 'text-blue-700 dark:text-blue-300',
        bgColor: 'bg-gradient-to-br from-blue-100 via-cyan-100 to-blue-50 dark:from-blue-900/40 dark:via-cyan-900/40 dark:to-blue-800/40 border-blue-300 dark:border-blue-700',
        streakCount: comebackLoseStreak
      });
    }

    // 상위권 연패
    if (total >= 5 && rank <= 2 && streak.isWinStreak === false && streak.currentStreak >= 3) {
      events.push({
        type: 'fallFromGrace',
        player,
        message: '여왕의 몰락',
        subMessage: `${displayName}님, 순위 떨어지겠어요 ㅋㅋ ㅜ`,
        icon: '👑',
        color: 'text-purple-700 dark:text-purple-300',
        bgColor: 'bg-gradient-to-br from-purple-100 via-pink-100 to-purple-50 dark:from-purple-900/40 dark:via-pink-900/40 dark:to-purple-800/40 border-purple-300 dark:border-purple-700',
        streakCount: streak.currentStreak
      });
    }

    // 하위권 연승
    if (total >= 5 && rank >= 4 && streak.isWinStreak === true && streak.currentStreak >= 3) {
      events.push({
        type: 'darkHorse',
        player,
        message: '파죽지세!',
        subMessage: `다크호스 ${displayName}님, 이제 올라가는 모습만 보여주세요!`,
        icon: '⚡️',
        color: 'text-yellow-700 dark:text-yellow-300',
        bgColor: 'bg-gradient-to-br from-yellow-100 via-gray-100 to-yellow-50 dark:from-yellow-900/40 dark:via-gray-900/40 dark:to-yellow-800/40 border-yellow-300 dark:border-yellow-700',
        streakCount: streak.currentStreak
      });
    }

    // 일반 연승
    if (streak.isWinStreak === true && streak.currentStreak >= 3 && !(total >= 5 && rank >= 4)) {
      events.push({
        type: 'winStreak',
        player,
        message: streak.currentStreak >= 5 ? '불멸의 연승' : '연승 행진',
        subMessage: `축하합니다 ${displayName}님, ${streak.currentStreak}연승 중이에요~!`,
        icon: streak.currentStreak >= 5 ? '🔥' : '✨',
        color: 'text-emerald-700 dark:text-emerald-300',
        bgColor: streak.currentStreak >= 5 
          ? 'bg-gradient-to-br from-emerald-100 via-green-100 to-emerald-50 dark:from-emerald-900/40 dark:via-green-900/40 dark:to-emerald-800/40 border-emerald-300 dark:border-emerald-700'
          : 'bg-gradient-to-br from-emerald-100 to-green-50 dark:from-emerald-900/40 dark:to-green-800/40 border-emerald-300 dark:border-emerald-700',
        streakCount: streak.currentStreak
      });
    }

    // 일반 연패
    if (streak.isWinStreak === false && streak.currentStreak >= 3 && !(total >= 5 && rank <= 2)) {
      events.push({
        type: 'loseStreak',
        player,
        message: streak.currentStreak >= 5 ? '절망의 연패' : '연패 감옥',
        subMessage: `${displayName}님, ${streak.currentStreak}연패 중... ㅋㅋ 힘내세요!`,
        icon: streak.currentStreak >= 5 ? '😭' : '😢',
        color: 'text-rose-700 dark:text-rose-300',
        bgColor: 'bg-gradient-to-br from-rose-100 via-red-100 to-rose-50 dark:from-rose-900/40 dark:via-red-900/40 dark:to-rose-800/40 border-rose-300 dark:border-rose-700',
        streakCount: streak.currentStreak
      });
    }
  });

  // 팀 이벤트 감지
  const sortedGames = [...games].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const teamSet = new Set<string>();
  sortedGames.forEach(game => {
    const winningTeamKey = getValidTeamKey(game.winningTeam);
    const losingTeamKey = getValidTeamKey(game.losingTeam);
    if (winningTeamKey) teamSet.add(winningTeamKey);
    if (losingTeamKey) teamSet.add(losingTeamKey);
  });

  teamSet.forEach(teamKey => {
    const team = teamKey.split('');
    const teamGames = analyzeTeamGames(team, games);
    const streak = calculateTeamStreak(teamGames);
    const teamName = getTeamName(team);

    if (streak.isWinStreak && streak.currentStreak >= 3) {
      events.push({
        type: 'teamWinStreak',
        player: '',
        team: team,
        message: '환상의 궁합',
        subMessage: `${teamName} 팀 ${streak.currentStreak}연승 중! 훌륭한 팀워크를 보여주시네요 ㅎㅎ`,
        icon: '💎',
        color: 'text-indigo-700 dark:text-indigo-300',
        bgColor: 'bg-gradient-to-br from-indigo-100 via-purple-100 to-indigo-50 dark:from-indigo-900/40 dark:via-purple-900/40 dark:to-indigo-800/40 border-indigo-300 dark:border-indigo-700',
        streakCount: streak.currentStreak
      });
    }

    if (!streak.isWinStreak && streak.currentStreak >= 3) {
      events.push({
        type: 'teamLoseStreak',
        player: '',
        team: team,
        message: '최악의 짝꿍',
        subMessage: `${teamName} 팀 ${streak.currentStreak}연패 중... 싸우지는 마세요 😅`,
        icon: '💔',
        color: 'text-gray-700 dark:text-gray-300',
        bgColor: 'bg-gradient-to-br from-gray-100 via-red-100 to-gray-50 dark:from-gray-900/40 dark:via-red-900/40 dark:to-gray-800/40 border-gray-300 dark:border-gray-700',
        streakCount: streak.currentStreak
      });
    }
  });

  // 중복 이벤트 제거
  const eventKeyMap = new Map<string, DashboardEvent>();
  events.forEach(event => {
    const teamKey = event.team ? getTeamKey(event.team) : null;
    const key = teamKey
      ? `team-${teamKey}-${event.type}-${event.streakCount || 0}`
      : `player-${event.player}-${event.type}-${event.streakCount || 0}`;
    if (!eventKeyMap.has(key)) {
      eventKeyMap.set(key, event);
    }
  });
  const uniqueEvents = Array.from(eventKeyMap.values());

  // 이벤트 타입별 우선순위 매핑
  const typePriorityMap: { [key: string]: number } = {
    'comeback': 7,
    'fallFromGrace': 6,
    'darkHorse': 5,
    'winStreak': 4,
    'teamWinStreak': 4,
    'loseStreak': 4,
    'teamLoseStreak': 4
  };

  // 우선순위에 따라 정렬
  return uniqueEvents.sort((a: DashboardEvent, b: DashboardEvent) => {
    const aStreakCount = a.streakCount || 0;
    const bStreakCount = b.streakCount || 0;
    if (aStreakCount !== bStreakCount) {
      return bStreakCount - aStreakCount;
    }
    const aTypePriority = typePriorityMap[a.type] || 0;
    const bTypePriority = typePriorityMap[b.type] || 0;
    if (aTypePriority !== bTypePriority) {
      return bTypePriority - aTypePriority;
    }
    return Math.random() * 1000000 - Math.random() * 1000000;
  });
};

export default GameDashboardBanner;

