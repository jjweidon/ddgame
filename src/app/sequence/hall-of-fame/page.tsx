'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import StatsList from '@/components/StatsList';
import GameHistoryList from '@/components/GameHistoryList';
import { IGame } from '@/models/Game';
import { SortField, SortDirection } from '@/components/GameHistoryList';

export default function HallOfFamePage() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [games, setGames] = useState<IGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedGames, setSelectedGames] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // 현재 연도 가져오기 (한국 시간 기준)
  const getCurrentYear = () => {
    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return koreaTime.getFullYear();
  };

  // 선택된 연도가 현재 연도인지 확인
  const isCurrentYear = () => {
    return selectedYear !== null && selectedYear === getCurrentYear();
  };

  // 사용 가능한 연도 목록 가져오기
  const fetchAvailableYears = async () => {
    try {
      const response = await fetch('/api/sequence/games');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '게임 데이터를 가져오는 중 오류가 발생했습니다.');
      }
      
      // 게임 데이터에서 연도 추출 (한국 시간 기준)
      const yearsSet = new Set<number>();
      const currentYear = getCurrentYear();
      data.data.forEach((game: IGame) => {
        const date = new Date(game.createdAt);
        const koreaTime = new Date(date.getTime() + (9 * 60 * 60 * 1000));
        const year = koreaTime.getFullYear();
        // 현재 연도는 제외하고 지나간 연도만 추가
        if (year < currentYear) {
          yearsSet.add(year);
        }
      });
      
      const years = Array.from(yearsSet).sort((a, b) => b - a); // 내림차순 정렬
      setAvailableYears(years);
      
      // 가장 최근 연도를 기본 선택
      if (years.length > 0 && !selectedYear) {
        setSelectedYear(years[0]);
      }
    } catch (error: any) {
      console.error('연도 목록 불러오기 오류:', error);
      setError(error.message || '연도 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 선택한 연도의 통계 가져오기
  const fetchYearStats = async (year: number) => {
    setStatsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/sequence/stats?year=${year}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '통계 데이터를 가져오는 중 오류가 발생했습니다.');
      }
      
      setStats(data.data);
    } catch (error: any) {
      console.error('통계 데이터 불러오기 오류:', error);
      setError(error.message || '통계 데이터를 불러오는데 실패했습니다.');
    } finally {
      setStatsLoading(false);
    }
  };

  // 선택한 연도의 게임 기록 가져오기
  const fetchYearGames = async (year: number) => {
    try {
      const response = await fetch(`/api/sequence/games?year=${year}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '게임 데이터를 가져오는 중 오류가 발생했습니다.');
      }
      
      setGames(data.data);
    } catch (error: any) {
      console.error('게임 기록 불러오기 오류:', error);
      setError(error.message || '게임 기록을 불러오는데 실패했습니다.');
    }
  };

  // 연도 선택 처리
  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    fetchYearStats(year);
    fetchYearGames(year);
  };

  // 정렬 상태 변경 처리
  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  // 선택된 게임 삭제 함수
  const handleDeleteSelected = async () => {
    if (selectedGames.length === 0) return;
    
    if (!confirm(`선택한 ${selectedGames.length}개의 게임 기록을 삭제하시겠습니까?`)) {
      return;
    }
    
    setDeleteLoading(true);
    
    try {
      // 선택된 각 게임 ID에 대해 삭제 API 호출
      const deletePromises = selectedGames.map(id => 
        fetch(`/api/sequence/games/${id}`, {
          method: 'DELETE',
        })
      );
      
      await Promise.all(deletePromises);
      
      // 삭제 후 목록 새로고침
      if (selectedYear) {
        fetchYearGames(selectedYear);
        fetchYearStats(selectedYear);
      }
      setSelectedGames([]);
      
    } catch (error: any) {
      console.error('게임 기록 삭제 오류:', error);
      alert('게임 기록 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 편집 모드 토글 (현재 연도만 가능)
  const toggleEditMode = () => {
    if (!isCurrentYear()) {
      alert('이전 연도 기록은 편집할 수 없습니다.');
      return;
    }
    setIsEditMode(!isEditMode);
    if (isEditMode) {
      setSelectedGames([]);
    }
  };

  // 컴포넌트 마운트 시 연도 목록 가져오기
  useEffect(() => {
    fetchAvailableYears();
  }, []);

  // 선택된 연도가 변경되면 해당 연도의 데이터 가져오기
  useEffect(() => {
    if (selectedYear) {
      fetchYearStats(selectedYear);
      fetchYearGames(selectedYear);
    }
  }, [selectedYear]);

  return (
    <main className="min-h-screen bg-page py-6 sm:py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground flex items-center gap-2">
                🏆 명예의 전당
              </h1>
              <p className="text-sm text-muted mt-0.5">
                연도별 기록과 통계를 확인하세요
              </p>
            </div>
            
            <Link 
              href="/" 
              className="flex items-center gap-2 px-4 py-2.5 text-foreground font-medium text-sm
                       hover:bg-surface-hover rounded-lg transition-colors duration-200
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>홈으로</span>
            </Link>
          </div>
        </div>

        {/* 연도 선택 섹션 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-lg 
                        border border-border">
            <svg className="animate-spin h-12 w-12 text-muted mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-muted font-medium text-lg">연도 목록 불러오는 중...</p>
          </div>
        ) : error && !selectedYear ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-lg 
                        border border-border">
            <div className="text-6xl mb-4 opacity-40">⚠️</div>
            <p className="text-foreground font-medium text-lg mb-4">{error}</p>
            <button 
              className="px-6 py-3 bg-accent-gradient hover:brightness-110 text-white font-semibold
                       transition-colors duration-200
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              onClick={fetchAvailableYears}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <>
            {/* 연도 선택 버튼들 */}
            <div className="mb-6">
              <div className="bg-surface rounded-lg border border-border p-4">
                <h2 className="text-lg font-semibold text-foreground mb-4">연도 선택</h2>
                <div className="flex flex-wrap gap-3">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className={`px-6 py-3 rounded-sm font-bold text-sm transition-all duration-200 shadow-sm hover:shadow-md
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                        selectedYear === year
                          ? 'bg-accent-gradient text-white focus-visible:ring-focus'
                          : 'bg-surface border border-border text-foreground hover:bg-surface-hover focus-visible:ring-focus'
                      }`}
                    >
                      {year}년
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedYear && (
              <>
                {/* 통계 섹션 */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                      {selectedYear}년 통계
                    </h2>
                    <Link
                      href={`/sequence/recap/${selectedYear}`}
                      className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700
                               text-white font-bold rounded-sm shadow-lg shadow-red-500/30
                               transition-all duration-200 transform hover:scale-[1.02]
                               focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2
                               flex flex-col items-center gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <span>Recap</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-xs opacity-90">
                        {selectedYear}년을 돌아보세요
                      </span>
                    </Link>
                  </div>
                  
                  {statsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-surface rounded-lg 
                                  border border-border">
                      <svg className="animate-spin h-12 w-12 text-muted mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <p className="text-muted font-medium">통계 로딩 중...</p>
                    </div>
                  ) : stats ? (
                    <StatsList 
                      totalGames={stats.totalGames}
                      playerWinrates={stats.playerWinrates}
                      teamWinrates={stats.teamWinrates}
                      playerWins={stats.playerWins}
                      dateRange={null}
                    />
                  ) : (
                    <div className="text-center py-12 bg-surface rounded-lg border border-border">
                      <div className="text-5xl mb-4 opacity-40">📊</div>
                      <p className="text-muted font-medium">해당 연도의 통계 데이터가 없습니다.</p>
                    </div>
                  )}
                </div>

                {/* 게임 기록 섹션 */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                      {selectedYear}년 게임 기록
                    </h2>
                    <div className="flex items-center gap-3">
                      {isEditMode && games.length > 0 && isCurrentYear() && (
                        <button
                          onClick={handleDeleteSelected}
                          disabled={selectedGames.length === 0 || deleteLoading}
                          className={`flex items-center gap-2 px-4 py-2.5 font-bold text-sm
                                   transition-all duration-200 shadow-sm hover:shadow-md
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                            selectedGames.length === 0 || deleteLoading
                              ? 'bg-neutral-300 dark:bg-neutral-700 text-neutral-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white focus-visible:ring-red-400'
                          }`}
                        >
                          {deleteLoading ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              삭제 중...
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              삭제 {selectedGames.length > 0 && `(${selectedGames.length})`}
                            </>
                          )}
                        </button>
                      )}
                      {games.length > 0 && isCurrentYear() && (
                        <button 
                          onClick={toggleEditMode}
                          className={`px-4 py-2.5 font-semibold text-sm rounded-sm transition-all duration-200
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
                            isEditMode 
                              ? 'text-foreground hover:bg-surface-hover' 
                              : 'text-muted hover:bg-surface-hover'
                          }`}
                        >
                          {isEditMode ? '완료' : '편집'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {games.length > 0 ? (
                    <GameHistoryList 
                      games={games} 
                      isEditMode={isEditMode && isCurrentYear()}
                      selectedGames={selectedGames}
                      setSelectedGames={setSelectedGames}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSortChange={handleSortChange}
                    />
                  ) : (
                    <div className="text-center py-12 bg-surface rounded-lg border border-border">
                      <div className="text-5xl mb-4 opacity-40">🎮</div>
                      <p className="text-muted font-medium">해당 연도의 게임 기록이 없습니다.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

