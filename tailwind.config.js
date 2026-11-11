// 화면 꾸밈 규칙(app.css)을 미리 만든다 (2026-11-11). 전엔 폰 브라우저가 열 때마다 cdn.tailwindcss.com 의 스크립트로 만들었다.
// 판은 그때 받던 것과 같은 3.4.17 — 올릴 땐 화면을 다시 비교할 것.
// ⚠ 클래스 이름은 소스에 **통째로** 적혀 있어야 들어간다. `text-${color}-500` 처럼 이어 붙여 만들면 빠진다
module.exports = {
  content: ['./index.html', './src/app.jsx'],
  theme: { extend: {} },
  plugins: [],
};
