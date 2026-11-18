import mongoose, { Schema } from 'mongoose';

// 사용자별 쓰기 요청 수 (고정 윈도우). 서버리스 인스턴스끼리 공유해야 해서 DB에 둔다
export interface IInsungRateLimit {
  key: string;
  windowStart: Date;
  count: number;
}

const InsungRateLimitSchema = new Schema<IInsungRateLimit>({
  key: { type: String, required: true, unique: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, default: 0 }
});

// 오래된 윈도우 문서는 1시간 뒤 자동 삭제
InsungRateLimitSchema.index({ windowStart: 1 }, { expireAfterSeconds: 60 * 60 });

export default mongoose.models.InsungRateLimit ||
  mongoose.model<IInsungRateLimit>('InsungRateLimit', InsungRateLimitSchema);
