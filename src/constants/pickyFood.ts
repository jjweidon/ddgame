import type { PlayerCode } from '@/models/Game';

// 편식 도감을 운영 중인 대상자. 다른 친구를 추가하려면 여기에 코드만 넣으면 됨 (첫 번째가 기본 탭)
export const PICKY_EATERS: PlayerCode[] = ['지'];

export const PICKY_FOOD_CATEGORIES = ['채소', '과일', '해산물', '고기', '기타'] as const;
export type PickyFoodCategory = typeof PICKY_FOOD_CATEGORIES[number];

export const PICKY_FOOD_CATEGORY_EMOJI: Record<PickyFoodCategory, string> = {
  채소: '🥬',
  과일: '🍎',
  해산물: '🦐',
  고기: '🥩',
  기타: '🍽️'
};

export const PICKY_FOOD_NAME_MAX = 30;
export const PICKY_FOOD_NOTE_MAX = 100;

export const isPickyEater = (value: unknown): value is PlayerCode =>
  PICKY_EATERS.includes(value as PlayerCode);

// 공백 제거 + 소문자 (중복 판정·검색 공용)
export const normalizeFoodName = (name: string) => name.replace(/\s+/g, '').toLowerCase();
