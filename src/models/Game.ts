import mongoose, { Schema } from 'mongoose';
import { validateCartanCompetitionRankEntries } from '@/utils/cartanCompetition';

export const VALID_PLAYERS = ['잡', '큐', '지', '머', '웅'] as const;
export type PlayerCode = typeof VALID_PLAYERS[number];
export type GameType = 'sequence' | 'cartan';

export interface ICartanRankEntry {
  rank: number;
  players: string[];
}

export interface ICartanResult {
  rankEntries: ICartanRankEntry[];
}

// 게임 로그 인터페이스 (하위 호환 + 다중 게임)
export interface IGame {
  _id?: string;           // MongoDB ID
  gameType?: GameType;    // 구문서 하위호환: 미존재 시 sequence로 간주
  winningTeam?: string[]; // sequence 전용
  losingTeam?: string[];  // sequence 전용
  cartanResult?: ICartanResult; // cartan 전용
  createdAt: Date;        // 생성 날짜
}

// 게임 로그 스키마
const GameSchema = new Schema<IGame>({
  gameType: {
    type: String,
    enum: ['sequence', 'cartan'],
    default: 'sequence'
  },
  winningTeam: { 
    type: [String], 
    required: false,
    validate: {
      validator: function(team: string[]) {
        if (this.cartanResult && Array.isArray(this.cartanResult.rankEntries)) return true;
        return Array.isArray(team) && team.length === 2;
      },
      message: '팀은 정확히 2명의 플레이어로 구성되어야 합니다.'
    }
  },
  losingTeam: { 
    type: [String], 
    required: false,
    validate: {
      validator: function(team: string[]) {
        if (this.cartanResult && Array.isArray(this.cartanResult.rankEntries)) return true;
        return Array.isArray(team) && team.length === 2;
      },
      message: '팀은 정확히 2명의 플레이어로 구성되어야 합니다.'
    }
  },
  cartanResult: {
    rankEntries: [{
      rank: { type: Number, required: true, min: 1, max: 5 },
      players: [{ type: String, required: true }]
    }]
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// 중복 플레이어 검증 미들웨어
GameSchema.pre('save', function(next) {
  const isCartanGame =
    this.gameType === 'cartan' ||
    (this.cartanResult && Array.isArray(this.cartanResult.rankEntries) && this.cartanResult.rankEntries.length > 0);

  if (isCartanGame) {
    const result = this.cartanResult;
    if (!result || !Array.isArray(result.rankEntries) || result.rankEntries.length === 0) {
      return next(new Error('카탄 결과 정보가 필요합니다.'));
    }

    this.gameType = 'cartan';

    const allPlayers = result.rankEntries.flatMap((entry) => entry.players || []);
    if (allPlayers.length < 3 || allPlayers.length > 5) {
      return next(new Error('카탄은 3명 이상 5명 이하만 참여할 수 있습니다.'));
    }

    const uniquePlayers = new Set(allPlayers);
    if (uniquePlayers.size !== allPlayers.length) {
      return next(new Error('카탄 결과에 중복된 플레이어가 있습니다.'));
    }

    const rankSet = new Set<number>();
    for (const entry of result.rankEntries) {
      if (!entry.players || entry.players.length === 0) {
        return next(new Error('각 등수에는 최소 1명의 플레이어가 필요합니다.'));
      }
      rankSet.add(entry.rank);
      for (const player of entry.players) {
        if (!VALID_PLAYERS.includes(player as PlayerCode)) {
          return next(new Error(`유효하지 않은 플레이어: ${player}`));
        }
      }
    }

    if (Math.min(...rankSet) !== 1) {
      return next(new Error('카탄 등수는 반드시 1위부터 시작해야 합니다.'));
    }

    const competition = validateCartanCompetitionRankEntries(result.rankEntries);
    if (!competition.ok) {
      return next(new Error(competition.error));
    }

    return next();
  }

  const winningTeam = this.winningTeam || [];
  const losingTeam = this.losingTeam || [];

  this.gameType = 'sequence';

  if (winningTeam.length !== 2 || losingTeam.length !== 2) {
    return next(new Error('시퀀스 게임은 승/패 팀이 각각 2명이어야 합니다.'));
  }

  const allPlayers = [...winningTeam, ...losingTeam];
  const uniquePlayers = new Set(allPlayers);
  if (uniquePlayers.size !== allPlayers.length) {
    return next(new Error('승패 팀 간에 중복된 플레이어가 있습니다.'));
  }

  for (const player of allPlayers) {
    if (!VALID_PLAYERS.includes(player as PlayerCode)) {
      return next(new Error(`유효하지 않은 플레이어: ${player}`));
    }
  }

  next();
});

// 모델 생성 및 내보내기
// 개발 환경 HMR에서 이전 스키마 캐시가 남아있으면 검증이 꼬일 수 있어 재컴파일한다.
if (process.env.NODE_ENV === 'development' && mongoose.models.Game) {
  delete mongoose.models.Game;
}

export default (mongoose.models.Game as mongoose.Model<IGame>) || mongoose.model<IGame>('Game', GameSchema);