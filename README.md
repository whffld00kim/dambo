# dambo — 담보비율 계산기

**https://minsung-dambo.web.app** (2026-10-15부터 Firebase Hosting 전용 주소, finance-manager-ca4ca 프로젝트. 옛 github.io 주소엔 이동 띠만)

## 고치는 법 (2026-10-15부터 바뀜)

- 화면 코드 원본은 **`src/app.jsx`**. 고친 뒤 `npm install`(처음 한 번) → **`npm run build`** → `app.js`가 다시 만들어진다
  (전엔 index.html 안의 JSX를 폰 브라우저가 열 때마다 변환했다 — CPU 4배 느린 조건에서 첫 화면 6.3초 → 2.3초)
- `app.js`를 바꾸면 `index.html`의 `app.js?v=`와 `sw.js`의 `CACHE`·`OWN`을 같이 올린다
- 배포: `git push`(소스 보관·옛 주소) + PowerShell에서 `firebase deploy --only hosting --project finance-manager-ca4ca`(새 주소)

## 데이터

RTDB `/dambo` = `{ portfolio: { stocks[], bonds, cash, loan, extraBuys, extraBuysSynced }, updatedAt, source }`. 재무현황과 같은 `allowedUsers`.
기기 사본 `dambo_cache_v1`(지난번 클라우드 문서)로 먼저 그리고 클라우드 값이 오면 다시 띄운다 — 그동안 상태 줄 「최신 확인 중」, 저장 안 함.
