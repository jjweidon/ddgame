// seed-api.js
import fetch from 'node-fetch';

// API URL 설정 - 실제 배포된 URL로 변경해야 합니다
const API_URL = 'http://localhost:3000/api/sequence/games'; 

// ex.py의 game_logs 데이터를 MongoDB 형식으로 변환
const gameData = [
  {
    winningTeam: ["지", "머"],
    losingTeam: ["잡", "큐"]
  },
  {
    winningTeam: ["지", "머"],
    losingTeam: ["잡", "큐"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["머", "큐"]
  },
  {
    winningTeam: ["지", "머"],
    losingTeam: ["잡", "큐"]
  },
  {
    winningTeam: ["지", "머"],
    losingTeam: ["잡", "큐"]
  },
  {
    winningTeam: ["지", "큐"],
    losingTeam: ["잡", "머"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["머", "큐"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["머", "큐"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["지", "머"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["머", "큐"]
  },
  {
    winningTeam: ["잡", "머"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["웅", "지"],
    losingTeam: ["머", "큐"]
  },
  {
    winningTeam: ["웅", "지"],
    losingTeam: ["잡", "큐"]
  },
  {
    winningTeam: ["지", "큐"],
    losingTeam: ["웅", "잡"]
  },
  {
    winningTeam: ["웅", "지"],
    losingTeam: ["잡", "머"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["머", "큐"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["웅", "큐"],
    losingTeam: ["지", "잡"]
  },
  {
    winningTeam: ["지", "큐"],
    losingTeam: ["웅", "잡"]
  },
  {
    winningTeam: ["잡", "큐"],
    losingTeam: ["웅", "지"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["잡", "큐"],
    losingTeam: ["웅", "지"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["지", "큐"],
    losingTeam: ["잡", "웅"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["웅", "큐"],
    losingTeam: ["지", "잡"]
  },
  {
    winningTeam: ["잡", "큐"],
    losingTeam: ["웅", "지"]
  },
  {
    winningTeam: ["잡", "큐"],
    losingTeam: ["웅", "지"]
  },
  {
    winningTeam: ["잡", "웅"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["잡", "웅"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["잡", "웅"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["지", "웅"],
    losingTeam: ["잡", "큐"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["지", "큐"],
    losingTeam: ["웅", "잡"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["큐", "잡"],
    losingTeam: ["웅", "지"]
  },
  {
    winningTeam: ["지", "큐"],
    losingTeam: ["웅", "잡"]
  },
  {
    winningTeam: ["잡", "큐"],
    losingTeam: ["웅", "지"]
  },
  {
    winningTeam: ["잡", "큐"],
    losingTeam: ["웅", "지"]
  },
  {
    winningTeam: ["웅", "큐"],
    losingTeam: ["지", "잡"]
  },
  // 240309 데이터
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["지", "큐"]
  },
  {
    winningTeam: ["지", "웅"],
    losingTeam: ["잡", "큐"]
  },
  {
    winningTeam: ["지", "잡"],
    losingTeam: ["웅", "큐"]
  },
  {
    winningTeam: ["머", "큐"],
    losingTeam: ["지", "잡"]
  },
  {
    winningTeam: ["큐", "웅"],
    losingTeam: ["지", "머"]
  },
  {
    winningTeam: ["큐", "웅"],
    losingTeam: ["지", "머"]
  },
  {
    winningTeam: ["지", "웅"],
    losingTeam: ["머", "큐"]
  },
  {
    winningTeam: ["큐", "웅"],
    losingTeam: ["머", "잡"]
  },
  {
    winningTeam: ["큐", "지"],
    losingTeam: ["머", "잡"]
  },
  {
    winningTeam: ["지", "머"],
    losingTeam: ["큐", "웅"]
  },
  {
    winningTeam: ["웅", "큐"],
    losingTeam: ["지", "머"]
  },
  {
    winningTeam: ["큐", "머"],
    losingTeam: ["잡", "웅"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["큐", "머"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["큐", "머"]
  },
  {
    winningTeam: ["웅", "머"],
    losingTeam: ["큐", "잡"]
  },
  {
    winningTeam: ["웅", "잡"],
    losingTeam: ["머", "큐"]
  },
  {
    winningTeam: ["큐", "머"],
    losingTeam: ["웅", "잡"]
  }
];

// 진행 상태 표시 함수
function printProgress(current: number, total: number): void {
  const percentage = Math.floor((current / total) * 100);
  process.stdout.write(`\r진행 중: ${current}/${total} (${percentage}%)`);
}

// API를 통해 데이터 삽입 함수
async function seedViaApi() {
  console.log(`총 ${gameData.length}개의 게임 데이터를 삽입합니다...`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < gameData.length; i++) {
    const game = gameData[i];
    
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          winningTeam: game.winningTeam,
          losingTeam: game.losingTeam
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '게임 데이터 저장 중 오류 발생');
      }
      
      successCount++;
      printProgress(i + 1, gameData.length);
      
    } catch (error: any) {
      console.error(`\n게임 데이터 #${i+1} 저장 오류:`, error.message);
      failCount++;
    }
    
    // API 요청 간 지연 (서버에 부담을 줄이기 위함)
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n데이터 삽입 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
}

// 스크립트 실행
(async () => {
  try {
    console.log('데이터 삽입을 시작합니다...');
    await seedViaApi();
    console.log('작업이 완료되었습니다.');
  } catch (error: any) {
    console.error('스크립트 실행 중 오류 발생:', error);
  }
})();