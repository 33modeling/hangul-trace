// 공통 캔버스 로직

/**
 * 한글/영문 웹폰트가 늦게 로드되는 환경에서 가이드 글자가 폴백 폰트로
 * 한 번 그려진 뒤 다시 그려지지 않는 문제를 막기 위한 헬퍼.
 * fonts.ready 미지원 환경에서는 no-op.
 * @param {() => void} callback fonts 준비 후 실행할 작업
 */
function traceWaitForFonts(callback) {
  if (typeof callback !== 'function') return;
  if (typeof document === 'undefined') return;
  if (!document.fonts || !document.fonts.ready) return;
  document.fonts.ready
    .then(() => {
      try {
        callback();
      } catch (_e) {
        /* 모드 정리 중에 호출되어도 조용히 무시 */
      }
    })
    .catch(() => {
      /* fonts.ready 자체가 reject되는 일부 브라우저 대비 */
    });
}

/**
 * 한 획의 누적 이동거리를 추적해 "진짜 획"인지 판단하는 헬퍼.
 *
 * 점 톡 찍기 / 손이 살짝 떨려서 down→up이 그냥 일어난 케이스를 제외하고,
 * 사용자가 의도적으로 그은 획만 카운트하기 위함이다. 이전에는 매 pointerdown
 * 마다 strokeCount++ 했기 때문에 빠르게 톡톡 두드리는 것만으로 완성 효과음이
 * 잘못 발사되는 문제가 있었다.
 *
 * @param {HTMLCanvasElement} canvas 기준 캔버스 (짧은 변 기준 minDist 계산)
 * @param {{ minDistRatio?: number, minDistPx?: number }} [opts]
 * @returns {{begin:Function, move:Function, end:Function}}
 */
function makeStrokeTracker(canvas, opts) {
  const ratio = (opts && typeof opts.minDistRatio === 'number') ? opts.minDistRatio : 0.08;
  const minPx = (opts && typeof opts.minDistPx === 'number') ? opts.minDistPx : 18;
  let active = false;
  let lastX = 0;
  let lastY = 0;
  let dist = 0;

  return {
    begin(pos) {
      active = true;
      lastX = pos.x;
      lastY = pos.y;
      dist = 0;
    },
    move(pos) {
      if (!active) return;
      const dx = pos.x - lastX;
      const dy = pos.y - lastY;
      dist += Math.sqrt(dx * dx + dy * dy);
      lastX = pos.x;
      lastY = pos.y;
    },
    /** Returns true if the just-ended motion looks like a real stroke. */
    end() {
      const wasActive = active;
      const total = dist;
      active = false;
      dist = 0;
      if (!wasActive) return false;
      if (!canvas || !canvas.width || !canvas.height) return total >= minPx;
      const minDist = Math.max(minPx, Math.min(canvas.width, canvas.height) * ratio);
      return total >= minDist;
    },
    /** mid-stroke 강제 종료 — navigation 등으로 stroke를 폐기할 때 호출. */
    cancel() {
      active = false;
      dist = 0;
      lastX = 0;
      lastY = 0;
    }
  };
}

/** Pointer / Touch / Mouse 에서 client 좌표 추출 */
function traceReadClientXY(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
    return { x: e.clientX, y: e.clientY };
  }
  return { x: 0, y: 0 };
}

class DrawingCanvas {
  constructor(canvasId, wrapperId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.wrapper = document.getElementById(wrapperId);
    this.isLandscape = false;
    this.fontSize = 0;
    this.lineWidth = 0;
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.startPoint = { x: 0, y: 0 };
  }

  resize() {
    if (!this.canvas || !this.wrapper) return;
    const r = this.wrapper.getBoundingClientRect();
    let w = Math.max(1, Math.floor(r.width)) || Math.max(1, this.wrapper.clientWidth);
    let h = Math.max(1, Math.floor(r.height)) || Math.max(1, this.wrapper.clientHeight);
    if (h <= 1 && w > 1) h = w;
    if (w <= 1 && h > 1) w = h;
    if (w <= 1 && h <= 1) {
      w = Math.max(1, this.wrapper.clientWidth) || 1;
      h = Math.max(1, this.wrapper.clientHeight) || w;
    }
    // flex 레이아웃 직후 래퍼가 0에 가깝게 잡히면 가이드·필기가 안 보임 — 뷰포트 기준 최소 크기
    if (w <= 4 || h <= 4) {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 320;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 480;
      const fs = Math.max(160, Math.floor(Math.min(vw, vh) * 0.52));
      w = fs;
      h = fs;
    }
    this.isLandscape = window.innerWidth > window.innerHeight;

    this.canvas.width = w;
    this.canvas.height = h;
    // CSS 크기도 버퍼와 동일한 px로 설정 — 100%로 하면 버퍼/표시 크기 불일치로 렌더링 깨짐
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    const base = Math.min(w, h);
    this.fontSize = base * 0.72;
    this.lineWidth = Math.max(8, base * 0.03);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawGuide(char, color = 'rgba(167, 139, 250, 0.55)') {
    const { width: w, height: h } = this.canvas;
    if (w < 2 || h < 2 || !this.ctx) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    try {
      ctx.filter = 'none';
    } catch (_e) {
      /* 구형 브라우저 */
    }
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, w, h);

    // 그리드라인
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // 프레임
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.14)';
    ctx.strokeRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);

    // 글자
    ctx.font = `${this.fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const y = h / 2 + Math.min(w, h) * 0.035;
    ctx.fillStyle = color;
    ctx.fillText(char, w / 2, y);
    ctx.restore();
  }

  /**
   * 가로 모드용: 최대 4음절을 한 행에 나란히 표시
   * @param {string[]} chars 음절 문자열 배열 (길이 1~4)
   * @param {string} [color]
   */
  drawGuideRow(chars, color = 'rgba(167, 139, 250, 0.55)') {
    const { width: w, height: h } = this.canvas;
    if (w < 2 || h < 2 || !this.ctx) return;

    const list = (chars || []).filter(Boolean).slice(0, 4);
    const n = list.length;
    if (n === 0) {
      this.clear();
      return;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    try {
      ctx.filter = 'none';
    } catch (_e) {
      /* 구형 브라우저 */
    }
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, w, h);

    const cellW = w / n;
    const base = Math.min(cellW, h);
    const fs = base * 0.62;

    ctx.strokeStyle = 'rgba(124, 58, 237, 0.10)';
    ctx.lineWidth = 1;
    for (let i = 1; i < n; i++) {
      const x = cellW * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(124, 58, 237, 0.14)';
    for (let i = 0; i < n; i++) {
      const padX = cellW * 0.08;
      const padY = h * 0.1;
      ctx.strokeRect(cellW * i + padX, padY, cellW - padX * 2, h - padY * 2);
    }

    ctx.font = `${fs}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = h / 2 + Math.min(cellW, h) * 0.03;
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      ctx.fillText(list[i], cellW * (i + 0.5), y);
    }
    ctx.restore();
  }

  drawLine(x1, y1, x2, y2, color = '#be3974', width = null) {
    if (!this.ctx) return;
    const lineW = width || this.lineWidth;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    try {
      ctx.filter = 'none';
    } catch (_e) {
      /* 구형 브라우저 */
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 10;
    ctx.stroke();
    ctx.restore();
  }

  drawDot(x, y, color = '#be3974', size = 6) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    try {
      ctx.filter = 'none';
    } catch (_e) {
      /* 구형 브라우저 */
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const { x: cx, y: cy } = traceReadClientXY(e);
    const sx = rect.width > 0 ? this.canvas.width / rect.width : 1;
    const sy = rect.height > 0 ? this.canvas.height / rect.height : 1;
    return {
      x: (cx - rect.left) * sx,
      y: (cy - rect.top) * sy
    };
  }
}

const CANVAS_OPTS = { capture: true, passive: false };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ onDown: (e: Event) => void, onMove: (e: Event) => void, onUp: (e: Event) => void }} h
 */
function attachCanvasPointerDrawing(canvas, h) {
  if (!canvas) return;
  if (typeof canvas.__traceDrawUnbind === 'function') {
    canvas.__traceDrawUnbind();
    canvas.__traceDrawUnbind = null;
  }

  let activePointerId = null;
  let touchTrackId = null;

  const cleanupPointerWin = () => {
    window.removeEventListener('pointermove', onPointerWinMove, CANVAS_OPTS);
    window.removeEventListener('pointerup', onPointerWinUp, CANVAS_OPTS);
    window.removeEventListener('pointercancel', onPointerWinUp, CANVAS_OPTS);
  };

  const onPointerWinMove = (e) => {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    e.preventDefault();
    h.onMove(e);
  };

  const onPointerWinUp = (e) => {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    /* pointerup에서 preventDefault 하면 손을 메뉴 버튼에서 뗄 때 click이 사라질 수 있음 */
    h.onUp(e);
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_err) {
      /* 일부 WebView에서 미지원 */
    }
    activePointerId = null;
    cleanupPointerWin();
  };

  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    activePointerId = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (_err) {
      /* 캡처 실패 시에도 window에서 move/up 추적 */
    }
    if (typeof TraceSound !== 'undefined') TraceSound.stroke();
    h.onDown(e);
    window.addEventListener('pointermove', onPointerWinMove, CANVAS_OPTS);
    window.addEventListener('pointerup', onPointerWinUp, CANVAS_OPTS);
    window.addEventListener('pointercancel', onPointerWinUp, CANVAS_OPTS);
  };

  function touchFromList(list, id) {
    if (!list || id == null) return null;
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === id) return list[i];
    }
    return null;
  }

  const cleanupTouchWin = () => {
    window.removeEventListener('touchmove', onTouchWinMove, CANVAS_OPTS);
    window.removeEventListener('touchend', onTouchWinEnd, CANVAS_OPTS);
    window.removeEventListener('touchcancel', onTouchWinEnd, CANVAS_OPTS);
  };

  const onTouchWinMove = (e) => {
    if (touchTrackId === null) return;
    if (!touchFromList(e.touches, touchTrackId)) return;
    e.preventDefault();
    h.onMove(e);
  };

  const onTouchWinEnd = (e) => {
    if (touchTrackId === null) return;
    const tch = touchFromList(e.changedTouches, touchTrackId);
    if (!tch) return;
    /* touchend에서도 동일 — 메뉴로 복귀 click 유지 */
    h.onUp(e);
    touchTrackId = null;
    cleanupTouchWin();
  };

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    if (!canvas.contains(e.target)) return;
    e.preventDefault();
    touchTrackId = e.touches[0].identifier;
    h.onDown(e);
    window.addEventListener('touchmove', onTouchWinMove, CANVAS_OPTS);
    window.addEventListener('touchend', onTouchWinEnd, CANVAS_OPTS);
    window.addEventListener('touchcancel', onTouchWinEnd, CANVAS_OPTS);
  };

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', onPointerDown, CANVAS_OPTS);
  } else {
    canvas.addEventListener('touchstart', onTouchStart, CANVAS_OPTS);
  }

  canvas.__traceDrawUnbind = () => {
    cleanupPointerWin();
    cleanupTouchWin();
    activePointerId = null;
    touchTrackId = null;
    if (window.PointerEvent) {
      canvas.removeEventListener('pointerdown', onPointerDown, CANVAS_OPTS);
    } else {
      canvas.removeEventListener('touchstart', onTouchStart, CANVAS_OPTS);
    }
  };
}

/**
 * 획순 오버레이 표시 — 캔버스 위에 획별 번호와 방향을 그림
 * @param {DrawingCanvas} guideLayer 가이드 캔버스
 * @param {string} ch 글자
 * @param {number} highlightStep 강조할 획 번호 (0=전체, 1~N=해당 획만 진하게)
 */
function showStrokeOrder(guideLayer, ch, highlightStep = 0) {
  const data = STROKE_ORDER[ch];
  if (!data || !guideLayer || !guideLayer.ctx) return;

  const { width: w, height: h } = guideLayer.canvas;
  if (w < 2 || h < 2) return;

  const ctx = guideLayer.ctx;
  const n = data.steps.length;
  const base = Math.min(w, h);

  // 가이드 글자 먼저 그리기
  guideLayer.clear();
  guideLayer.drawGuide(ch);

  ctx.save();

  // 획순 번호를 글자 주변에 배치
  const fontSize = Math.max(12, base * 0.09);
  ctx.font = `bold ${fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 획별 라벨을 글자 위/아래/옆에 배치
  const positions = _getStrokePositions(n, w, h, fontSize);

  for (let i = 0; i < n; i++) {
    const step = data.steps[i];
    const pos = positions[i];
    const isHighlight = highlightStep === 0 || highlightStep === i + 1;

    // 배경 원
    const radius = fontSize * 0.7;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isHighlight ? 'rgba(167, 139, 250, 0.92)' : 'rgba(167, 139, 250, 0.45)';
    ctx.fill();

    // 번호
    ctx.fillStyle = isHighlight ? '#fff' : 'rgba(255,255,255,0.7)';
    ctx.fillText(String(i + 1), pos.x, pos.y);

    // 획 심볼 라벨 (번호 아래)
    const labelY = pos.y + radius + fontSize * 0.6;
    ctx.font = `bold ${Math.max(10, fontSize * 0.75)}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    ctx.fillStyle = isHighlight ? '#7c3aed' : 'rgba(124, 58, 237, 0.5)';
    ctx.fillText(step.s, pos.x, labelY);

    // 한국어 라벨 (심볼 아래)
    const subY = labelY + fontSize * 0.8;
    ctx.font = `${Math.max(9, fontSize * 0.6)}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
    ctx.fillStyle = isHighlight ? '#7c3aed' : 'rgba(124, 58, 237, 0.45)';
    ctx.fillText(step.l, pos.x, subY);

    // 폰트 복구
    ctx.font = `bold ${fontSize}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  }

  ctx.restore();
}

/**
 * 획순 번호 위치 계산 — 글자 주변에 균등 배치
 */
function _getStrokePositions(n, w, h, fontSize) {
  const positions = [];
  const cx = w / 2;
  const cy = h / 2;
  const margin = fontSize * 1.2;

  if (n <= 1) {
    positions.push({ x: cx, y: margin });
  } else if (n <= 3) {
    // 위쪽에 가로 배치
    const totalW = (n - 1) * fontSize * 2.5;
    const startX = cx - totalW / 2;
    for (let i = 0; i < n; i++) {
      positions.push({ x: startX + i * fontSize * 2.5, y: margin });
    }
  } else if (n <= 5) {
    // 위쪽 + 오른쪽
    const topCount = Math.min(3, n);
    const rightCount = n - topCount;
    const totalW = (topCount - 1) * fontSize * 2.5;
    const startX = cx - totalW / 2;
    for (let i = 0; i < topCount; i++) {
      positions.push({ x: startX + i * fontSize * 2.5, y: margin });
    }
    for (let i = 0; i < rightCount; i++) {
      positions.push({ x: w - margin, y: margin + (i + 1) * fontSize * 2.8 });
    }
  } else {
    // 위쪽 + 오른쪽 + 아래쪽
    const topCount = 3;
    const rightCount = Math.min(3, n - topCount);
    const bottomCount = n - topCount - rightCount;
    const totalW = (topCount - 1) * fontSize * 2.5;
    const startX = cx - totalW / 2;
    for (let i = 0; i < topCount; i++) {
      positions.push({ x: startX + i * fontSize * 2.5, y: margin });
    }
    for (let i = 0; i < rightCount; i++) {
      positions.push({ x: w - margin, y: margin + (i + 1) * fontSize * 2.8 });
    }
    const btotalW = (bottomCount - 1) * fontSize * 2.5;
    const bstartX = cx - btotalW / 2;
    for (let i = 0; i < bottomCount; i++) {
      positions.push({ x: bstartX + i * fontSize * 2.5, y: h - margin });
    }
  }
  return positions;
}

/**
 * 획순 단계별 애니메이션 — 각 획을 순서대로 하나씩 강조
 * @param {DrawingCanvas} guideLayer
 * @param {string} ch
 * @param {function} onComplete 완료 콜백
 */
function animateStrokeOrder(guideLayer, ch, onComplete) {
  const data = STROKE_ORDER[ch];
  if (!data) {
    if (onComplete) onComplete();
    return;
  }

  let step = 0;
  const total = data.steps.length;

  function nextStep() {
    step++;
    if (step > total) {
      // 애니메이션 완료 — 원래 가이드로 복구
      guideLayer.clear();
      guideLayer.drawGuide(ch);
      if (onComplete) onComplete();
      return;
    }
    showStrokeOrder(guideLayer, ch, step);
    setTimeout(nextStep, 800);
  }

  nextStep();
}

/**
 * 획순 심볼 → SVG 화살표 매핑.
 * 모든 stroke 종류를 일관된 화살표 아이콘으로 시각화.
 * viewBox 0 0 24 24, currentColor stroke 2.5.
 * @param {string} s STROKE_ORDER 데이터의 s 필드
 * @returns {string} SVG markup
 */
function _strokeIconSvg(s) {
  const open = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const close = '</svg>';
  let body;
  switch (s) {
    case '─':  // 가로 (왼→오)
      body = '<path d="M3 12 L19 12"/><path d="M15 7 L20 12 L15 17"/>';
      break;
    case '│':  // 세로 (위→아래)
      body = '<path d="M12 3 L12 19"/><path d="M7 15 L12 20 L17 15"/>';
      break;
    case '╲':  // 왼 대각선 ↘
      body = '<path d="M5 5 L17 17"/><path d="M17 12 L18 18 L12 17"/>';
      break;
    case '╱':  // 오른 대각선 ↙
      body = '<path d="M19 5 L7 17"/><path d="M7 12 L6 18 L12 17"/>';
      break;
    case '○':  // 원 (시계방향)
      body = '<path d="M19.5 9.5 A8 8 0 1 1 13 4.2"/><path d="M16 3.6 L13 4.2 L14 7.4"/>';
      break;
    case '⌒':  // 위로 볼록한 곡선 (왼→오)
      body = '<path d="M4 18 Q12 3 20 18"/><path d="M16 13.5 L20 18 L19.5 13"/>';
      break;
    case '⌢':  // 아래로 볼록한 곡선 (왼→오)
      body = '<path d="M4 6 Q12 21 20 6"/><path d="M16 10.5 L20 6 L19.5 11"/>';
      break;
    case '⌒⌒':  // 위로 볼록한 곡선 두 개가 세로로 쌓임 (위 ⌒ + 아래 ⌒)
      body = '<path d="M3 9 Q12 2 21 9"/><path d="M3 21 Q12 14 21 21"/>';
      break;
    case '∞':  // 8자 — 위 원 + 아래 원
      body = '<path d="M12 5 A4 4 0 1 1 12 13 A4 4 0 1 0 12 21 A4 4 0 1 0 12 13 A4 4 0 1 1 12 5"/>';
      break;
    case '⌇':  // S 곡선
      body = '<path d="M19 5 Q19 11 12 12 Q5 13 5 19"/><path d="M8 16.5 L5 19.5 L8 21"/>';
      break;
    case '·':  // 점
      body = '<circle cx="12" cy="12" r="2.8" fill="currentColor"/>';
      break;
    case '╲╱':  // V 쌍 (위에서 가운데로 모이는 두 대각선)
      body = '<path d="M5 5 L12 18 L19 5"/><path d="M9 14.5 L12 18 L9 17.5"/><path d="M15 14.5 L12 18 L15 17.5"/>';
      break;
    default:  // 기존 텍스트 폴백
      body = `<text x="12" y="16" font-size="13" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">${s.replace(/[<>&]/g, '')}</text>`;
  }
  return open + body + close;
}

/**
 * 획순 strip 렌더링 — 캔버스 아래 가로 스크롤 카드.
 * 가로 레이아웃: [번호 배지][화살표 SVG][한국어 라벨]
 * 데이터 출처는 STROKE_ORDER 동일.
 *
 * @param {HTMLElement} container .stroke-strip 컨테이너
 * @param {string} ch 글자
 * @param {number} activeStep 1-based 강조 인덱스 (0 = 강조 없음)
 */
function renderStrokeOrderStrip(container, ch, activeStep) {
  if (!container) return;
  const data = STROKE_ORDER[ch];
  if (!data || !data.steps || data.steps.length === 0) {
    container.innerHTML = '';
    return;
  }
  const steps = data.steps;
  const active = (typeof activeStep === 'number' && activeStep > 0) ? activeStep : 0;

  // 같은 글자 재렌더면 active 클래스만 갱신 (DOM 재생성 비용 절약 + 깜빡임 방지)
  const existing = container.querySelectorAll('.stroke-step');
  if (existing.length === steps.length && container.dataset.ch === ch) {
    existing.forEach((card, i) => {
      const isActive = (i + 1) === active;
      card.classList.toggle('active', isActive);
    });
    return;
  }

  container.dataset.ch = ch;
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  steps.forEach((step, i) => {
    const n = i + 1;
    const isActive = n === active;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'stroke-step' + (isActive ? ' active' : '');
    card.dataset.step = String(n);
    card.setAttribute('aria-label', `획 ${n}: ${step.l}`);

    const num = document.createElement('span');
    num.className = 'step-num';
    num.textContent = String(n);
    card.appendChild(num);

    const sym = document.createElement('span');
    sym.className = 'step-symbol';
    sym.innerHTML = _strokeIconSvg(step.s);
    card.appendChild(sym);

    const lbl = document.createElement('span');
    lbl.className = 'step-label';
    lbl.textContent = step.l;
    card.appendChild(lbl);

    card.addEventListener('click', () => {
      const all = container.querySelectorAll('.stroke-step');
      all.forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
    }, { passive: true });

    frag.appendChild(card);
  });
  container.appendChild(frag);
}

/**
 * 획순 strip 플레이 — 카드를 1번부터 순차적으로 강조.
 * 캔버스에는 글자만 깔끔하게 보여주고 (오버레이 X), 정보는 strip이 담당.
 * 동일 컨테이너에 이전 플레이 진행 중이면 취소하고 새로 시작.
 *
 * @param {HTMLElement} container .stroke-strip 엘리먼트
 * @param {DrawingCanvas} guideLayer 가이드 캔버스 (글자 그리기용)
 * @param {string} ch 글자
 * @param {function} onComplete 완료 콜백
 */
function playStrokeOrderStrip(container, guideLayer, ch, onComplete) {
  const data = STROKE_ORDER[ch];

  // 이전 플레이 진행 중이면 취소
  if (container && container.__strokePlayTimer) {
    clearTimeout(container.__strokePlayTimer);
    container.__strokePlayTimer = null;
  }

  if (!data || !data.steps || data.steps.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  // 캔버스는 항상 깔끔하게 글자만
  if (guideLayer && guideLayer.clear && guideLayer.drawGuide) {
    guideLayer.clear();
    guideLayer.drawGuide(ch);
  }

  // 모든 카드 초기 상태로 렌더 (active=0)
  renderStrokeOrderStrip(container, ch, 0);

  let step = 1;
  const total = data.steps.length;

  const tick = () => {
    if (step > total) {
      // 마지막 카드까지 보여준 뒤 잠깐 유지하고 active 해제
      container.__strokePlayTimer = setTimeout(() => {
        renderStrokeOrderStrip(container, ch, 0);
        container.__strokePlayTimer = null;
        if (onComplete) onComplete();
      }, 800);
      return;
    }
    renderStrokeOrderStrip(container, ch, step);

    // 활성 카드를 가시 영역으로 스크롤
    const active = container.querySelector('.stroke-step.active');
    if (active && typeof active.scrollIntoView === 'function') {
      try {
        active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } catch (_) { /* older browsers */ }
    }

    step++;
    container.__strokePlayTimer = setTimeout(tick, 800);
  };

  tick();
}

/**
 * 컨테이너의 진행 중인 strip 플레이를 강제 취소 (모드 이탈/리셋용).
 */
function cancelStrokeOrderStrip(container) {
  if (!container) return;
  if (container.__strokePlayTimer) {
    clearTimeout(container.__strokePlayTimer);
    container.__strokePlayTimer = null;
  }
}


// setupDrawingEvents 제거됨 — 모든 모드는 attachCanvasPointerDrawing 사용
// (중복 이벤트 리스너로 인해 모바일에서 터치가 두 번 처리되는 버그 수정)

// 공통 피드백 업데이트
function updateFeedback(strokeCount, targetStrokes, feedbackId = 'feedback') {
  const feedbackEl = document.getElementById(feedbackId);
  if (!feedbackEl) return;
  
  if (strokeCount < targetStrokes) {
    const remaining = targetStrokes - strokeCount;
    feedbackEl.textContent = `획 ${strokeCount} / ${targetStrokes} — ${remaining}획 더!`;
    feedbackEl.style.color = '#888';
  } else if (strokeCount >= targetStrokes) {
    feedbackEl.textContent = '잘 했어요! 다음 글자도 써볼까요? 🎉';
    feedbackEl.style.color = '#be3974';
  }
}

// 공통 완료 처리
function handleCompletion(strokeCount, targetStrokes, currentIdx, currentMode, doneSet, nextCallback) {
  if (strokeCount >= targetStrokes && !doneSet.has(currentIdx)) {
    doneSet.add(currentIdx);
    return true;
  }
  return false;
}

// 공통 글자 크기 계산
function getFontSize(wrapperWidth, isLandscape) {
  return isLandscape ? wrapperWidth * 0.7 : wrapperWidth * 0.75;
}

/** index.html 과 동일 — viewport-fit 유지(safe-area), 핀치 줌만 잠금 */
const TRACE_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

// 공통 스크롤/스케일 방지 (body overflow 잠금은 제외: 모바일에서 모드 패널 스크롤·레이아웃 깨짐 방지)
function initScrollPrevention() {
  document.body.style.touchAction = 'manipulation';

  const metaViewport = document.querySelector('meta[name="viewport"]');
  if (metaViewport) {
    metaViewport.setAttribute('content', TRACE_VIEWPORT_CONTENT);
  }
}

/**
 * file:// 에서 캔버스 드래그 시 브라우저가 현재 페이지 URL을 끌어다 넣으려 하며
 * "Unsafe attempt to load URL file://... from frame..." 가 나는 경우가 있음 — 기본 DnD 차단.
 */
function initFileDragNavigateGuard() {
  const stop = (e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
  };
  const opts = { capture: true, passive: false };
  document.addEventListener('dragstart', stop, opts);
  document.addEventListener('dragover', stop, opts);
  document.addEventListener('drop', stop, opts);
}

// 초기화 함수
function initCommon() {
  initScrollPrevention();
  initFileDragNavigateGuard();
  function resizeVisibleCanvases() {
    const seen = new Set();
    document.querySelectorAll('canvas').forEach((canvas) => {
      let el = canvas.parentElement;
      while (el && !el.canvasObj) el = el.parentElement;
      if (el && el.canvasObj && !seen.has(el)) {
        seen.add(el);
        el.canvasObj.resize();
      }
    });
  }

  window.addEventListener('resize', () => {
    resizeVisibleCanvases();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(resizeVisibleCanvases, 200);
  });
}

// DOMContentLoaded 시 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCommon);
} else {
  initCommon();
}


/* ==========================================================================
   터치 ripple — 모든 .tool-btn / .mode-card / .stroke-step / .sound-toggle-btn
   pointerdown에 .trace-ripple span을 동적으로 삽입. 0.55s 후 자동 제거.
   ========================================================================== */
function traceAttachRipple() {
  if (typeof document === 'undefined' || document.__traceRippleBound) return;
  document.__traceRippleBound = true;
  document.addEventListener('pointerdown', (e) => {
    const target = e.target.closest(
      '.tool-btn, .mode-card, .stroke-step, .sound-toggle-btn, .myword-kind-btn'
    );
    if (!target) return;
    if (target.disabled) return;
    const rect = target.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const size = Math.max(rect.width, rect.height) * 1.6;
    const x = (e.clientX || rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (e.clientY || rect.top + rect.height / 2) - rect.top - size / 2;
    const ripple = document.createElement('span');
    ripple.className = 'trace-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.style.width = size + 'px';
    ripple.style.height = size + 'px';
    // ensure parent positioned & overflow:hidden
    const cs = window.getComputedStyle(target);
    if (cs.position === 'static') target.style.position = 'relative';
    if (cs.overflow !== 'hidden') target.style.overflow = 'hidden';
    target.appendChild(ripple);
    setTimeout(() => {
      if (ripple && ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 600);
  }, { passive: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', traceAttachRipple);
  } else {
    traceAttachRipple();
  }
}

/* ==========================================================================
   획 진행도 점 시각화 — feedback 영역에 들어갈 HTML 생성.
   사용 예: feedbackEl.innerHTML = traceRenderProgress(strokeCount, target);
   ========================================================================== */
function traceRenderProgress(count, target, opts) {
  const c = Math.max(0, Math.min(target, Number(count) || 0));
  const t = Math.max(1, Number(target) || 1);
  let dots = '';
  // 너무 많은 획(20+)은 숫자만, 그 외엔 점으로 시각화
  if (t <= 20) {
    for (let i = 0; i < t; i++) {
      dots += '<span class="trace-pdot' + (i < c ? ' filled' : '') + '"></span>';
    }
  } else {
    dots = '';
  }
  const isDone = c >= t;
  const fraction = `${c} / ${t}`;
  const tail = (opts && opts.doneText) || '완성! 🎉';
  if (isDone) {
    return '<span class="trace-progress done">'
      + (dots ? '<span class="trace-pdots">' + dots + '</span>' : '')
      + '<span class="trace-done-text">' + tail + '</span>'
      + '</span>';
  }
  return '<span class="trace-progress">'
    + (dots ? '<span class="trace-pdots">' + dots + '</span>' : '')
    + '<span class="trace-pcount">' + fraction + '</span>'
    + '</span>';
}
