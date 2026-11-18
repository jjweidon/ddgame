// 인성질 포인트 예산제 (docs/insung-spec.md 12장)
export const INSUNG_POINT_MONTHLY_GRANT = 50; // 매월 1일(KST) 지급
export const INSUNG_POINT_CARRY_OVER_MAX = 10; // 다음 달로 넘어가는 최대 잔액
export const INSUNG_POINT_MIN = 1;
export const INSUNG_POINT_MAX = 5;
export const INSUNG_POINT_START_MONTH = '2026-11'; // 이 달부터 예산 계산. 포인트제 이전 투표는 1포인트씩 이 달 사용량으로 차감

// 쓰기 요청(투표·등록·수정·삭제) 사용자별 제한. 화면은 별 연타를 묶어서 보내므로 정상 사용으론 닿지 않음
export const INSUNG_WRITE_LIMIT_PER_WINDOW = 30;
export const INSUNG_WRITE_LIMIT_WINDOW_SECONDS = 60;
