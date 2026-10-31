import mongoose, { Schema } from 'mongoose';
import { VALID_PLAYERS, PlayerCode } from '@/models/Game';
import { PICKY_FOOD_NAME_MAX, PICKY_FOOD_NOTE_MAX } from '@/constants/pickyFood';

// 누군가(eater)가 안 먹는 음식
export interface IPickyFood {
  _id?: string;
  eater: PlayerCode;          // 안 먹는 사람
  name: string;
  normalizedName: string;     // 공백 제거 + 소문자 (대상자별 중복 방지용)
  note?: string;              // 메모
  createdAt: Date;
}

const PickyFoodSchema = new Schema<IPickyFood>({
  eater: { type: String, enum: VALID_PLAYERS, required: true },
  name: { type: String, required: true, maxlength: PICKY_FOOD_NAME_MAX },
  normalizedName: { type: String, required: true },
  note: { type: String, maxlength: PICKY_FOOD_NOTE_MAX },
  createdAt: { type: Date, default: Date.now }
});

PickyFoodSchema.index({ eater: 1, normalizedName: 1 }, { unique: true });
PickyFoodSchema.index({ eater: 1, createdAt: -1 });

export default mongoose.models.PickyFood || mongoose.model<IPickyFood>('PickyFood', PickyFoodSchema);
