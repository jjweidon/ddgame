import mongoose, { Schema } from 'mongoose';
import { VALID_PLAYERS, PlayerCode } from '@/models/Game';

// 인성질 멘트
export interface IInsungQuote {
  _id?: string;
  content: string;
  normalizedContent: string; // 공백 정규화 본문 (중복 병합용)
  author: PlayerCode;        // 멘트를 한 사람
  context?: string;          // 상황 메모
  saidAt?: string;           // 발언 날짜 (YYYY-MM-DD, KST)
  registrant: PlayerCode;    // 등록한 사람
  voteCount: number;         // 비정규화 투표 수
  createdAt: Date;
}

const InsungQuoteSchema = new Schema<IInsungQuote>({
  content: { type: String, required: true, maxlength: 500 },
  normalizedContent: { type: String, required: true },
  author: { type: String, enum: VALID_PLAYERS, required: true },
  context: { type: String, maxlength: 100 },
  saidAt: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  registrant: { type: String, enum: VALID_PLAYERS, required: true },
  voteCount: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now }
});

InsungQuoteSchema.index({ normalizedContent: 1, author: 1 }, { unique: true });
InsungQuoteSchema.index({ author: 1, createdAt: -1 });
InsungQuoteSchema.index({ voteCount: -1, createdAt: 1 });

export default mongoose.models.InsungQuote || mongoose.model<IInsungQuote>('InsungQuote', InsungQuoteSchema);
