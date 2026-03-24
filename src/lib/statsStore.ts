import { create } from 'zustand';

interface GameStats {
  totalGames: number;
  playerWinrates: any[];
  teamWinrates: any[];
  playerWins: any[];
}

interface StatsStore {
  // 전체 통계 데이터 (API에서 가져온 원본)
  allStats: GameStats | null;
  
  // 현재 표시할 통계 데이터 (필터링된 데이터)
  currentStats: GameStats | null;
  
  // 로딩 상태
  loading: boolean;
  
  // 에러 상태
  error: string | null;
  
  // 현재 선택된 날짜 범위
  dateRange: { startDate: string; endDate: string } | null;
  
  // 전체 통계 데이터 가져오기 (새로고침 시에만 호출)
  fetchAllStats: () => Promise<void>;
  
  // 날짜 범위에 따라 통계 필터링
  filterStatsByDateRange: (startDate?: string, endDate?: string) => void;
  
  // 날짜 범위 초기화 (전체 기간으로)
  resetDateRange: () => void;
  
  // 로딩 상태 설정
  setLoading: (loading: boolean) => void;
  
  // 에러 상태 설정
  setError: (error: string | null) => void;
}

export const useStatsStore = create<StatsStore>((set, get) => ({
  allStats: null,
  currentStats: null,
  loading: false,
  error: null,
  dateRange: null,
  
  fetchAllStats: async () => {
    const { setLoading, setError } = get();
    
    setLoading(true);
    setError(null);
    
    try {
      // 올해 연도 가져오기 (한국 시간 기준)
      const now = new Date();
      const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      const currentYear = koreaTime.getFullYear();
      
      // 올해 기록만 가져오기
      const response = await fetch(`/api/sequence/stats?year=${currentYear}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '통계 데이터를 가져오는 중 오류가 발생했습니다.');
      }
      
      set({
        allStats: data.data,
        currentStats: data.data, // 올해 통계를 현재 통계로 설정
        loading: false
      });
    } catch (error: any) {
      setError(error.message || '통계 데이터를 가져오는 중 오류가 발생했습니다.');
      set({ loading: false });
    }
  },
  
  filterStatsByDateRange: async (startDate?: string, endDate?: string) => {
    const { allStats, setLoading, setError } = get();
    
    if (!allStats) {
      console.warn('전체 통계 데이터가 없습니다.');
      return;
    }
    
    if (!startDate || !endDate) {
      // 날짜 범위가 없으면 전체 통계를 사용
      set({
        currentStats: allStats,
        dateRange: null
      });
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let url = '/api/sequence/stats';
      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      url += `?${params.toString()}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '통계 데이터를 가져오는 중 오류가 발생했습니다.');
      }
      
      set({
        currentStats: data.data,
        dateRange: { startDate, endDate },
        loading: false
      });
    } catch (error: any) {
      setError(error.message || '통계 데이터를 가져오는 중 오류가 발생했습니다.');
      set({ loading: false });
    }
  },
  
  resetDateRange: async () => {
    const { setLoading, setError } = get();
    
    setLoading(true);
    setError(null);
    
    try {
      // 올해 연도 가져오기 (한국 시간 기준)
      const now = new Date();
      const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
      const currentYear = koreaTime.getFullYear();
      
      // 올해 기록만 가져오기
      const response = await fetch(`/api/sequence/stats?year=${currentYear}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '통계 데이터를 가져오는 중 오류가 발생했습니다.');
      }
      
      set({
        allStats: data.data,
        currentStats: data.data,
        dateRange: null,
        loading: false
      });
    } catch (error: any) {
      setError(error.message || '통계 데이터를 가져오는 중 오류가 발생했습니다.');
      set({ loading: false });
    }
  },
  
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error })
})); 