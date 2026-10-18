import mongoose, { Schema, Types } from 'mongoose';
import { VALID_PLAYERS, PlayerCode } from '@/models/Game';

// 인성질 멘트 공감 투표 (멘트당 1인 1표)
export interface IInsungVote {
  _id?: string;
  quoteId: Types.ObjectId;
  voter: PlayerCode;
  createdAt: Date;
}

const InsungVoteSchema = new Schema<IInsungVote>({
  quoteId: { type: Schema.Types.ObjectId, ref: 'InsungQuote', required: true },
  voter: { type: String, enum: VALID_PLAYERS, required: true },
  createdAt: { type: Date, default: Date.now }
});

InsungVoteSchema.index({ quoteId: 1, voter: 1 }, { unique: true });

export default mongoose.models.InsungVote || mongoose.model<IInsungVote>('InsungVote', InsungVoteSchema);
