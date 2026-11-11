/* 담보비율 화면 (React). ⚠ 이 파일이 원본이다 — 고친 뒤 `npm run build`로 ../app.js 와 ../app.css 를 다시 만든다 (2026-10-15, css 는 2026-11-11).
   전엔 index.html 안의 <script type="text/babel">을 폰 브라우저가 열 때마다 변환했다(CPU 4배 느린 조건에서 약 1.8초 + 변환기 파일 받기).
   이제 미리 변환한 app.js 를 부른다. 바벨·테일윈드는 PC에만 있다 */
const { useState, useMemo, useRef, useEffect } = React;

// 삼성증권 신용 최저유지(적용)비율의 기본값. 2026-11-10 140 → 130 (한시 인하).
// 2026-11-11부터 화면의 「최저유지비율」 칸(클라우드 portfolio.minRatio)이 있으면 그 값이 우선이다 — 원복 때 빌드 없이 바꾼다
const DEFAULT_MIN_RATIO = 130;
const REF_RATIO = 140;            // 인하 전(원복 뒤) 비율. 지금 기준과 다르면 카드에 같이 보여 준다
const validRatio = (v) => (typeof v === 'number' && v >= 100 && v <= 300) ? v : DEFAULT_MIN_RATIO;

/* ── 숫자 포매터 ── */
const fmt  = (n) => (isNaN(n) || n == null) ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtW = (n) => `${fmt(n)}원`;
const fmtP = (n) => isFinite(n) ? `${n.toFixed(2)}%` : '∞%';
const num  = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
const fmtWhen = (ms) => {
  const d = new Date(ms);
  if (!ms || isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/* 같은 종목의 일반·신용은 한 묶음 — 이름 끝의 「(신용)」「(일반)」을 뗀 것이 같으면 같은 종목이다 */
const baseName = (n) => String(n || '').replace(/\s*\((신용|일반)\)\s*$/, '').trim();

/* ── 핵심 계산 ── */
function calc(stocks, bonds, cash, loan, minRatio = DEFAULT_MIN_RATIO) {
  const won = stocks.filter(s => s.type === 'credit')
    .reduce((sum, s) => sum + (s.quantity||0) * (s.currentPrice||0), 0);
  const stockBu = stocks.filter(s => s.type === 'normal')
    .reduce((sum, s) => sum + (s.quantity||0) * (s.currentPrice||0), 0);
  const bu    = stockBu + (bonds||0) + (cash||0);
  const total = won + bu;
  const ratio = (loan > 0) ? (total / loan) * 100 : Infinity;
  const required = (loan||0) * (minRatio / 100);
  const shortage = Math.max(0, required - total);
  const surplus  = Math.max(0, total - required);
  return { won, bu, stockBu, total, ratio, required, shortage, surplus, minRatio, loan: loan || 0 };
}

/* ── 추가매수가 가리키는 종목 찾기 ──
   추가매수는 종목 번호(stockId)와 그때의 이름을 함께 들고 있다. PC에서 사진으로 갱신하면 번호가 다시 매겨질 수 있어서
   (2026-11-11 점검) 번호만 믿지 않는다: 번호와 이름이 같이 맞으면 그 종목, 아니면 이름으로 다시 찾고,
   그래도 없으면 같은 종목의 다른 구분(일반·신용) 줄. 끝내 없으면 null — 계산에서 빼고 목록에 「종목 없음」으로 보인다 */
function resolveBuy(stocks, buy) {
  if (!buy || buy.stockId === 'new') return null;
  const sid = parseInt(buy.stockId);
  const byId = stocks.find(s => s.id === sid);
  if (byId && (!buy.name || byId.name === buy.name)) return byId;
  const byName = stocks.find(s => s.name === buy.name);
  if (byName) return byName;
  const k = baseName(buy.name);
  const same = stocks.filter(s => baseName(s.name) === k);
  if (same.length) return same.find(s => s.type === buy.type) || same[0];
  return null;
}
/* 찾은 종목의 번호로 맞춰 둔다(번호가 다시 매겨진 뒤에도 다음부터는 번호로 바로 찾게) */
function normalizeBuys(stocks, buys) {
  return buys.map(b => {
    if (!b || b.stockId === 'new') return b;
    const t = resolveBuy(stocks, b);
    return t && String(t.id) !== String(b.stockId) ? { ...b, stockId: String(t.id) } : b;
  });
}

/* ── 추가매수 적용 → mergedStocks / extraLoan / orphans(가리키던 종목이 없어진 매수의 번호) ── */
function applyExtraBuys(baseStocks, extraBuys) {
  let stocks = baseStocks.map(s => ({ ...s }));
  let extraLoan = 0;
  const orphans = [];

  for (const buy of extraBuys) {
    const evalAmt = (buy.qty||0) * (buy.price||0);
    if (buy.stockId === 'new') {
      stocks.push({
        id: `extra_${buy.id}`,
        name: buy.name,
        quantity: buy.qty,
        avgPrice: buy.price,
        currentPrice: buy.price,
        type: buy.type,
      });
    } else {
      const target = resolveBuy(baseStocks, buy);
      if (!target) { orphans.push(buy.id); continue; }      // 수량도 융자도 더하지 않는다
      stocks = stocks.map(s =>
        s.id === target.id ? { ...s, quantity: (s.quantity||0) + (buy.qty||0) } : s
      );
    }
    if (buy.type === 'credit') extraLoan += evalAmt; // 대용증거금 방식: 매수금액 100% 융자 증가
  }
  return { mergedStocks: stocks, extraLoan, orphans };
}

/* ── 어디까지 떨어지면 최저유지비율에 닿는가 (2026-11-11) ──
   all    = 전 종목이 같은 비율로 움직일 때의 변화율(%)
   groups = 종목 묶음(같은 종목의 일반·신용) 하나만 움직일 때의 변화율(%)과 그때 가격
   변화율이 0 이상이면 이미 부족, −100 이하면 0원이 되어도 유지 */
function breakEven(stocks, bonds, cash, loan, minRatio) {
  const val = (s) => (s.quantity||0) * (s.currentPrice||0);
  const stockTotal = stocks.reduce((a, s) => a + val(s), 0);
  if (!(loan > 0) || !(stockTotal > 0)) return null;
  const required = loan * (minRatio / 100);
  const total = stockTotal + (bonds||0) + (cash||0);
  const groups = {};
  for (const s of stocks) {
    const k = baseName(s.name);
    const g = (groups[k] = groups[k] || { base: k, value: 0, price: s.currentPrice || 0, ids: [] });
    g.value += val(s);
    g.ids.push(s.id);
  }
  const list = Object.values(groups).filter(g => g.value > 0).map(g => {
    const chg = ((required - (total - g.value)) / g.value - 1) * 100;
    return { ...g, chg, target: g.price * (1 + chg / 100) };
  }).sort((a, b) => b.value - a.value);
  return { all: ((required - (bonds||0) - (cash||0)) / stockTotal - 1) * 100, groups: list };
}
/* 변화율 글자. 0 이상이면 이미 부족한 상태라 「그만큼 올라야 닿는다」는 뜻이다 */
const dropText = (chg) => chg <= -100 ? '0원이 되어도 유지' : `${chg > 0 ? '+' : ''}${chg.toFixed(1)}%`;

/* 수정 중인 것이 있으면(종목 수정 카드·창) 클라우드 값을 받아 넣지 않고 기다린다 — index.html 의 tryRefresh 가 본다 */
const damboUi = { editing: 0 };

/* ── 숫자 입력 (쉼표 포매팅) ──
   포커스 중에는 친 글자를 그대로 보여 준다(2026-11-11 — 전엔 값에서 다시 만들어 보여 줘서 「-」를 치는 순간 사라졌다).
   negative 를 주면 맨 앞의 빼기를 받는다(현금예수금) */
function NumInput({ value, onChange, className = '', placeholder = '0', negative = false }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  return (
    <input
      type="text"
      inputMode="numeric"
      className={`min-w-0 border rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
      value={focused ? text : fmt(value)}
      placeholder={placeholder}
      onFocus={() => { setFocused(true); setText(value === 0 ? '' : String(value)); }}
      onBlur={() => setFocused(false)}
      onChange={e => {
        let raw = e.target.value;
        const minus = negative && /^\s*[-−]/.test(raw);
        raw = raw.replace(/[^0-9]/g, '');           // 원·주 단위라 숫자만 받는다(쉼표·소수점·글자는 버린다)
        if (minus) raw = '-' + raw;
        setText(raw);
        const n = parseInt(raw, 10);
        onChange(isNaN(n) ? 0 : n);
      }}
    />
  );
}

/* ── 가격 직접 입력 전용 컴포넌트 ──
   포커스 중에는 로컬 버퍼를 표시하므로,
   외부 value가 재계산되어도 입력 중 커서/텍스트가 초기화되지 않음 ── */
function PriceInput({ value, onChange, className = '' }) {
  const [focused,   setFocused]   = useState(false);
  const [localVal,  setLocalVal]  = useState('');

  const handleFocus = () => {
    setFocused(true);
    setLocalVal(value === 0 ? '' : String(Math.round(value)));
  };
  const handleChange = (e) => {
    const raw = e.target.value.replace(/,/g, '');
    setLocalVal(raw);                       // 로컬 버퍼만 업데이트 (display 고정)
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 0) onChange(n);  // 유효 숫자일 때만 외부로 전달
  };
  // 비우거나 숫자가 아닌 채로 나오면 아무것도 바꾸지 않는다 (2026-11-11 — 전엔 0원 = −100% 가 됐다). 고친 값은 칠 때 이미 전달됐다
  const handleBlur = () => setFocused(false);

  return (
    <input
      type="text"
      inputMode="numeric"
      className={`min-w-0 border rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
      value={focused ? localVal : fmt(value)}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}

/* ══════════════════════════════════
   담보비율 요약 카드
══════════════════════════════════ */
function RatioCard({ result, label = '현재 담보비율', subLabel = null, children = null }) {
  const { won, bu, total, ratio, shortage, surplus, minRatio, loan } = result;
  const danger  = ratio < minRatio;
  const warning = ratio >= minRatio && ratio < 170;
  const ratioClass = danger ? 'text-red-500' : warning ? 'text-yellow-500' : 'text-emerald-500';
  const barClass   = danger ? 'bg-red-500'   : warning ? 'bg-yellow-400'   : 'bg-emerald-500';

  const MAX_DISPLAY = 350;
  const barPct  = Math.min(100, (ratio / MAX_DISPLAY) * 100);
  const markMin = (minRatio / MAX_DISPLAY) * 100;
  const mark200 = (200 / MAX_DISPLAY) * 100;
  const refGap  = total - loan * (REF_RATIO / 100);     // 원복(140%) 기준으로 남거나 모자라는 금액

  return (
    <div className="tb-ratio bg-white rounded-2xl shadow-md p-5 mb-4">
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-gray-500 font-semibold">{label}</span>
          {subLabel && <div className="text-xs text-blue-500 font-medium mt-0.5">{subLabel}</div>}
        </div>
        <span className={`tb-ratio-num text-4xl font-extrabold tabular-nums ${ratioClass}`}>{fmtP(ratio)}</span>
      </div>
      {/* 아래 여백은 게이지 눈금 글자(막대 위 20px)가 이 줄과 겹치지 않을 만큼 */}
      <div className="tb-ratio-req text-right text-xs text-gray-400 mb-7">최저유지 {minRatio}% · 필요담보금액 {fmtW(result.required)}</div>

      {/* 게이지 바 */}
      <div className="tb-gauge relative mb-6">
        <div className="h-5 bg-gray-100 rounded-full overflow-visible">
          <div className={`h-full rounded-full transition-all duration-500 ${barClass}`}
               style={{ width: `${barPct}%` }} />
        </div>
        <div className="tb-gauge-mark absolute top-0 bottom-0 flex flex-col items-center"
             style={{ left: `${markMin}%`, transform: 'translateX(-50%)' }}>
          <div className="absolute -top-5 text-xs font-bold text-red-500 whitespace-nowrap">{minRatio}%</div>
          <div className="w-0.5 h-5 bg-red-500 mt-0" />
        </div>
        <div className="tb-gauge-mark absolute top-0 bottom-0 flex flex-col items-center"
             style={{ left: `${mark200}%`, transform: 'translateX(-50%)' }}>
          <div className="absolute -top-5 text-xs font-bold text-emerald-600 whitespace-nowrap">200%</div>
          <div className="w-0.5 h-5 bg-emerald-500 mt-0" />
        </div>
      </div>

      <div className="tb-ratio-grid3 grid grid-cols-3 gap-2 mb-3">
        {[
          { label: '총담보금액', val: total, bg: 'bg-blue-50',   txt: 'text-blue-800'   },
          { label: '원담보금액', val: won,   bg: 'bg-orange-50', txt: 'text-orange-800' },
          { label: '부담보금액', val: bu,    bg: 'bg-indigo-50', txt: 'text-indigo-800' },
        ].map(({ label: l, val, bg, txt }) => (
          <div key={l} className={`${bg} rounded-xl px-1 py-2.5 text-center`}>
            <div className="text-xs text-gray-400 mb-1">{l}</div>
            {/* 10자리 금액이 접은 화면 한 칸에 들어가게 글자 사이를 조금 좁힌다(전엔 「원」만 다음 줄로 넘어갔다) */}
            <div className={`tb-money3 text-xs font-bold ${txt} whitespace-nowrap tracking-tight`}>{fmtW(val)}</div>
          </div>
        ))}
      </div>

      <div className="tb-ratio-grid2 grid grid-cols-2 gap-2">
        <div className={`rounded-xl p-2.5 text-center ${danger ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className="text-xs text-gray-400 mb-1">담보부족금액</div>
          <div className={`text-sm font-bold ${danger ? 'text-red-600' : 'text-gray-300'}`}>
            {shortage > 0 ? fmtW(shortage) : '부족 없음'}
          </div>
        </div>
        <div className={`rounded-xl p-2.5 text-center ${danger ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <div className="text-xs text-gray-400 mb-1">{minRatio}% 여유금액</div>
          <div className={`text-sm font-bold ${danger ? 'text-red-600' : 'text-emerald-600'}`}>
            {danger ? `-${fmtW(shortage)}` : fmtW(surplus)}
          </div>
        </div>
      </div>

      {/* 원복 기준 — 지금 쓰는 비율이 140%가 아닐 때만 (한시 인하가 끝나는 날 바로 담보부족이 되는지 미리 본다) */}
      {minRatio !== REF_RATIO && loan > 0 && (
        <div className={`tb-ratio-ref mt-2 text-xs text-center ${refGap < 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
          원복({REF_RATIO}%) 기준이면 {refGap < 0 ? `부족 ${fmtW(-refGap)}` : `여유 ${fmtW(refGap)}`}
        </div>
      )}
      {children}
    </div>
  );
}

/* 「어디까지 떨어지면」 — 포트폴리오 탭의 비율 카드 아래쪽 (2026-11-11) */
function BreakEvenBox({ stocks, bonds, cash, loan, minRatio }) {
  const be = useMemo(() => breakEven(stocks, bonds, cash, loan, minRatio), [stocks, bonds, cash, loan, minRatio]);
  if (!be) return null;
  return (
    <div className="tb-be mt-3 pt-3 border-t border-gray-100 text-xs">
      <div className="flex justify-between text-gray-500 mb-1">
        <span className="font-semibold">{minRatio}%에 닿는 지점</span>
        <span className="text-gray-400">지금 값 기준</span>
      </div>
      <div className="flex justify-between py-0.5">
        <span className="text-gray-500">전 종목이 함께 움직이면</span>
        <span className={`font-bold tabular-nums ${be.all >= 0 ? 'text-red-600' : 'text-gray-700'}`}>{dropText(be.all)}</span>
      </div>
      {/* 혼자서는 0원이 되어도 닿지 않는 종목은 적지 않는다(줄만 늘어난다). 큰 것부터 셋까지 */}
      {be.groups.filter(g => g.chg > -100).slice(0, 3).map(g => (
        <div key={g.base} className="flex justify-between gap-2 py-0.5">
          <span className="text-gray-500 truncate">{g.base}만 움직이면</span>
          <span className={`shrink-0 font-bold tabular-nums ${g.chg >= 0 ? 'text-red-600' : 'text-gray-700'}`}>
            {fmtW(g.target)} ({dropText(g.chg)})
          </span>
        </div>
      ))}
    </div>
  );
}

/* 종목 한 줄을 고치는 카드 — 접은 화면의 카드 목록과 넓은 화면의 표가 같은 것을 쓴다
   (2026-11-11 — 전엔 표 안에 입력칸을 줄줄이 넣어, 펼친 화면에서 다른 줄이 두 줄로 접히고 구분 칸이 「신」만 보였다) */
function StockEditCard({ data, setData, onSave, onCancel }) {
  return (
    <div className="tb-editcard bg-yellow-50 border border-yellow-200 rounded-xl p-3 shadow-sm text-left">
      <input className="border rounded-lg px-2 py-1.5 w-full text-sm mb-2 bg-white"
        value={data.name}
        placeholder="종목명"
        onChange={e => setData(d => ({ ...d, name: e.target.value }))} />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-xs text-gray-400 block mb-0.5">수량</label>
          <NumInput value={data.quantity}
            onChange={v => setData(d => ({ ...d, quantity: v }))} className="w-full bg-white" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-0.5">현재가</label>
          <NumInput value={data.currentPrice}
            onChange={v => setData(d => ({ ...d, currentPrice: v }))} className="w-full bg-white" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs text-gray-400">평가금액</span>
        <span className="text-xs font-bold text-gray-600 tabular-nums">
          {fmtW((data.quantity||0) * (data.currentPrice||0))}
        </span>
      </div>
      <div className="flex gap-1.5 mb-2">
        {['normal', 'credit'].map(t => (
          <button key={t} onClick={() => setData(d => ({ ...d, type: t }))}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all
              ${data.type === t
                ? (t === 'normal' ? 'bg-blue-500 text-white border-blue-500' : 'bg-orange-500 text-white border-orange-500')
                : 'bg-white text-gray-400 border-gray-200'}`}>
            {t === 'normal' ? '일반' : '신용'}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button onClick={onSave}
          className="flex-1 bg-blue-500 text-white rounded-lg py-2 text-xs font-bold">저장</button>
        <button onClick={onCancel}
          className="flex-1 bg-gray-200 text-gray-600 rounded-lg py-2 text-xs font-bold">취소</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════
   탭 1 : 현재 포트폴리오
══════════════════════════════════ */
function Tab1({ stocks, setStocks, bonds, setBonds, cash, setCash, loan, setLoan, minRatio, setMinRatio, extraBuys, setExtraBuys, priceAt, onPriceEdit }) {
  const [editId,   setEditId]   = useState(null);     // 고치는 종목 번호, 새 종목이면 'new'
  const [editData, setEditData] = useState({});
  // 새 종목 번호는 지금 있는 번호의 최댓값 + 1 (2026-10-12 — 열 때마다 100부터 다시 세서 저장된 종목과 겹쳤다)
  const newStockId = () => Math.max(99, ...stocks.map(s => Number(s.id) || 0)) + 1;
  useEffect(() => { if (editId == null) return; damboUi.editing++; return () => { damboUi.editing--; }; }, [editId]);

  const startEdit  = (s) => { setEditId(s.id); setEditData({ ...s }); };
  const saveEdit   = () => {
    const name = String(editData.name || '').trim() || '신규종목';
    if (editId === 'new') {
      setStocks(prev => [...prev, { ...editData, name, id: newStockId() }]);
    } else {
      const before = stocks.find(s => s.id === editId);
      setStocks(prev => prev.map(s => s.id === editId ? { ...editData, name } : s));
      if (before && before.currentPrice !== editData.currentPrice && onPriceEdit) onPriceEdit();     // 손으로 고친 값이 섞였으니 「시세 자동 반영」 표시는 내린다
      // 이름을 바꾸면 그 종목을 가리키는 추가매수의 이름도 같이 바꾼다(추가매수는 번호와 이름으로 종목을 찾는다)
      if (before && before.name !== name) {
        setExtraBuys(prev => prev.map(b => (b.stockId !== 'new' && (resolveBuy(stocks, b) || {}).id === editId) ? { ...b, name } : b));
      }
    }
    setEditId(null);
  };
  const cancelEdit  = () => setEditId(null);
  // 지우기 전에 한 번 묻는다 (2026-10-17 — 폰에서 값을 고치다 한 줄이 확인 없이 지워졌다. 「수정」 바로 옆이라 잘못 눌리기 쉽다)
  const deleteStock = (s) => {
    const linked = extraBuys.filter(b => b.stockId !== 'new' && (resolveBuy(stocks, b) || {}).id === s.id);
    const more = linked.length ? `\n이 종목의 추가매수 ${linked.length}건도 함께 지웁니다.` : '';
    if (!confirm(`${s.name}(${s.type === 'credit' ? '신용' : '일반'}) 종목을 지울까요?${more}`)) return;
    setStocks(prev => prev.filter(x => x.id !== s.id));
    const gone = linked.map(b => b.id);
    if (gone.length) setExtraBuys(prev => prev.filter(b => !gone.includes(b.id)));
  };
  // 새 종목은 「저장」을 눌러야 목록에 들어간다 (2026-11-11 — 전엔 누르는 순간 「신규종목 0주」가 들어가 「취소」해도 남았다)
  const addStock    = () => { setEditId('new'); setEditData({ name: '', quantity: 0, avgPrice: 0, currentPrice: 0, type: 'normal' }); };
  const editCard    = <StockEditCard data={editData} setData={setEditData} onSave={saveEdit} onCancel={cancelEdit} />;

  return (
    <div className="tb-inputs">
      {/* ── 넓은 화면(640px+): 테이블 ── */}
      <div className="tb-table-wrap hidden sm:block overflow-x-auto mb-3">
        <table className="tb-table w-full text-sm bg-white rounded-xl shadow overflow-hidden min-w-[420px]">
          <thead className="bg-slate-700 text-white text-xs">
            <tr>
              <th className="px-3 py-2 text-left whitespace-nowrap">종목명</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">수량</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">현재가</th>
              <th className="px-3 py-2 text-right whitespace-nowrap">평가금액</th>
              <th className="px-3 py-2 text-center whitespace-nowrap">구분</th>
              <th className="px-3 py-2 text-center whitespace-nowrap">관리</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s, i) => {
              const evalAmt = (s.quantity||0) * (s.currentPrice||0);
              if (editId === s.id) return (
                <tr key={s.id} className="tb-editrow border-b border-yellow-100">
                  <td colSpan={6} className="p-2">{editCard}</td>
                </tr>
              );
              return (
                <tr key={s.id} className={`border-b hover:bg-gray-50 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-3 py-2 font-medium">
                    {s.name}
                    {s.type === 'credit' &&
                      <span className="ml-1.5 bg-orange-100 text-orange-600 text-xs px-1 rounded">신용</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(s.quantity)}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(s.currentPrice)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap">{fmtW(evalAmt)}</td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium
                      ${s.type === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {s.type === 'credit' ? '신용' : '일반'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center whitespace-nowrap">
                    <button onClick={() => startEdit(s)}
                      className="tb-rowbtn bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold mr-1.5">수정</button>
                    <button onClick={() => deleteStock(s)}
                      className="tb-rowbtn bg-red-50 text-red-500 hover:bg-red-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold">삭제</button>
                  </td>
                </tr>
              );
            })}
            {editId === 'new' && (
              <tr className="tb-editrow">
                <td colSpan={6} className="p-2">{editCard}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 좁은 화면(폴드 분할·커버): 카드 목록 ── */}
      <div className="sm:hidden space-y-2 mb-3">
        {stocks.map(s => {
          const evalAmt = (s.quantity||0) * (s.currentPrice||0);
          if (editId === s.id) return <div key={s.id}>{editCard}</div>;
          return (
            <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-sm truncate">{s.name}</span>
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium
                    ${s.type === 'credit' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    {s.type === 'credit' ? '신용' : '일반'}
                  </span>
                </div>
                {/* 누르는 자리를 키우고 사이를 띄운다 (2026-11-11 — 전엔 24×16px 두 개가 8px 붙어 있었다) */}
                <div className="shrink-0 whitespace-nowrap flex gap-2">
                  <button onClick={() => startEdit(s)}
                    className="bg-blue-50 text-blue-600 rounded-lg px-3 py-2 text-xs font-semibold">수정</button>
                  <button onClick={() => deleteStock(s)}
                    className="bg-red-50 text-red-500 rounded-lg px-3 py-2 text-xs font-semibold">삭제</button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400 tabular-nums whitespace-nowrap">
                  {fmt(s.quantity)}주 × {fmt(s.currentPrice)}원
                </span>
                <span className="font-bold text-gray-700 tabular-nums whitespace-nowrap">
                  {fmtW(evalAmt)}
                </span>
              </div>
            </div>
          );
        })}
        {editId === 'new' && editCard}
      </div>

      <div className="tb-addrow flex items-center justify-between gap-3 mb-4">
        <button onClick={addStock} disabled={editId != null}
          className={`tb-add rounded-lg px-4 py-2 text-sm font-medium shadow text-white ${editId != null ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'}`}>
          + 종목 추가
        </button>
        {priceAt ? <span className="text-xs text-gray-400 text-right">현재가: {fmtWhen(priceAt)} 시세 자동 반영</span> : null}
      </div>

      <div className="tb-etc bg-white rounded-xl shadow p-4">
        <h3 className="font-semibold text-gray-600 text-sm mb-3">기타 자산 · 부채</h3>
        <div className="tb-etc-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">채권평가금액</label>
            <NumInput value={bonds} onChange={setBonds} className="w-full bg-gray-50" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">현금예수금</label>
              {/* 숫자 자판에 빼기가 없을 때를 위해 — 누르면 부호가 바뀐다 */}
              <button onClick={() => setCash(-cash)} title="부호 바꾸기"
                className="tb-sign text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded px-2 py-0.5 -my-0.5">＋／−</button>
            </div>
            <NumInput value={cash} onChange={setCash} negative className={`w-full bg-gray-50 ${cash < 0 ? 'text-red-600' : ''}`} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">신용융자금액</label>
            <NumInput value={loan} onChange={setLoan} className="w-full bg-red-50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">최저유지비율 (%)</label>
            <NumInput value={minRatio} onChange={setMinRatio} className="w-full bg-gray-50" placeholder={String(DEFAULT_MIN_RATIO)} />
          </div>
        </div>
        {validRatio(minRatio) !== minRatio && (
          <p className="text-xs text-red-500 mt-2">최저유지비율은 100~300 사이여야 합니다 — 지금은 {DEFAULT_MIN_RATIO}%로 계산합니다.</p>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════
   탭 2 : 추가매수 시뮬레이션 (다중 입력) + 입금·상환 + 목표 비율
══════════════════════════════════ */
function Tab2({ stocks, bonds, cash, loan, extraBuys, setExtraBuys, orphans, sim, setSim, minRatio, merged, onFill, onApplySim }) {
  // 추가매수 번호도 최댓값 + 1 (2026-10-12 — 500부터 다시 세서 ✕ 하나에 두 건이 지워졌다)
  const newBuyId = () => Math.max(499, ...extraBuys.map(b => Number(b.id) || 0)) + 1;

  /* 입력 폼 상태 */
  const [selId,    setSelId]    = useState('new');
  const [newName,  setNewName]  = useState('');
  const [addQty,   setAddQty]   = useState(0);
  const [addPrice, setAddPrice] = useState(0);
  const [addType,  setAddType]  = useState('normal');
  const [target,   setTarget]   = useState(() => { try { return Number(localStorage.getItem('dambo_target')) || 150; } catch { return 150; } });
  useEffect(() => { try { localStorage.setItem('dambo_target', String(target)); } catch {} }, [target]);

  const selStock = selId === 'new' ? null : stocks.find(s => String(s.id) === String(selId));
  // 고른 종목이 포트폴리오에서 없어졌으면 「신규 종목」으로 돌린다 (2026-11-11 — 전엔 이름 「?」인 매수가 들어갔다)
  useEffect(() => { if (selId !== 'new' && !selStock) setSelId('new'); }, [selId, selStock]);
  // 종목을 고르면 잔고 구분을 그 종목에 맞춘다 (2026-11-11 — 신용 종목을 골라도 「일반」인 채였다). 고른 뒤에 직접 바꿀 수는 있다
  const pickStock = (v) => {
    setSelId(v);
    const s = stocks.find(x => String(x.id) === String(v));
    if (s) setAddType(s.type === 'credit' ? 'credit' : 'normal');
  };

  /* 폼 유효성 */
  const formValid = addQty > 0 && addPrice > 0 && (selId !== 'new' ? !!selStock : newName.trim() !== '');

  /* 미리보기: 이 건이 체결될 때 = 그 종목(일반·신용 함께)이 매수 가격이 됐을 때의 담보비율
     (2026-11-11 — 전엔 지금 값으로 평가해, 그 값까지 내려와 체결됐을 때보다 높게 나왔다) */
  const previewResult = useMemo(() => {
    if (!formValid) return null;
    const name = selStock ? selStock.name : newName;
    const previewBuy = { id: -1, stockId: selId, name, qty: addQty, price: addPrice, type: addType };
    const { mergedStocks: ms, extraLoan: el } = applyExtraBuys(stocks, [...extraBuys, previewBuy]);
    const k = baseName(name);
    const at = ms.map(s => baseName(s.name) === k ? { ...s, currentPrice: addPrice } : s);
    const repay = Math.max(0, Math.min(sim.repay || 0, loan + el));
    return calc(at, bonds, cash + (sim.deposit || 0) - repay, loan + el - repay, minRatio);
  }, [stocks, bonds, cash, loan, extraBuys, selId, selStock, newName, addQty, addPrice, addType, formValid, sim, minRatio]);

  const handleAdd = () => {
    if (!formValid) return;
    setExtraBuys(prev => [...prev, {
      id: newBuyId(),
      stockId: selId,
      name: selStock ? selStock.name : newName.trim(),
      qty: addQty,
      price: addPrice,
      type: addType,
    }]);
    setAddQty(0);
    setAddPrice(0);
    if (selId === 'new') setNewName('');
  };

  const removeBuy = (id) => setExtraBuys(prev => prev.filter(b => b.id !== id));
  // 한 번에 다 지우는 것은 묻고 지운다 (2026-11-11 — 서버에서도 지워지고 되돌릴 수 없다)
  const clearAll  = () => { if (confirm(`추가매수 ${extraBuys.length}건을 모두 지울까요?`)) setExtraBuys([]); };

  /* 목표 비율 계산 — 추가매수·입금·상환을 반영한 지금 값 기준 */
  const T = target / 100;
  const goal = useMemo(() => {
    const { total, loan: L, cash: C } = merged;
    if (!(L > 0) || !(T > 1)) return null;
    const gap = T * L - total;                     // 양수면 모자람
    return {
      deposit: Math.max(0, gap),                   // 밖에서 넣으면
      repay: gap > 0 ? gap / (T - 1) : 0,          // 계좌의 현금으로 융자를 갚으면 (담보와 융자가 같이 준다)
      cash: C,
      room: gap < 0 ? -gap / (T - 1) : 0,          // 그 비율을 지키며 신용으로 더 살 수 있는 금액
    };
  }, [merged, T]);
  const simOn = (sim.deposit || 0) > 0 || (sim.repay || 0) > 0;

  return (
    <div className="tb-buy">
      <div className="tb-buy-left">
      {/* ── 추가 매수 입력 폼 ── */}
      <div className="tb-buyform bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-semibold text-gray-600 text-sm mb-3">매수 추가</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

          <div className="sm:col-span-2">
            <label className="text-xs text-gray-400 block mb-1">종목 선택</label>
            <select className="w-full border rounded-lg px-2 py-1.5 text-sm"
              value={selStock ? String(selStock.id) : 'new'} onChange={e => pickStock(e.target.value)}>
              <option value="new">+ 신규 종목</option>
              {stocks.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.type === 'credit' ? '신용' : '일반'}) — {fmt(s.currentPrice)}원
                </option>
              ))}
            </select>
          </div>

          {selId === 'new' && (
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-400 block mb-1">종목명</label>
              <input className="w-full border rounded-lg px-2 py-1.5 text-sm"
                value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="종목명 입력" />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 block mb-1">수량</label>
            <NumInput value={addQty} onChange={setAddQty} className="w-full bg-gray-50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">매수 가격</label>
            <NumInput value={addPrice} onChange={setAddPrice} className="w-full bg-gray-50" />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs text-gray-400 block mb-1">잔고 구분</label>
            <div className="flex gap-2">
              {['normal', 'credit'].map(t => (
                <button key={t} onClick={() => setAddType(t)}
                  className={`tb-typebtn flex-1 py-2 rounded-lg text-sm font-semibold border transition-all
                    ${addType === t
                      ? (t === 'normal' ? 'bg-blue-500 text-white border-blue-500' : 'bg-orange-500 text-white border-orange-500')
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  {t === 'normal' ? '일반' : '신용'}
                </button>
              ))}
            </div>
            {selStock && selStock.type !== addType && (
              <p className="text-xs text-amber-600 mt-1">고른 종목은 {selStock.type === 'credit' ? '신용' : '일반'} 줄입니다 — {addType === 'credit' ? '신용(융자가 늘어남)' : '일반(융자가 늘지 않음)'}으로 계산합니다.</p>
            )}
          </div>

          {/* 미리보기 */}
          {previewResult && (
            <div className="tb-preview sm:col-span-2 bg-slate-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">매수금액</span>
                <span className="font-bold">{fmtW(addQty * addPrice)}</span>
              </div>
              {addType === 'credit' && (
                <div className="flex justify-between text-orange-600">
                  <span>융자증가 (100% · 대용증거금)</span>
                  <span className="font-bold">+{fmtW(addQty * addPrice)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="text-gray-500">이 건 체결 시 담보비율</span>
                <span className={`tb-preview-ratio font-bold tabular-nums ${previewResult.ratio >= minRatio ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmtP(previewResult.ratio)}
                </span>
              </div>
              <div className="text-xs text-gray-400">그 종목이 {fmt(addPrice)}원일 때 · 목록의 추가매수 포함</div>
            </div>
          )}

          <button
            onClick={handleAdd}
            disabled={!formValid}
            className={`sm:col-span-2 py-2.5 rounded-xl text-sm font-bold transition-all
              ${formValid
                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
            + 목록에 추가
          </button>
        </div>
      </div>

      {/* ── 입금·상환 시뮬레이션 + 목표 비율 (2026-11-11) ── */}
      <div className="tb-sim bg-white rounded-xl shadow p-4 mb-4">
        <h3 className="font-semibold text-gray-600 text-sm mb-3">입금 · 상환</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">입금 (밖에서 넣는 돈)</label>
            <NumInput value={sim.deposit || 0} onChange={v => setSim(s => ({ ...s, deposit: Math.max(0, v) }))} className="w-full bg-gray-50" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">현금으로 융자 상환</label>
            <NumInput value={sim.repay || 0} onChange={v => setSim(s => ({ ...s, repay: Math.max(0, v) }))} className="w-full bg-gray-50" />
          </div>
        </div>
        {simOn && (
          <div className="mt-3 bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">반영하면 담보비율 (지금 값)</span>
              <span className={`tb-sim-ratio font-bold tabular-nums ${merged.ratio >= minRatio ? 'text-emerald-600' : 'text-red-600'}`}>{fmtP(merged.ratio)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>현금 {fmtW(merged.cash)} · 융자 {fmtW(merged.loan)}</span>
            </div>
            {(sim.repay || 0) > Math.max(0, cash + (sim.deposit || 0)) && (
              <div className="text-xs text-red-500">상환할 현금이 모자랍니다 (현금예수금 + 입금보다 큽니다).</div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={onApplySim}
                className="tb-sim-apply flex-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg py-2 text-xs font-bold">실제로 했음 — 보유 내역에 반영</button>
              <button onClick={() => setSim({ deposit: 0, repay: 0 })}
                className="bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-lg px-3 py-2 text-xs font-bold">지우기</button>
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-gray-500 font-semibold">목표 담보비율</span>
            <div className="flex items-center gap-1">
              <NumInput value={target} onChange={setTarget} className="tb-target w-20 bg-gray-50" />
              <span className="text-sm text-gray-400">%</span>
            </div>
          </div>
          {goal ? (
            goal.deposit > 0 ? (
              <div className="tb-goal text-xs space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">입금으로 맞추려면</span><span className="font-bold tabular-nums text-gray-700">{fmtW(goal.deposit)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">현금으로 상환해 맞추려면</span>
                  <span className={`font-bold tabular-nums ${goal.repay > goal.cash ? 'text-red-600' : 'text-gray-700'}`}>{fmtW(goal.repay)}{goal.repay > goal.cash ? ' (현금 부족)' : ''}</span></div>
              </div>
            ) : (
              <div className="tb-goal text-xs flex justify-between">
                <span className="text-gray-500">그 비율을 지키며 신용으로 더 살 수 있는 금액</span>
                <span className="font-bold tabular-nums text-gray-700">{fmtW(goal.room)}</span>
              </div>
            )
          ) : <div className="tb-goal text-xs text-gray-400">융자가 있고 목표가 100%보다 클 때 계산합니다.</div>}
          <div className="text-xs text-gray-300 mt-1">추가매수·입금·상환을 반영한 지금 값 기준</div>
        </div>
      </div>
      </div>

      {/* ── 추가매수 목록 ── */}
      {extraBuys.length > 0 && (
        <div className="tb-buylist bg-white rounded-xl shadow p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-600 text-sm">
              추가매수 목록
              <span className="ml-2 bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">
                {extraBuys.length}건
              </span>
            </h3>
            <button onClick={clearAll}
              className="text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-2">
              전체 삭제
            </button>
          </div>

          <div className="tb-buyitems space-y-2">
            {extraBuys.map((buy, idx) => {
              const orphan = orphans.includes(buy.id);
              return (
                <div key={buy.id} className={`tb-buyitem rounded-lg px-3 py-2 text-sm ${orphan ? 'bg-red-50' : 'bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-400 text-xs w-4 shrink-0">{idx + 1}</span>
                      <span className="font-medium truncate">{buy.name}</span>
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded
                        ${buy.type === 'credit' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {buy.type === 'credit' ? '신용' : '일반'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!orphan && (
                        <button onClick={() => onFill(buy)}
                          className="tb-fill bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold">체결</button>
                      )}
                      <button onClick={() => removeBuy(buy.id)} aria-label="지우기"
                        className="tb-x w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 text-sm">✕</button>
                    </div>
                  </div>
                  <div className="flex justify-between items-baseline gap-2 pl-6 text-xs tabular-nums">
                    <span className="text-gray-500 whitespace-nowrap">{fmt(buy.qty)}주 × {fmt(buy.price)}원</span>
                    <span className="font-bold text-gray-700 whitespace-nowrap">= {fmtW(buy.qty * buy.price)}</span>
                  </div>
                  {orphan && (
                    <div className="tb-orphan pl-6 mt-1 text-xs text-red-600">가리키던 종목이 포트폴리오에 없습니다 — 계산에서 뺐습니다. 지우거나 다시 넣어 주세요.</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 합계 */}
          <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
            <div className="flex justify-between text-gray-500 mb-1">
              <span>총 추가매수금액</span>
              <span className="font-bold tabular-nums text-gray-700">
                {fmtW(extraBuys.filter(b => !orphans.includes(b.id)).reduce((s, b) => s + b.qty * b.price, 0))}
              </span>
            </div>
            {merged.extraLoan > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>총 융자증가</span>
                <span className="font-bold tabular-nums">+{fmtW(merged.extraLoan)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 「전후 비교」 카드는 2026-10-09 삭제 — 사용자: "나에게 의미가 없다". 추가매수 후 담보비율은 가격 시나리오 탭에서 본다 */}
    </div>
  );
}

/* ══════════════════════════════════
   탭 3 : 가격 시나리오 (추가매수·입금·상환 반영)
══════════════════════════════════ */
function Tab3({ mergedStocks, bonds, cash, mergedLoan, extraBuys = [], changes, setChanges, minRatio, simNote }) {
  const extraBuyCount = extraBuys.length;

  const groupIds = id => {
    const me = mergedStocks.find(x => x.id === id);
    if (!me) return [id];
    const k = baseName(me.name);
    return mergedStocks.filter(x => baseName(x.name) === k).map(x => x.id);
  };

  /* 시나리오가 기본값 = 그 종목에 입력한 추가매수 중 가장 낮은 가격 (2026-09-07 사용자 요청).
     사용자가 직접 바꾼 값(changes)이 있으면 그쪽이 우선. 전체 초기화 → 다시 이 기본값으로 */
  const defaultChg = useMemo(() => {
    const minByBase = {};
    for (const b of extraBuys) {
      if (!(b.price > 0)) continue;
      const k = baseName(b.name);
      minByBase[k] = Math.min(minByBase[k] ?? Infinity, b.price);
    }
    const m = {};
    for (const st of mergedStocks) {
      const p = minByBase[baseName(st.name)];
      if (p && st.currentPrice > 0) m[st.id] = ((p - st.currentPrice) / st.currentPrice) * 100;
    }
    return m;
  }, [extraBuys, mergedStocks]);

  const getChg = id => changes[id] ?? defaultChg[id] ?? 0;
  const setChg = (id, v) => setChanges(prev => {
    const next = { ...prev };
    for (const gid of groupIds(id)) next[gid] = v;   // 일반·신용 함께 움직인다
    return next;
  });
  const resetAll = () => setChanges({});

  const simStocks = useMemo(() =>
    mergedStocks.map(s => ({
      ...s,
      currentPrice: Math.max(0, s.currentPrice * (1 + getChg(s.id) / 100)),
    })), [mergedStocks, changes, defaultChg]);

  const result     = useMemo(() => calc(simStocks, bonds, cash, mergedLoan, minRatio),     [simStocks, bonds, cash, mergedLoan, minRatio]);
  const baseResult = useMemo(() => calc(mergedStocks, bonds, cash, mergedLoan, minRatio),  [mergedStocks, bonds, cash, mergedLoan, minRatio]);
  const diff       = result.ratio - baseResult.ratio;

  /* 계좌 총잔고 = 증권사 「총평가금액」 = 주식 + 채권 + 현금 − 신용대출 (2026-10-15 사용자 요청).
     일반 추가매수는 현금으로 사므로 그 금액을 뺀다(calc의 cash엔 반영돼 있지 않다 — 담보비율 쪽은 2026-11-11 사용자 결정으로 그대로 둔다).
     신용 추가매수는 대출로 이미 상쇄 */
  const extraCashCost = extraBuys
    .filter(b => b.type !== 'credit')
    .reduce((sum, b) => sum + (b.qty || 0) * (b.price || 0), 0);
  const simBalance  = result.total     - mergedLoan - extraCashCost;
  const baseBalance = baseResult.total - mergedLoan - extraCashCost;
  const balDiff     = simBalance - baseBalance;
  const balPct      = baseBalance > 0 ? (balDiff / baseBalance) * 100 : 0;

  /* 종목 묶음마다 「이 종목만 더 움직여 최저유지비율에 닿는 값」 — 다른 종목은 지금 시나리오 값 그대로 */
  const edge = useMemo(() => {
    const required = mergedLoan * (minRatio / 100);
    const out = {};
    if (!(mergedLoan > 0)) return out;
    const byBase = {};
    for (const s of mergedStocks) (byBase[baseName(s.name)] = byBase[baseName(s.name)] || []).push(s);
    for (const k of Object.keys(byBase)) {
      const baseVal = byBase[k].reduce((a, s) => a + (s.quantity||0) * (s.currentPrice||0), 0);   // 기준가로 본 이 묶음의 평가금액
      const simVal  = simStocks.filter(s => baseName(s.name) === k).reduce((a, s) => a + (s.quantity||0) * (s.currentPrice||0), 0);
      if (!(baseVal > 0)) continue;
      const chg = ((required - (result.total - simVal)) / baseVal - 1) * 100;                     // 기준가 대비 변화율
      for (const s of byBase[k]) out[s.id] = chg;
    }
    return out;
  }, [mergedStocks, simStocks, result.total, mergedLoan, minRatio]);

  const subLabel = [extraBuyCount > 0 ? `추가매수 ${extraBuyCount}건` : null, simNote].filter(Boolean).join(' · ');

  return (
    <div className="tb-scn">
      {/* 오른쪽 열(태블릿): 비율·기준 대비·총잔고를 한 묶음으로 — 높이가 모자라면 이 묶음 안에서 스크롤한다(카드를 누르지 않는다) */}
      <div className="tb-scn-side">
      <RatioCard result={result} label="시나리오 담보비율" subLabel={subLabel ? `${subLabel} 반영 중` : null} />

      {Math.abs(diff) > 0.005 && (
        <div className={`tb-scn-diff mb-4 text-center rounded-xl py-2.5 font-bold text-sm
          ${diff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          기준 대비 {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(2)}%p
        </div>
      )}

      {/* 시나리오 가격일 때 계좌 총잔고 (증권사 「총평가금액」과 같은 기준) */}
      <div className="tb-scn-bal bg-white rounded-xl shadow p-4 mb-4">
        <div className="flex justify-between items-baseline">
          <span className="text-gray-500 font-semibold text-sm">시나리오 총잔고</span>
          <span className={`text-2xl font-extrabold tabular-nums
            ${balDiff > 0.5 ? 'text-red-500' : balDiff < -0.5 ? 'text-blue-600' : 'text-gray-700'}`}>
            {fmtW(simBalance)}
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>지금 {fmtW(baseBalance)}</span>
          {Math.abs(balDiff) > 0.5 ? (
            <span className={`tabular-nums font-medium ${balDiff > 0 ? 'text-red-500' : 'text-blue-600'}`}>
              {balDiff > 0 ? '▲ +' : '▼ −'}{fmtW(Math.abs(balDiff))} ({balDiff > 0 ? '+' : '−'}{Math.abs(balPct).toFixed(1)}%)
            </span>
          ) : <span>변화 없음</span>}
        </div>
        <div className="text-xs text-gray-300 mt-1">주식 + 채권 + 현금 − 신용대출 (증권사 총평가금액)</div>
      </div>
      </div>

      <div className="tb-scn-list bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-600 text-sm">종목별 가격 시나리오</h3>
            {extraBuyCount > 0 && (
              <p className="text-xs text-blue-500 mt-0.5">추가매수 {extraBuyCount}건이 수량에 반영됨 · 시나리오가 기본값 = 추가매수 최저가</p>
            )}
          </div>
          <button onClick={resetAll}
            className="shrink-0 whitespace-nowrap text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg px-3 py-2">
            전체 초기화
          </button>
        </div>

        <div className="tb-scn-items space-y-4">
          {mergedStocks.map(s => {
            const chg      = getChg(s.id);
            const simPrice = Math.max(0, s.currentPrice * (1 + chg / 100));
            const isExtra  = String(s.id).startsWith('extra_');
            const e        = edge[s.id];

            /* 가격 직접 입력 → % 역산 */
            const handlePriceChange = (newPrice) => {
              if (s.currentPrice <= 0) return;
              const newChg = ((newPrice - s.currentPrice) / s.currentPrice) * 100;
              setChg(s.id, newChg);   // 반올림하지 않는다 — 입력한 가격이 그대로 남아야 한다 (% 칸은 표시만 0.1 단위)
            };

            return (
              <div key={s.id} className={`tb-scn-item border rounded-xl p-3 ${isExtra ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}`}>
                {/* 종목 헤더 */}
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <span className="font-medium text-sm">{s.name}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded
                      ${s.type === 'credit' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {s.type === 'credit' ? '신용' : '일반'}
                    </span>
                    {isExtra && (
                      <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-500">추가매수</span>
                    )}
                    <span className="ml-2 text-xs text-gray-400">{fmt(s.quantity)}주</span>
                  </div>
                  <div className="text-xs text-gray-300">기준가 {fmt(s.currentPrice)}원</div>
                </div>

                {/* 가격 직접 입력 + % 입력 한 줄 */}
                <div className="flex items-center gap-2 mb-2">
                  {/* 시나리오 가격 직접 입력 */}
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className="text-xs text-gray-400 shrink-0">시나리오가</span>
                    <PriceInput
                      value={simPrice}
                      onChange={handlePriceChange}
                      className={`flex-1 font-bold text-sm
                        ${chg < 0 ? 'text-blue-600 border-blue-200 bg-blue-50'
                          : chg > 0 ? 'text-red-500 border-red-200 bg-red-50'
                          : 'text-gray-700 bg-gray-50'}`}
                    />
                    <span className="text-xs text-gray-400 shrink-0">원</span>
                  </div>

                  {/* 구분선 */}
                  <div className="text-gray-200 text-sm shrink-0">|</div>

                  {/* % 입력 */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <input type="number" min="-80" max="200"
                      value={Math.round(chg * 10) / 10}
                      onChange={e => setChg(s.id, parseFloat(e.target.value) || 0)}
                      className={`w-14 border rounded px-1 py-1.5 text-sm text-right font-bold focus:outline-none focus:ring-1 focus:ring-blue-300
                        ${chg < 0 ? 'text-blue-600 border-blue-200 bg-blue-50'
                          : chg > 0 ? 'text-red-500 border-red-200 bg-red-50'
                          : 'text-gray-600 bg-gray-50'}`} />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                </div>

                {/* 슬라이더 */}
                <input type="range" min="-80" max="50" step="1"
                  value={Math.max(-80, Math.min(50, chg))}
                  onChange={e => setChg(s.id, parseFloat(e.target.value))}
                  className="w-full mb-2" />

                {/* 평가금액 */}
                <div className="flex justify-between text-xs text-gray-400">
                  <span>평가금액</span>
                  <span className="tabular-nums font-medium">
                    {fmtW(s.quantity * simPrice)}
                    {chg !== 0 && (
                      <span className={`ml-1 ${chg < 0 ? 'text-blue-500' : 'text-red-500'}`}>
                        ({chg > 0 ? '+' : ''}{fmtW((simPrice - s.currentPrice) * s.quantity)})
                      </span>
                    )}
                  </span>
                </div>

                {/* 이 종목만 더 움직여 최저유지비율에 닿는 값 — 누르면 그 값으로 맞춘다 */}
                {e != null && s.currentPrice > 0 && (
                  <div className="tb-edge flex justify-between items-center gap-2 text-xs text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100">
                    <span>{minRatio}%에 닿는 값</span>
                    {e > -100 ? (
                      <button onClick={() => setChg(s.id, e)}
                        className="tb-edge-btn tabular-nums font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1">
                        {fmtW(s.currentPrice * (1 + e / 100))} ({e > 0 ? '+' : ''}{e.toFixed(1)}%)
                      </button>
                    ) : <span className="font-medium text-gray-500">0원이 되어도 유지</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════
   백업 · 복원 창 (2026-11-11 — 옛 「코드 동기화」를 바꿈)
   기기 사이 동기화는 클라우드가 한다. 여기는 지금 내역을 파일로 받아 두고, 필요할 때 그 파일로 되돌리는 곳이다.
   복원은 파일을 검사하고, 무엇이 바뀌는지 보여 준 뒤 한 번 더 묻는다
══════════════════════════════════ */
function checkBackup(json) {
  const bad = (msg) => ({ error: msg });
  if (!json || typeof json !== 'object' || Array.isArray(json)) return bad('백업 파일의 모양이 아닙니다.');
  const p = (json.portfolio && typeof json.portfolio === 'object') ? json.portfolio : json;
  if (!Array.isArray(p.stocks)) return bad('종목 목록(stocks)이 없습니다.');
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const ids = new Set();
  for (let i = 0; i < p.stocks.length; i++) {
    const s = p.stocks[i], at = `종목 ${i + 1}번째`;
    if (!s || typeof s !== 'object') return bad(`${at}: 내용이 없습니다.`);
    if (!isNum(s.id) || ids.has(s.id)) return bad(`${at}: 번호(id)가 없거나 겹칩니다.`);
    ids.add(s.id);
    if (typeof s.name !== 'string' || !s.name.trim()) return bad(`${at}: 이름이 없습니다.`);
    if (!isNum(s.quantity) || s.quantity < 0) return bad(`${at}(${s.name}): 수량이 숫자가 아닙니다.`);
    if (!isNum(s.currentPrice) || s.currentPrice < 0) return bad(`${at}(${s.name}): 현재가가 숫자가 아닙니다.`);
    if (s.type !== 'normal' && s.type !== 'credit') return bad(`${at}(${s.name}): 구분이 일반/신용이 아닙니다.`);
  }
  for (const k of ['bonds', 'cash', 'loan']) if (p[k] != null && !isNum(p[k])) return bad(`${k} 값이 숫자가 아닙니다.`);
  if (isNum(p.loan) && p.loan < 0) return bad('융자 값이 음수입니다.');
  const buys = p.extraBuys == null ? [] : p.extraBuys;
  if (!Array.isArray(buys)) return bad('추가매수 목록의 모양이 다릅니다.');
  const bids = new Set();
  for (let i = 0; i < buys.length; i++) {
    const b = buys[i], at = `추가매수 ${i + 1}번째`;
    if (!b || typeof b !== 'object') return bad(`${at}: 내용이 없습니다.`);
    if (!isNum(b.id) || bids.has(b.id)) return bad(`${at}: 번호(id)가 없거나 겹칩니다.`);
    bids.add(b.id);
    if (typeof b.name !== 'string' || !isNum(b.qty) || !isNum(b.price) || b.qty <= 0 || b.price <= 0) return bad(`${at}: 이름·수량·가격이 올바르지 않습니다.`);
    if (b.type !== 'normal' && b.type !== 'credit') return bad(`${at}: 구분이 일반/신용이 아닙니다.`);
    if (b.stockId !== 'new' && !/^\d+$/.test(String(b.stockId))) return bad(`${at}: 가리키는 종목 번호가 올바르지 않습니다.`);
  }
  if (p.minRatio != null && !(isNum(p.minRatio) && p.minRatio >= 100 && p.minRatio <= 300)) return bad('최저유지비율이 100~300 사이가 아닙니다.');
  const sim = (p.sim && typeof p.sim === 'object') ? p.sim : {};
  for (const k of ['deposit', 'repay']) if (sim[k] != null && !(isNum(sim[k]) && sim[k] >= 0)) return bad('입금·상환 값이 올바르지 않습니다.');
  return {
    data: {
      stocks: p.stocks.map(s => ({ id: s.id, name: s.name.trim(), quantity: s.quantity, avgPrice: isNum(s.avgPrice) ? s.avgPrice : 0, currentPrice: s.currentPrice, type: s.type })),
      bonds: isNum(p.bonds) ? p.bonds : 0, cash: isNum(p.cash) ? p.cash : 0, loan: isNum(p.loan) ? p.loan : 0,
      extraBuys: buys.map(b => ({ id: b.id, stockId: String(b.stockId), name: b.name, qty: b.qty, price: b.price, type: b.type })),
      minRatio: isNum(p.minRatio) ? p.minRatio : null,
      sim: { deposit: isNum(sim.deposit) ? sim.deposit : 0, repay: isNum(sim.repay) ? sim.repay : 0 },
    },
    savedAt: typeof json.savedAt === 'number' ? json.savedAt : null,
  };
}

function BackupModal({ data, canRestore, onRestore, onClose }) {
  const [error, setError] = useState('');
  const [done,  setDone]  = useState('');
  const fileRef = useRef(null);
  useEffect(() => { damboUi.editing++; return () => { damboUi.editing--; }; }, []);

  const download = () => {
    try {
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      const name = `dambo-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
      const blob = new Blob([JSON.stringify({ app: 'dambo', savedAt: Date.now(), portfolio: data }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setError(''); setDone(`「${name}」으로 받았습니다. 받은 파일에는 보유 내역이 그대로 들어 있으니 다른 사람에게 보내지 마세요.`);
    } catch (e) { setError('파일을 만들지 못했습니다.'); }
  };

  const pickFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setDone(''); setError('');
    if (f.size > 1024 * 1024) { setError('파일이 너무 큽니다 (1MB 넘음). 담보비율 백업 파일이 맞는지 확인해 주세요.'); return; }
    const reader = new FileReader();
    reader.onerror = () => setError('파일을 읽지 못했습니다.');
    reader.onload = () => {
      let json;
      try { json = JSON.parse(String(reader.result)); } catch { setError('백업 파일이 아닙니다 (내용을 읽을 수 없음).'); return; }
      const r = checkBackup(json);
      if (r.error) { setError(`복원하지 않았습니다 — ${r.error}`); return; }
      const n = r.data;
      const msg = `이 파일로 되돌릴까요?${r.savedAt ? `\n(백업한 때: ${fmtWhen(r.savedAt)})` : ''}\n\n` +
        `종목 ${data.stocks.length}개 → ${n.stocks.length}개\n추가매수 ${data.extraBuys.length}건 → ${n.extraBuys.length}건\n` +
        `융자 ${fmtW(data.loan)} → ${fmtW(n.loan)}\n\n지금 내역은 지워지고 서버에도 저장됩니다.`;
      if (!confirm(msg)) return;
      onRestore(n);
      onClose();
    };
    reader.readAsText(f);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tb-modal bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-700 text-base">백업 · 복원</h2>
          <button onClick={onClose} aria-label="닫기" className="tb-x w-9 h-9 -mr-2 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          기기끼리는 클라우드가 맞춰 줍니다. 여기서는 지금 내역을 파일로 받아 두었다가, 잘못 고쳤을 때 그 파일로 되돌릴 수 있습니다.
        </p>
        <button onClick={download}
          className="tb-backup-save w-full py-2.5 rounded-xl text-sm font-bold bg-slate-700 hover:bg-slate-800 text-white">
          지금 내역을 파일로 받기
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={pickFile} />
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={!canRestore}
          className={`tb-backup-load mt-2 w-full py-2.5 rounded-xl text-sm font-bold
            ${canRestore ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
          백업 파일로 되돌리기
        </button>
        {!canRestore && <p className="text-xs text-gray-400 mt-1">되돌리기는 저장할 수 있는 계정에서, 최신 값을 받은 뒤에만 됩니다.</p>}
        {error && <p className="tb-backup-error text-xs text-red-500 mt-2">{error}</p>}
        {done && <p className="tb-backup-done text-xs text-emerald-600 mt-2">{done}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════
   추가매수 「체결」 창 (2026-11-11)
   시뮬레이션해 둔 매수가 실제로 체결됐을 때 보유 내역에 한 번에 옮긴다: 수량(없던 구분이면 새 줄), 신용이면 융자.
   현재가를 체결가로 맞출지, 일반 매수의 금액을 현금에서 뺄지는 고른다(고른 것은 이 기기가 기억한다)
══════════════════════════════════ */
function FillModal({ buy, onConfirm, onClose }) {
  const saved = useMemo(() => { try { return JSON.parse(localStorage.getItem('dambo_fill_opts') || '{}') || {}; } catch { return {}; } }, []);
  const [setPrice, setSetPrice] = useState(saved.setPrice !== false);
  const [deduct,   setDeduct]   = useState(saved.deduct === true);
  useEffect(() => { damboUi.editing++; return () => { damboUi.editing--; }; }, []);
  const amount = (buy.qty||0) * (buy.price||0);
  const go = () => {
    try { localStorage.setItem('dambo_fill_opts', JSON.stringify({ setPrice, deduct })); } catch {}
    onConfirm(buy, { setPrice, deductCash: buy.type !== 'credit' && deduct });
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="tb-modal tb-fillmodal bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <h2 className="font-bold text-gray-700 text-base mb-3">체결된 매수를 보유 내역에 반영</h2>
        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1 mb-3">
          <div className="flex justify-between gap-2"><span className="text-gray-500 truncate">{buy.name} · {buy.type === 'credit' ? '신용' : '일반'}</span>
            <span className="font-bold tabular-nums whitespace-nowrap">{fmt(buy.qty)}주 × {fmt(buy.price)}원</span></div>
          <div className="flex justify-between text-xs text-gray-500"><span>수량</span><span className="tabular-nums">+{fmt(buy.qty)}주</span></div>
          {buy.type === 'credit'
            ? <div className="flex justify-between text-xs text-orange-600"><span>신용융자금액</span><span className="tabular-nums">+{fmtW(amount)}</span></div>
            : <div className="flex justify-between text-xs text-gray-500"><span>매수금액</span><span className="tabular-nums">{fmtW(amount)}</span></div>}
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-600 py-1.5">
          <input type="checkbox" className="mt-0.5 w-4 h-4" checked={setPrice} onChange={e => setSetPrice(e.target.checked)} />
          <span>그 종목의 현재가를 체결가({fmt(buy.price)}원)로 맞춘다</span>
        </label>
        {buy.type !== 'credit' && (
          <label className="flex items-start gap-2 text-sm text-gray-600 py-1.5">
            <input type="checkbox" className="mt-0.5 w-4 h-4" checked={deduct} onChange={e => setDeduct(e.target.checked)} />
            <span>현금예수금에서 매수금액을 뺀다 <span className="text-xs text-gray-400">(계좌에 있던 현금으로 샀을 때)</span></span>
          </label>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={go} className="tb-fill-ok flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold">반영</button>
          <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-bold">취소</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════
   클라우드 상태 줄

   지금 보고 있는 숫자가 어디서 왔는지, 언제 것인지 늘 보이게 한다.
   PC에서 넣은 값이 폰에 왔는지 확인할 방법이 없으면 이 구조는 못 믿는다.
   2026-11-11: 접은 화면에서 잘리지 않게 줄바꿈을 허용하고, 중요한 말(열람 전용·고치지 마세요·오프라인)을 앞에 둔다.
   저장한 뒤에는 그 시각과 「앱에서 저장」으로 바뀐다
══════════════════════════════════ */
function CloudBar({ state, updatedAt, source, role, email, offline, pending, onOpenBackup }) {
  const when = fmtWhen(updatedAt);
  const from = source === 'claude' ? 'PC에서 입력' : source === 'app' ? '앱에서 저장' : source === 'auto' ? '시세 자동 반영' : '';
  let dot = 'bg-slate-500', text = '';
  if (state === 'checking')      { dot = 'bg-amber-400 animate-pulse'; text = `최신 확인 중 — 아직 고치지 마세요${when ? ` (지난번 ${when} 값)` : ''}`; }
  else if (offline && pending)   { dot = 'bg-red-400 animate-pulse';   text = '오프라인 — 연결되면 저장합니다. 그 전에 닫으면 고친 값이 사라집니다'; }
  else if (state === 'saving')   { dot = 'bg-blue-400 animate-pulse';  text = '저장 중…'; }
  else if (state === 'savefail') { dot = 'bg-red-400';                 text = '저장하지 못했습니다 — 고친 값은 이 화면에만 있습니다'; }
  else if (state === 'error')    { dot = 'bg-red-400';                 text = `클라우드를 못 읽었습니다${when ? ` (지난번 ${when} 값)` : ' (빈 화면)'}`; }
  else if (state === 'empty')    { dot = 'bg-slate-500';               text = '클라우드에 저장된 내역 없음'; }
  else if (offline)              { dot = 'bg-red-400';                 text = `오프라인${when ? ` — ${when} 값` : ''}`; }
  else                           { dot = 'bg-emerald-400';             text = when ? `클라우드 ${when}${from ? ` · ${from}` : ''}` : '클라우드 연결됨'; }
  if (role === 'viewer') text = `열람 전용(고쳐도 저장 안 됨) · ${text}`;

  return (
    <div className="tb-cloud mt-3 flex items-start gap-2 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dot}`} />
      <span className="tb-cloud-text flex-1 min-w-0 text-slate-400 leading-snug break-keep">{text}</span>
      <div className="shrink-0 flex -my-1.5 -mr-2">
        <button onClick={onOpenBackup} title={email}
          className="tb-headbtn px-2 py-2 text-slate-400 hover:text-slate-200">백업</button>
        <button onClick={() => window.damboSignOut()}
          className="tb-headbtn px-2 py-2 text-slate-400 hover:text-slate-200">로그아웃</button>
      </div>
    </div>
  );
}

/* 클라우드 문서의 portfolio → 화면 상태. 이 앱이 모르는 키(rest)는 그대로 들고 있다가 저장할 때 돌려보낸다
   (PC가 더한 키를 앱 저장이 지우지 않게 — 2026-11-11) */
const KNOWN_KEYS = ['stocks', 'bonds', 'cash', 'loan', 'extraBuys', 'extraBuysSynced', 'minRatio', 'sim', 'priceAt'];
function fromCloud(p) {
  p = (p && typeof p === 'object') ? p : {};
  const stocks = (Array.isArray(p.stocks) ? p.stocks : []).filter(Boolean);
  const rest = {};
  for (const k of Object.keys(p)) if (!KNOWN_KEYS.includes(k)) rest[k] = p[k];
  return {
    stocks,
    bonds: num(p.bonds), cash: num(p.cash), loan: num(p.loan),
    extraBuys: normalizeBuys(stocks, (Array.isArray(p.extraBuys) ? p.extraBuys : []).filter(Boolean)),
    minRatio: typeof p.minRatio === 'number' ? p.minRatio : DEFAULT_MIN_RATIO,
    sim: { deposit: num(p.sim && p.sim.deposit), repay: num(p.sim && p.sim.repay) },
    priceAt: typeof p.priceAt === 'number' ? p.priceAt : null,      // PC 가 시세를 자동으로 넣은 때(update-dambo-prices.js). 사람이 현재가를 고치면 지운다
    rest,
  };
}

function App({ boot }) {
  const init = useMemo(() => fromCloud(boot.portfolio), []);
  const [stocks,     setStocks]     = useState(init.stocks);
  const [bonds,      setBonds]      = useState(init.bonds);
  const [cash,       setCash]       = useState(init.cash);
  const [loan,       setLoan]       = useState(init.loan);
  const [extraBuys,  setExtraBuys]  = useState(init.extraBuys);
  const [minRatioIn, setMinRatioIn] = useState(init.minRatio);       // 칸에 친 값 그대로(치는 중엔 100 미만일 수 있다)
  const [sim,        setSim]        = useState(init.sim);
  const [priceAt,    setPriceAt]    = useState(init.priceAt);
  const restRef = useRef(init.rest);
  const [sync,            setSync]            = useState({ updatedAt: boot.updatedAt, source: boot.source });
  const [applied,         setApplied]         = useState(0);         // 클라우드 값을 받아 넣을 때마다 +1 — 그 변화는 저장하지 않는다
  const [scenarioChanges, setScenarioChanges] = useState({});
  const [tab,             setTab]             = useState('portfolio');
  const [showBackup,      setShowBackup]      = useState(false);
  const [fillBuy,         setFillBuy]         = useState(null);
  const [offline,         setOffline]         = useState(false);
  const [cloudState,      setCloudState]      = useState(
    boot.cached ? 'checking' : boot.error ? 'error' : boot.portfolio ? 'synced' : 'empty'
  );
  const minRatio = validRatio(minRatioIn);
  const canSave  = boot.role === 'admin';

  /* ── 저장 ──
     값이 바뀌면 0.8초 뒤에 클라우드로 보낸다(관리자만). 보내는 일 자체는 index.html 의 damboSave 가 한 줄로 세운다 —
     앞 저장이 끝나기 전에 또 보내면 "다른 곳에서 바뀌었다"로 잘못 읽히던 것(2026-11-11 점검)을 거기서 막는다.
     seq = 이 화면에서 값을 바꾼 횟수, savedSeq = 그중 서버에 닿은 것. 다르면 "아직 안 보낸 것이 있다" */
  const seq = useRef(0), savedSeq = useRef(0), lastApplied = useRef(0), timer = useRef(null), first = useRef(true);
  const latest = useRef(null);
  latest.current = { stocks, bonds, cash, loan, extraBuys, minRatioIn, sim, priceAt };
  const [pending, setPending] = useState(false);

  const toCloud = (s) => {
    const p = { ...restRef.current, stocks: s.stocks, bonds: s.bonds, cash: s.cash, loan: s.loan,
      extraBuys: s.extraBuys, extraBuysSynced: true };      // extraBuysSynced: 2026-10-09 전환 때의 표시. PC 절차가 이 키를 그대로 옮겨 쓰므로 남겨 둔다
    p.minRatio = validRatio(s.minRatioIn);
    if (s.priceAt) p.priceAt = s.priceAt;
    if ((s.sim.deposit || 0) > 0 || (s.sim.repay || 0) > 0) p.sim = { deposit: s.sim.deposit || 0, repay: s.sim.repay || 0 };
    return p;
  };

  const onStale = () => {
    alert('PC나 다른 기기에서 값이 바뀌어 있었습니다.\n덮어쓰지 않고 최신 값을 불러옵니다. 방금 고친 내용은 다시 입력해 주세요.');
    seq.current = savedSeq.current;                  // 못 보낸 수정은 버린다 — 아래에서 받은 값으로 바뀐다
    setPending(false);
    Promise.resolve(window.damboRefresh ? window.damboRefresh() : Promise.reject()).catch(() => location.reload());
  };

  const sendNow = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const my = seq.current;
    window.damboSave(toCloud(latest.current)).then(res => {
      if (!res || res.r === 'skipped' || res.r === 'viewer') return;
      if (res.r === 'ok') {
        savedSeq.current = Math.max(savedSeq.current, my);
        setSync({ updatedAt: res.at, source: 'app' });
        if (seq.current === my) { setPending(false); setCloudState('synced'); }
        return;
      }
      if (res.r === 'stale') { onStale(); return; }
      if (seq.current === my) setCloudState('savefail');
    });
  };

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (lastApplied.current !== applied) { lastApplied.current = applied; return; }   // 클라우드에서 받아 넣은 변화
    seq.current++;
    if (!canSave) return;
    setPending(true);
    setCloudState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(sendNow, 800);
  }, [stocks, bonds, cash, loan, extraBuys, minRatioIn, sim, priceAt, applied]);

  /* 화면을 떠날 때(다른 앱으로 가거나 닫을 때) 0.8초를 기다리던 저장이 있으면 바로 보낸다.
     이 화면이 새로 띄워지며 내려갈 때(사본 → 진짜 값)는 보내지 않고 타이머만 거둔다 */
  useEffect(() => {
    const flush = () => { if (timer.current && document.visibilityState !== 'visible') sendNow(); };
    const flushNow = () => { if (timer.current) sendNow(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flushNow);
    return () => {
      document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flushNow);
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    };
  }, []);

  /* 클라우드 값을 이 화면에 받아 넣는다 — 열어 둔 화면이 스스로 최신 값이 되게(index.html 이 부른다). 탭·시나리오는 그대로 둔다 */
  useEffect(() => {
    const apply = (doc) => {
      const c = fromCloud(doc.portfolio);
      restRef.current = c.rest;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      seq.current = savedSeq.current;
      setStocks(c.stocks); setBonds(c.bonds); setCash(c.cash); setLoan(c.loan);
      setExtraBuys(c.extraBuys); setMinRatioIn(c.minRatio); setSim(c.sim); setPriceAt(c.priceAt);
      setSync({ updatedAt: doc.updatedAt ?? null, source: doc.source ?? null });
      setApplied(n => n + 1);
      setPending(false);
      setCloudState(doc.portfolio ? 'synced' : 'empty');
    };
    const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !!a.closest('#root'); };
    const api = { apply, busy: () => (canSave && seq.current !== savedSeq.current) || damboUi.editing > 0 || typing() };
    window.__damboApp = api;
    return () => { if (window.__damboApp === api) window.__damboApp = null; };
  }, []);

  /* 연결 상태 — 끊긴 지 2.5초가 넘어야 「오프라인」으로 본다(앱을 켠 직후의 잠깐은 넘긴다) */
  useEffect(() => {
    let t = null;
    const onNet = (on) => {
      if (t) { clearTimeout(t); t = null; }
      if (on) setOffline(false); else t = setTimeout(() => setOffline(true), 2500);
    };
    window.__damboNet = onNet;
    if (window.__damboOnline === false) onNet(false);
    return () => { if (t) clearTimeout(t); if (window.__damboNet === onNet) window.__damboNet = null; };
  }, []);

  /* 추가매수·입금·상환을 반영한 상태 */
  const { mergedStocks, extraLoan, orphans } = useMemo(
    () => applyExtraBuys(stocks, extraBuys),
    [stocks, extraBuys]
  );
  const deposit    = Math.max(0, sim.deposit || 0);
  const repay      = Math.max(0, Math.min(sim.repay || 0, loan + extraLoan));
  const mergedCash = cash + deposit - repay;
  const mergedLoan = loan + extraLoan - repay;
  const appliedBuys = useMemo(() => extraBuys.filter(b => !orphans.includes(b.id)), [extraBuys, orphans]);
  const mergedNow = useMemo(() => {
    const r = calc(mergedStocks, bonds, mergedCash, mergedLoan, minRatio);
    return { ...r, cash: mergedCash, extraLoan };
  }, [mergedStocks, bonds, mergedCash, mergedLoan, minRatio, extraLoan]);
  const simNote = (deposit > 0 || repay > 0) ? [deposit > 0 ? '입금' : null, repay > 0 ? '상환' : null].filter(Boolean).join('·') : null;

  /* 헤더: 기본 포트폴리오 기준 */
  const baseResult   = useMemo(() => calc(stocks, bonds, cash, loan, minRatio), [stocks, bonds, cash, loan, minRatio]);
  const ratioClass   = baseResult.ratio < minRatio ? 'text-red-400'
    : baseResult.ratio < 170 ? 'text-yellow-400' : 'text-emerald-400';

  /* 체결: 시뮬레이션해 둔 매수 하나를 보유 내역으로 옮긴다 */
  const confirmFill = (buy, opt) => {
    const amount = (buy.qty||0) * (buy.price||0);
    const k = baseName(buy.name);
    const linked = buy.stockId === 'new' ? null : resolveBuy(stocks, buy);
    const sameBase = stocks.filter(s => baseName(s.name) === k);
    const target = (linked && linked.type === buy.type) ? linked : sameBase.find(s => s.type === buy.type);
    let next = stocks.map(s => ({ ...s }));
    if (target) {
      next = next.map(s => s.id === target.id ? { ...s, quantity: (s.quantity||0) + (buy.qty||0) } : s);
    } else {
      const price = sameBase.length ? (sameBase[0].currentPrice || buy.price) : buy.price;
      next.push({ id: Math.max(99, ...stocks.map(s => Number(s.id) || 0)) + 1,
        name: buy.type === 'credit' ? `${k}(신용)` : k, quantity: buy.qty, avgPrice: 0, currentPrice: price, type: buy.type });
    }
    if (opt.setPrice) { next = next.map(s => baseName(s.name) === k ? { ...s, currentPrice: buy.price } : s); setPriceAt(null); }
    setStocks(next);
    if (buy.type === 'credit') setLoan(loan + amount);
    else if (opt.deductCash) setCash(cash - amount);
    setExtraBuys(prev => normalizeBuys(next, prev.filter(b => b.id !== buy.id)));
  };

  /* 입금·상환을 실제로 했을 때: 현금·융자에 옮기고 시뮬레이션 칸을 비운다 */
  const applySim = () => {
    const dep = Math.max(0, sim.deposit || 0), rep = Math.max(0, Math.min(sim.repay || 0, loan));
    if (!(dep > 0 || rep > 0)) return;
    const lines = [dep > 0 ? `현금예수금 +${fmtW(dep)} (입금)` : null, rep > 0 ? `현금예수금 −${fmtW(rep)} · 신용융자금액 −${fmtW(rep)} (상환)` : null].filter(Boolean).join('\n');
    if (!confirm(`보유 내역에 반영할까요?\n\n${lines}`)) return;
    setCash(cash + dep - rep);
    setLoan(loan - rep);
    setSim({ deposit: 0, repay: 0 });
  };

  /* 백업 파일로 되돌리기 */
  const restore = (n) => {
    setStocks(n.stocks); setBonds(n.bonds); setCash(n.cash); setLoan(n.loan);
    setExtraBuys(normalizeBuys(n.stocks, n.extraBuys));
    if (n.minRatio != null) setMinRatioIn(n.minRatio);
    setSim(n.sim);
    setPriceAt(null);
    setScenarioChanges({});
  };

  const TABS = [
    { id: 'portfolio', label: '포트폴리오' },
    { id: 'buy',       label: '추가매수'   },
    { id: 'scenario',  label: '가격시나리오' },
  ];
  const simBadge = appliedBuys.length + (simNote ? 1 : 0);

  return (
    <div className="tb-app max-w-2xl mx-auto px-3 py-4 pb-10">
      {showBackup && (
        <BackupModal
          data={toCloud(latest.current)}
          canRestore={canSave && cloudState !== 'checking'}
          onRestore={restore}
          onClose={() => setShowBackup(false)}
        />
      )}
      {fillBuy && <FillModal buy={fillBuy} onConfirm={confirmFill} onClose={() => setFillBuy(null)} />}
      {/* 헤더 */}
      <div className="tb-header bg-slate-800 text-white rounded-2xl px-5 py-4 mb-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">담보비율 계산기</h1>
            <p className="text-slate-400 text-xs mt-0.5">삼성증권 신용융자 · 최저유지 {minRatio}%</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-extrabold tabular-nums ${ratioClass}`}>
              {fmtP(baseResult.ratio)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">융자 {fmtW(loan)}</div>
          </div>
        </div>
        {/* 한 줄을 따로 쓴다 — 오른쪽 묶음 안에 두면 글이 길어질 때 왼쪽 제목 줄까지 접혔다 */}
        {(appliedBuys.length > 0 || simNote) && (
          <div className="tb-simnote text-xs text-blue-400 mt-1 text-right">
            {[appliedBuys.length > 0 ? `추가매수 ${appliedBuys.length}건` : null, simNote].filter(Boolean).join(' · ')} 시뮬레이션 중
          </div>
        )}
        <CloudBar
          state={cloudState}
          updatedAt={sync.updatedAt}
          source={sync.source}
          role={boot.role}
          email={boot.email}
          offline={offline}
          pending={pending}
          onOpenBackup={() => setShowBackup(true)}
        />
      </div>

      {/* 탭 네비게이션 */}
      <div className="tb-tabs flex gap-1 mb-4 bg-white rounded-xl p-1 shadow">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all relative
              ${tab === t.id
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
            {t.id === 'buy' && (simBadge > 0 || orphans.length > 0) && (
              <span className={`absolute -top-1 -right-1 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none ${orphans.length ? 'bg-red-500' : 'bg-blue-500'}`}>
                {orphans.length ? '!' : simBadge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 탭 내용 — display로 숨기기/보이기 (언마운트 없음 → 상태 유지) */}
      <div className="tb-panel tb-panel-portfolio" style={{ display: tab === 'portfolio' ? '' : 'none' }}>
        <RatioCard result={baseResult}>
          <BreakEvenBox stocks={stocks} bonds={bonds} cash={cash} loan={loan} minRatio={minRatio} />
        </RatioCard>
        <Tab1
          stocks={stocks} setStocks={setStocks}
          bonds={bonds}   setBonds={setBonds}
          cash={cash}     setCash={setCash}
          loan={loan}     setLoan={setLoan}
          minRatio={minRatioIn} setMinRatio={setMinRatioIn}
          extraBuys={extraBuys} setExtraBuys={setExtraBuys}
          priceAt={priceAt} onPriceEdit={() => setPriceAt(null)}
        />
      </div>
      <div className="tb-panel tb-panel-buy" style={{ display: tab === 'buy' ? '' : 'none' }}>
        <Tab2
          stocks={stocks} bonds={bonds} cash={cash} loan={loan}
          extraBuys={extraBuys} setExtraBuys={setExtraBuys} orphans={orphans}
          sim={sim} setSim={setSim} minRatio={minRatio} merged={mergedNow}
          onFill={setFillBuy} onApplySim={applySim}
        />
      </div>
      <div className="tb-panel tb-panel-scn" style={{ display: tab === 'scenario' ? '' : 'none' }}>
        <Tab3
          mergedStocks={mergedStocks}
          bonds={bonds} cash={mergedCash}
          mergedLoan={mergedLoan}
          extraBuys={appliedBuys}
          changes={scenarioChanges}
          setChanges={setScenarioChanges}
          minRatio={minRatio}
          simNote={simNote}
        />
      </div>
    </div>
  );
}

/* 로그인·클라우드 읽기가 끝난 뒤에야 그린다. 부트스트랩 스크립트가 불러준다.
   인증이 이 파일보다 먼저 끝나는 경우가 있어서, 먼저 와 있던 값이 있으면 그걸로 바로 연다. */
// 루트는 하나만 만든다 — 로그인이 풀렸다 돌아오면 이 함수가 다시 불려 화면이 겹쳤다 (2026-10-12).
// 다시 불리면 key를 바꿔 App을 새로 띄워 그때 받은 클라우드 값으로 시작한다
let damboRoot = null, damboBootCount = 0;
window.startDamboApp = function (payload) {
  if (!damboRoot) damboRoot = ReactDOM.createRoot(document.getElementById('root'));
  damboRoot.render(<App key={++damboBootCount} boot={payload} />);
};
if (window.__damboPending) window.startDamboApp(window.__damboPending);
