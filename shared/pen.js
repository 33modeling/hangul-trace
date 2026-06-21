/*
 * 펜 설정 — 색상·굵기. 설정 화면에서 바꾸고 모든 따라쓰기에 적용된다.
 *
 * core.js 의 DrawingCanvas.drawLine/drawDot 는 '사용자 잉크' 전용이라(가이드
 * 글자·획순 애니는 별도 경로) 이 두 곳만 TracePen 색·굵기를 읽게 하면 전 모드에
 * 일괄 적용된다. localStorage 에 저장.
 *
 * 의존: Utils(utils.js) — index.html 에서 utils.js 뒤에 로드.
 */
const TracePen = (function () {
  const KEY = 'tracing.pen.v1';
  const COLORS = [
    { id: 'rose',   color: '#be3974', label: '분홍' },
    { id: 'red',    color: '#e23d3d', label: '빨강' },
    { id: 'orange', color: '#ef8a23', label: '주황' },
    { id: 'green',  color: '#2fa85a', label: '초록' },
    { id: 'blue',   color: '#2f7fd1', label: '파랑' },
    { id: 'purple', color: '#7c3aed', label: '보라' },
    { id: 'black',  color: '#2d2d2d', label: '검정' }
  ];
  const WIDTHS = [
    { id: 'thin',   scale: 0.7, label: '가늘게' },
    { id: 'normal', scale: 1.0, label: '보통' },
    { id: 'thick',  scale: 1.45, label: '굵게' }
  ];

  let state = { color: '#be3974', width: 'normal' };
  let booted = false;

  function load() {
    const d = (typeof Utils !== 'undefined') ? Utils.loadLocal(KEY, null) : null;
    if (d && typeof d === 'object') {
      if (typeof d.color === 'string' && COLORS.some((c) => c.color === d.color)) state.color = d.color;
      if (typeof d.width === 'string' && WIDTHS.some((w) => w.id === d.width)) state.width = d.width;
    }
    booted = true;
  }
  function save() {
    if (typeof Utils !== 'undefined') Utils.saveLocal(KEY, state);
  }
  function ensure() { if (!booted) load(); }

  function color() { ensure(); return state.color; }
  function setColor(c) { ensure(); if (COLORS.some((x) => x.color === c)) { state.color = c; save(); } }
  function widthId() { ensure(); return state.width; }
  function widthScale() {
    ensure();
    const w = WIDTHS.find((x) => x.id === state.width);
    return w ? w.scale : 1;
  }
  function setWidth(id) { ensure(); if (WIDTHS.some((x) => x.id === id)) { state.width = id; save(); } }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', load);
    } else {
      load();
    }
  }

  return { color, setColor, widthId, widthScale, setWidth, COLORS, WIDTHS };
})();
