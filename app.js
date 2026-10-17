/* 생성 파일 — 고치지 말 것. 원본은 src/app.jsx, 다시 만들기: npm run build */
const {
  useState,
  useMemo,
  useRef,
  useEffect
} = React;
const MIN_RATIO = 140;
const fmt = n => isNaN(n) || n == null ? '0' : Math.round(n).toLocaleString('ko-KR');
const fmtW = n => `${fmt(n)}원`;
const fmtP = n => isFinite(n) ? `${n.toFixed(2)}%` : '∞%';
const INIT_STOCKS = [];
const INIT_BONDS = 0;
const INIT_CASH = 0;
const INIT_LOAN = 0;
function calc(stocks, bonds, cash, loan) {
  const won = stocks.filter(s => s.type === 'credit').reduce((sum, s) => sum + (s.quantity || 0) * (s.currentPrice || 0), 0);
  const stockBu = stocks.filter(s => s.type === 'normal').reduce((sum, s) => sum + (s.quantity || 0) * (s.currentPrice || 0), 0);
  const bu = stockBu + (bonds || 0) + (cash || 0);
  const total = won + bu;
  const ratio = loan > 0 ? total / loan * 100 : Infinity;
  const required = (loan || 0) * (MIN_RATIO / 100);
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
    surplus
  };
}
function applyExtraBuys(baseStocks, extraBuys) {
  let stocks = baseStocks.map(s => ({
    ...s
  }));
  let extraLoan = 0;
  for (const buy of extraBuys) {
    const evalAmt = buy.qty * buy.price;
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
      const sid = parseInt(buy.stockId);
      stocks = stocks.map(s => s.id === sid ? {
        ...s,
        quantity: s.quantity + buy.qty
      } : s);
    }
    if (buy.type === 'credit') extraLoan += evalAmt;
  }
  return {
    mergedStocks: stocks,
    extraLoan
  };
}
function NumInput({
  value,
  onChange,
  className = '',
  placeholder = '0'
}) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value === 0 ? '' : String(value) : fmt(value);
  return React.createElement("input", {
    type: "text",
    inputMode: "numeric",
    className: `min-w-0 border rounded-lg px-2 py-1.5 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`,
    value: display,
    placeholder: placeholder,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    onChange: e => {
      const raw = e.target.value.replace(/,/g, '');
      const n = parseFloat(raw);
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
  const handleBlur = () => {
    setFocused(false);
    const n = parseFloat(localVal.replace(/,/g, ''));
    onChange(isNaN(n) || n < 0 ? 0 : n);
  };
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
  subLabel = null
}) {
  const {
    won,
    bu,
    total,
    ratio,
    shortage,
    surplus
  } = result;
  const danger = ratio < MIN_RATIO;
  const warning = ratio >= MIN_RATIO && ratio < 170;
  const ratioClass = danger ? 'text-red-500' : warning ? 'text-yellow-500' : 'text-emerald-500';
  const barClass = danger ? 'bg-red-500' : warning ? 'bg-yellow-400' : 'bg-emerald-500';
  const MAX_DISPLAY = 350;
  const barPct = Math.min(100, ratio / MAX_DISPLAY * 100);
  const mark140 = 140 / MAX_DISPLAY * 100;
  const mark200 = 200 / MAX_DISPLAY * 100;
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
    className: "tb-ratio-req text-right text-xs text-gray-400 mb-3"
  }, "\uCD5C\uC800\uC720\uC9C0 140% \xB7 \uD544\uC694\uB2F4\uBCF4\uAE08\uC561 ", fmtW(result.required)), React.createElement("div", {
    className: "tb-gauge relative mb-6"
  }, React.createElement("div", {
    className: "h-5 bg-gray-100 rounded-full overflow-visible"
  }, React.createElement("div", {
    className: `h-full rounded-full transition-all duration-500 ${barClass}`,
    style: {
      width: `${barPct}%`
    }
  })), React.createElement("div", {
    className: "absolute top-0 bottom-0 flex flex-col items-center",
    style: {
      left: `${mark140}%`,
      transform: 'translateX(-50%)'
    }
  }, React.createElement("div", {
    className: "absolute -top-5 text-xs font-bold text-red-500 whitespace-nowrap"
  }, "140%"), React.createElement("div", {
    className: "w-0.5 h-5 bg-red-500 mt-0"
  })), React.createElement("div", {
    className: "absolute top-0 bottom-0 flex flex-col items-center",
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
    className: `${bg} rounded-xl p-2.5 text-center`
  }, React.createElement("div", {
    className: "text-xs text-gray-400 mb-1"
  }, l), React.createElement("div", {
    className: `text-xs font-bold ${txt} break-all`
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
  }, "140% \uC5EC\uC720\uAE08\uC561"), React.createElement("div", {
    className: `text-sm font-bold ${danger ? 'text-red-600' : 'text-emerald-600'}`
  }, danger ? `-${fmtW(shortage)}` : fmtW(surplus)))));
}
function Tab1({
  stocks,
  setStocks,
  bonds,
  setBonds,
  cash,
  setCash,
  loan,
  setLoan
}) {
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const newStockId = () => Math.max(99, ...stocks.map(s => Number(s.id) || 0)) + 1;
  const startEdit = s => {
    setEditId(s.id);
    setEditData({
      ...s
    });
  };
  const saveEdit = () => {
    setStocks(prev => prev.map(s => s.id === editId ? {
      ...editData
    } : s));
    setEditId(null);
  };
  const cancelEdit = () => setEditId(null);
  const deleteStock = s => {
    if (!confirm(`${s.name}(${s.type === 'credit' ? '신용' : '일반'}) 종목을 지울까요?`)) return;
    setStocks(prev => prev.filter(x => x.id !== s.id));
  };
  const addStock = () => {
    const ns = {
      id: newStockId(),
      name: '신규종목',
      quantity: 0,
      avgPrice: 0,
      currentPrice: 0,
      type: 'normal'
    };
    setStocks(prev => [...prev, ns]);
    startEdit(ns);
  };
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
    const isEditing = editId === s.id;
    const evalAmt = (s.quantity || 0) * (s.currentPrice || 0);
    if (isEditing) return React.createElement("tr", {
      key: s.id,
      className: "bg-yellow-50 border-b border-yellow-100"
    }, React.createElement("td", {
      className: "px-2 py-1.5"
    }, React.createElement("input", {
      className: "border rounded px-1.5 py-0.5 w-full text-sm",
      value: editData.name,
      onChange: e => setEditData(d => ({
        ...d,
        name: e.target.value
      }))
    })), React.createElement("td", {
      className: "px-2 py-1.5"
    }, React.createElement(NumInput, {
      value: editData.quantity,
      onChange: v => setEditData(d => ({
        ...d,
        quantity: v
      })),
      className: "w-full"
    })), React.createElement("td", {
      className: "px-2 py-1.5"
    }, React.createElement(NumInput, {
      value: editData.currentPrice,
      onChange: v => setEditData(d => ({
        ...d,
        currentPrice: v
      })),
      className: "w-full"
    })), React.createElement("td", {
      className: "px-2 py-1.5 text-right text-gray-400 text-xs"
    }, fmtW((editData.quantity || 0) * (editData.currentPrice || 0))), React.createElement("td", {
      className: "px-2 py-1.5"
    }, React.createElement("select", {
      className: "border rounded px-1 py-0.5 text-sm w-full",
      value: editData.type,
      onChange: e => setEditData(d => ({
        ...d,
        type: e.target.value
      }))
    }, React.createElement("option", {
      value: "normal"
    }, "\uC77C\uBC18"), React.createElement("option", {
      value: "credit"
    }, "\uC2E0\uC6A9"))), React.createElement("td", {
      className: "px-2 py-1.5 text-center space-x-1 whitespace-nowrap"
    }, React.createElement("button", {
      onClick: saveEdit,
      className: "bg-blue-500 hover:bg-blue-600 text-white rounded px-2 py-0.5 text-xs"
    }, "\uC800\uC7A5"), React.createElement("button", {
      onClick: cancelEdit,
      className: "bg-gray-300 hover:bg-gray-400 text-gray-700 rounded px-2 py-0.5 text-xs"
    }, "\uCDE8\uC18C")));
    return React.createElement("tr", {
      key: s.id,
      className: `border-b hover:bg-gray-50 ${i % 2 !== 0 ? 'bg-gray-50/40' : ''}`
    }, React.createElement("td", {
      className: "px-3 py-2 font-medium"
    }, s.name, s.type === 'credit' && React.createElement("span", {
      className: "ml-1.5 bg-orange-100 text-orange-600 text-xs px-1 rounded"
    }, "\uC2E0\uC6A9")), React.createElement("td", {
      className: "px-3 py-2 text-right tabular-nums"
    }, fmt(s.quantity)), React.createElement("td", {
      className: "px-3 py-2 text-right tabular-nums"
    }, fmt(s.currentPrice)), React.createElement("td", {
      className: "px-3 py-2 text-right font-medium tabular-nums"
    }, fmtW(evalAmt)), React.createElement("td", {
      className: "px-3 py-2 text-center"
    }, React.createElement("span", {
      className: `px-2 py-0.5 rounded text-xs font-medium
                      ${s.type === 'credit' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`
    }, s.type === 'credit' ? '신용' : '일반')), React.createElement("td", {
      className: "px-3 py-2 text-center whitespace-nowrap"
    }, React.createElement("button", {
      onClick: () => startEdit(s),
      className: "text-blue-500 hover:text-blue-700 text-xs mr-2"
    }, "\uC218\uC815"), React.createElement("button", {
      onClick: () => deleteStock(s),
      className: "text-red-400 hover:text-red-600 text-xs"
    }, "\uC0AD\uC81C")));
  })))), React.createElement("div", {
    className: "sm:hidden space-y-2 mb-3"
  }, stocks.map(s => {
    const isEditing = editId === s.id;
    const evalAmt = (s.quantity || 0) * (s.currentPrice || 0);
    if (isEditing) return React.createElement("div", {
      key: s.id,
      className: "bg-yellow-50 border border-yellow-200 rounded-xl p-3 shadow-sm"
    }, React.createElement("input", {
      className: "border rounded-lg px-2 py-1.5 w-full text-sm mb-2 bg-white",
      value: editData.name,
      placeholder: "\uC885\uBAA9\uBA85",
      onChange: e => setEditData(d => ({
        ...d,
        name: e.target.value
      }))
    }), React.createElement("div", {
      className: "grid grid-cols-2 gap-2 mb-2"
    }, React.createElement("div", null, React.createElement("label", {
      className: "text-xs text-gray-400 block mb-0.5"
    }, "\uC218\uB7C9"), React.createElement(NumInput, {
      value: editData.quantity,
      onChange: v => setEditData(d => ({
        ...d,
        quantity: v
      })),
      className: "w-full bg-white"
    })), React.createElement("div", null, React.createElement("label", {
      className: "text-xs text-gray-400 block mb-0.5"
    }, "\uD604\uC7AC\uAC00"), React.createElement(NumInput, {
      value: editData.currentPrice,
      onChange: v => setEditData(d => ({
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
    }, fmtW((editData.quantity || 0) * (editData.currentPrice || 0)))), React.createElement("div", {
      className: "flex gap-1.5 mb-2"
    }, ['normal', 'credit'].map(t => React.createElement("button", {
      key: t,
      onClick: () => setEditData(d => ({
        ...d,
        type: t
      })),
      className: `flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all
                      ${editData.type === t ? t === 'normal' ? 'bg-blue-500 text-white border-blue-500' : 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-400 border-gray-200'}`
    }, t === 'normal' ? '일반' : '신용'))), React.createElement("div", {
      className: "flex gap-1.5"
    }, React.createElement("button", {
      onClick: saveEdit,
      className: "flex-1 bg-blue-500 text-white rounded-lg py-1.5 text-xs font-bold"
    }, "\uC800\uC7A5"), React.createElement("button", {
      onClick: cancelEdit,
      className: "flex-1 bg-gray-200 text-gray-600 rounded-lg py-1.5 text-xs font-bold"
    }, "\uCDE8\uC18C")));
    return React.createElement("div", {
      key: s.id,
      className: "bg-white rounded-xl p-3 shadow-sm"
    }, React.createElement("div", {
      className: "flex items-center justify-between mb-1.5"
    }, React.createElement("div", {
      className: "flex items-center gap-1.5 min-w-0"
    }, React.createElement("span", {
      className: "font-semibold text-sm truncate"
    }, s.name), React.createElement("span", {
      className: `shrink-0 text-xs px-1.5 py-0.5 rounded font-medium
                    ${s.type === 'credit' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`
    }, s.type === 'credit' ? '신용' : '일반')), React.createElement("div", {
      className: "shrink-0 whitespace-nowrap"
    }, React.createElement("button", {
      onClick: () => startEdit(s),
      className: "text-blue-500 text-xs mr-2"
    }, "\uC218\uC815"), React.createElement("button", {
      onClick: () => deleteStock(s),
      className: "text-red-400 text-xs"
    }, "\uC0AD\uC81C"))), React.createElement("div", {
      className: "flex items-center justify-between text-xs"
    }, React.createElement("span", {
      className: "text-gray-400 tabular-nums whitespace-nowrap"
    }, fmt(s.quantity), "\uC8FC \xD7 ", fmt(s.currentPrice), "\uC6D0"), React.createElement("span", {
      className: "font-bold text-gray-700 tabular-nums whitespace-nowrap"
    }, fmtW(evalAmt))));
  })), React.createElement("button", {
    onClick: addStock,
    className: "tb-add mb-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium shadow"
  }, "+ \uC885\uBAA9 \uCD94\uAC00"), React.createElement("div", {
    className: "tb-etc bg-white rounded-xl shadow p-4"
  }, React.createElement("h3", {
    className: "font-semibold text-gray-600 text-sm mb-3"
  }, "\uAE30\uD0C0 \uC790\uC0B0 \xB7 \uBD80\uCC44"), React.createElement("div", {
    className: "grid grid-cols-1 gap-3 sm:grid-cols-3"
  }, [{
    label: '채권평가금액',
    val: bonds,
    set: setBonds,
    cls: 'bg-gray-50'
  }, {
    label: '현금예수금',
    val: cash,
    set: setCash,
    cls: 'bg-gray-50'
  }, {
    label: '신용융자금액',
    val: loan,
    set: setLoan,
    cls: 'bg-red-50'
  }].map(({
    label,
    val,
    set,
    cls
  }) => React.createElement("div", {
    key: label
  }, React.createElement("label", {
    className: "text-xs text-gray-400 block mb-1"
  }, label), React.createElement(NumInput, {
    value: val,
    onChange: set,
    className: `w-full ${cls}`
  }))))));
}
function Tab2({
  stocks,
  bonds,
  cash,
  loan,
  extraBuys,
  setExtraBuys
}) {
  const newBuyId = () => Math.max(499, ...extraBuys.map(b => Number(b.id) || 0)) + 1;
  const [selId, setSelId] = useState('new');
  const [newName, setNewName] = useState('');
  const [addQty, setAddQty] = useState(0);
  const [addPrice, setAddPrice] = useState(0);
  const [addType, setAddType] = useState('normal');
  const baseResult = useMemo(() => calc(stocks, bonds, cash, loan), [stocks, bonds, cash, loan]);
  const {
    mergedStocks,
    extraLoan
  } = useMemo(() => applyExtraBuys(stocks, extraBuys), [stocks, extraBuys]);
  const mergedResult = useMemo(() => calc(mergedStocks, bonds, cash, loan + extraLoan), [mergedStocks, bonds, cash, loan, extraLoan]);
  const formValid = addQty > 0 && addPrice > 0 && (selId !== 'new' || newName.trim() !== '');
  const previewResult = useMemo(() => {
    if (!formValid) return null;
    const previewBuy = {
      id: -1,
      stockId: selId,
      name: selId === 'new' ? newName : stocks.find(s => s.id === parseInt(selId))?.name || '?',
      qty: addQty,
      price: addPrice,
      type: addType
    };
    const {
      mergedStocks: ms,
      extraLoan: el
    } = applyExtraBuys(stocks, [...extraBuys, previewBuy]);
    return calc(ms, bonds, cash, loan + el);
  }, [stocks, bonds, cash, loan, extraBuys, selId, newName, addQty, addPrice, addType, formValid]);
  const handleAdd = () => {
    if (!formValid) return;
    const stockName = selId === 'new' ? newName : stocks.find(s => s.id === parseInt(selId))?.name || '?';
    setExtraBuys(prev => [...prev, {
      id: newBuyId(),
      stockId: selId,
      name: stockName,
      qty: addQty,
      price: addPrice,
      type: addType
    }]);
    setAddQty(0);
    setAddPrice(0);
    if (selId === 'new') setNewName('');
  };
  const removeBuy = id => setExtraBuys(prev => prev.filter(b => b.id !== id));
  const clearAll = () => setExtraBuys([]);
  return React.createElement("div", {
    className: "tb-buy"
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
    value: selId,
    onChange: e => setSelId(e.target.value)
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
    className: `flex-1 py-2 rounded-lg text-sm font-semibold border transition-all
                    ${addType === t ? t === 'normal' ? 'bg-blue-500 text-white border-blue-500' : 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`
  }, t === 'normal' ? '일반' : '신용')))), previewResult && React.createElement("div", {
    className: "sm:col-span-2 bg-slate-50 rounded-lg p-3 text-sm space-y-1"
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
  }, "\uC774 \uAC74 \uCD94\uAC00 \uD6C4 \uB2F4\uBCF4\uBE44\uC728"), React.createElement("span", {
    className: `font-bold tabular-nums ${previewResult.ratio >= MIN_RATIO ? 'text-emerald-600' : 'text-red-600'}`
  }, fmtP(previewResult.ratio)))), React.createElement("button", {
    onClick: handleAdd,
    disabled: !formValid,
    className: `sm:col-span-2 py-2.5 rounded-xl text-sm font-bold transition-all
              ${formValid ? 'bg-blue-500 hover:bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`
  }, "+ \uBAA9\uB85D\uC5D0 \uCD94\uAC00"))), extraBuys.length > 0 && React.createElement("div", {
    className: "tb-buylist bg-white rounded-xl shadow p-4 mb-4"
  }, React.createElement("div", {
    className: "flex justify-between items-center mb-3"
  }, React.createElement("h3", {
    className: "font-semibold text-gray-600 text-sm"
  }, "\uCD94\uAC00\uB9E4\uC218 \uBAA9\uB85D", React.createElement("span", {
    className: "ml-2 bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full"
  }, extraBuys.length, "\uAC74")), React.createElement("button", {
    onClick: clearAll,
    className: "text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded px-2 py-1"
  }, "\uC804\uCCB4 \uC0AD\uC81C")), React.createElement("div", {
    className: "tb-buyitems space-y-2"
  }, extraBuys.map((buy, idx) => React.createElement("div", {
    key: buy.id,
    className: "flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm"
  }, React.createElement("div", {
    className: "flex items-center gap-2"
  }, React.createElement("span", {
    className: "text-gray-400 text-xs w-4"
  }, idx + 1), React.createElement("span", {
    className: "font-medium"
  }, buy.name), React.createElement("span", {
    className: `text-xs px-1.5 py-0.5 rounded
                    ${buy.type === 'credit' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`
  }, buy.type === 'credit' ? '신용' : '일반')), React.createElement("div", {
    className: "flex items-center gap-3"
  }, React.createElement("div", {
    className: "text-right"
  }, React.createElement("div", {
    className: "tabular-nums text-xs text-gray-500"
  }, fmt(buy.qty), "\uC8FC \xD7 ", fmt(buy.price), "\uC6D0"), React.createElement("div", {
    className: "tabular-nums text-xs font-bold text-gray-700"
  }, "= ", fmtW(buy.qty * buy.price))), React.createElement("button", {
    onClick: () => removeBuy(buy.id),
    className: "text-red-400 hover:text-red-600 text-xs ml-1"
  }, "\u2715"))))), React.createElement("div", {
    className: "mt-3 pt-3 border-t border-gray-100 text-sm"
  }, React.createElement("div", {
    className: "flex justify-between text-gray-500 mb-1"
  }, React.createElement("span", null, "\uCD1D \uCD94\uAC00\uB9E4\uC218\uAE08\uC561"), React.createElement("span", {
    className: "font-bold tabular-nums text-gray-700"
  }, fmtW(extraBuys.reduce((s, b) => s + b.qty * b.price, 0)))), extraLoan > 0 && React.createElement("div", {
    className: "flex justify-between text-orange-600"
  }, React.createElement("span", null, "\uCD1D \uC735\uC790\uC99D\uAC00"), React.createElement("span", {
    className: "font-bold tabular-nums"
  }, "+", fmtW(extraLoan))))));
}
function Tab3({
  mergedStocks,
  bonds,
  cash,
  mergedLoan,
  extraBuys = [],
  changes,
  setChanges
}) {
  const extraBuyCount = extraBuys.length;
  const baseName = n => String(n || '').replace(/\s*\((신용|일반)\)\s*$/, '').trim();
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
  })), [mergedStocks, changes]);
  const result = useMemo(() => calc(simStocks, bonds, cash, mergedLoan), [simStocks, bonds, cash, mergedLoan]);
  const baseResult = useMemo(() => calc(mergedStocks, bonds, cash, mergedLoan), [mergedStocks, bonds, cash, mergedLoan]);
  const diff = result.ratio - baseResult.ratio;
  const extraCashCost = extraBuys.filter(b => b.type !== 'credit').reduce((sum, b) => sum + (b.qty || 0) * (b.price || 0), 0);
  const simBalance = result.total - mergedLoan - extraCashCost;
  const baseBalance = baseResult.total - mergedLoan - extraCashCost;
  const balDiff = simBalance - baseBalance;
  const balPct = baseBalance > 0 ? balDiff / baseBalance * 100 : 0;
  const subLabel = extraBuyCount > 0 ? `추가매수 ${extraBuyCount}건 반영 중` : null;
  return React.createElement("div", {
    className: "tb-scn"
  }, React.createElement(RatioCard, {
    result: result,
    label: "\uC2DC\uB098\uB9AC\uC624 \uB2F4\uBCF4\uBE44\uC728",
    subLabel: subLabel
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
  }, "\uC8FC\uC2DD + \uCC44\uAD8C + \uD604\uAE08 \u2212 \uC2E0\uC6A9\uB300\uCD9C (\uC99D\uAD8C\uC0AC \uCD1D\uD3C9\uAC00\uAE08\uC561)")), React.createElement("div", {
    className: "tb-scn-list bg-white rounded-xl shadow p-4"
  }, React.createElement("div", {
    className: "flex justify-between items-center mb-4"
  }, React.createElement("div", null, React.createElement("h3", {
    className: "font-semibold text-gray-600 text-sm"
  }, "\uC885\uBAA9\uBCC4 \uAC00\uACA9 \uC2DC\uB098\uB9AC\uC624"), extraBuyCount > 0 && React.createElement("p", {
    className: "text-xs text-blue-500 mt-0.5"
  }, "\uCD94\uAC00\uB9E4\uC218 ", extraBuyCount, "\uAC74\uC774 \uC218\uB7C9\uC5D0 \uBC18\uC601\uB428 \xB7 \uC2DC\uB098\uB9AC\uC624\uAC00 \uAE30\uBCF8\uAC12 = \uCD94\uAC00\uB9E4\uC218 \uCD5C\uC800\uAC00")), React.createElement("button", {
    onClick: resetAll,
    className: "text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 rounded px-2 py-1"
  }, "\uC804\uCCB4 \uCD08\uAE30\uD654")), React.createElement("div", {
    className: "tb-scn-items space-y-4"
  }, mergedStocks.map(s => {
    const chg = getChg(s.id);
    const simPrice = Math.max(0, s.currentPrice * (1 + chg / 100));
    const isExtra = String(s.id).startsWith('extra_');
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
    }, "(", chg > 0 ? '+' : '', fmtW((simPrice - s.currentPrice) * s.quantity), ")"))));
  }))));
}
function SyncModal({
  data,
  onImport,
  onClose
}) {
  const [mode, setMode] = useState('export');
  const [importCode, setImportCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const exportCode = useMemo(() => {
    try {
      return btoa(encodeURIComponent(JSON.stringify(data)));
    } catch {
      return '';
    }
  }, [data]);
  const handleCopy = () => {
    navigator.clipboard.writeText(exportCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const handleImport = () => {
    try {
      const json = JSON.parse(decodeURIComponent(atob(importCode.trim())));
      if (!json.stocks || !Array.isArray(json.stocks)) throw new Error('잘못된 형식');
      onImport(json);
      onClose();
    } catch {
      setError('올바르지 않은 코드입니다. 다시 확인해주세요.');
    }
  };
  return React.createElement("div", {
    className: "fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4",
    onClick: e => e.target === e.currentTarget && onClose()
  }, React.createElement("div", {
    className: "tb-modal bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
  }, React.createElement("div", {
    className: "flex justify-between items-center mb-4"
  }, React.createElement("h2", {
    className: "font-bold text-gray-700 text-base"
  }, "\uB370\uC774\uD130 \uB3D9\uAE30\uD654"), React.createElement("button", {
    onClick: onClose,
    className: "text-gray-400 hover:text-gray-600 text-xl leading-none"
  }, "\u2715")), React.createElement("div", {
    className: "flex gap-1 bg-gray-100 rounded-lg p-1 mb-4"
  }, [['export', '내보내기 (공유)'], ['import', '가져오기']].map(([m, label]) => React.createElement("button", {
    key: m,
    onClick: () => {
      setMode(m);
      setError('');
    },
    className: `flex-1 py-1.5 text-xs font-semibold rounded-md transition-all
                ${mode === m ? 'bg-white shadow text-slate-700' : 'text-gray-400'}`
  }, label))), mode === 'export' ? React.createElement(React.Fragment, null, React.createElement("p", {
    className: "text-xs text-gray-500 mb-3"
  }, "\uC544\uB798 \uCF54\uB4DC\uB97C \uBCF5\uC0AC\uD574\uC11C \uB2E4\uB978 \uAE30\uAE30\uC758 ", React.createElement("strong", null, "\uAC00\uC838\uC624\uAE30"), "\uC5D0 \uBD99\uC5EC\uB123\uC73C\uC138\uC694."), React.createElement("textarea", {
    readOnly: true,
    rows: 4,
    className: "w-full border rounded-xl p-3 text-xs text-gray-600 bg-gray-50 font-mono resize-none focus:outline-none",
    value: exportCode
  }), React.createElement("button", {
    onClick: handleCopy,
    className: `mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-all
                ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-800 text-white'}`
  }, copied ? '✓ 복사됨!' : '코드 복사하기')) : React.createElement(React.Fragment, null, React.createElement("p", {
    className: "text-xs text-gray-500 mb-3"
  }, "\uB2E4\uB978 \uAE30\uAE30\uC5D0\uC11C \uBCF5\uC0AC\uD55C \uCF54\uB4DC\uB97C \uBD99\uC5EC\uB123\uACE0 \uAC00\uC838\uC624\uAE30\uB97C \uB204\uB974\uC138\uC694."), React.createElement("textarea", {
    rows: 4,
    className: "w-full border rounded-xl p-3 text-xs text-gray-600 bg-gray-50 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-300",
    placeholder: "\uCF54\uB4DC\uB97C \uBD99\uC5EC\uB123\uC73C\uC138\uC694...",
    value: importCode,
    onChange: e => {
      setImportCode(e.target.value);
      setError('');
    }
  }), error && React.createElement("p", {
    className: "text-xs text-red-500 mt-1"
  }, error), React.createElement("button", {
    onClick: handleImport,
    disabled: !importCode.trim(),
    className: `mt-3 w-full py-2.5 rounded-xl text-sm font-bold transition-all
                ${importCode.trim() ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`
  }, "\uB370\uC774\uD130 \uAC00\uC838\uC624\uAE30"))));
}
const STORAGE_KEY = 'dambo_v1';
function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}
function CloudBar({
  state,
  updatedAt,
  source,
  role,
  email,
  onOpenSync
}) {
  const when = updatedAt ? new Date(updatedAt).toLocaleString('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }) : null;
  const view = {
    synced: {
      dot: 'bg-emerald-400',
      text: when ? `클라우드 · ${when}` : '클라우드 연결됨'
    },
    saving: {
      dot: 'bg-blue-400 animate-pulse',
      text: '저장 중…'
    },
    empty: {
      dot: 'bg-slate-500',
      text: '클라우드에 저장된 내역 없음 (이 기기 값)'
    },
    error: {
      dot: 'bg-red-400',
      text: '클라우드를 못 읽었습니다 (이 기기 값)'
    },
    checking: {
      dot: 'bg-amber-400 animate-pulse',
      text: when ? `최신 확인 중 · 지난번 ${when} 값 (아직 고치지 마세요)` : '최신 확인 중'
    }
  }[state] || {
    dot: 'bg-slate-500',
    text: ''
  };
  return React.createElement("div", {
    className: "mt-3 flex items-center gap-2 text-xs"
  }, React.createElement("span", {
    className: `w-1.5 h-1.5 rounded-full shrink-0 ${view.dot}`
  }), React.createElement("span", {
    className: "text-slate-400 truncate"
  }, view.text, state === 'synced' && source === 'claude' && ' · PC에서 입력', role === 'viewer' && ' · 열람 전용'), React.createElement("button", {
    onClick: onOpenSync,
    title: email,
    className: "ml-auto shrink-0 text-slate-500 hover:text-slate-300"
  }, "\uCF54\uB4DC \uB3D9\uAE30\uD654"), React.createElement("button", {
    onClick: () => window.damboSignOut(),
    className: "shrink-0 text-slate-500 hover:text-slate-300"
  }, "\uB85C\uADF8\uC544\uC6C3"));
}
function pick(cloud, local, init, key) {
  if (cloud && cloud[key] != null) return cloud[key];
  if (cloud && Array.isArray(init)) return [];
  if (local && local[key] != null) return local[key];
  return init;
}
function App({
  boot
}) {
  const saved = useMemo(() => loadStorage(), []);
  const cloud = boot.portfolio;
  const [stocks, setStocks] = useState(() => pick(cloud, saved, INIT_STOCKS, 'stocks'));
  const [bonds, setBonds] = useState(() => pick(cloud, saved, INIT_BONDS, 'bonds'));
  const [cash, setCash] = useState(() => pick(cloud, saved, INIT_CASH, 'cash'));
  const [loan, setLoan] = useState(() => pick(cloud, saved, INIT_LOAN, 'loan'));
  const [extraBuys, setExtraBuys] = useState(() => cloud && cloud.extraBuysSynced ? cloud.extraBuys ?? [] : saved?.extraBuys ?? []);
  const [scenarioChanges, setScenarioChanges] = useState({});
  const [tab, setTab] = useState('portfolio');
  const [showSync, setShowSync] = useState(false);
  const [cloudState, setCloudState] = useState(boot.cached ? 'checking' : boot.portfolio ? 'synced' : boot.error ? 'error' : 'empty');
  useEffect(() => {
    saveStorage({
      stocks,
      bonds,
      cash,
      loan,
      extraBuys
    });
  }, [stocks, bonds, cash, loan, extraBuys]);
  const onStale = r => {
    if (r !== 'stale') return;
    alert('PC나 다른 기기에서 값이 바뀌어 있었습니다.\n덮어쓰지 않고 최신 값을 불러옵니다. 방금 고친 내용은 다시 입력해 주세요.');
    location.reload();
  };
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      if (boot.role === 'admin' && cloud && !cloud.extraBuysSynced && extraBuys.length > 0) {
        window.damboSave({
          stocks,
          bonds,
          cash,
          loan,
          extraBuys,
          extraBuysSynced: true
        }).then(onStale);
      }
      return;
    }
    if (boot.role !== 'admin') return;
    setCloudState('saving');
    const t = setTimeout(() => {
      window.damboSave({
        stocks,
        bonds,
        cash,
        loan,
        extraBuys,
        extraBuysSynced: true
      }).then(r => {
        onStale(r);
        setCloudState(r === 'ok' ? 'synced' : 'error');
      });
    }, 800);
    return () => clearTimeout(t);
  }, [stocks, bonds, cash, loan, extraBuys]);
  const handleSyncImport = json => {
    if (json.stocks) setStocks(json.stocks);
    if (json.bonds != null) setBonds(json.bonds);
    if (json.cash != null) setCash(json.cash);
    if (json.loan != null) setLoan(json.loan);
    if (json.extraBuys) setExtraBuys(json.extraBuys);
  };
  const {
    mergedStocks,
    extraLoan
  } = useMemo(() => applyExtraBuys(stocks, extraBuys), [stocks, extraBuys]);
  const mergedLoan = loan + extraLoan;
  const baseResult = useMemo(() => calc(stocks, bonds, cash, loan), [stocks, bonds, cash, loan]);
  const ratioClass = baseResult.ratio < MIN_RATIO ? 'text-red-400' : baseResult.ratio < 170 ? 'text-yellow-400' : 'text-emerald-400';
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
  return React.createElement("div", {
    className: "tb-app max-w-2xl mx-auto px-3 py-4 pb-10"
  }, showSync && React.createElement(SyncModal, {
    data: {
      stocks,
      bonds,
      cash,
      loan,
      extraBuys
    },
    onImport: handleSyncImport,
    onClose: () => setShowSync(false)
  }), React.createElement("div", {
    className: "tb-header bg-slate-800 text-white rounded-2xl px-5 py-4 mb-4 shadow-lg"
  }, React.createElement("div", {
    className: "flex items-center justify-between"
  }, React.createElement("div", null, React.createElement("h1", {
    className: "text-xl font-extrabold tracking-tight"
  }, "\uB2F4\uBCF4\uBE44\uC728 \uACC4\uC0B0\uAE30"), React.createElement("p", {
    className: "text-slate-400 text-xs mt-0.5"
  }, "\uC0BC\uC131\uC99D\uAD8C \uC2E0\uC6A9\uC735\uC790 \xB7 \uCD5C\uC800\uC720\uC9C0 140%")), React.createElement("div", {
    className: "text-right"
  }, React.createElement("div", {
    className: `text-3xl font-extrabold tabular-nums ${ratioClass}`
  }, fmtP(baseResult.ratio)), React.createElement("div", {
    className: "text-xs text-slate-400 mt-0.5"
  }, "\uC735\uC790 ", fmtW(loan)), extraBuys.length > 0 && React.createElement("div", {
    className: "text-xs text-blue-400 mt-0.5"
  }, "\uCD94\uAC00\uB9E4\uC218 ", extraBuys.length, "\uAC74 \uC2DC\uBBAC\uB808\uC774\uC158 \uC911"))), React.createElement(CloudBar, {
    state: cloudState,
    updatedAt: boot.updatedAt,
    source: boot.source,
    role: boot.role,
    email: boot.email,
    onOpenSync: () => setShowSync(true)
  })), React.createElement("div", {
    className: "tb-tabs flex gap-1 mb-4 bg-white rounded-xl p-1 shadow"
  }, TABS.map(t => React.createElement("button", {
    key: t.id,
    onClick: () => setTab(t.id),
    className: `flex-1 py-2 text-xs font-semibold rounded-lg transition-all relative
              ${tab === t.id ? 'bg-slate-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`
  }, t.label, t.id === 'buy' && extraBuys.length > 0 && React.createElement("span", {
    className: "absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none"
  }, extraBuys.length)))), React.createElement("div", {
    className: "tb-panel tb-panel-portfolio",
    style: {
      display: tab === 'portfolio' ? '' : 'none'
    }
  }, React.createElement(RatioCard, {
    result: baseResult
  }), React.createElement(Tab1, {
    stocks: stocks,
    setStocks: setStocks,
    bonds: bonds,
    setBonds: setBonds,
    cash: cash,
    setCash: setCash,
    loan: loan,
    setLoan: setLoan
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
    setExtraBuys: setExtraBuys
  })), React.createElement("div", {
    className: "tb-panel tb-panel-scn",
    style: {
      display: tab === 'scenario' ? '' : 'none'
    }
  }, React.createElement(Tab3, {
    mergedStocks: mergedStocks,
    bonds: bonds,
    cash: cash,
    mergedLoan: mergedLoan,
    extraBuys: extraBuys,
    changes: scenarioChanges,
    setChanges: setScenarioChanges
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
