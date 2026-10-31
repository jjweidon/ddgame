import mongoose, { Schema } from 'mongoose';
import { VALID_PLAYERS, PlayerCode } from '@/models/Game';
import {
  PICKY_FOOD_CATEGORIES,
  PICKY_FOOD_NAME_MAX,
  PICKY_FOOD_NOTE_MAX,
  PickyFoodCategory
} from '@/constants/pickyFood';

// 누군가(eater)가 안 먹는 음식
export interface IPickyFood {
  _id?: string;
  eater: PlayerCode;          // 안 먹는 사람
  name: string;
  normalizedName: string;     // 공백 제거 + 소문자 (대상자별 중복 방지용)
  category: PickyFoodCategory;
  note?: string;              // 메모 (예: 익힌 건 먹음)
  registrant?: PlayerCode;    // 제보자 (선택)
  graduatedAt?: Date | null;  // 먹게 된 시각 (값이 있으면 졸업)
  createdAt: Date;
}

const PickyFoodSchema = new Schema<IPickyFood>({
  eater: { type: String, enum: VALID_PLAYERS, required: true },
  name: { type: String, required: true, maxlength: PICKY_FOOD_NAME_MAX },
  normalizedName: { type: String, required: true },
  category: { type: String, enum: PICKY_FOOD_CATEGORIES, default: '기타' },
  note: { type: String, maxlength: PICKY_FOOD_NOTE_MAX },
  registrant: { type: String, enum: VALID_PLAYERS },
  graduatedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

PickyFoodSchema.index({ eater: 1, normalizedName: 1 }, { unique: true });
PickyFoodSchema.index({ eater: 1, createdAt: -1 });

export default mongoose.models.PickyFood || mongoose.model<IPickyFood>('PickyFood', PickyFoodSchema);
