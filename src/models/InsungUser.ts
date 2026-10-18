import mongoose, { Schema } from 'mongoose';
import { VALID_PLAYERS, PlayerCode } from '@/models/Game';

// 인성질 랭킹 사용자 (PIN 인증)
export interface IInsungUser {
  _id?: string;
  player: PlayerCode;
  pinHash?: string;
  pinSalt?: string;
  pinVersion: number;     // PIN 설정/리셋 시 증가 → 기존 세션 무효화
  failedAttempts: number;
  lockedUntil?: Date;
  createdAt: Date;
}

const InsungUserSchema = new Schema<IInsungUser>({
  player: { type: String, enum: VALID_PLAYERS, required: true, unique: true },
  pinHash: { type: String },
  pinSalt: { type: String },
  pinVersion: { type: Number, default: 0 },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.InsungUser || mongoose.model<IInsungUser>('InsungUser', InsungUserSchema);
