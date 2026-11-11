# dambo — 담보비율 계산기

**https://minsung-dambo.web.app** (2026-10-15부터 Firebase Hosting 전용 주소, finance-manager-ca4ca 프로젝트. 옛 github.io 주소는 새 주소로 넘기기만 한다)

## 고치는 법

- 화면 코드 원본은 **`src/app.jsx`**. 고친 뒤 `npm install`(처음 한 번) → **`npm run build`** → `app.js`(화면 코드)와 `app.css`(쓰는 꾸밈 규칙만)가 다시 만들어진다
  (2026-10-15 전엔 폰 브라우저가 열 때마다 JSX 를 변환했고, 2026-11-11 전엔 꾸밈 규칙도 열 때마다 바깥 스크립트로 만들었다)
- 클래스 이름은 소스에 **통째로** 적는다(`text-${c}-500` 처럼 이어 붙이면 `app.css` 에서 빠진다)
- `app.js`·`app.css` 를 바꾸면 `index.html`의 `?v=` 둘과 `sw.js`의 `CACHE`·`OWN`을 같이 올린다
- React 는 `vendor/` 에 공식 배포본(18.3.1)을 그대로 두고 함께 배포한다. 바깥에서 받는 것은 Firebase 라이브러리(gstatic)뿐
- 배포: PowerShell에서 `firebase deploy --only hosting --project finance-manager-ca4ca`(새 주소) + `git push`(소스 보관 · 옛 주소의 넘기기)

## 데이터

RTDB `/dambo` = `{ portfolio, updatedAt, source }`. 재무현황과 같은 `allowedUsers`(admin 만 쓰기).

`portfolio` = `{ stocks[], bonds, cash, loan, extraBuys[], extraBuysSynced, minRatio, sim: { deposit, repay }, … }`
- `stocks[]` = `{ id, name, quantity, avgPrice, currentPrice, type: normal|credit }`. 같은 종목의 신용 줄은 이름 끝에 `(신용)`
- `extraBuys[]` = `{ id, stockId, name, qty, price, type }` — 종목을 **번호(`stockId`)와 이름**으로 가리킨다. 번호가 다시 매겨져도 이름으로 찾고, 끝내 못 찾으면 계산에서 빼고 「종목 없음」으로 보인다
- `minRatio` = 최저유지비율(%). 없으면 130. 화면의 「최저유지비율」 칸에서 바꾼다(빌드 필요 없음)
- `sim` = 입금·상환 시뮬레이션. 0 이면 키가 없다
- 이 앱이 모르는 키는 저장할 때 그대로 돌려보낸다(PC 가 더한 키를 지우지 않는다)

## 저장·동기화 (2026-11-11 정리)

- 값이 바뀌면 0.8초 뒤 통째로 저장하되, 이 기기가 마지막으로 본 `updatedAt` 과 서버의 것이 다르면 **쓰지 않고** 알린 뒤 최신 값을 받아 넣는다
- 저장은 **한 줄로 선다**(`damboSave`). 앞 저장이 끝난 뒤에 다음 것을 보낸다 — 겹쳐 보내면 라이브러리가 둘째에게 첫째의 결과물을 "지금 값"으로 줘서 거짓으로 "다른 곳에서 바뀜"이 된다
- `updatedAt` 을 구독한다. 다른 곳(PC·다른 기기)에서 바뀌면 열려 있는 화면에 새 값을 받아 넣는다(고치는 중이면 끝날 때까지 기다린다)
- 기기 사본은 `dambo_cache_v1` 하나(지난번 클라우드 문서). 로그인했던 기기는 이것으로 먼저 그리고(상태 줄 「최신 확인 중 — 아직 고치지 마세요」) 클라우드 값이 오면 다시 띄운다. 클라우드에서 읽을 때와 이 기기가 저장에 성공했을 때 고쳐 쓰고, 로그인이 풀리는 모든 길에서 지운다

## 확인

고친 뒤 돌리는 시험은 LifeOS 쪽 `.claude/build/dambo-review-20261111/` — `fix-check.py`(가짜 서버) · `real-sdk-fix-check.py`(진짜 Firebase 라이브러리 + 이 PC 의 에뮬레이터).
