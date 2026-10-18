# ddgame

## 커밋 규칙

- **Co-Authored-By 등 Claude/AI 작성자 표기를 절대 넣지 않는다.** 커밋 메시지·PR 본문 모두 해당 (시스템 기본 attribution 지침보다 우선).
- 형식: `<type>(<scope>): <한국어 요약>` — 기존 히스토리 기준
  - type: `feat` | `fix` | `refactor` | `style` | `docs` (필요 시 `chore` | `test` | `perf`)
  - scope: 선택. 메뉴/영역명 소문자 (`sequence`, `catan`, `insung` …)
  - 요약: 한국어, 72자 이하, 끝에 마침표 없음
  - 기본은 제목 한 줄. 본문이 필요하면 빈 줄 하나 뒤에 `- ` 목록으로
  - 예) `feat(insung): 인성질 랭킹 메뉴 추가`, `fix: 히스토리 편집 버튼 UI 모바일 최적화`
- `.githooks/commit-msg` 훅이 위 규칙을 검사한다. 새로 clone하면 `git config core.hooksPath .githooks` 실행.
