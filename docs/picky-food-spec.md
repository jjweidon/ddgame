# 편식 도감 (`/picky`) 기능 명세 v0.1

친구가 안 먹는 음식을 생각날 때마다 한 줄씩 추가해 두는 페이지. 게임 기록·투표 같은 집계 없이 **목록 기록**만 한다.
나중에 그 음식을 먹게 되면 **졸업** 처리해서 "아직 안 먹음"과 구분한다.

v0.1은 진호(`지`) 한 명만 운영하지만, 데이터·API·화면 모두 **대상자(eater)** 단위로 설계해서 다른 친구를 코드 한 줄로 추가할 수 있게 한다.

## 1. 범위

- 경로: 페이지 `/picky`, API `/api/picky-foods`
- 루트 메뉴([src/app/page.tsx](../src/app/page.tsx))의 `games` 배열에 항목 추가 ("편식 도감")
- 저장소: 기존 MongoDB(mongoose). 컬렉션 1개(`PickyFood`) 추가
- 로그인 없음. 누구나 추가·졸업 처리 가능, 삭제만 관리자 비밀번호
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
| category (분류) | O | `채소` · `과일` · `해산물` · `고기` · `기타` 중 하나, 기본 `기타` |
| note (메모) | X | 최대 100자. 예) "익힌 건 먹음", "냄새만 맡아도 싫어함" |
| registrant (제보자) | X | `VALID_PLAYERS` 중 한 명. 선택 안 해도 됨 |
| graduatedAt (졸업일) | X | 먹게 된 시각. 값이 있으면 졸업 상태 |
| createdAt | 자동 | 등록 시각 |

## 4. 화면

1. **헤더**: 제목 "{대상자} 편식 도감", 홈으로 버튼
2. **대상자 탭**: 대상자 2명 이상일 때만 노출
3. **요약**: 아직 안 먹는 음식 N개 · 졸업 M개
4. **추가 폼**
   - 음식 이름 + 분류 버튼(5개) + 메모(선택) + 제보자(선택, 다시 누르면 해제)
   - Enter 또는 [추가] 버튼으로 저장. 저장 후 이름·메모만 비우고 분류·제보자는 유지(연속 입력 편의)
   - 이미 있는 음식이면 안내 (졸업한 음식이면 졸업 취소 안내)
5. **목록**
   - 필터: 상태 탭(안 먹음 / 졸업 / 전체), 분류 칩, 이름 검색
   - 정렬: 최신 등록순
   - 카드: 분류 이모지 · 이름 · 메모 · `제보자 · 등록일`
   - 카드 동작: [먹게 됨 🎓] ↔ [졸업 취소], [삭제](관리자 비밀번호 prompt)

## 5. API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/picky-foods?eater=지` | 해당 대상자 목록 (최신순). 수십~수백 개 규모라 필터·검색은 클라이언트에서 처리 |
| POST | `/api/picky-foods` | `{ eater, name, category, note?, registrant? }` 추가. 중복이면 409 |
| PATCH | `/api/picky-foods/[id]` | `{ graduated: boolean }` 졸업 처리/취소 |
| DELETE | `/api/picky-foods/[id]` | `{ adminPassword }` 필요 (`RECORD_SUBMISSION_OVERRIDE_PASSWORD`) |

응답 형식은 기존 API와 동일하게 `{ success, data?, error? }`.

## 6. 범위 밖 (추후)

- 대상자별 바로가기 URL (`/picky?eater=…`)
- 음식별 "진짜 안 먹는지" 투표/검증
- 대상자 간 비교 (예: 편식왕 랭킹)
