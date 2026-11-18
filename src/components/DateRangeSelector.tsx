import React, { useState } from 'react';
import Icon from '@/components/Icon';

interface DateRangeSelectorProps {
  onDateRangeChange: (startDate: string, endDate: string) => void;
  isActive: boolean;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ 
  onDateRangeChange, 
  isActive 
}) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedQuickOption, setSelectedQuickOption] = useState<number | null>(null);

  // 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (한국 시간 기준)
  const getTodayString = () => {
    const today = new Date();
    // 한국 시간대로 변환 (UTC+9)
    const koreaTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
    return koreaTime.toISOString().split('T')[0];
  };

  // 빠른 선택 버튼들
  const quickSelectOptions = [
    { label: '1일', days: 1 },
    { label: '7일', days: 7 },
    { label: '30일', days: 30 },
    { label: '3개월', days: 90 },
    { label: '6개월', days: 180 },
    { label: '1년', days: 365 }
  ];

  // 빠른 선택 처리 (한국 시간 기준)
  const handleQuickSelect = (option: any, e: React.MouseEvent) => {
    e.preventDefault(); // 기본 동작 방지
    e.stopPropagation(); // 이벤트 버블링 방지
    
    const today = new Date();
    // 한국 시간대로 변환
    const koreaTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
    
    const end = new Date(koreaTime);
    const start = new Date(koreaTime);
    start.setDate(koreaTime.getDate() - option.days + 1);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    setStartDate(startStr);
    setEndDate(endStr);
    setSelectedQuickOption(option.days);
    // 빠른 선택 시에는 즉시 통계를 가져오지 않고, 사용자가 적용 버튼을 클릭할 때까지 대기
  };

  // 수동 날짜 변경 처리
  const handleDateChange = (e: React.MouseEvent) => {
    e.preventDefault(); // 기본 동작 방지
    e.stopPropagation(); // 이벤트 버블링 방지
    
    if (startDate && endDate) {
      setSelectedQuickOption(null); // 수동 입력 시 빠른 선택 해제
      onDateRangeChange(startDate, endDate);
    }
  };

  return (
    <div 
      className={`bg-surface border border-border rounded-lg overflow-hidden transition-all duration-300 ease-out ${
        isActive 
          ? 'opacity-100 max-h-[500px] transform translate-y-0 mb-6' 
          : 'opacity-0 max-h-0 transform -translate-y-4 pointer-events-none mb-0'
      }`}
    >
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <span className="text-lg"><Icon name="calendar" className="inline-block w-[1em] h-[1em]" strokeWidth={1.75} /></span>
          기간 선택
        </h3>
      </div>
      
      <div className="p-5">
        {/* 빠른 선택 버튼들 */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-muted mb-3 uppercase tracking-wider">
            빠른 선택
          </label>
          <div className="flex flex-wrap gap-2">
            {quickSelectOptions.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={(e) => handleQuickSelect(option, e)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors duration-200
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2
                         ${selectedQuickOption === option.days
                           ? 'bg-accent-gradient text-white'
                           : 'bg-surface-hover text-foreground hover:bg-accent-gradient hover:text-white'
                         }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* 수동 날짜 선택 */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-muted mb-3 uppercase tracking-wider">
            직접 입력
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                시작일
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setSelectedQuickOption(null);
                  }}
                  max={getTodayString()}
                  className="w-full px-4 py-2.5 border border-border bg-surface text-foreground 
                           rounded-lg text-sm font-medium
                           focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent
                           transition-colors duration-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                종료일
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setSelectedQuickOption(null);
                  }}
                  max={getTodayString()}
                  className="w-full px-4 py-2.5 border border-border bg-surface text-foreground 
                           rounded-lg text-sm font-medium
                           focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent
                           transition-colors duration-200"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* 적용 버튼 */}
        <button
          type="button"
          onClick={handleDateChange}
          disabled={!startDate || !endDate}
          className="w-full bg-accent-gradient hover:brightness-110 text-white font-semibold py-3 px-6 rounded-lg
                   transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          {startDate && endDate ? '기간 적용하기' : '날짜를 선택해주세요'}
        </button>
      </div>
    </div>
  );
};

export default DateRangeSelector; 