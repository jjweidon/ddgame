import mongoose, { Schema, Types } from 'mongoose';
import { VALID_PLAYERS, PlayerCode } from '@/models/Game';

// 인성질 제보 투표 (제보당 1인 1회, 1~5포인트)
export interface IInsungVote {
  _id?: string;
  quoteId: Types.ObjectId;
  voter: PlayerCode;
  points?: number;       // 1~5. 포인트제 이전 투표는 없음 → 1로 간주
  month?: string;        // 'YYYY-MM'(KST). 예산 집계용. 포인트제 이전 투표는 없음
  createdAt: Date;
}

const InsungVoteSchema = new Schema<IInsungVote>({
  quoteId: { type: Schema.Types.ObjectId, ref: 'InsungQuote', required: true },
  voter: { type: String, enum: VALID_PLAYERS, required: true },
  points: { type: Number, min: 1, max: 5 },
  month: { type: String, match: /^\d{4}-\d{2}$/ },
  createdAt: { type: Date, default: Date.now }
});

InsungVoteSchema.index({ quoteId: 1, voter: 1 }, { unique: true });
InsungVoteSchema.index({ voter: 1, month: 1 });

export default mongoose.models.InsungVote || mongoose.model<IInsungVote>('InsungVote', InsungVoteSchema);
