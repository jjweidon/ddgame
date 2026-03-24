'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import GameHistoryList from '@/components/GameHistoryList';
import GameDashboardBannerCarousel from '@/components/GameDashboardBannerCarousel';
import PlayerSelect from '@/components/PlayerSelect';
import PenaltyHistoryModal from '@/components/PenaltyHistoryModal';
import { IGame } from '@/models/Game';
import { SortField, SortDirection } from '@/components/GameHistoryList';
import { getTeamName, getTeamKey } from '@/utils/teamOrder';

const getValidTeamKey = (team?: string[]): string | null => {
  if (!Array.isArray(team) || team.length !== 2) return null;
  return getTeamKey(team);
};

const getValidTeamName = (team?: string[]): string => {
  if (!Array.isArray(team) || team.length !== 2) return '';
  return getTeamName(team);
};

export default function HistoryPage() {
  const [games, setGames] = useState<IGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentBannerIndex, setCurrentBannerIndex] = useState<number>(0);
  const [eventCount, setEventCount] = useState<number>(0);
  
  // 팀 필터링 관련 상태
  const [filterTeam1, setFilterTeam1] = useState<string[]>([]);
  const [filterTeam2, setFilterTeam2] = useState<string[]>([]);
  
  // 패널티 히스토리 모달 상태
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState<boolean>(false);

  // 현재 연도 가져오기 (한국 시간 기준)
  const getCurrentYear = () => {
    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return koreaTime.getFullYear();
  };

  // 게임 데이터 가져오기 (현재 연도만)
  const fetchGames = async () => {
    setLoading(true);
    try {
      const currentYear = getCurrentYear();
      const response = await fetch(`/api/sequence/games?year=${currentYear}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '게임 데이터 로딩 중 오류가 발생했습니다.');
      }
      
      setGames(data.data);
    } catch (error: any) {
      console.error('게임 기록 불러오기 오류:', error);
      setError(error.message || '게임 기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 7일 지났는지 확인하는 함수
  const isOlderThan7Days = (dateString: string | Date) => {
    const gameDate = new Date(dateString);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 7;
  };

  // 선택된 게임 삭제 함수
  const handleDeleteSelected = async () => {
    if (selectedGames.length === 0) return;
    
    // 7일 지난 게임이 있는지 확인
    const oldGames = games.filter(game => 
      game._id && selectedGames.includes(game._id) && isOlderThan7Days(game.createdAt)
    );
    
    if (oldGames.length > 0) {
      alert('7일이 지난 게임 기록은 삭제할 수 없습니다.');
      // 7일 지나지 않은 게임만 선택 상태로 유지
      const validGames = games
        .filter(game => game._id && selectedGames.includes(game._id) && !isOlderThan7Days(game.createdAt))
        .map(game => game._id || '')
        .filter(id => id);
      setSelectedGames(validGames);
      return;
    }
    
    if (!confirm(`선택한 ${selectedGames.length}개의 게임 기록을 삭제하시겠습니까?`)) {
      return;
    }
    
    setDeleteLoading(true);
    
    try {
      // 선택된 각 게임 ID에 대해 삭제 API 호출
      const deletePromises = selectedGames.map(async (id) => {
        const response = await fetch(`/api/sequence/games/${id}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '삭제에 실패했습니다.');
        }
        return data;
      });
      
      await Promise.all(deletePromises);
      
      // 삭제 후 목록 새로고침
      fetchGames();
      setSelectedGames([]);
      
    } catch (error: any) {
      console.error('게임 기록 삭제 오류:', error);
      alert(error.message || '게임 기록 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  };

  
  // 편집 모드 토글
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    if (isEditMode) {
      setSelectedGames([]);
    }
  };

  // 정렬 상태 변경 처리
  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  // 날짜 포맷팅 함수 (YYYY년 MM월 DD일)
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  // 팀 필터링된 게임 가져오기
  const getFilteredGames = useMemo(() => {
    if (filterTeam1.length !== 2 && filterTeam2.length !== 2) {
      return games;
    }
    
    const team1Key = filterTeam1.length === 2 ? getTeamKey(filterTeam1) : null;
    const team2Key = filterTeam2.length === 2 ? getTeamKey(filterTeam2) : null;
    
    return games.filter(game => {
      const winningTeamKey = getValidTeamKey(game.winningTeam);
      const losingTeamKey = getValidTeamKey(game.losingTeam);
      
      // 두 팀 모두 선택된 경우: 정확히 해당 조합인 게임만
      if (team1Key && team2Key) {
        return (winningTeamKey === team1Key && losingTeamKey === team2Key) ||
               (winningTeamKey === team2Key && losingTeamKey === team1Key);
      }
      
      // 기준 팀만 선택된 경우: 기준 팀이 포함된 게임
      if (team1Key && !team2Key) {
        return winningTeamKey === team1Key || losingTeamKey === team1Key;
      }
      
      // 비교 팀만 선택된 경우: 비교 팀가 포함된 게임
      if (!team1Key && team2Key) {
        return winningTeamKey === team2Key || losingTeamKey === team2Key;
      }
      
      return true;
    });
  }, [games, filterTeam1, filterTeam2]);

  // 필터링된 게임 통계 계산
  const getFilteredStats = useMemo(() => {
    if (filterTeam1.length !== 2 && filterTeam2.length !== 2) {
      return null;
    }
    
    const team1Key = filterTeam1.length === 2 ? getTeamKey(filterTeam1) : null;
    const team2Key = filterTeam2.length === 2 ? getTeamKey(filterTeam2) : null;
    
    if (!team1Key && !team2Key) {
      return null;
    }
    
    let wins = 0;
    let losses = 0;
    
    getFilteredGames.forEach(game => {
      const winningTeamKey = getValidTeamKey(game.winningTeam);
      const losingTeamKey = getValidTeamKey(game.losingTeam);
      
      if (team1Key && team2Key) {
        // 두 팀 모두 선택된 경우
        if (winningTeamKey === team1Key && losingTeamKey === team2Key) {
          wins++;
        } else if (winningTeamKey === team2Key && losingTeamKey === team1Key) {
          losses++;
        }
      } else if (team1Key) {
        // 기준 팀만 선택된 경우
        if (winningTeamKey === team1Key) {
          wins++;
        } else if (losingTeamKey === team1Key) {
          losses++;
        }
      } else if (team2Key) {
        // 비교 팀만 선택된 경우
        if (winningTeamKey === team2Key) {
          wins++;
        } else if (losingTeamKey === team2Key) {
          losses++;
        }
      }
    });
    
    const total = wins + losses;
    const winrate = total > 0 ? ((wins / total) * 100).toFixed(2) : '0.00';
    
    return {
      total,
      wins,
      losses,
      winrate
    };
  }, [getFilteredGames, filterTeam1, filterTeam2]);

  // 현재 정렬 설정에 따라 게임 정렬
  const getSortedGames = () => {
    return [...getFilteredGames].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      
      if (sortField === 'index' || sortField === 'createdAt') {
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
      }
      
      return 0;
    });
  };

  // 게임 데이터를 날짜별로 그룹화
  const groupGamesByDate = () => {
    const groupedGames: { [key: string]: IGame[] } = {};
    
    // 현재 정렬 설정에 따라 정렬된 게임
    const sortedGames = getSortedGames();
    
    // 날짜별로 그룹화
    sortedGames.forEach(game => {
      const dateKey = formatDate(game.createdAt);
      if (!groupedGames[dateKey]) {
        groupedGames[dateKey] = [];
      }
      groupedGames[dateKey].push(game);
    });
    
    return groupedGames;
  };

  // 필터 초기화 함수
  const handleResetFilter = () => {
    setFilterTeam1([]);
    setFilterTeam2([]);
  };

  // 기준 팀 플레이어 선택 핸들러
  const handleSelectTeam1Player = (player: string) => {
    if (filterTeam1.includes(player)) {
      setFilterTeam1(filterTeam1.filter(p => p !== player));
    } else if (filterTeam1.length < 2 && !filterTeam2.includes(player)) {
      setFilterTeam1([...filterTeam1, player]);
    }
  };

  // 비교 팀 플레이어 선택 핸들러
  const handleSelectTeam2Player = (player: string) => {
    if (filterTeam2.includes(player)) {
      setFilterTeam2(filterTeam2.filter(p => p !== player));
    } else if (filterTeam2.length < 2 && !filterTeam1.includes(player)) {
      setFilterTeam2([...filterTeam2, player]);
    }
  };

  // 게임 기록을 텍스트로 변환
  const getGamesAsText = () => {
    let text = `https://ddsequence.vercel.app\n\n`;
    
    const groupedGames = groupGamesByDate();
    
    // 정렬된 전체 게임 목록
    const sortedGames = getSortedGames();
    let gameCounter = 1;
    
    // 날짜별로 순회
    Object.entries(groupedGames).forEach(([date, gamesInDay]) => {
      text += `[${date}]\n`;
      
      // 해당 날짜의 게임들을 순회
      gamesInDay.forEach(game => {
        const winTeam = getValidTeamName(game.winningTeam);
        const loseTeam = getValidTeamName(game.losingTeam);
        if (!winTeam || !loseTeam) return;
        
        // 정렬 방향에 따라 게임 번호 결정
        const gameNumber = sortDirection === 'asc' 
          ? gameCounter++ 
          : sortedGames.length - gameCounter++ + 1;
        
        text += `${(gameNumber + ".").padEnd(4)} ${winTeam} 승 : ${loseTeam} 패\n`;
      });
      
      text += '\n';
    });
    
    return text;
  };

  // 게임 기록 복사 함수
  const copyGamesToClipboard = async () => {
    try {
      const gamesText = getGamesAsText();
      await navigator.clipboard.writeText(gamesText);
      setIsCopied(true);
      
      // 2초 후 아이콘 원래대로 변경
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
    }
  };

  // 컴포넌트 마운트 시 데이터 가져오기
  useEffect(() => {
    fetchGames();
  }, []);

  return (
    <>
      {/* 대시보드 배너 캐러셀 - 전체 너비 */}
      {!loading && !error && games.length > 0 && (
        <div className="w-full">
          <GameDashboardBannerCarousel 
            games={games} 
            onEventCountChange={setEventCount}
            currentIndex={currentBannerIndex}
            onIndexChange={setCurrentBannerIndex}
          />
        </div>
      )}
      
      <main className="min-h-screen bg-page py-6 sm:py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* 좌측: 제목과 복사 버튼 */}
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                  게임 기록
                </h1>
                <p className="text-sm text-muted mt-0.5">
                  {getCurrentYear()}년 기록 {getFilteredGames.length} 게임
                  {getFilteredStats && ` (${getFilteredStats.wins}승 ${getFilteredStats.losses}패, 승률 ${getFilteredStats.winrate}%)`}
                </p>
              </div>
              <button 
                onClick={copyGamesToClipboard}
                className="p-2.5 text-muted hover:text-foreground hover:bg-surface-hover rounded-lg transition-colors duration-200
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                title="게임 기록 복사하기"
              >
                {isCopied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* 우측: 이전/편집 버튼(좌측 정렬) + 패널티 히스토리 버튼(우측) */}
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              {/* 좌측: 이전, 편집 버튼 */}
              <div className="flex items-center gap-1.5 sm:gap-3">
                <Link 
                  href="/sequence" 
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2.5 text-foreground font-medium text-xs sm:text-sm whitespace-nowrap
                           hover:bg-surface-hover rounded-lg transition-colors duration-200
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>이전</span>
                </Link>
                
                {isEditMode && (
                  <button
                    onClick={handleDeleteSelected}
                    disabled={selectedGames.length === 0 || deleteLoading}
                    className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2.5 font-bold text-xs sm:text-sm whitespace-nowrap
                             transition-all duration-200 shadow-sm hover:shadow-md
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                      selectedGames.length === 0 || deleteLoading
                        ? 'bg-surface-hover text-muted cursor-not-allowed opacity-70'
                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white focus-visible:ring-red-400'
                    }`}
                  >
                    {deleteLoading ? (
                      <>
                        <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="hidden sm:inline">삭제 중...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="hidden sm:inline">삭제</span>
                        {selectedGames.length > 0 && <span>({selectedGames.length})</span>}
                      </>
                    )}
                  </button>
                )}
                
                <button 
                  onClick={toggleEditMode}
                  className={`px-2 sm:px-4 py-1.5 sm:py-2.5 font-medium text-xs sm:text-sm rounded-lg transition-colors duration-200 whitespace-nowrap
                           focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
                    isEditMode 
                      ? 'text-foreground hover:bg-surface-hover' 
                      : 'text-muted hover:bg-surface-hover'
                  }`}
                >
                  {isEditMode ? '완료' : '편집'}
                </button>
              </div>
              
              {/* 우측: 패널티 히스토리 버튼 */}
              <button
                onClick={() => setIsPenaltyModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-foreground font-medium text-xs
                         bg-surface-hover border border-border rounded-lg hover:bg-border transition-colors duration-200
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2
                         whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>패널티 히스토리</span>
              </button>
            </div>
          </div>
        </div>

        {/* 팀 필터링 섹션 */}
        <div className="mb-4 sm:mb-6 bg-surface rounded-lg border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <h2 className="text-sm sm:text-xl font-semibold text-foreground">
              팀 필터링
            </h2>
            {(filterTeam1.length > 0 || filterTeam2.length > 0) && (
              <button
                onClick={handleResetFilter}
                className="px-2 py-1 text-xs sm:text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover 
                         rounded-lg transition-colors duration-200
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                초기화
              </button>
            )}
          </div>
          
          <div className="flex flex-row items-center justify-center gap-2 sm:gap-6">
            <div className="flex-1 min-w-0">
              <PlayerSelect
                label="기준 팀"
                selectedPlayers={filterTeam1}
                oppositeTeamPlayers={filterTeam2}
                onSelectPlayer={handleSelectTeam1Player}
                compact={true}
              />
            </div>
            
            <div className="flex items-center justify-center">
              <span className="text-sm sm:text-lg font-medium text-muted px-2 sm:px-4">vs</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <PlayerSelect
                label="비교 팀"
                selectedPlayers={filterTeam2}
                oppositeTeamPlayers={filterTeam1}
                onSelectPlayer={handleSelectTeam2Player}
                compact={true}
              />
            </div>
          </div>
          
          {/* 필터링 통계 표시 */}
          {getFilteredStats && (
            <div className="mt-3 sm:mt-6 pt-3 sm:pt-4 border-t border-border">
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
                <div className="text-center">
                  <div className="text-lg sm:text-3xl font-semibold text-foreground">
                    {getFilteredStats.total}
                  </div>
                  <div className="text-[10px] sm:text-sm text-muted mt-0.5 sm:mt-1">
                    총 게임
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-3xl font-semibold text-win">
                    {getFilteredStats.wins}
                  </div>
                  <div className="text-[10px] sm:text-sm text-muted mt-0.5 sm:mt-1">
                    승리
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-3xl font-semibold text-lose">
                    {getFilteredStats.losses}
                  </div>
                  <div className="text-[10px] sm:text-sm text-muted mt-0.5 sm:mt-1">
                    패배
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-3xl font-semibold text-foreground">
                    {getFilteredStats.winrate}%
                  </div>
                  <div className="text-[10px] sm:text-sm text-muted mt-0.5 sm:mt-1">
                    승률
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 컨텐츠 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-lg border border-border">
            <svg className="animate-spin h-12 w-12 text-muted mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-muted font-medium text-lg">기록 불러오는 중...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-neutral-900 rounded-lg 
                        border border-neutral-200 dark:border-neutral-800">
            <div className="text-6xl mb-4 opacity-40">⚠️</div>
            <p className="text-foreground font-medium text-lg mb-4">{error}</p>
            <button 
              className="px-6 py-3 bg-accent-gradient hover:brightness-110 text-white font-semibold
                       transition-colors duration-200
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              onClick={fetchGames}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <GameHistoryList 
            games={getFilteredGames} 
            isEditMode={isEditMode}
            selectedGames={selectedGames}
            setSelectedGames={setSelectedGames}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
          />
        )}
      </div>
    </main>
    
    {/* 패널티 히스토리 모달 */}
    <PenaltyHistoryModal
      isOpen={isPenaltyModalOpen}
      onClose={() => setIsPenaltyModalOpen(false)}
      year={getCurrentYear()}
    />
    </>
  );
} 