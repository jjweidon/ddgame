# 인성질 랭킹 (`/insung`) 기능 명세 v0.2

친구들의 "인성질"을 **제보**로 등록하고, 친구들이 공감 투표(👍)로 점수를 매겨 누가 인성질을 제일 잘하는지 집계한다.
인성질은 카톡 메시지, 직접 나눈 대화, 행동 등 **무엇이든** 될 수 있으며 유형을 나누지 않는다. 제보 본문은 발언이면 그대로 옮겨 적고, 행동이면 무슨 일이 있었는지 서술한다.
카톡 메시지는 복사해서 붙여넣으면 편하지만, 이것은 입력 방법 중 하나일 뿐이다.

### 용어

| 용어 | 뜻 | 코드상 이름 (변경 없음) |
|---|---|---|
| 제보 | 인성질 한 건 (발언·행동 구분 없음) | `InsungQuote`, `/api/insung/quotes` |
| 주인공 | 인성질을 한 사람 | `author` |
| 등록자 | 제보를 올린 사람 | `registrant` |

이미 운영 데이터가 있을 수 있어 컬렉션·API·필드 이름은 바꾸지 않고, 화면 문구만 바꾼다.

## 1. 범위

- 경로: 페이지 `/insung`, API `/api/insung/*`
- 루트 메뉴([src/app/page.tsx](../src/app/page.tsx))의 `games` 배열에 항목 추가 (이름 예: "인성질 랭킹")
- 사용자: 기존 5명 고정 — `VALID_PLAYERS` (`잡/큐/지/머/웅`, 표시명은 `playerNames.ts`)
- 저장소: 기존 MongoDB(mongoose). 컬렉션 3개 추가
- 랭킹 기간: 전체 누적만 (주간/월간은 v0.1 범위 밖)

## 2. 인증 (PIN)

| 항목 | 규칙 |
|---|---|
| 신원 | 5명 중 한 명으로 고정. 이름 선택 + 본인 PIN으로 인증 |
| PIN 설정 | 처음 접속할 때 본인이 설정(숫자 4자리). 서버에는 해시(`crypto.scrypt` + salt)만 저장 |
| 선점 방지 | 이미 PIN이 있는 이름은 PIN 입력만 가능. 아직 PIN이 없는 이름만 설정할 수 있음 |
| PIN 리셋 | 관리자 비밀번호(`RECORD_SUBMISSION_OVERRIDE_PASSWORD`)로 특정 사용자의 PIN 삭제 → 그 사람이 다시 설정 |
| 세션 | 인증에 성공하면 httpOnly·Secure·SameSite=Lax 서명 쿠키 발급(HMAC, 180일). 서명 키는 신규 env `INSUNG_SESSION_SECRET` |
| 세션 무효화 | 쿠키에 `pinVersion`을 넣어 둠. PIN을 리셋하거나 바꾸면 version이 올라가서 기존 쿠키는 무효 |
| 무차별 대입 방지 | 사용자별로 PIN을 5회 연속 틀리면 10분 잠금 (실패 횟수와 잠금 시각은 DB에 저장) |
| API 신원 | 쓰기 API는 모두 **쿠키로만** 사용자를 확인. body로 받은 voter/registrant 값은 무시 |
| 로그아웃 | 쿠키 삭제 (다른 이름으로 바꾸고 싶을 때) |

## 3. 점수 규칙

- **점수 = 해당 사람이 주인공인 제보들이 받은 투표 수의 합.** 발언이든 행동이든 1표 = 1점으로 동일
- 제보를 등록하면 = 등록자가 그 제보에 투표 1개 (자동). 등록자도 이후 투표를 취소할 수 있음
- 같은 제보에는 한 사람이 1표만 가능 (`UNIQUE(quoteId, voter)`)
- **본인이 주인공인 제보에는 투표할 수 없음.** 본인이 등록한 경우(자수)에도 자동 투표 없이 0점에서 시작
- 투표를 취소하면 -1. 0표가 된 제보도 목록에는 남음

## 4. 제보 등록

1. 본문 입력: 무슨 말·행동을 했는지 적는다
   - 카톡 메시지라면 [붙여넣기] 버튼(`navigator.clipboard.readText`)으로 복사한 내용을 바로 넣을 수 있음
   - 대화는 들은 말을 옮겨 적고, 행동은 상황을 서술 (예: "약속 30분 늦고 사과 한마디 없음")
2. 주인공 버튼(5명) 탭 → 저장

| 필드 | 필수 | 규칙 |
|---|---|---|
| content (본문) | O | trim 후 1~500자. 발언 인용 또는 행동 서술 |
| author (주인공) | O | `VALID_PLAYERS` |
| context (상황 메모) | X | 최대 100자 |
| saidAt (발생 날짜) | X | 기본값 오늘(KST), 미래 날짜 불가 |
| registrant | 자동 | 세션 사용자 |

**중복 병합**: 공백을 정규화(연속 공백·개행을 공백 1개로, trim)한 본문과 주인공이 기존 제보와 같으면 새 제보를 만들지 않는다. 유형을 나누지 않으므로 모든 제보에 같은 규칙을 적용한다. 행동 서술은 사람마다 다르게 쓰기 때문에 정확히 일치하는 경우는 드물고, 비슷한 중복은 등록자 삭제나 관리자 삭제로 정리한다.
- 아직 투표하지 않았고 본인이 주인공이 아니면 → 기존 제보에 투표하고 "이미 등록된 제보라 투표로 반영했어요" 안내
- 이미 투표했거나 본인이 주인공이면 → "이미 등록된 제보예요" 안내
- `normalizedContent + author` 조합에 unique 인덱스를 둬서 동시 등록 경쟁도 막음

## 5. 삭제·취소

| 동작 | 권한 |
|---|---|
| 투표 취소 | 투표한 본인 (👍 다시 누르면 토글) |
| 제보 삭제 | 등록자 본인, 또는 관리자 비밀번호 입력 |
| 제보 삭제 시 | 그 제보의 투표도 함께 삭제 (점수에서 빠짐) |

## 6. 화면 (`/insung` 한 페이지, 탭 또는 섹션)

- **상단**: 로그인 상태("재웅으로 접속 중 · 로그아웃"), 제보 등록 폼
- **랭킹**: 순위 · 이름 · 점수 · 제보 수. 동점이면 같은 순위로 표시하고 다음 순위는 건너뜀(카탄과 같은 경쟁 순위). 이름을 누르면 그 사람의 제보 목록
- **최신 피드**: 최신순 제보 카드 — 본문, 주인공, 상황 메모, 발생일, 👍 수, 투표한 사람 이름, 내 투표 여부(토글 버튼), 삭제 버튼(권한이 있을 때만)
  - 발언과 행동을 구분하지 않으므로 본문에 인용부호(“ ”)를 자동으로 붙이지 않고, 입력한 그대로 표시
- **레전드 TOP**: 투표가 많은 순 상위 10개 (동률이면 먼저 등록된 제보가 위)
- **사람별 모아보기**: 주인공으로 필터한 피드 (투표순/최신순 정렬)
- 유형 필터나 아이콘 구분은 두지 않음
- 로그인하지 않은 상태: 조회만 가능하고, 등록·투표 시 이름/PIN 입력 모달을 띄움

## 7. 데이터 모델 (mongoose)

```ts
InsungUser   { player: PlayerCode (unique), pinHash, pinSalt, pinVersion,
               failedAttempts, lockedUntil?, createdAt }
InsungQuote  { content, normalizedContent, author: PlayerCode, context?, saidAt?,
               registrant: PlayerCode, voteCount, createdAt }
               index: unique(normalizedContent, author), (author), (voteCount, createdAt)
InsungVote   { quoteId, voter: PlayerCode, createdAt }
               index: unique(quoteId, voter)
```

`voteCount`는 비정규화 카운터로, 투표·취소할 때 `$inc`로 갱신한다. 랭킹은 `InsungQuote`를 author 기준으로 aggregate해서 voteCount 합과 제보 수를 계산한다. v0.2에서 스키마 변경은 없다.

## 8. API

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| GET | `/api/insung/auth/status` | - | 5명의 PIN 설정 여부 + 현재 세션 사용자 |
| POST | `/api/insung/auth/setup` | - | `{player, pin}` PIN이 없는 이름일 때만 설정 → 쿠키 발급 |
| POST | `/api/insung/auth/login` | - | `{player, pin}` → 쿠키 발급 / 실패 횟수·잠금 처리 |
| POST | `/api/insung/auth/logout` | 세션 | 쿠키 삭제 |
| POST | `/api/insung/auth/reset` | 관리자 비번 | `{player, adminPassword}` PIN 삭제 + pinVersion 증가 |
| GET | `/api/insung/quotes?author=&sort=latest\|top&limit=&offset=` | - | 피드/TOP/사람별 (voters 포함) |
| POST | `/api/insung/quotes` | 세션 | 등록 (+자동 투표, 중복 병합). 결과: `created` / `merged` / `duplicate` |
| DELETE | `/api/insung/quotes/[id]` | 세션(등록자) 또는 `{adminPassword}` | 제보와 투표 삭제 |
| POST | `/api/insung/quotes/[id]/vote` | 세션 | 투표 (본인이 주인공이면 403, 이미 투표했으면 409) |
| DELETE | `/api/insung/quotes/[id]/vote` | 세션 | 투표 취소 |
| GET | `/api/insung/leaderboard` | - | `[{player, score, quoteCount, rank}]` (5명 전원, 0점 포함) |

## 9. 신규 env

- `INSUNG_SESSION_SECRET` — 쿠키 서명 키 (필수, 32바이트 이상)
- `RECORD_SUBMISSION_OVERRIDE_PASSWORD` — 기존 env 재사용 (관리자 삭제·PIN 리셋)

## 10. 범위 밖

주간/월간 랭킹, 안드로이드 공유 시트(PWA Web Share Target), 제보 수정, 사진·캡처 첨부, 알림, 발언/행동 유형 구분

## 11. v0.2 변경 요약 (v0.1 대비)

| 항목 | v0.1 | v0.2 |
|---|---|---|
| 대상 | 카톡 멘트 | 카톡·대화·행동 등 모든 인성질 (유형 구분 없음) |
| 화면 용어 | 멘트 / 작성자 / 발언 날짜 | 제보 / 주인공 / 발생 날짜 |
| 입력 안내 | "카톡에서 복사한 멘트를 붙여넣으세요" | "무슨 말이나 행동을 했나요?" + 예시. 붙여넣기 버튼은 보조 수단으로 유지 |
| 카드 표시 | 본문에 “인용부호” 자동 표시 | 입력 그대로 표시 |
| 점수·투표·병합·인증 | - | 변경 없음 |
| 데이터·API | - | 변경 없음 (화면 문구만 수정) |
