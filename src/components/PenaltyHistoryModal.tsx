'use client';

import React, { useState, useEffect } from 'react';
import { IPenalty } from '@/models/Penalty';
import { getPlayerDisplayName } from '@/utils/playerNames';

interface PenaltyHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  year?: number;
}

const PenaltyHistoryModal: React.FC<PenaltyHistoryModalProps> = ({
  isOpen,
  onClose,
  year,
}) => {
  const [penalties, setPenalties] = useState<IPenalty[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [selectedPenalties, setSelectedPenalties] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // 현재 연도 가져오기
  const getCurrentYear = () => {
    if (year) return year;
    const now = new Date();
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    return koreaTime.getFullYear();
  };

  // 패널티 데이터 가져오기
  const fetchPenalties = async () => {
    setLoading(true);
    setError(null);
    try {
      const currentYear = getCurrentYear();
      const response = await fetch(`/api/sequence/penalties?year=${currentYear}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '패널티 데이터 로딩 중 오류가 발생했습니다.');
      }
      
      setPenalties(data.data);
    } catch (error: any) {
      console.error('패널티 기록 불러오기 오류:', error);
      setError(error.message || '패널티 기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 7일 지났는지 확인하는 함수
  const isOlderThan7Days = (dateString: string | Date) => {
    const penaltyDate = new Date(dateString);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - penaltyDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 7;
  };

  // 선택된 패널티 삭제 함수
  const handleDeleteSelected = async () => {
    if (selectedPenalties.length === 0) return;
    
    // 7일 지난 패널티가 있는지 확인
    const oldPenalties = penalties.filter(penalty => 
      penalty._id && selectedPenalties.includes(penalty._id) && isOlderThan7Days(penalty.createdAt)
    );
    
    if (oldPenalties.length > 0) {
      alert('7일이 지난 패널티 기록은 삭제할 수 없습니다.');
      // 7일 지나지 않은 패널티만 선택 상태로 유지
      const validPenalties = penalties
        .filter(penalty => penalty._id && selectedPenalties.includes(penalty._id) && !isOlderThan7Days(penalty.createdAt))
        .map(penalty => penalty._id || '')
        .filter(id => id);
      setSelectedPenalties(validPenalties);
      return;
    }
    
    if (!confirm(`선택한 ${selectedPenalties.length}개의 패널티 기록을 삭제하시겠습니까?`)) {
      return;
    }
    
    setDeleteLoading(true);
    
    try {
      const deletePromises = selectedPenalties.map(async (id) => {
        const response = await fetch(`/api/sequence/penalties/${id}`, {
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
      fetchPenalties();
      setSelectedPenalties([]);
      
    } catch (error: any) {
      console.error('패널티 기록 삭제 오류:', error);
      alert(error.message || '패널티 기록 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 편집 모드 토글
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    if (isEditMode) {
      setSelectedPenalties([]);
    }
  };

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string | Date) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // 모달이 열릴 때 데이터 가져오기
  useEffect(() => {
    if (isOpen) {
      fetchPenalties();
      setIsEditMode(false);
      setSelectedPenalties([]);
    }
  }, [isOpen, year]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-lg shadow-xl max-w-4xl w-full mx-2 sm:mx-4 max-h-[90vh] overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 최상단 우측 버튼들 */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex items-center gap-2">
          {/* 편집 버튼 */}
          <button
            onClick={toggleEditMode}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 font-semibold text-xs sm:text-sm rounded-sm transition-all duration-200 whitespace-nowrap
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 ${
              isEditMode 
                ? 'text-foreground hover:bg-surface-hover' 
                : 'text-muted hover:bg-surface-hover'
            }`}
          >
            {isEditMode ? '완료' : '편집'}
          </button>
          
          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors p-1.5 hover:bg-surface-hover rounded-lg"
            aria-label="닫기"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 헤더 */}
        <div className="border-b border-border px-3 sm:px-6 py-3 sm:py-4 pr-24 sm:pr-28 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground">
              패널티 히스토리
            </h2>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              {getCurrentYear()}년 기록 ({penalties.length}건)
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {isEditMode && (
              <button
                onClick={handleDeleteSelected}
                disabled={selectedPenalties.length === 0 || deleteLoading}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 font-bold text-xs sm:text-sm whitespace-nowrap
                         transition-all duration-200 shadow-sm hover:shadow-md
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  selectedPenalties.length === 0 || deleteLoading
                    ? 'bg-surface-hover text-muted cursor-not-allowed opacity-70'
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white focus-visible:ring-red-400'
                }`}
              >
                {deleteLoading ? (
                  <>
                    <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">삭제 중...</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden sm:inline">삭제</span>
                    {selectedPenalties.length > 0 && <span>({selectedPenalties.length})</span>}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <svg className="animate-spin h-10 w-10 sm:h-12 sm:w-12 text-muted mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-muted font-medium text-base sm:text-lg">로딩 중...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="text-5xl sm:text-6xl mb-4 opacity-40">⚠️</div>
              <p className="text-foreground font-medium text-base sm:text-lg mb-4 text-center">{error}</p>
              <button 
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-accent-gradient hover:brightness-110 text-white font-semibold text-sm sm:text-base
                         transition-colors duration-200
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                onClick={fetchPenalties}
              >
                다시 시도
              </button>
            </div>
          ) : penalties.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl sm:text-5xl mb-4 opacity-40">⚠️</div>
              <p className="text-muted font-medium text-sm sm:text-base">패널티 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {penalties.map((penalty) => (
                <div
                  key={penalty._id}
                  className={`bg-surface-hover border border-border rounded-lg p-3 sm:p-4 transition-colors duration-200 ${
                    isEditMode && selectedPenalties.includes(penalty._id || '')
                      ? 'ring-2 ring-accent bg-surface'
                      : 'hover:bg-surface'
                    }`}
                >
                  <div className="flex items-start gap-2 sm:gap-4">
                    {isEditMode && (
                      <input
                        type="checkbox"
                        checked={penalty._id ? selectedPenalties.includes(penalty._id) : false}
                        onChange={(e) => {
                          if (penalty._id) {
                            if (e.target.checked) {
                              setSelectedPenalties([...selectedPenalties, penalty._id]);
                            } else {
                              setSelectedPenalties(selectedPenalties.filter(id => id !== penalty._id));
                            }
                          }
                        }}
                        className="mt-0.5 sm:mt-1 w-4 h-4 sm:w-5 sm:h-5 text-accent border-border-strong rounded focus:ring-focus flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1 sm:mb-2">
                        <span className="text-xl sm:text-2xl font-semibold text-foreground whitespace-nowrap">
                          {getPlayerDisplayName(penalty.player)}
                        </span>
                        <span className="text-xs sm:text-sm text-muted whitespace-nowrap">
                          {formatDate(penalty.createdAt)}
                        </span>
                      </div>
                      {penalty.reason && (
                        <p className="text-xs sm:text-sm text-muted mt-1 sm:mt-2 break-words">
                          {penalty.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PenaltyHistoryModal;
