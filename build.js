// 미리 만들기 (2026-10-15 app.js · 2026-11-11 app.css). 브라우저에서 하던 일을 PC에서 한 번만 한다.
//   src/app.jsx → app.js   (바벨: JSX 변환)
//   src/tw.css  → app.css  (테일윈드: src/app.jsx·index.html 에서 쓰는 클래스만)
// 쓰는 법: npm install (처음 한 번) → npm run build → sw.js 의 CACHE·OWN 과 index.html 의 app.js?v= · app.css?v= 를 같이 올린다
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Babel = require('@babel/standalone');

const src = fs.readFileSync(path.join(__dirname, 'src', 'app.jsx'), 'utf8');
const out = Babel.transform(src, { presets: ['react'], comments: false, compact: false }).code;
const head = '/* 생성 파일 — 고치지 말 것. 원본은 src/app.jsx, 다시 만들기: npm run build */\n';
fs.writeFileSync(path.join(__dirname, 'app.js'), head + out + '\n');
console.log('app.js ', (out.length / 1024).toFixed(1) + 'KB');

const cli = path.join(__dirname, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
const cssOut = path.join(__dirname, 'app.css');
execFileSync(process.execPath, [cli, '-c', path.join(__dirname, 'tailwind.config.js'), '-i', path.join(__dirname, 'src', 'tw.css'), '-o', cssOut, '--minify'],
  { cwd: __dirname, stdio: ['ignore', 'ignore', 'inherit'] });
const css = fs.readFileSync(cssOut, 'utf8');
fs.writeFileSync(cssOut, '/* 생성 파일 — 고치지 말 것. 원본은 src/tw.css + 소스에서 쓰는 클래스, 다시 만들기: npm run build */\n' + css);
console.log('app.css', (css.length / 1024).toFixed(1) + 'KB');
