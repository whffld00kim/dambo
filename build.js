// src/app.jsx → app.js (2026-10-15). 브라우저에서 바벨을 돌리던 것을 PC에서 한 번만 한다.
// 쓰는 법: npm install (처음 한 번) → npm run build → sw.js 의 CACHE 와 index.html 의 app.js?v= 를 같이 올린다
const fs = require('fs');
const path = require('path');
const Babel = require('@babel/standalone');
const src = fs.readFileSync(path.join(__dirname, 'src', 'app.jsx'), 'utf8');
const out = Babel.transform(src, { presets: ['react'], comments: false, compact: false }).code;
const head = '/* 생성 파일 — 고치지 말 것. 원본은 src/app.jsx, 다시 만들기: npm run build */\n';
fs.writeFileSync(path.join(__dirname, 'app.js'), head + out + '\n');
console.log('app.js', (out.length / 1024).toFixed(1) + 'KB');
