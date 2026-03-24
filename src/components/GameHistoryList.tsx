import React, { useState } from 'react';
import { IGame } from '@/models/Game';
import { getTeamDisplayOrder } from '@/utils/teamOrder';

export type SortField = 'index' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

interface GameHistoryListProps {
  games: IGame[];
  isEditMode?: boolean;
  selectedGames?: string[];
  setSelectedGames?: React.Dispatch<React.SetStateAction<string[]>>;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSortChange?: (field: SortField, direction: SortDirection) => void;
}

const getSafeTeamDisplayOrder = (team?: string[]): string[] => {
  if (!Array.isArray(team) || team.length !== 2) return [];
  return getTeamDisplayOrder(team);
};

const GameHistoryList: React.FC<GameHistoryListProps> = ({ 
  games,
  isEditMode = false,
  selectedGames = [],
  setSelectedGames = () => {},
  sortField: propsSortField = 'createdAt',
  sortDirection: propsSortDirection = 'desc',
  onSortChange = () => {}
}) => {
  const [localSortField, setLocalSortField] = useState<SortField>(propsSortField);
  const [localSortDirection, setLocalSortDirection] = useState<SortDirection>(propsSortDirection);

  // props가 변경될 때 local 상태 업데이트
  React.useEffect(() => {
    setLocalSortField(propsSortField);
    setLocalSortDirection(propsSortDirection);
  }, [propsSortField, propsSortDirection]);

  // 정렬 토글 함수
  const toggleSort = (field: SortField) => {
    let newDirection: SortDirection = 'desc';
    
    if (localSortField === field) {
      // 같은 필드를 다시 클릭하면 정렬 방향 토글
      newDirection = localSortDirection === 'asc' ? 'desc' : 'asc';
    }
    
    // 로컬 상태 업데이트
    setLocalSortField(field);
    setLocalSortDirection(newDirection);
    
    // 부모 컴포넌트에 변경 알림
    onSortChange(field, newDirection);
  };

  // 체크박스 토글 함수
  const toggleGameSelection = (gameId: string) => {
    const game = games.find(g => g._id === gameId);
    if (!game) return;
    
    // 7일 지난 기록은 선택할 수 없음
    if (isOlderThan7Days(game.createdAt)) {
      return;
    }
    
    if (selectedGames.includes(gameId)) {
      // 이미 선택된 경우 선택 해제
      setSelectedGames(selectedGames.filter(id => id !== gameId));
    } else {
      // 선택되지 않은 경우 선택 추가
      setSelectedGames([...selectedGames, gameId]);
    }
  };

  // 모든 게임 선택/해제 토글
  const toggleSelectAll = () => {
    if (selectedGames.length === games.length) {
      // 모두 선택된 상태면 모두 해제
      setSelectedGames([]);
    } else {
      // 일부만 선택되었거나 아무것도 선택되지 않았으면 모두 선택 (7일 지난 기록 제외)
      const selectableGames = games
        .filter(game => !isOlderThan7Days(game.createdAt))
        .map(game => game._id || '')
        .filter(id => id);
      setSelectedGames(selectableGames);
    }
  };

  // 게임 데이터 정렬
  const sortedGames = [...games].sort((a, b) => {
    if (localSortField === 'index') {
      // 인덱스 기준 정렬은 실제로는 createdAt 기준으로 정렬합니다
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return localSortDirection === 'asc' ? aTime - bTime : bTime - aTime;
    } else {
      // 날짜 기준 정렬
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return localSortDirection === 'asc' ? aTime - bTime : bTime - aTime;
    }
  });

  // 7일 지났는지 확인하는 함수
  const isOlderThan7Days = (dateString: string | Date) => {
    const gameDate = new Date(dateString);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 7;
  };

  // 날짜 포맷팅 함수 (yyyy-mm-dd HH:mm 형식)
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // 모바일 뷰에서 날짜 포맷팅 함수 (yyyy-mm-dd HH:mm 형식)
  const formatMobileDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  return (
    <div className="w-full">
      {/* 데스크탑 테이블 뷰 - 모바일에서는 숨김 */}
      <div className="hidden sm:block bg-surface rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr className="bg-surface-hover">
                {isEditMode && (
                  <th className="px-4 py-4 w-12">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border-strong text-accent focus:ring-2 focus:ring-focus cursor-pointer"
                      checked={games.length > 0 && selectedGames.length === games.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider 
                           cursor-pointer hover:bg-surface-hover transition-colors duration-200 select-none"
                  onClick={() => toggleSort('index')}
                >
                  <div className="flex items-center gap-2">
                    No.
                    {localSortField === 'index' && (
                      <span className="text-foreground font-semibold">
                        {localSortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th 
                  className="px-4 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider 
                           cursor-pointer hover:bg-surface-hover transition-colors duration-200 select-none"
                  onClick={() => toggleSort('createdAt')}
                >
                  <div className="flex items-center gap-2">
                    날짜/시간
                    {localSortField === 'createdAt' && (
                      <span className="text-foreground font-semibold">
                        {localSortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  승리팀
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  패배팀
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedGames.map((game, index) => (
                <tr 
                  key={game._id || index} 
                  className="hover:bg-surface-hover transition-colors duration-150 animate-fadeIn"
                  style={{ animationDelay: `${index * 20}ms` }}
                >
                  {isEditMode && (
                    <td className="px-4 py-4 whitespace-nowrap w-12">
                      <input
                        type="checkbox"
                        className={`h-4 w-4 rounded border-border-strong text-accent focus:ring-2 focus:ring-focus ${
                          isOlderThan7Days(game.createdAt) 
                            ? 'cursor-not-allowed opacity-50' 
                            : 'cursor-pointer'
                        }`}
                        checked={selectedGames.includes(game._id || '')}
                        onChange={() => game._id && toggleGameSelection(game._id)}
                        disabled={isOlderThan7Days(game.createdAt)}
                        title={isOlderThan7Days(game.createdAt) ? '7일이 지난 기록은 삭제할 수 없습니다' : ''}
                      />
                    </td>
                  )}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-surface-hover text-foreground text-sm font-semibold">
                      {localSortDirection === 'asc' ? index + 1 : games.length - index}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-muted font-medium">
                    {formatDate(game.createdAt)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getSafeTeamDisplayOrder(game.winningTeam).map(player => (
                        <span key={player} className="inline-flex items-center justify-center h-9 w-9 rounded-lg 
                                                    bg-emerald-50 dark:bg-emerald-900/30 
                                                    text-emerald-800 dark:text-emerald-200 font-semibold text-sm 
                                                    border border-emerald-200 dark:border-emerald-800">
                          {player}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getSafeTeamDisplayOrder(game.losingTeam).map(player => (
                        <span key={player} className="inline-flex items-center justify-center h-9 w-9 rounded-lg 
                                                    bg-rose-50 dark:bg-rose-900/30 
                                                    text-rose-800 dark:text-rose-200 font-semibold text-sm 
                                                    border border-rose-200 dark:border-rose-800">
                          {player}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 모바일 카드 뷰 - 데스크탑에서는 숨김 */}
      <div className="sm:hidden">
        <div className="grid grid-cols-1 gap-3">
          {sortedGames.map((game, index) => (
            <div 
              key={game._id || index} 
              className="bg-surface rounded-lg border border-border p-4 transition-colors duration-200 hover:border-border-strong animate-fadeIn"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  {isEditMode && (
                      <input
                        type="checkbox"
                        className={`h-4 w-4 rounded border-border-strong text-accent focus:ring-2 focus:ring-focus ${
                        isOlderThan7Days(game.createdAt) 
                          ? 'cursor-not-allowed opacity-50' 
                          : 'cursor-pointer'
                      }`}
                      checked={selectedGames.includes(game._id || '')}
                      onChange={() => game._id && toggleGameSelection(game._id)}
                      disabled={isOlderThan7Days(game.createdAt)}
                      title={isOlderThan7Days(game.createdAt) ? '7일이 지난 기록은 삭제할 수 없습니다' : ''}
                    />
                  )}
                  <span className="inline-flex items-center justify-center min-w-[32px] h-7 px-2 rounded-md 
                                 bg-surface-hover text-foreground text-xs font-semibold">
                    #{localSortDirection === 'asc' ? index + 1 : games.length - index}
                  </span>
                </div>
                <span className="text-xs text-muted font-medium">
                  {formatMobileDate(game.createdAt)}
                </span>
              </div>
              
              <div className="flex items-stretch gap-3">
                  <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 
                                rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">승리</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {getSafeTeamDisplayOrder(game.winningTeam).map(player => (
                        <span key={player} className="inline-flex items-center justify-center h-8 w-8 rounded-lg 
                                                    bg-emerald-100 dark:bg-emerald-800 
                                                    text-emerald-800 dark:text-emerald-200 font-semibold text-sm 
                                                    border border-emerald-300 dark:border-emerald-700">
                          {player}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex-1 bg-rose-50 dark:bg-rose-900/20 
                                rounded-lg p-3 border border-rose-200 dark:border-rose-800">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">패배</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {getSafeTeamDisplayOrder(game.losingTeam).map(player => (
                        <span key={player} className="inline-flex items-center justify-center h-8 w-8 rounded-lg 
                                                    bg-rose-100 dark:bg-rose-800 
                                                    text-rose-800 dark:text-rose-200 font-semibold text-sm 
                                                    border border-rose-300 dark:border-rose-700">
                          {player}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
            </div>
          ))}
        </div>
      </div>
      
      {games.length === 0 && (
        <div className="text-center py-12 bg-surface rounded-lg border border-border">
          <div className="text-5xl mb-4 opacity-40">🎮</div>
          <p className="text-muted font-medium">기록된 게임이 없습니다.</p>
        </div>
      )}
    </div>
  );
};

export default GameHistoryList; 