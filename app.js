/* 생성 파일 — 고치지 말 것. 원본은 src/app.jsx, 다시 만들기: npm run build */
const {
  useState,
  useMemo,
  useRef,
  useEffect
} = React;
const DEFAULT_MIN_RATIO = 130;
const REF_RATIO = 140;
const validRatio = v => typeof v === 'number' && v >= 100 && v <= 300 ? v : DEFAULT_MIN_RATIO;
const fmt = n => isNaN(n) || n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtW = n => `${fmt(n)}원`;
const fmtP = n => isFinite(n) ? `${n.toFixed(2)}%` : '∞%';
const num = v => typeof v === 'number' && isFinite(v) ? v : 0;
const fmtWhen = ms => {
  const d = new Date(ms);
  if (!ms || isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const baseName = n => String(n || '').replace(/\s*\((신용|일반)\)\s*$/, '').trim();
function calc(stocks, bonds, cash, loan, minRatio = DEFAULT_MIN_RATIO) {
  const won = stocks.filter(s => s.type === 'credit').reduce((sum, s) => sum + (s.quantity || 0) * (s.currentPrice || 0), 0);
  const stockBu = stocks.filter(s => s.type === 'normal').reduce((sum, s) => sum + (s.quantity || 0) * (s.currentPrice || 0), 0);
  const bu = stockBu + (bonds || 0) + (cash || 0);
  const total = won + bu;
  const ratio = loan > 0 ? total / loan * 100 : Infinity;
  const required = (loan || 0) * (minRatio / 100);
  const shortage = Math.max(0, required - total);
  const surplus = Math.max(0, total - required);
  return {
    won,
    bu,
    stockBu,
    total,
    ratio,
    required,
    shortage,
    surplus,
    minRatio,
    loan: loan || 0
  };
}
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
function normalizeBuys(stocks, buys) {
  return buys.map(b => {
    if (!b || b.stockId === 'new') return b;
    const t = resolveBuy(stocks, b);
    return t && String(t.id) !== String(b.stockId) ? {
      ...b,
      stockId: String(t.id)
    } : b;
  });
}
function applyExtraBuys(baseStocks, extraBuys) {
  let stocks = baseStocks.map(s => ({
    ...s
  }));
  let extraLoan = 0;
  const orphans = [];
  for (const buy of extraBuys) {
    const evalAmt = (buy.qty || 0) * (buy.price || 0);
    if (buy.stockId === 'new') {
      stocks.push({
        id: `extra_${buy.id}`,
        name: buy.name,
        quantity: buy.qty,
        avgPrice: buy.price,
        currentPrice: buy.price,
        type: buy.type
      });
    } else {
      const target = resolveBuy(baseStocks, buy);
      if (!target) {
        orphans.push(buy.id);
        continue;
      }
      stocks = stocks.map(s => s.id === target.id ? {
        ...s,
        quantity: (s.quantity || 0) + (buy.qty || 0)
      } : s);
    }
    if (buy.type === 'credit') extraLoan += evalAmt;
  }
  return {
    mergedStocks: stocks,
    extraLoan,
    orphans
  };
}
function breakEven(stocks, bonds, cash, loan, minRatio) {
  const val = s => (s.quantity || 0) * (s.currentPrice || 0);
  const stockTotal = stocks.reduce((a, s) => a + val(s), 0);
  if (!(loan > 0) || !(stockTotal > 0)) return null;
  const required = loan * (minRatio / 100);
  const total = stockTotal + (bonds || 0) + (cash || 0);
  const groups = {};
  for (const s of stocks) {
    const k = baseName(s.name);
    const g = groups[k] = groups[k] || {
      base: k,
      value: 0,
      price: s.currentPrice || 0,
      ids: []
    };
    g.value += val(s);
    g.ids.push(s.id);
  }
  const list = Object.values(groups).filter(g => g.value > 0).map(g => {
    const chg = ((required - (total - g.value)) / g.value - 1) * 100;
    return {
      ...g,
      chg,
      target: g.price * (1 + chg / 100)
    };
  }).sort((a, b) => b.value - a.value);
  return {
    all: ((required - (bonds || 0) - (cash || 0)) / stockTotal - 1) * 100,
    groups: list
  };
}
const dropText = chg => chg <= -100 ? '0원이 되어도 유지' : `${chg > 0 ? '+' : ''}${chg.toFixed(1)}%`;
const damboUi = {
  editing: 0
};
function NumInput({
  value,
  onChange,
  className = '',
  placeholder = '0',
  negative = false
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  return React.createElement("input", {
    type: "text",
    inputMode: "numeric",
    className: `min-w-0 border rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`,
    value: focused ? text : fmt(value),
    placeholder: placeholder,
    onFocus: () => {
      setFocused(true);
      setText(value === 0 ? '' : String(value));
    },
    onBlur: () => setFocused(false),
    onChange: e => {
      let raw = e.target.value;
      const minus = negative && /^\s*[-−]/.test(raw);
      raw = raw.replace(/[^0-9]/g, '');
      if (minus) raw = '-' + raw;
      setText(raw);
      const n = parseInt(raw, 10);
      onChange(isNaN(n) ? 0 : n);
    }
  });
}
function PriceInput({
  value,
  onChange,
  className = ''
}) {
  const [focused, setFocused] = useState(false);
  const [localVal, setLocalVal] = useState('');
  const handleFocus = () => {
    setFocused(true);
    setLocalVal(value === 0 ? '' : String(Math.round(value)));
  };
  const handleChange = e => {
    const raw = e.target.value.replace(/,/g, '');
    setLocalVal(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n >= 0) onChange(n);
  };
  const handleBlur = () => setFocused(false);
  return React.createElement("input", {
    type: "text",
    inputMode: "numeric",
    className: `min-w-0 border rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`,
    value: focused ? localVal : fmt(value),
    onFocus: handleFocus,
    onChange: handleChange,
    onBlur: handleBlur
  });
}
function RatioCard({
  result,
  label = '현재 담보비율',
  subLabel = null,
  children = null
}) {
  const {
    won,
    bu,
    total,
    ratio,
    shortage,
    surplus,
    minRatio,
    loan
  } = result;
  const danger = ratio < minRatio;
  const warning = ratio >= minRatio && ratio < 170;
  const ratioClass = danger ? 'text-red-500' : warning ? 'text-yellow-500' : 'text-emerald-500';
  const barClass = danger ? 'bg-red-500' : warning ? 'bg-yellow-400' : 'bg-emerald-500';
  const MAX_DISPLAY = 350;
  const barPct = Math.min(100, ratio / MAX_DISPLAY * 100);
  const markMin = minRatio / MAX_DISPLAY * 100;
  const mark200 = 200 / MAX_DISPLAY * 100;
  const refGap = total - loan * (REF_RATIO / 100);
  return React.createElement("div", {
    className: "tb-ratio bg-white rounded-2xl shadow-md p-5 mb-4"
  }, React.createElement("div", {
    className: "flex items-center justify-between mb-1"
  }, React.createElement("div", null, React.createElement("span", {
    className: "text-gray-500 font-semibold"
  }, label), subLabel && React.createElement("div", {
    className: "text-xs text-blue-500 font-medium mt-0.5"
  }, subLabel)), React.createElement("span", {
    className: `tb-ratio-num text-4xl font-extrabold tabular-nums ${ratioClass}`
  }, fmtP(ratio))), React.createElement("div", {
    className: "tb-ratio-req text-right text-xs text-gray-400 mb-7"
  }, "\uCD5C\uC800\uC720\uC9C0 ", minRatio, "% \xB7 \uD544\uC694\uB2F4\uBCF4\uAE08\uC561 ", fmtW(result.required)), React.createElement("div", {
    className: "tb-gauge relative mb-6"
  }, React.createElement("div", {
    className: "h-5 bg-gray-100 rounded-full overflow-visible"
  }, React.createElement("div", {
    className: `h-full rounded-full transition-all duration-500 ${barClass}`,
    style: {
      width: `${barPct}%`
    }
  })), React.createElement("div", {
    className: "tb-gauge-mark absolute top-0 bottom-0 flex flex-col items-center",
    style: {
      left: `${markMin}%`,
      transform: 'translateX(-50%)'
    }
  }, React.createElement("div", {
    className: "absolute -top-5 text-xs font-bold text-red-500 whitespace-nowrap"
  }, minRatio, "%"), React.createElement("div", {
    className: "w-0.5 h-5 bg-red-500 mt-0"
  })), React.createElement("div", {
    className: "tb-gauge-mark absolute top-0 bottom-0 flex flex-col items-center",
    style: {
      left: `${mark200}%`,
      transform: 'translateX(-50%)'
    }
  }, React.createElement("div", {
    className: "absolute -top-5 text-xs font-bold text-emerald-600 whitespace-nowrap"
  }, "200%"), React.createElement("div", {
    className: "w-0.5 h-5 bg-emerald-500 mt-0"
  }))), React.createElement("div", {
    className: "tb-ratio-grid3 grid grid-cols-3 gap-2 mb-3"
  }, [{
    label: '총담보금액',
    val: total,
    bg: 'bg-blue-50',
    txt: 'text-blue-800'
  }, {
    label: '원담보금액',
    val: won,
    bg: 'bg-orange-50',
    txt: 'text-orange-800'
  }, {
    label: '부담보금액',
    val: bu,
    bg: 'bg-indigo-50',
    txt: 'text-indigo-800'
  }].map(({
    label: l,
    val,
    bg,
    txt
  }) => React.createElement("div", {
    key: l,
    className: `${bg} rounded-xl px-1 py-2.5 text-center`
  }, React.createElement("div", {
    className: "text-xs text-gray-400 mb-1"
  }, l), React.createElement("div", {
    className: `tb-money3 text-xs font-bold ${txt} whitespace-nowrap tracking-tight`
  }, fmtW(val))))), React.createElement("div", {
    className: "tb-ratio-grid2 grid grid-cols-2 gap-2"
  }, React.createElement("div", {
    className: `rounded-xl p-2.5 text-center ${danger ? 'bg-red-50' : 'bg-gray-50'}`
  }, React.createElement("div", {
    className: "text-xs text-gray-400 mb-1"
  }, "\uB2F4\uBCF4\uBD80\uC871\uAE08\uC561"), React.createElement("div", {
    className: `text-sm font-bold ${danger ? 'text-red-600' : 'text-gray-300'}`
  }, shortage > 0 ? fmtW(shortage) : '부족 없음')), React.createElement("div", {
    className: `rounded-xl p-2.5 text-center ${danger ? 'bg-red-50' : 'bg-emerald-50'}`
  }, React.createElement("div", {
    className: "text-xs text-gray-400 mb-1"
  }, minRatio, "% \uC5EC\uC720\uAE08\uC561"), React.createElement("div", {
    className: `text-sm font-bold ${danger ? 'text-red-600' : 'text-emerald-600'}`
  }, danger ? `-${fmtW(shortage)}` : fmtW(surplus)))), minRatio !== REF_RATIO && loan > 0 && React.createElement("div", {
    className: `tb-ratio-ref mt-2 text-xs text-center ${refGap < 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}`
  }, "\uC6D0\uBCF5(", REF_RATIO, "%) \uAE30\uC900\uC774\uBA74 ", refGap < 0 ? `부족 ${fmtW(-refGap)}` : `여유 ${fmtW(refGap)}`), children);
}
function BreakEvenBox({
  stocks,
  bonds,
  cash,
  loan,
  minRatio
}) {
  const be = useMemo(() => breakEven(stocks, bonds, cash, loan, minRatio), [stocks, bonds, cash, loan, minRatio]);
  if (!be) return null;
  return React.createElement("div", {
    className: "tb-be mt-3 pt-3 border-t border-gray-100 text-xs"
  }, React.createElement("div", {
    className: "flex justify-between text-gray-500 mb-1"
  }, React.createElement("span", {
    className: "font-semibold"
  }, minRatio, "%\uC5D0 \uB2FF\uB294 \uC9C0\uC810"), React.createElement("span", {
    className: "text-gray-400"
  }, "\uC9C0\uAE08 \uAC12 \uAE30\uC900")), React.createElement("div", {
    className: "flex justify-between py-0.5"
  }, React.createElement("span", {
    className: "text-gray-500"
  }, "\uC804 \uC885\uBAA9\uC774 \uD568\uAED8 \uC6C0\uC9C1\uC774\uBA74"), React.createElement("span", {
    className: `font-bold tabular-nums ${be.all >= 0 ? 'text-red-600' : 'text-gray-700'}`
  }, dropText(be.all))), be.groups.filter(g => g.chg > -100).slice(0, 3).map(g => React.createElement("div", {
    key: g.base,
    className: "flex justify-between gap-2 py-0.5"
  }, React.createElement("span", {
    className: "text-gray-500 truncate"
  }, g.base, "\uB9CC \uC6C0\uC9C1\uC774\uBA74"), React.createElement("span", {
    className: `shrink-0 font-bold tabular-nums ${g.chg >= 0 ? 'text-red-600' : 'text-gray-700'}`
  }, fmtW(g.target), " (", dropText(g.chg), ")"))));
}
function StockEditCard({
  data,
  setData,
  onSave,
  onCancel
}) {
  return React.createElement("div", {
    className: "tb-editcard bg-yellow-50 border border-yellow-200 rounded-xl p-3 shadow-sm text-left"
  }, React.createElement("input", {
    className: "border rounded-lg px-2 py-1.5 w-full text-sm mb-2 bg-white",
    value: data.name,
    placeholder: "\uC885\uBAA9\uBA85",
    onChange: e => setData(d => ({
      ...d,
      name: e.target.value
    }))
  }), React.createElement("div", {
    className: "grid grid-cols-2 gap-2 mb-2"
  }, React.createElement("div", null, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-0.5"
  }, "\uC218\uB7C9"), React.createElement(NumInput, {
    value: data.quantity,
    onChange: v => setData(d => ({
      ...d,
      quantity: v
    })),
    className: "w-full bg-white"
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-0.5"
  }, "\uD604\uC7AC\uAC00"), React.createElement(NumInput, {
    value: data.currentPrice,
    onChange: v => setData(d => ({
      ...d,
      currentPrice: v
    })),
    className: "w-full bg-white"
  }))), React.createElement("div", {
    className: "flex items-center justify-between gap-2 mb-2"
  }, React.createElement("span", {
    className: "text-xs text-gray-400"
  }, "\uD3C9\uAC00\uAE08\uC561"), React.createElement("span", {
    className: "text-xs font-bold text-gray-600 tabular-nums"
  }, fmtW((data.quantity || 0) * (data.currentPrice || 0)))), React.createElement("div", {
    className: "flex gap-1.5 mb-2"
  }, ['normal', 'credit'].map(t => React.createElement("button", {
    key: t,
    onClick: () => setData(d => ({
      ...d,
      type: t
    })),
    className: `flex-1 py-2 rounded-lg text-xs font-semibold border transition-all
              ${data.type === t ? t === 'normal' ? 'bg-blue-500 text-white border-blue-500' : 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-400 border-gray-200'}`
  }, t === 'normal' ? '일반' : '신용'))), React.createElement("div", {
    className: "flex gap-1.5"
  }, React.createElement("button", {
    onClick: onSave,
    className: "flex-1 bg-blue-500 text-white rounded-lg py-2 text-xs font-bold"
  }, "\uC800\uC7A5"), React.createElement("button", {
    onClick: onCancel,
    className: "flex-1 bg-gray-200 text-gray-600 rounded-lg py-2 text-xs font-bold"
  }, "\uCDE8\uC18C")));
}
function Tab1({
  stocks,
  setStocks,
  bonds,
  setBonds,
  cash,
  setCash,
  loan,
  setLoan,
  minRatio,
  setMinRatio,
  extraBuys,
  setExtraBuys,
  priceAt,
  onPriceEdit
}) {
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const newStockId = () => Math.max(99, ...stocks.map(s => Number(s.id) || 0)) + 1;
  useEffect(() => {
    if (editId == null) return;
    damboUi.editing++;
    return () => {
      damboUi.editing--;
    };
  }, [editId]);
  const startEdit = s => {
    setEditId(s.id);
    setEditData({
      ...s
    });
  };
  const saveEdit = () => {
    const name = String(editData.name || '').trim() || '신규종목';
    if (editId === 'new') {
      setStocks(prev => [...prev, {
        ...editData,
        name,
        id: newStockId()
      }]);
    } else {
      const before = stocks.find(s => s.id === editId);
      setStocks(prev => prev.map(s => s.id === editId ? {
        ...editData,
        name
      } : s));
      if (before && before.currentPrice !== editData.currentPrice && onPriceEdit) onPriceEdit();
      if (before && before.name !== name) {
        setExtraBuys(prev => prev.map(b => b.stockId !== 'new' && (resolveBuy(stocks, b) || {}).id === editId ? {
          ...b,
          name
        } : b));
      }
    }
    setEditId(null);
  };
  const cancelEdit = () => setEditId(null);
  const deleteStock = s => {
    const linked = extraBuys.filter(b => b.stockId !== 'new' && (resolveBuy(stocks, b) || {}).id === s.id);
    const more = linked.length ? `\n이 종목의 추가매수 ${linked.length}건도 함께 지웁니다.` : '';
    if (!confirm(`${s.name}(${s.type === 'credit' ? '신용' : '일반'}) 종목을 지울까요?${more}`)) return;
    setStocks(prev => prev.filter(x => x.id !== s.id));
    const gone = linked.map(b => b.id);
    if (gone.length) setExtraBuys(prev => prev.filter(b => !gone.includes(b.id)));
  };
  const addStock = () => {
    setEditId('new');
    setEditData({
      name: '',
      quantity: 0,
      avgPrice: 0,
      currentPrice: 0,
      type: 'normal'
    });
  };
  const editCard = React.createElement(StockEditCard, {
    data: editData,
    setData: setEditData,
    onSave: saveEdit,
    onCancel: cancelEdit
  });
  return React.createElement("div", {
    className: "tb-inputs"
  }, React.createElement("div", {
    className: "tb-table-wrap hidden sm:block overflow-x-auto mb-3"
  }, React.createElement("table", {
    className: "tb-table w-full text-sm bg-white rounded-xl shadow overflow-hidden min-w-[420px]"
  }, React.createElement("thead", {
    className: "bg-slate-700 text-white text-xs"
  }, React.createElement("tr", null, React.createElement("th", {
    className: "px-3 py-2 text-left whitespace-nowrap"
  }, "\uC885\uBAA9\uBA85"), React.createElement("th", {
    className: "px-3 py-2 text-right whitespace-nowrap"
  }, "\uC218\uB7C9"), React.createElement("th", {
    className: "px-3 py-2 text-right whitespace-nowrap"
  }, "\uD604\uC7AC\uAC00"), React.createElement("th", {
    className: "px-3 py-2 text-right whitespace-nowrap"
  }, "\uD3C9\uAC00\uAE08\uC561"), React.createElement("th", {
    className: "px-3 py-2 text-center whitespace-nowrap"
  }, "\uAD6C\uBD84"), React.createElement("th", {
    className: "px-3 py-2 text-center whitespace-nowrap"
  }, "\uAD00\uB9AC"))), React.createElement("tbody", null, stocks.map((s, i) => {
    const evalAmt = (s.quantity || 0) * (s.currentPrice || 0);
    if (editId === s.id) return React.createElement("tr", {
      key: s.id,
      className: "tb-editrow border-b border-yellow-100"
    }, React.createElement("td", {
      colSpan: 6,
      className: "p-2"
    }, editCard));
    return React.createElement("tr", {
      key: s.id,
      className: `border-b hover:bg-gray-50 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`
    }, React.createElement("td", {
      className: "px-3 py-2 font-medium"
    }, s.name, s.type === 'credit' && React.createElement("span", {
      className: "ml-1.5 bg-orange-100 text-orange-600 text-xs px-1 rounded"
    }, "\uC2E0\uC6A9")), React.createElement("td", {
      className: "px-3 py-2 text-right tabular-nums whitespace-nowrap"
    }, fmt(s.quantity)), React.createElement("td", {
      className: "px-3 py-2 text-right tabular-nums whitespace-nowrap"
    }, fmt(s.currentPrice)), React.createElement("td", {
      className: "px-3 py-2 text-right font-medium tabular-nums whitespace-nowrap"
    }, fmtW(evalAmt)), React.createElement("td", {
      className: "px-3 py-2 text-center whitespace-nowrap"
    }, React.createElement("span", {
      className: `px-2 py-0.5 rounded text-xs font-medium
                      ${s.type === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`
    }, s.type === 'credit' ? '신용' : '일반')), React.createElement("td", {
      className: "px-2 py-1.5 text-center whitespace-nowrap"
    }, React.createElement("button", {
      onClick: () => startEdit(s),
      className: "tb-rowbtn bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold mr-1.5"
    }, "\uC218\uC815"), React.createElement("button", {
      onClick: () => deleteStock(s),
      className: "tb-rowbtn bg-red-50 text-red-500 hover:bg-red-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
    }, "\uC0AD\uC81C")));
  }), editId === 'new' && React.createElement("tr", {
    className: "tb-editrow"
  }, React.createElement("td", {
    colSpan: 6,
    className: "p-2"
  }, editCard))))), React.createElement("div", {
    className: "sm:hidden space-y-2 mb-3"
  }, stocks.map(s => {
    const evalAmt = (s.quantity || 0) * (s.currentPrice || 0);
    if (editId === s.id) return React.createElement("div", {
      key: s.id
    }, editCard);
    return React.createElement("div", {
      key: s.id,
      className: "bg-white rounded-xl p-3 shadow-sm"
    }, React.createElement("div", {
      className: "flex items-center justify-between gap-2 mb-1.5"
    }, React.createElement("div", {
      className: "flex items-center gap-1.5 min-w-0"
    }, React.createElement("span", {
      className: "font-semibold text-sm truncate"
    }, s.name), React.createElement("span", {
      className: `shrink-0 text-xs px-1.5 py-0.5 rounded font-medium
                    ${s.type === 'credit' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`
    }, s.type === 'credit' ? '신용' : '일반')), React.createElement("div", {
      className: "shrink-0 whitespace-nowrap flex gap-2"
    }, React.createElement("button", {
      onClick: () => startEdit(s),
      className: "bg-blue-50 text-blue-600 rounded-lg px-3 py-2 text-xs font-semibold"
    }, "\uC218\uC815"), React.createElement("button", {
      onClick: () => deleteStock(s),
      className: "bg-red-50 text-red-500 rounded-lg px-3 py-2 text-xs font-semibold"
    }, "\uC0AD\uC81C"))), React.createElement("div", {
      className: "flex items-center justify-between text-xs"
    }, React.createElement("span", {
      className: "text-gray-400 tabular-nums whitespace-nowrap"
    }, fmt(s.quantity), "\uC8FC \xD7 ", fmt(s.currentPrice), "\uC6D0"), React.createElement("span", {
      className: "font-bold text-gray-700 tabular-nums whitespace-nowrap"
    }, fmtW(evalAmt))));
  }), editId === 'new' && editCard), React.createElement("div", {
    className: "tb-addrow flex items-center justify-between gap-3 mb-4"
  }, React.createElement("button", {
    onClick: addStock,
    disabled: editId != null,
    className: `tb-add rounded-lg px-4 py-2 text-sm font-medium shadow text-white ${editId != null ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'}`
  }, "+ \uC885\uBAA9 \uCD94\uAC00"), priceAt ? React.createElement("span", {
    className: "text-xs text-gray-400 text-right"
  }, "\uD604\uC7AC\uAC00: ", fmtWhen(priceAt), " \uC2DC\uC138 \uC790\uB3D9 \uBC18\uC601") : null), React.createElement("div", {
    className: "tb-etc bg-white rounded-xl shadow p-4"
  }, React.createElement("h3", {
    className: "font-semibold text-gray-600 text-sm mb-3"
  }, "\uAE30\uD0C0 \uC790\uC0B0 \xB7 \uBD80\uCC44"), React.createElement("div", {
    className: "tb-etc-grid grid grid-cols-1 gap-3 sm:grid-cols-2"
  }, React.createElement("div", null, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uCC44\uAD8C\uD3C9\uAC00\uAE08\uC561"), React.createElement(NumInput, {
    value: bonds,
    onChange: setBonds,
    className: "w-full bg-gray-50"
  })), React.createElement("div", null, React.createElement("div", {
    className: "flex items-center justify-between mb-1"
  }, React.createElement("label", {
    className: "text-xs text-gray-400"
  }, "\uD604\uAE08\uC608\uC218\uAE08"), React.createElement("button", {
    onClick: () => setCash(-cash),
    title: "\uBD80\uD638 \uBC14\uAFB8\uAE30",
    className: "tb-sign text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded px-2 py-0.5 -my-0.5"
  }, "\uFF0B\uFF0F\u2212")), React.createElement(NumInput, {
    value: cash,
    onChange: setCash,
    negative: true,
    className: `w-full bg-gray-50 ${cash < 0 ? 'text-red-600' : ''}`
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uC2E0\uC6A9\uC735\uC790\uAE08\uC561"), React.createElement(NumInput, {
    value: loan,
    onChange: setLoan,
    className: "w-full bg-red-50"
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uCD5C\uC800\uC720\uC9C0\uBE44\uC728 (%)"), React.createElement(NumInput, {
    value: minRatio,
    onChange: setMinRatio,
    className: "w-full bg-gray-50",
    placeholder: String(DEFAULT_MIN_RATIO)
  }))), validRatio(minRatio) !== minRatio && React.createElement("p", {
    className: "text-xs text-red-500 mt-2"
  }, "\uCD5C\uC800\uC720\uC9C0\uBE44\uC728\uC740 100~300 \uC0AC\uC774\uC5EC\uC57C \uD569\uB2C8\uB2E4 \u2014 \uC9C0\uAE08\uC740 ", DEFAULT_MIN_RATIO, "%\uB85C \uACC4\uC0B0\uD569\uB2C8\uB2E4.")));
}
function Tab2({
  stocks,
  bonds,
  cash,
  loan,
  extraBuys,
  setExtraBuys,
  orphans,
  sim,
  setSim,
  minRatio,
  merged,
  onFill,
  onApplySim
}) {
  const newBuyId = () => Math.max(499, ...extraBuys.map(b => Number(b.id) || 0)) + 1;
  const [selId, setSelId] = useState('new');
  const [newName, setNewName] = useState('');
  const [addQty, setAddQty] = useState(0);
  const [addPrice, setAddPrice] = useState(0);
  const [addType, setAddType] = useState('normal');
  const [target, setTarget] = useState(() => {
    try {
      return Number(localStorage.getItem('dambo_target')) || 150;
    } catch {
      return 150;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('dambo_target', String(target));
    } catch {}
  }, [target]);
  const selStock = selId === 'new' ? null : stocks.find(s => String(s.id) === String(selId));
  useEffect(() => {
    if (selId !== 'new' && !selStock) setSelId('new');
  }, [selId, selStock]);
  const pickStock = v => {
    setSelId(v);
    const s = stocks.find(x => String(x.id) === String(v));
    if (s) setAddType(s.type === 'credit' ? 'credit' : 'normal');
  };
  const formValid = addQty > 0 && addPrice > 0 && (selId !== 'new' ? !!selStock : newName.trim() !== '');
  const previewResult = useMemo(() => {
    if (!formValid) return null;
    const name = selStock ? selStock.name : newName;
    const previewBuy = {
      id: -1,
      stockId: selId,
      name,
      qty: addQty,
      price: addPrice,
      type: addType
    };
    const {
      mergedStocks: ms,
      extraLoan: el
    } = applyExtraBuys(stocks, [...extraBuys, previewBuy]);
    const k = baseName(name);
    const at = ms.map(s => baseName(s.name) === k ? {
      ...s,
      currentPrice: addPrice
    } : s);
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
      type: addType
    }]);
    setAddQty(0);
    setAddPrice(0);
    if (selId === 'new') setNewName('');
  };
  const removeBuy = id => setExtraBuys(prev => prev.filter(b => b.id !== id));
  const clearAll = () => {
    if (confirm(`추가매수 ${extraBuys.length}건을 모두 지울까요?`)) setExtraBuys([]);
  };
  const T = target / 100;
  const goal = useMemo(() => {
    const {
      total,
      loan: L,
      cash: C
    } = merged;
    if (!(L > 0) || !(T > 1)) return null;
    const gap = T * L - total;
    return {
      deposit: Math.max(0, gap),
      repay: gap > 0 ? gap / (T - 1) : 0,
      cash: C,
      room: gap < 0 ? -gap / (T - 1) : 0
    };
  }, [merged, T]);
  const simOn = (sim.deposit || 0) > 0 || (sim.repay || 0) > 0;
  return React.createElement("div", {
    className: "tb-buy"
  }, React.createElement("div", {
    className: "tb-buy-left"
  }, React.createElement("div", {
    className: "tb-buyform bg-white rounded-xl shadow p-4 mb-4"
  }, React.createElement("h3", {
    className: "font-semibold text-gray-600 text-sm mb-3"
  }, "\uB9E4\uC218 \uCD94\uAC00"), React.createElement("div", {
    className: "grid grid-cols-1 gap-3 sm:grid-cols-2"
  }, React.createElement("div", {
    className: "sm:col-span-2"
  }, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uC885\uBAA9 \uC120\uD0DD"), React.createElement("select", {
    className: "w-full border rounded-lg px-2 py-1.5 text-sm",
    value: selStock ? String(selStock.id) : 'new',
    onChange: e => pickStock(e.target.value)
  }, React.createElement("option", {
    value: "new"
  }, "+ \uC2E0\uADDC \uC885\uBAA9"), stocks.map(s => React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name, " (", s.type === 'credit' ? '신용' : '일반', ") \u2014 ", fmt(s.currentPrice), "\uC6D0")))), selId === 'new' && React.createElement("div", {
    className: "sm:col-span-2"
  }, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uC885\uBAA9\uBA85"), React.createElement("input", {
    className: "w-full border rounded-lg px-2 py-1.5 text-sm",
    value: newName,
    onChange: e => setNewName(e.target.value),
    placeholder: "\uC885\uBAA9\uBA85 \uC785\uB825"
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uC218\uB7C9"), React.createElement(NumInput, {
    value: addQty,
    onChange: setAddQty,
    className: "w-full bg-gray-50"
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uB9E4\uC218 \uAC00\uACA9"), React.createElement(NumInput, {
    value: addPrice,
    onChange: setAddPrice,
    className: "w-full bg-gray-50"
  })), React.createElement("div", {
    className: "sm:col-span-2"
  }, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uC794\uACE0 \uAD6C\uBD84"), React.createElement("div", {
    className: "flex gap-2"
  }, ['normal', 'credit'].map(t => React.createElement("button", {
    key: t,
    onClick: () => setAddType(t),
    className: `tb-typebtn flex-1 py-2 rounded-lg text-sm font-semibold border transition-all
                    ${addType === t ? t === 'normal' ? 'bg-blue-500 text-white border-blue-500' : 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`
  }, t === 'normal' ? '일반' : '신용'))), selStock && selStock.type !== addType && React.createElement("p", {
    className: "text-xs text-amber-600 mt-1"
  }, "\uACE0\uB978 \uC885\uBAA9\uC740 ", selStock.type === 'credit' ? '신용' : '일반', " \uC904\uC785\uB2C8\uB2E4 \u2014 ", addType === 'credit' ? '신용(융자가 늘어남)' : '일반(융자가 늘지 않음)', "\uC73C\uB85C \uACC4\uC0B0\uD569\uB2C8\uB2E4.")), previewResult && React.createElement("div", {
    className: "tb-preview sm:col-span-2 bg-slate-50 rounded-lg p-3 text-sm space-y-1"
  }, React.createElement("div", {
    className: "flex justify-between"
  }, React.createElement("span", {
    className: "text-gray-500"
  }, "\uB9E4\uC218\uAE08\uC561"), React.createElement("span", {
    className: "font-bold"
  }, fmtW(addQty * addPrice))), addType === 'credit' && React.createElement("div", {
    className: "flex justify-between text-orange-600"
  }, React.createElement("span", null, "\uC735\uC790\uC99D\uAC00 (100% \xB7 \uB300\uC6A9\uC99D\uAC70\uAE08)"), React.createElement("span", {
    className: "font-bold"
  }, "+", fmtW(addQty * addPrice))), React.createElement("div", {
    className: "flex justify-between pt-1 border-t border-gray-200"
  }, React.createElement("span", {
    className: "text-gray-500"
  }, "\uC774 \uAC74 \uCCB4\uACB0 \uC2DC \uB2F4\uBCF4\uBE44\uC728"), React.createElement("span", {
    className: `tb-preview-ratio font-bold tabular-nums ${previewResult.ratio >= minRatio ? 'text-emerald-600' : 'text-red-600'}`
  }, fmtP(previewResult.ratio))), React.createElement("div", {
    className: "text-xs text-gray-400"
  }, "\uADF8 \uC885\uBAA9\uC774 ", fmt(addPrice), "\uC6D0\uC77C \uB54C \xB7 \uBAA9\uB85D\uC758 \uCD94\uAC00\uB9E4\uC218 \uD3EC\uD568")), React.createElement("button", {
    onClick: handleAdd,
    disabled: !formValid,
    className: `sm:col-span-2 py-2.5 rounded-xl text-sm font-bold transition-all
              ${formValid ? 'bg-blue-500 hover:bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`
  }, "+ \uBAA9\uB85D\uC5D0 \uCD94\uAC00"))), React.createElement("div", {
    className: "tb-sim bg-white rounded-xl shadow p-4 mb-4"
  }, React.createElement("h3", {
    className: "font-semibold text-gray-600 text-sm mb-3"
  }, "\uC785\uAE08 \xB7 \uC0C1\uD658"), React.createElement("div", {
    className: "grid grid-cols-2 gap-3"
  }, React.createElement("div", null, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uC785\uAE08 (\uBC16\uC5D0\uC11C \uB123\uB294 \uB3C8)"), React.createElement(NumInput, {
    value: sim.deposit || 0,
    onChange: v => setSim(s => ({
      ...s,
      deposit: Math.max(0, v)
    })),
    className: "w-full bg-gray-50"
  })), React.createElement("div", null, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, "\uD604\uAE08\uC73C\uB85C \uC735\uC790 \uC0C1\uD658"), React.createElement(NumInput, {
    value: sim.repay || 0,
    onChange: v => setSim(s => ({
      ...s,
      repay: Math.max(0, v)
    })),
    className: "w-full bg-gray-50"
  }))), simOn && React.createElement("div", {
    className: "mt-3 bg-slate-50 rounded-lg p-3 text-sm space-y-1"
  }, React.createElement("div", {
    className: "flex justify-between"
  }, React.createElement("span", {
    className: "text-gray-500"
  }, "\uBC18\uC601\uD558\uBA74 \uB2F4\uBCF4\uBE44\uC728 (\uC9C0\uAE08 \uAC12)"), React.createElement("span", {
    className: `tb-sim-ratio font-bold tabular-nums ${merged.ratio >= minRatio ? 'text-emerald-600' : 'text-red-600'}`
  }, fmtP(merged.ratio))), React.createElement("div", {
    className: "flex justify-between text-xs text-gray-400"
  }, React.createElement("span", null, "\uD604\uAE08 ", fmtW(merged.cash), " \xB7 \uC735\uC790 ", fmtW(merged.loan))), (sim.repay || 0) > Math.max(0, cash + (sim.deposit || 0)) && React.createElement("div", {
    className: "text-xs text-red-500"
  }, "\uC0C1\uD658\uD560 \uD604\uAE08\uC774 \uBAA8\uC790\uB78D\uB2C8\uB2E4 (\uD604\uAE08\uC608\uC218\uAE08 + \uC785\uAE08\uBCF4\uB2E4 \uD07D\uB2C8\uB2E4)."), React.createElement("div", {
    className: "flex gap-2 pt-1"
  }, React.createElement("button", {
    onClick: onApplySim,
    className: "tb-sim-apply flex-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg py-2 text-xs font-bold"
  }, "\uC2E4\uC81C\uB85C \uD588\uC74C \u2014 \uBCF4\uC720 \uB0B4\uC5ED\uC5D0 \uBC18\uC601"), React.createElement("button", {
    onClick: () => setSim({
      deposit: 0,
      repay: 0
    }),
    className: "bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-lg px-3 py-2 text-xs font-bold"
  }, "\uC9C0\uC6B0\uAE30"))), React.createElement("div", {
    className: "mt-3 pt-3 border-t border-gray-100"
  }, React.createElement("div", {
    className: "flex items-center justify-between gap-2 mb-2"
  }, React.createElement("span", {
    className: "text-xs text-gray-500 font-semibold"
  }, "\uBAA9\uD45C \uB2F4\uBCF4\uBE44\uC728"), React.createElement("div", {
    className: "flex items-center gap-1"
  }, React.createElement(NumInput, {
    value: target,
    onChange: setTarget,
    className: "tb-target w-20 bg-gray-50"
  }), React.createElement("span", {
    className: "text-sm text-gray-400"
  }, "%"))), goal ? goal.deposit > 0 ? React.createElement("div", {
    className: "tb-goal text-xs space-y-1"
  }, React.createElement("div", {
    className: "flex justify-between"
  }, React.createElement("span", {
    className: "text-gray-500"
  }, "\uC785\uAE08\uC73C\uB85C \uB9DE\uCD94\uB824\uBA74"), React.createElement("span", {
    className: "font-bold tabular-nums text-gray-700"
  }, fmtW(goal.deposit))), React.createElement("div", {
    className: "flex justify-between"
  }, React.createElement("span", {
    className: "text-gray-500"
  }, "\uD604\uAE08\uC73C\uB85C \uC0C1\uD658\uD574 \uB9DE\uCD94\uB824\uBA74"), React.createElement("span", {
    className: `font-bold tabular-nums ${goal.repay > goal.cash ? 'text-red-600' : 'text-gray-700'}`
  }, fmtW(goal.repay), goal.repay > goal.cash ? ' (현금 부족)' : ''))) : React.createElement("div", {
    className: "tb-goal text-xs flex justify-between"
  }, React.createElement("span", {
    className: "text-gray-500"
  }, "\uADF8 \uBE44\uC728\uC744 \uC9C0\uD0A4\uBA70 \uC2E0\uC6A9\uC73C\uB85C \uB354 \uC0B4 \uC218 \uC788\uB294 \uAE08\uC561"), React.createElement("span", {
    className: "font-bold tabular-nums text-gray-700"
  }, fmtW(goal.room))) : React.createElement("div", {
    className: "tb-goal text-xs text-gray-400"
  }, "\uC735\uC790\uAC00 \uC788\uACE0 \uBAA9\uD45C\uAC00 100%\uBCF4\uB2E4 \uD074 \uB54C \uACC4\uC0B0\uD569\uB2C8\uB2E4."), React.createElement("div", {
    className: "text-xs text-gray-300 mt-1"
  }, "\uCD94\uAC00\uB9E4\uC218\xB7\uC785\uAE08\xB7\uC0C1\uD658\uC744 \uBC18\uC601\uD55C \uC9C0\uAE08 \uAC12 \uAE30\uC900")))), extraBuys.length > 0 && React.createElement("div", {
    className: "tb-buylist bg-white rounded-xl shadow p-4 mb-4"
  }, React.createElement("div", {
    className: "flex justify-between items-center mb-3"
  }, React.createElement("h3", {
    className: "font-semibold text-gray-600 text-sm"
  }, "\uCD94\uAC00\uB9E4\uC218 \uBAA9\uB85D", React.createElement("span", {
    className: "ml-2 bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full"
  }, extraBuys.length, "\uAC74")), React.createElement("button", {
    onClick: clearAll,
    className: "text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-2"
  }, "\uC804\uCCB4 \uC0AD\uC81C")), React.createElement("div", {
    className: "tb-buyitems space-y-2"
  }, extraBuys.map((buy, idx) => {
    const orphan = orphans.includes(buy.id);
    return React.createElement("div", {
      key: buy.id,
      className: `tb-buyitem rounded-lg px-3 py-2 text-sm ${orphan ? 'bg-red-50' : 'bg-slate-50'}`
    }, React.createElement("div", {
      className: "flex items-center justify-between gap-2"
    }, React.createElement("div", {
      className: "flex items-center gap-2 min-w-0"
    }, React.createElement("span", {
      className: "text-gray-400 text-xs w-4 shrink-0"
    }, idx + 1), React.createElement("span", {
      className: "font-medium truncate"
    }, buy.name), React.createElement("span", {
      className: `shrink-0 text-xs px-1.5 py-0.5 rounded
                        ${buy.type === 'credit' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`
    }, buy.type === 'credit' ? '신용' : '일반')), React.createElement("div", {
      className: "flex items-center gap-1 shrink-0"
    }, !orphan && React.createElement("button", {
      onClick: () => onFill(buy),
      className: "tb-fill bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
    }, "\uCCB4\uACB0"), React.createElement("button", {
      onClick: () => removeBuy(buy.id),
      "aria-label": "\uC9C0\uC6B0\uAE30",
      className: "tb-x w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 text-sm"
    }, "\u2715"))), React.createElement("div", {
      className: "flex justify-between items-baseline gap-2 pl-6 text-xs tabular-nums"
    }, React.createElement("span", {
      className: "text-gray-500 whitespace-nowrap"
    }, fmt(buy.qty), "\uC8FC \xD7 ", fmt(buy.price), "\uC6D0"), React.createElement("span", {
      className: "font-bold text-gray-700 whitespace-nowrap"
    }, "= ", fmtW(buy.qty * buy.price))), orphan && React.createElement("div", {
      className: "tb-orphan pl-6 mt-1 text-xs text-red-600"
    }, "\uAC00\uB9AC\uD0A4\uB358 \uC885\uBAA9\uC774 \uD3EC\uD2B8\uD3F4\uB9AC\uC624\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4 \u2014 \uACC4\uC0B0\uC5D0\uC11C \uBE90\uC2B5\uB2C8\uB2E4. \uC9C0\uC6B0\uAC70\uB098 \uB2E4\uC2DC \uB123\uC5B4 \uC8FC\uC138\uC694."));
  })), React.createElement("div", {
    className: "mt-3 pt-3 border-t border-gray-100 text-sm"
  }, React.createElement("div", {
    className: "flex justify-between text-gray-500 mb-1"
  }, React.createElement("span", null, "\uCD1D \uCD94\uAC00\uB9E4\uC218\uAE08\uC561"), React.createElement("span", {
    className: "font-bold tabular-nums text-gray-700"
  }, fmtW(extraBuys.filter(b => !orphans.includes(b.id)).reduce((s, b) => s + b.qty * b.price, 0)))), merged.extraLoan > 0 && React.createElement("div", {
    className: "flex justify-between text-orange-600"
  }, React.createElement("span", null, "\uCD1D \uC735\uC790\uC99D\uAC00"), React.createElement("span", {
    className: "font-bold tabular-nums"
  }, "+", fmtW(merged.extraLoan))))));
}
function Tab3({
  mergedStocks,
  bonds,
  cash,
  mergedLoan,
  extraBuys = [],
  changes,
  setChanges,
  minRatio,
  simNote
}) {
  const extraBuyCount = extraBuys.length;
  const groupIds = id => {
    const me = mergedStocks.find(x => x.id === id);
    if (!me) return [id];
    const k = baseName(me.name);
    return mergedStocks.filter(x => baseName(x.name) === k).map(x => x.id);
  };
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
      if (p && st.currentPrice > 0) m[st.id] = (p - st.currentPrice) / st.currentPrice * 100;
    }
    return m;
  }, [extraBuys, mergedStocks]);
  const getChg = id => changes[id] ?? defaultChg[id] ?? 0;
  const setChg = (id, v) => setChanges(prev => {
    const next = {
      ...prev
    };
    for (const gid of groupIds(id)) next[gid] = v;
    return next;
  });
  const resetAll = () => setChanges({});
  const simStocks = useMemo(() => mergedStocks.map(s => ({
    ...s,
    currentPrice: Math.max(0, s.currentPrice * (1 + getChg(s.id) / 100))
  })), [mergedStocks, changes, defaultChg]);
  const result = useMemo(() => calc(simStocks, bonds, cash, mergedLoan, minRatio), [simStocks, bonds, cash, mergedLoan, minRatio]);
  const baseResult = useMemo(() => calc(mergedStocks, bonds, cash, mergedLoan, minRatio), [mergedStocks, bonds, cash, mergedLoan, minRatio]);
  const diff = result.ratio - baseResult.ratio;
  const extraCashCost = extraBuys.filter(b => b.type !== 'credit').reduce((sum, b) => sum + (b.qty || 0) * (b.price || 0), 0);
  const simBalance = result.total - mergedLoan - extraCashCost;
  const baseBalance = baseResult.total - mergedLoan - extraCashCost;
  const balDiff = simBalance - baseBalance;
  const balPct = baseBalance > 0 ? balDiff / baseBalance * 100 : 0;
  const edge = useMemo(() => {
    const required = mergedLoan * (minRatio / 100);
    const out = {};
    if (!(mergedLoan > 0)) return out;
    const byBase = {};
    for (const s of mergedStocks) (byBase[baseName(s.name)] = byBase[baseName(s.name)] || []).push(s);
    for (const k of Object.keys(byBase)) {
      const baseVal = byBase[k].reduce((a, s) => a + (s.quantity || 0) * (s.currentPrice || 0), 0);
      const simVal = simStocks.filter(s => baseName(s.name) === k).reduce((a, s) => a + (s.quantity || 0) * (s.currentPrice || 0), 0);
      if (!(baseVal > 0)) continue;
      const chg = ((required - (result.total - simVal)) / baseVal - 1) * 100;
      for (const s of byBase[k]) out[s.id] = chg;
    }
    return out;
  }, [mergedStocks, simStocks, result.total, mergedLoan, minRatio]);
  const subLabel = [extraBuyCount > 0 ? `추가매수 ${extraBuyCount}건` : null, simNote].filter(Boolean).join(' · ');
  return React.createElement("div", {
    className: "tb-scn"
  }, React.createElement("div", {
    className: "tb-scn-side"
  }, React.createElement(RatioCard, {
    result: result,
    label: "\uC2DC\uB098\uB9AC\uC624 \uB2F4\uBCF4\uBE44\uC728",
    subLabel: subLabel ? `${subLabel} 반영 중` : null
  }), Math.abs(diff) > 0.005 && React.createElement("div", {
    className: `tb-scn-diff mb-4 text-center rounded-xl py-2.5 font-bold text-sm
          ${diff >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`
  }, "\uAE30\uC900 \uB300\uBE44 ", diff >= 0 ? '▲' : '▼', " ", Math.abs(diff).toFixed(2), "%p"), React.createElement("div", {
    className: "tb-scn-bal bg-white rounded-xl shadow p-4 mb-4"
  }, React.createElement("div", {
    className: "flex justify-between items-baseline"
  }, React.createElement("span", {
    className: "text-gray-500 font-semibold text-sm"
  }, "\uC2DC\uB098\uB9AC\uC624 \uCD1D\uC794\uACE0"), React.createElement("span", {
    className: `text-2xl font-extrabold tabular-nums
            ${balDiff > 0.5 ? 'text-red-500' : balDiff < -0.5 ? 'text-blue-600' : 'text-gray-700'}`
  }, fmtW(simBalance))), React.createElement("div", {
    className: "flex justify-between text-xs text-gray-400 mt-1.5"
  }, React.createElement("span", null, "\uC9C0\uAE08 ", fmtW(baseBalance)), Math.abs(balDiff) > 0.5 ? React.createElement("span", {
    className: `tabular-nums font-medium ${balDiff > 0 ? 'text-red-500' : 'text-blue-600'}`
  }, balDiff > 0 ? '▲ +' : '▼ −', fmtW(Math.abs(balDiff)), " (", balDiff > 0 ? '+' : '−', Math.abs(balPct).toFixed(1), "%)") : React.createElement("span", null, "\uBCC0\uD654 \uC5C6\uC74C")), React.createElement("div", {
    className: "text-xs text-gray-300 mt-1"
  }, "\uC8FC\uC2DD + \uCC44\uAD8C + \uD604\uAE08 \u2212 \uC2E0\uC6A9\uB300\uCD9C (\uC99D\uAD8C\uC0AC \uCD1D\uD3C9\uAC00\uAE08\uC561)"))), React.createElement("div", {
    className: "tb-scn-list bg-white rounded-xl shadow p-4"
  }, React.createElement("div", {
    className: "flex justify-between items-center gap-3 mb-4"
  }, React.createElement("div", {
    className: "min-w-0"
  }, React.createElement("h3", {
    className: "font-semibold text-gray-600 text-sm"
  }, "\uC885\uBAA9\uBCC4 \uAC00\uACA9 \uC2DC\uB098\uB9AC\uC624"), extraBuyCount > 0 && React.createElement("p", {
    className: "text-xs text-blue-500 mt-0.5"
  }, "\uCD94\uAC00\uB9E4\uC218 ", extraBuyCount, "\uAC74\uC774 \uC218\uB7C9\uC5D0 \uBC18\uC601\uB428 \xB7 \uC2DC\uB098\uB9AC\uC624\uAC00 \uAE30\uBCF8\uAC12 = \uCD94\uAC00\uB9E4\uC218 \uCD5C\uC800\uAC00")), React.createElement("button", {
    onClick: resetAll,
    className: "shrink-0 whitespace-nowrap text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg px-3 py-2"
  }, "\uC804\uCCB4 \uCD08\uAE30\uD654")), React.createElement("div", {
    className: "tb-scn-items space-y-4"
  }, mergedStocks.map(s => {
    const chg = getChg(s.id);
    const simPrice = Math.max(0, s.currentPrice * (1 + chg / 100));
    const isExtra = String(s.id).startsWith('extra_');
    const e = edge[s.id];
    const handlePriceChange = newPrice => {
      if (s.currentPrice <= 0) return;
      const newChg = (newPrice - s.currentPrice) / s.currentPrice * 100;
      setChg(s.id, newChg);
    };
    return React.createElement("div", {
      key: s.id,
      className: `tb-scn-item border rounded-xl p-3 ${isExtra ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}`
    }, React.createElement("div", {
      className: "flex justify-between items-center mb-3"
    }, React.createElement("div", null, React.createElement("span", {
      className: "font-medium text-sm"
    }, s.name), React.createElement("span", {
      className: `ml-2 text-xs px-1.5 py-0.5 rounded
                      ${s.type === 'credit' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`
    }, s.type === 'credit' ? '신용' : '일반'), isExtra && React.createElement("span", {
      className: "ml-1 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-500"
    }, "\uCD94\uAC00\uB9E4\uC218"), React.createElement("span", {
      className: "ml-2 text-xs text-gray-400"
    }, fmt(s.quantity), "\uC8FC")), React.createElement("div", {
      className: "text-xs text-gray-300"
    }, "\uAE30\uC900\uAC00 ", fmt(s.currentPrice), "\uC6D0")), React.createElement("div", {
      className: "flex items-center gap-2 mb-2"
    }, React.createElement("div", {
      className: "flex items-center gap-1 flex-1 min-w-0"
    }, React.createElement("span", {
      className: "text-xs text-gray-400 shrink-0"
    }, "\uC2DC\uB098\uB9AC\uC624\uAC00"), React.createElement(PriceInput, {
      value: simPrice,
      onChange: handlePriceChange,
      className: `flex-1 font-bold text-sm
                        ${chg < 0 ? 'text-blue-600 border-blue-200 bg-blue-50' : chg > 0 ? 'text-red-500 border-red-200 bg-red-50' : 'text-gray-700 bg-gray-50'}`
    }), React.createElement("span", {
      className: "text-xs text-gray-400 shrink-0"
    }, "\uC6D0")), React.createElement("div", {
      className: "text-gray-200 text-sm shrink-0"
    }, "|"), React.createElement("div", {
      className: "flex items-center gap-0.5 shrink-0"
    }, React.createElement("input", {
      type: "number",
      min: "-80",
      max: "200",
      value: Math.round(chg * 10) / 10,
      onChange: e => setChg(s.id, parseFloat(e.target.value) || 0),
      className: `w-14 border rounded px-1 py-1.5 text-sm text-right font-bold focus:outline-none focus:ring-1 focus:ring-blue-300
                        ${chg < 0 ? 'text-blue-600 border-blue-200 bg-blue-50' : chg > 0 ? 'text-red-500 border-red-200 bg-red-50' : 'text-gray-600 bg-gray-50'}`
    }), React.createElement("span", {
      className: "text-sm text-gray-400"
    }, "%"))), React.createElement("input", {
      type: "range",
      min: "-80",
      max: "50",
      step: "1",
      value: Math.max(-80, Math.min(50, chg)),
      onChange: e => setChg(s.id, parseFloat(e.target.value)),
      className: "w-full mb-2"
    }), React.createElement("div", {
      className: "flex justify-between text-xs text-gray-400"
    }, React.createElement("span", null, "\uD3C9\uAC00\uAE08\uC561"), React.createElement("span", {
      className: "tabular-nums font-medium"
    }, fmtW(s.quantity * simPrice), chg !== 0 && React.createElement("span", {
      className: `ml-1 ${chg < 0 ? 'text-blue-500' : 'text-red-500'}`
    }, "(", chg > 0 ? '+' : '', fmtW((simPrice - s.currentPrice) * s.quantity), ")"))), e != null && s.currentPrice > 0 && React.createElement("div", {
      className: "tb-edge flex justify-between items-center gap-2 text-xs text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100"
    }, React.createElement("span", null, minRatio, "%\uC5D0 \uB2FF\uB294 \uAC12"), e > -100 ? React.createElement("button", {
      onClick: () => setChg(s.id, e),
      className: "tb-edge-btn tabular-nums font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg px-2 py-1"
    }, fmtW(s.currentPrice * (1 + e / 100)), " (", e > 0 ? '+' : '', e.toFixed(1), "%)") : React.createElement("span", {
      className: "font-medium text-gray-500"
    }, "0\uC6D0\uC774 \uB418\uC5B4\uB3C4 \uC720\uC9C0")));
  }))));
}
function checkBackup(json) {
  const bad = msg => ({
    error: msg
  });
  if (!json || typeof json !== 'object' || Array.isArray(json)) return bad('백업 파일의 모양이 아닙니다.');
  const p = json.portfolio && typeof json.portfolio === 'object' ? json.portfolio : json;
  if (!Array.isArray(p.stocks)) return bad('종목 목록(stocks)이 없습니다.');
  const isNum = v => typeof v === 'number' && isFinite(v);
  const ids = new Set();
  for (let i = 0; i < p.stocks.length; i++) {
    const s = p.stocks[i],
      at = `종목 ${i + 1}번째`;
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
    const b = buys[i],
      at = `추가매수 ${i + 1}번째`;
    if (!b || typeof b !== 'object') return bad(`${at}: 내용이 없습니다.`);
    if (!isNum(b.id) || bids.has(b.id)) return bad(`${at}: 번호(id)가 없거나 겹칩니다.`);
    bids.add(b.id);
    if (typeof b.name !== 'string' || !isNum(b.qty) || !isNum(b.price) || b.qty <= 0 || b.price <= 0) return bad(`${at}: 이름·수량·가격이 올바르지 않습니다.`);
    if (b.type !== 'normal' && b.type !== 'credit') return bad(`${at}: 구분이 일반/신용이 아닙니다.`);
    if (b.stockId !== 'new' && !/^\d+$/.test(String(b.stockId))) return bad(`${at}: 가리키는 종목 번호가 올바르지 않습니다.`);
  }
  if (p.minRatio != null && !(isNum(p.minRatio) && p.minRatio >= 100 && p.minRatio <= 300)) return bad('최저유지비율이 100~300 사이가 아닙니다.');
  const sim = p.sim && typeof p.sim === 'object' ? p.sim : {};
  for (const k of ['deposit', 'repay']) if (sim[k] != null && !(isNum(sim[k]) && sim[k] >= 0)) return bad('입금·상환 값이 올바르지 않습니다.');
  return {
    data: {
      stocks: p.stocks.map(s => ({
        id: s.id,
        name: s.name.trim(),
        quantity: s.quantity,
        avgPrice: isNum(s.avgPrice) ? s.avgPrice : 0,
        currentPrice: s.currentPrice,
        type: s.type
      })),
      bonds: isNum(p.bonds) ? p.bonds : 0,
      cash: isNum(p.cash) ? p.cash : 0,
      loan: isNum(p.loan) ? p.loan : 0,
      extraBuys: buys.map(b => ({
        id: b.id,
        stockId: String(b.stockId),
        name: b.name,
        qty: b.qty,
        price: b.price,
        type: b.type
      })),
      minRatio: isNum(p.minRatio) ? p.minRatio : null,
      sim: {
        deposit: isNum(sim.deposit) ? sim.deposit : 0,
        repay: isNum(sim.repay) ? sim.repay : 0
      }
    },
    savedAt: typeof json.savedAt === 'number' ? json.savedAt : null
  };
}
function BackupModal({
  data,
  canRestore,
  onRestore,
  onClose
}) {
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const fileRef = useRef(null);
  useEffect(() => {
    damboUi.editing++;
    return () => {
      damboUi.editing--;
    };
  }, []);
  const download = () => {
    try {
      const d = new Date(),
        p = n => String(n).padStart(2, '0');
      const name = `dambo-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
      const blob = new Blob([JSON.stringify({
        app: 'dambo',
        savedAt: Date.now(),
        portfolio: data
      }, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setError('');
      setDone(`「${name}」으로 받았습니다. 받은 파일에는 보유 내역이 그대로 들어 있으니 다른 사람에게 보내지 마세요.`);
    } catch (e) {
      setError('파일을 만들지 못했습니다.');
    }
  };
  const pickFile = e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setDone('');
    setError('');
    if (f.size > 1024 * 1024) {
      setError('파일이 너무 큽니다 (1MB 넘음). 담보비율 백업 파일이 맞는지 확인해 주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError('파일을 읽지 못했습니다.');
    reader.onload = () => {
      let json;
      try {
        json = JSON.parse(String(reader.result));
      } catch {
        setError('백업 파일이 아닙니다 (내용을 읽을 수 없음).');
        return;
      }
      const r = checkBackup(json);
      if (r.error) {
        setError(`복원하지 않았습니다 — ${r.error}`);
        return;
      }
      const n = r.data;
      const msg = `이 파일로 되돌릴까요?${r.savedAt ? `\n(백업한 때: ${fmtWhen(r.savedAt)})` : ''}\n\n` + `종목 ${data.stocks.length}개 → ${n.stocks.length}개\n추가매수 ${data.extraBuys.length}건 → ${n.extraBuys.length}건\n` + `융자 ${fmtW(data.loan)} → ${fmtW(n.loan)}\n\n지금 내역은 지워지고 서버에도 저장됩니다.`;
      if (!confirm(msg)) return;
      onRestore(n);
      onClose();
    };
    reader.readAsText(f);
  };
  return React.createElement("div", {
    className: "fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4",
    onClick: e => e.target === e.currentTarget && onClose()
  }, React.createElement("div", {
    className: "tb-modal bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
  }, React.createElement("div", {
    className: "flex justify-between items-center mb-3"
  }, React.createElement("h2", {
    className: "font-bold text-gray-700 text-base"
  }, "\uBC31\uC5C5 \xB7 \uBCF5\uC6D0"), React.createElement("button", {
    onClick: onClose,
    "aria-label": "\uB2EB\uAE30",
    className: "tb-x w-9 h-9 -mr-2 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xl leading-none"
  }, "\u2715")), React.createElement("p", {
    className: "text-xs text-gray-500 mb-3"
  }, "\uAE30\uAE30\uB07C\uB9AC\uB294 \uD074\uB77C\uC6B0\uB4DC\uAC00 \uB9DE\uCDB0 \uC90D\uB2C8\uB2E4. \uC5EC\uAE30\uC11C\uB294 \uC9C0\uAE08 \uB0B4\uC5ED\uC744 \uD30C\uC77C\uB85C \uBC1B\uC544 \uB450\uC5C8\uB2E4\uAC00, \uC798\uBABB \uACE0\uCCE4\uC744 \uB54C \uADF8 \uD30C\uC77C\uB85C \uB418\uB3CC\uB9B4 \uC218 \uC788\uC2B5\uB2C8\uB2E4."), React.createElement("button", {
    onClick: download,
    className: "tb-backup-save w-full py-2.5 rounded-xl text-sm font-bold bg-slate-700 hover:bg-slate-800 text-white"
  }, "\uC9C0\uAE08 \uB0B4\uC5ED\uC744 \uD30C\uC77C\uB85C \uBC1B\uAE30"), React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: "application/json,.json",
    className: "hidden",
    onChange: pickFile
  }), React.createElement("button", {
    onClick: () => fileRef.current && fileRef.current.click(),
    disabled: !canRestore,
    className: `tb-backup-load mt-2 w-full py-2.5 rounded-xl text-sm font-bold
            ${canRestore ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`
  }, "\uBC31\uC5C5 \uD30C\uC77C\uB85C \uB418\uB3CC\uB9AC\uAE30"), !canRestore && React.createElement("p", {
    className: "text-xs text-gray-400 mt-1"
  }, "\uB418\uB3CC\uB9AC\uAE30\uB294 \uC800\uC7A5\uD560 \uC218 \uC788\uB294 \uACC4\uC815\uC5D0\uC11C, \uCD5C\uC2E0 \uAC12\uC744 \uBC1B\uC740 \uB4A4\uC5D0\uB9CC \uB429\uB2C8\uB2E4."), error && React.createElement("p", {
    className: "tb-backup-error text-xs text-red-500 mt-2"
  }, error), done && React.createElement("p", {
    className: "tb-backup-done text-xs text-emerald-600 mt-2"
  }, done)));
}
function FillModal({
  buy,
  onConfirm,
  onClose
}) {
  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('dambo_fill_opts') || '{}') || {};
    } catch {
      return {};
    }
  }, []);
  const [setPrice, setSetPrice] = useState(saved.setPrice !== false);
  const [deduct, setDeduct] = useState(saved.deduct === true);
  useEffect(() => {
    damboUi.editing++;
    return () => {
      damboUi.editing--;
    };
  }, []);
  const amount = (buy.qty || 0) * (buy.price || 0);
  const go = () => {
    try {
      localStorage.setItem('dambo_fill_opts', JSON.stringify({
        setPrice,
        deduct
      }));
    } catch {}
    onConfirm(buy, {
      setPrice,
      deductCash: buy.type !== 'credit' && deduct
    });
    onClose();
  };
  return React.createElement("div", {
    className: "fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4",
    onClick: e => e.target === e.currentTarget && onClose()
  }, React.createElement("div", {
    className: "tb-modal tb-fillmodal bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
  }, React.createElement("h2", {
    className: "font-bold text-gray-700 text-base mb-3"
  }, "\uCCB4\uACB0\uB41C \uB9E4\uC218\uB97C \uBCF4\uC720 \uB0B4\uC5ED\uC5D0 \uBC18\uC601"), React.createElement("div", {
    className: "bg-slate-50 rounded-lg p-3 text-sm space-y-1 mb-3"
  }, React.createElement("div", {
    className: "flex justify-between gap-2"
  }, React.createElement("span", {
    className: "text-gray-500 truncate"
  }, buy.name, " \xB7 ", buy.type === 'credit' ? '신용' : '일반'), React.createElement("span", {
    className: "font-bold tabular-nums whitespace-nowrap"
  }, fmt(buy.qty), "\uC8FC \xD7 ", fmt(buy.price), "\uC6D0")), React.createElement("div", {
    className: "flex justify-between text-xs text-gray-500"
  }, React.createElement("span", null, "\uC218\uB7C9"), React.createElement("span", {
    className: "tabular-nums"
  }, "+", fmt(buy.qty), "\uC8FC")), buy.type === 'credit' ? React.createElement("div", {
    className: "flex justify-between text-xs text-orange-600"
  }, React.createElement("span", null, "\uC2E0\uC6A9\uC735\uC790\uAE08\uC561"), React.createElement("span", {
    className: "tabular-nums"
  }, "+", fmtW(amount))) : React.createElement("div", {
    className: "flex justify-between text-xs text-gray-500"
  }, React.createElement("span", null, "\uB9E4\uC218\uAE08\uC561"), React.createElement("span", {
    className: "tabular-nums"
  }, fmtW(amount)))), React.createElement("label", {
    className: "flex items-start gap-2 text-sm text-gray-600 py-1.5"
  }, React.createElement("input", {
    type: "checkbox",
    className: "mt-0.5 w-4 h-4",
    checked: setPrice,
    onChange: e => setSetPrice(e.target.checked)
  }), React.createElement("span", null, "\uADF8 \uC885\uBAA9\uC758 \uD604\uC7AC\uAC00\uB97C \uCCB4\uACB0\uAC00(", fmt(buy.price), "\uC6D0)\uB85C \uB9DE\uCD98\uB2E4")), buy.type !== 'credit' && React.createElement("label", {
    className: "flex items-start gap-2 text-sm text-gray-600 py-1.5"
  }, React.createElement("input", {
    type: "checkbox",
    className: "mt-0.5 w-4 h-4",
    checked: deduct,
    onChange: e => setDeduct(e.target.checked)
  }), React.createElement("span", null, "\uD604\uAE08\uC608\uC218\uAE08\uC5D0\uC11C \uB9E4\uC218\uAE08\uC561\uC744 \uBE80\uB2E4 ", React.createElement("span", {
    className: "text-xs text-gray-400"
  }, "(\uACC4\uC88C\uC5D0 \uC788\uB358 \uD604\uAE08\uC73C\uB85C \uC0C0\uC744 \uB54C)"))), React.createElement("div", {
    className: "flex gap-2 mt-3"
  }, React.createElement("button", {
    onClick: go,
    className: "tb-fill-ok flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold"
  }, "\uBC18\uC601"), React.createElement("button", {
    onClick: onClose,
    className: "flex-1 bg-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-bold"
  }, "\uCDE8\uC18C"))));
}
function CloudBar({
  state,
  updatedAt,
  source,
  role,
  email,
  offline,
  pending,
  onOpenBackup
}) {
  const when = fmtWhen(updatedAt);
  const from = source === 'claude' ? 'PC에서 입력' : source === 'app' ? '앱에서 저장' : source === 'auto' ? '시세 자동 반영' : '';
  let dot = 'bg-slate-500',
    text = '';
  if (state === 'checking') {
    dot = 'bg-amber-400 animate-pulse';
    text = `최신 확인 중 — 아직 고치지 마세요${when ? ` (지난번 ${when} 값)` : ''}`;
  } else if (offline && pending) {
    dot = 'bg-red-400 animate-pulse';
    text = '오프라인 — 연결되면 저장합니다. 그 전에 닫으면 고친 값이 사라집니다';
  } else if (state === 'saving') {
    dot = 'bg-blue-400 animate-pulse';
    text = '저장 중…';
  } else if (state === 'savefail') {
    dot = 'bg-red-400';
    text = '저장하지 못했습니다 — 고친 값은 이 화면에만 있습니다';
  } else if (state === 'error') {
    dot = 'bg-red-400';
    text = `클라우드를 못 읽었습니다${when ? ` (지난번 ${when} 값)` : ' (빈 화면)'}`;
  } else if (state === 'empty') {
    dot = 'bg-slate-500';
    text = '클라우드에 저장된 내역 없음';
  } else if (offline) {
    dot = 'bg-red-400';
    text = `오프라인${when ? ` — ${when} 값` : ''}`;
  } else {
    dot = 'bg-emerald-400';
    text = when ? `클라우드 ${when}${from ? ` · ${from}` : ''}` : '클라우드 연결됨';
  }
  if (role === 'viewer') text = `열람 전용(고쳐도 저장 안 됨) · ${text}`;
  return React.createElement("div", {
    className: "tb-cloud mt-3 flex items-start gap-2 text-xs"
  }, React.createElement("span", {
    className: `w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dot}`
  }), React.createElement("span", {
    className: "tb-cloud-text flex-1 min-w-0 text-slate-400 leading-snug break-keep"
  }, text), React.createElement("div", {
    className: "shrink-0 flex -my-1.5 -mr-2"
  }, React.createElement("button", {
    onClick: onOpenBackup,
    title: email,
    className: "tb-headbtn px-2 py-2 text-slate-400 hover:text-slate-200"
  }, "\uBC31\uC5C5"), React.createElement("button", {
    onClick: () => window.damboSignOut(),
    className: "tb-headbtn px-2 py-2 text-slate-400 hover:text-slate-200"
  }, "\uB85C\uADF8\uC544\uC6C3")));
}
const KNOWN_KEYS = ['stocks', 'bonds', 'cash', 'loan', 'extraBuys', 'extraBuysSynced', 'minRatio', 'sim', 'priceAt'];
function fromCloud(p) {
  p = p && typeof p === 'object' ? p : {};
  const stocks = (Array.isArray(p.stocks) ? p.stocks : []).filter(Boolean);
  const rest = {};
  for (const k of Object.keys(p)) if (!KNOWN_KEYS.includes(k)) rest[k] = p[k];
  return {
    stocks,
    bonds: num(p.bonds),
    cash: num(p.cash),
    loan: num(p.loan),
    extraBuys: normalizeBuys(stocks, (Array.isArray(p.extraBuys) ? p.extraBuys : []).filter(Boolean)),
    minRatio: typeof p.minRatio === 'number' ? p.minRatio : DEFAULT_MIN_RATIO,
    sim: {
      deposit: num(p.sim && p.sim.deposit),
      repay: num(p.sim && p.sim.repay)
    },
    priceAt: typeof p.priceAt === 'number' ? p.priceAt : null,
    rest
  };
}
function App({
  boot
}) {
  const init = useMemo(() => fromCloud(boot.portfolio), []);
  const [stocks, setStocks] = useState(init.stocks);
  const [bonds, setBonds] = useState(init.bonds);
  const [cash, setCash] = useState(init.cash);
  const [loan, setLoan] = useState(init.loan);
  const [extraBuys, setExtraBuys] = useState(init.extraBuys);
  const [minRatioIn, setMinRatioIn] = useState(init.minRatio);
  const [sim, setSim] = useState(init.sim);
  const [priceAt, setPriceAt] = useState(init.priceAt);
  const restRef = useRef(init.rest);
  const [sync, setSync] = useState({
    updatedAt: boot.updatedAt,
    source: boot.source
  });
  const [applied, setApplied] = useState(0);
  const [scenarioChanges, setScenarioChanges] = useState({});
  const [tab, setTab] = useState('portfolio');
  const [showBackup, setShowBackup] = useState(false);
  const [fillBuy, setFillBuy] = useState(null);
  const [offline, setOffline] = useState(false);
  const [cloudState, setCloudState] = useState(boot.cached ? 'checking' : boot.error ? 'error' : boot.portfolio ? 'synced' : 'empty');
  const minRatio = validRatio(minRatioIn);
  const canSave = boot.role === 'admin';
  const seq = useRef(0),
    savedSeq = useRef(0),
    lastApplied = useRef(0),
    timer = useRef(null),
    first = useRef(true);
  const latest = useRef(null);
  latest.current = {
    stocks,
    bonds,
    cash,
    loan,
    extraBuys,
    minRatioIn,
    sim,
    priceAt
  };
  const [pending, setPending] = useState(false);
  const toCloud = s => {
    const p = {
      ...restRef.current,
      stocks: s.stocks,
      bonds: s.bonds,
      cash: s.cash,
      loan: s.loan,
      extraBuys: s.extraBuys,
      extraBuysSynced: true
    };
    p.minRatio = validRatio(s.minRatioIn);
    if (s.priceAt) p.priceAt = s.priceAt;
    if ((s.sim.deposit || 0) > 0 || (s.sim.repay || 0) > 0) p.sim = {
      deposit: s.sim.deposit || 0,
      repay: s.sim.repay || 0
    };
    return p;
  };
  const onStale = () => {
    alert('PC나 다른 기기에서 값이 바뀌어 있었습니다.\n덮어쓰지 않고 최신 값을 불러옵니다. 방금 고친 내용은 다시 입력해 주세요.');
    seq.current = savedSeq.current;
    setPending(false);
    Promise.resolve(window.damboRefresh ? window.damboRefresh() : Promise.reject()).catch(() => location.reload());
  };
  const sendNow = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const my = seq.current;
    window.damboSave(toCloud(latest.current)).then(res => {
      if (!res || res.r === 'skipped' || res.r === 'viewer') return;
      if (res.r === 'ok') {
        savedSeq.current = Math.max(savedSeq.current, my);
        setSync({
          updatedAt: res.at,
          source: 'app'
        });
        if (seq.current === my) {
          setPending(false);
          setCloudState('synced');
        }
        return;
      }
      if (res.r === 'stale') {
        onStale();
        return;
      }
      if (seq.current === my) setCloudState('savefail');
    });
  };
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (lastApplied.current !== applied) {
      lastApplied.current = applied;
      return;
    }
    seq.current++;
    if (!canSave) return;
    setPending(true);
    setCloudState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(sendNow, 800);
  }, [stocks, bonds, cash, loan, extraBuys, minRatioIn, sim, priceAt, applied]);
  useEffect(() => {
    const flush = () => {
      if (timer.current && document.visibilityState !== 'visible') sendNow();
    };
    const flushNow = () => {
      if (timer.current) sendNow();
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flushNow);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flushNow);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);
  useEffect(() => {
    const apply = doc => {
      const c = fromCloud(doc.portfolio);
      restRef.current = c.rest;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      seq.current = savedSeq.current;
      setStocks(c.stocks);
      setBonds(c.bonds);
      setCash(c.cash);
      setLoan(c.loan);
      setExtraBuys(c.extraBuys);
      setMinRatioIn(c.minRatio);
      setSim(c.sim);
      setPriceAt(c.priceAt);
      setSync({
        updatedAt: doc.updatedAt ?? null,
        source: doc.source ?? null
      });
      setApplied(n => n + 1);
      setPending(false);
      setCloudState(doc.portfolio ? 'synced' : 'empty');
    };
    const typing = () => {
      const a = document.activeElement;
      return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !!a.closest('#root');
    };
    const api = {
      apply,
      busy: () => canSave && seq.current !== savedSeq.current || damboUi.editing > 0 || typing()
    };
    window.__damboApp = api;
    return () => {
      if (window.__damboApp === api) window.__damboApp = null;
    };
  }, []);
  useEffect(() => {
    let t = null;
    const onNet = on => {
      if (t) {
        clearTimeout(t);
        t = null;
      }
      if (on) setOffline(false);else t = setTimeout(() => setOffline(true), 2500);
    };
    window.__damboNet = onNet;
    if (window.__damboOnline === false) onNet(false);
    return () => {
      if (t) clearTimeout(t);
      if (window.__damboNet === onNet) window.__damboNet = null;
    };
  }, []);
  const {
    mergedStocks,
    extraLoan,
    orphans
  } = useMemo(() => applyExtraBuys(stocks, extraBuys), [stocks, extraBuys]);
  const deposit = Math.max(0, sim.deposit || 0);
  const repay = Math.max(0, Math.min(sim.repay || 0, loan + extraLoan));
  const mergedCash = cash + deposit - repay;
  const mergedLoan = loan + extraLoan - repay;
  const appliedBuys = useMemo(() => extraBuys.filter(b => !orphans.includes(b.id)), [extraBuys, orphans]);
  const mergedNow = useMemo(() => {
    const r = calc(mergedStocks, bonds, mergedCash, mergedLoan, minRatio);
    return {
      ...r,
      cash: mergedCash,
      extraLoan
    };
  }, [mergedStocks, bonds, mergedCash, mergedLoan, minRatio, extraLoan]);
  const simNote = deposit > 0 || repay > 0 ? [deposit > 0 ? '입금' : null, repay > 0 ? '상환' : null].filter(Boolean).join('·') : null;
  const baseResult = useMemo(() => calc(stocks, bonds, cash, loan, minRatio), [stocks, bonds, cash, loan, minRatio]);
  const ratioClass = baseResult.ratio < minRatio ? 'text-red-400' : baseResult.ratio < 170 ? 'text-yellow-400' : 'text-emerald-400';
  const confirmFill = (buy, opt) => {
    const amount = (buy.qty || 0) * (buy.price || 0);
    const k = baseName(buy.name);
    const linked = buy.stockId === 'new' ? null : resolveBuy(stocks, buy);
    const sameBase = stocks.filter(s => baseName(s.name) === k);
    const target = linked && linked.type === buy.type ? linked : sameBase.find(s => s.type === buy.type);
    let next = stocks.map(s => ({
      ...s
    }));
    if (target) {
      next = next.map(s => s.id === target.id ? {
        ...s,
        quantity: (s.quantity || 0) + (buy.qty || 0)
      } : s);
    } else {
      const price = sameBase.length ? sameBase[0].currentPrice || buy.price : buy.price;
      next.push({
        id: Math.max(99, ...stocks.map(s => Number(s.id) || 0)) + 1,
        name: buy.type === 'credit' ? `${k}(신용)` : k,
        quantity: buy.qty,
        avgPrice: 0,
        currentPrice: price,
        type: buy.type
      });
    }
    if (opt.setPrice) {
      next = next.map(s => baseName(s.name) === k ? {
        ...s,
        currentPrice: buy.price
      } : s);
      setPriceAt(null);
    }
    setStocks(next);
    if (buy.type === 'credit') setLoan(loan + amount);else if (opt.deductCash) setCash(cash - amount);
    setExtraBuys(prev => normalizeBuys(next, prev.filter(b => b.id !== buy.id)));
  };
  const applySim = () => {
    const dep = Math.max(0, sim.deposit || 0),
      rep = Math.max(0, Math.min(sim.repay || 0, loan));
    if (!(dep > 0 || rep > 0)) return;
    const lines = [dep > 0 ? `현금예수금 +${fmtW(dep)} (입금)` : null, rep > 0 ? `현금예수금 −${fmtW(rep)} · 신용융자금액 −${fmtW(rep)} (상환)` : null].filter(Boolean).join('\n');
    if (!confirm(`보유 내역에 반영할까요?\n\n${lines}`)) return;
    setCash(cash + dep - rep);
    setLoan(loan - rep);
    setSim({
      deposit: 0,
      repay: 0
    });
  };
  const restore = n => {
    setStocks(n.stocks);
    setBonds(n.bonds);
    setCash(n.cash);
    setLoan(n.loan);
    setExtraBuys(normalizeBuys(n.stocks, n.extraBuys));
    if (n.minRatio != null) setMinRatioIn(n.minRatio);
    setSim(n.sim);
    setPriceAt(null);
    setScenarioChanges({});
  };
  const TABS = [{
    id: 'portfolio',
    label: '포트폴리오'
  }, {
    id: 'buy',
    label: '추가매수'
  }, {
    id: 'scenario',
    label: '가격시나리오'
  }];
  const simBadge = appliedBuys.length + (simNote ? 1 : 0);
  return React.createElement("div", {
    className: "tb-app max-w-2xl mx-auto px-3 py-4 pb-10"
  }, showBackup && React.createElement(BackupModal, {
    data: toCloud(latest.current),
    canRestore: canSave && cloudState !== 'checking',
    onRestore: restore,
    onClose: () => setShowBackup(false)
  }), fillBuy && React.createElement(FillModal, {
    buy: fillBuy,
    onConfirm: confirmFill,
    onClose: () => setFillBuy(null)
  }), React.createElement("div", {
    className: "tb-header bg-slate-800 text-white rounded-2xl px-5 py-4 mb-4 shadow-lg"
  }, React.createElement("div", {
    className: "flex items-center justify-between"
  }, React.createElement("div", null, React.createElement("h1", {
    className: "text-xl font-extrabold tracking-tight"
  }, "\uB2F4\uBCF4\uBE44\uC728 \uACC4\uC0B0\uAE30"), React.createElement("p", {
    className: "text-slate-400 text-xs mt-0.5"
  }, "\uC0BC\uC131\uC99D\uAD8C \uC2E0\uC6A9\uC735\uC790 \xB7 \uCD5C\uC800\uC720\uC9C0 ", minRatio, "%")), React.createElement("div", {
    className: "text-right"
  }, React.createElement("div", {
    className: `text-3xl font-extrabold tabular-nums ${ratioClass}`
  }, fmtP(baseResult.ratio)), React.createElement("div", {
    className: "text-xs text-slate-400 mt-0.5"
  }, "\uC735\uC790 ", fmtW(loan)))), (appliedBuys.length > 0 || simNote) && React.createElement("div", {
    className: "tb-simnote text-xs text-blue-400 mt-1 text-right"
  }, [appliedBuys.length > 0 ? `추가매수 ${appliedBuys.length}건` : null, simNote].filter(Boolean).join(' · '), " \uC2DC\uBBAC\uB808\uC774\uC158 \uC911"), React.createElement(CloudBar, {
    state: cloudState,
    updatedAt: sync.updatedAt,
    source: sync.source,
    role: boot.role,
    email: boot.email,
    offline: offline,
    pending: pending,
    onOpenBackup: () => setShowBackup(true)
  })), React.createElement("div", {
    className: "tb-tabs flex gap-1 mb-4 bg-white rounded-xl p-1 shadow"
  }, TABS.map(t => React.createElement("button", {
    key: t.id,
    onClick: () => setTab(t.id),
    className: `flex-1 py-2 text-xs font-semibold rounded-lg transition-all relative
              ${tab === t.id ? 'bg-slate-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`
  }, t.label, t.id === 'buy' && (simBadge > 0 || orphans.length > 0) && React.createElement("span", {
    className: `absolute -top-1 -right-1 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none ${orphans.length ? 'bg-red-500' : 'bg-blue-500'}`
  }, orphans.length ? '!' : simBadge)))), React.createElement("div", {
    className: "tb-panel tb-panel-portfolio",
    style: {
      display: tab === 'portfolio' ? '' : 'none'
    }
  }, React.createElement(RatioCard, {
    result: baseResult
  }, React.createElement(BreakEvenBox, {
    stocks: stocks,
    bonds: bonds,
    cash: cash,
    loan: loan,
    minRatio: minRatio
  })), React.createElement(Tab1, {
    stocks: stocks,
    setStocks: setStocks,
    bonds: bonds,
    setBonds: setBonds,
    cash: cash,
    setCash: setCash,
    loan: loan,
    setLoan: setLoan,
    minRatio: minRatioIn,
    setMinRatio: setMinRatioIn,
    extraBuys: extraBuys,
    setExtraBuys: setExtraBuys,
    priceAt: priceAt,
    onPriceEdit: () => setPriceAt(null)
  })), React.createElement("div", {
    className: "tb-panel tb-panel-buy",
    style: {
      display: tab === 'buy' ? '' : 'none'
    }
  }, React.createElement(Tab2, {
    stocks: stocks,
    bonds: bonds,
    cash: cash,
    loan: loan,
    extraBuys: extraBuys,
    setExtraBuys: setExtraBuys,
    orphans: orphans,
    sim: sim,
    setSim: setSim,
    minRatio: minRatio,
    merged: mergedNow,
    onFill: setFillBuy,
    onApplySim: applySim
  })), React.createElement("div", {
    className: "tb-panel tb-panel-scn",
    style: {
      display: tab === 'scenario' ? '' : 'none'
    }
  }, React.createElement(Tab3, {
    mergedStocks: mergedStocks,
    bonds: bonds,
    cash: mergedCash,
    mergedLoan: mergedLoan,
    extraBuys: appliedBuys,
    changes: scenarioChanges,
    setChanges: setScenarioChanges,
    minRatio: minRatio,
    simNote: simNote
  })));
}
let damboRoot = null,
  damboBootCount = 0;
window.startDamboApp = function (payload) {
  if (!damboRoot) damboRoot = ReactDOM.createRoot(document.getElementById('root'));
  damboRoot.render(React.createElement(App, {
    key: ++damboBootCount,
    boot: payload
  }));
};
if (window.__damboPending) window.startDamboApp(window.__damboPending);
