// 기존 'cartan' 표기로 저장된 게임 문서를 'catan'으로 옮긴다.
// - gameType: 'cartan' -> 'catan'
// - cartanResult 필드 -> catanResult
// 사용: MONGODB_URI=... node scripts/migrate-cartan-to-catan.mjs [--dry-run]
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI 환경 변수가 필요합니다.');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const client = new MongoClient(uri);

try {
  await client.connect();
  const games = client.db().collection('games');

  const typeFilter = { gameType: 'cartan' };
  const fieldFilter = { cartanResult: { $exists: true } };

  console.log(`gameType 'cartan' 문서: ${await games.countDocuments(typeFilter)}`);
  console.log(`cartanResult 보유 문서: ${await games.countDocuments(fieldFilter)}`);

  if (dryRun) {
    console.log('--dry-run: 변경하지 않았습니다.');
  } else {
    const renamed = await games.updateMany(fieldFilter, { $rename: { cartanResult: 'catanResult' } });
    const retyped = await games.updateMany(typeFilter, { $set: { gameType: 'catan' } });
    console.log(`필드 이름 변경: ${renamed.modifiedCount}건, gameType 변경: ${retyped.modifiedCount}건`);
  }
} finally {
  await client.close();
}
