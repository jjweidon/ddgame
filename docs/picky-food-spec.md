# 편식 도감 (`/picky`) 기능 명세 v0.2

친구가 안 먹는 음식을 생각날 때마다 한 줄씩 추가해 두는 페이지. 집계·분류·투표 없이 **목록 기록**만 한다.

v0.2는 진호(`지`) 한 명만 운영하지만, 데이터·API·화면 모두 **대상자(eater)** 단위로 설계해서 다른 친구를 코드 한 줄로 추가할 수 있게 한다.

## 1. 범위

- 경로: 페이지 `/picky`, API `/api/picky-foods`
- 루트 메뉴([src/app/page.tsx](../src/app/page.tsx))의 `games` 배열에 항목 추가 ("편식 도감")
- 저장소: 기존 MongoDB(mongoose). 컬렉션 1개(`PickyFood`) 추가
- 로그인 없음. 누구나 추가 가능, 삭제만 관리자 비밀번호
- 기록 저장 5분 잠금(`enforceRecordSubmissionLock`)은 게임 기록 전용이라 적용하지 않음

## 2. 대상자 (eater)

| 항목 | 규칙 |
|---|---|
| 설정 위치 | [src/constants/pickyFood.ts](../src/constants/pickyFood.ts)의 `PICKY_EATERS` |
| 현재 값 | `['지']` (진호) |
| 대상자 추가 | `PICKY_EATERS`에 플레이어 코드 추가. DB·API 수정 불필요 |
| 화면 | 대상자가 2명 이상이면 상단에 대상자 탭이 나타남. 제목은 "{이름} 편식 도감"으로 바뀜 |
| 서버 검증 | `PICKY_EATERS`에 없는 대상자로는 조회·등록 불가 (400) |

## 3. 데이터

| 필드 | 필수 | 규칙 |
|---|---|---|
| eater (안 먹는 사람) | O | `VALID_PLAYERS`. API에서는 `PICKY_EATERS`만 허용 |
| name (음식 이름) | O | trim 후 1~30자 |
| normalizedName | 자동 | 공백 제거 + 소문자. **(eater, normalizedName) unique** — 같은 음식도 사람이 다르면 따로 등록 |
| note (메모) | X | 최대 100자 |
| createdAt | 자동 | 등록 시각 |

## 4. 화면

1. **헤더**: 제목 "{대상자} 편식 도감", 홈으로 버튼
2. **대상자 탭**: 대상자 2명 이상일 때만 노출
3. **추가 폼**: 음식 이름 + 메모(선택). Enter 또는 [추가] 버튼으로 저장. 이미 있는 음식이면 안내
4. **목록**
   - 제목에 개수 표시 ("안 먹는 음식 N개"), 이름 검색
   - 정렬: 최신 등록순
   - 카드: 이름 · 메모 · 등록일 · [삭제](관리자 비밀번호 prompt)

## 5. API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/picky-foods?eater=지` | 해당 대상자 목록 (최신순). 수십~수백 개 규모라 검색은 클라이언트에서 처리 |
| POST | `/api/picky-foods` | `{ eater, name, note? }` 추가. 중복이면 409 |
| DELETE | `/api/picky-foods/[id]` | `{ adminPassword }` 필요 (`RECORD_SUBMISSION_OVERRIDE_PASSWORD`) |

응답 형식은 기존 API와 동일하게 `{ success, data?, error? }`.

## 6. 범위 밖 (추후)

- 대상자별 바로가기 URL (`/picky?eater=…`)
- 대상자 간 비교 (예: 편식왕 랭킹)
