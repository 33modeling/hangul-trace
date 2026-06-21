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

  /**
   * @param {{ preserveInk?: boolean }} [opts] preserveInk=true 면 크기가 바뀔 때
   *   기존 그림을 새 버퍼에 비율 유지로 재배율해 보존한다(리사이즈 동기화용).
   *   기본(false)은 버퍼 재할당으로 캔버스가 비워진다(네비게이션용).
   */
  resize(opts) {
    if (!this.canvas || !this.wrapper) return;
    const preserveInk = !!(opts && opts.preserveInk);
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
    this.isLandscape = (typeof window !== 'undefined') ? window.innerWidth > window.innerHeight : false;

    // HiDPI 대응: 버퍼는 device pixel 단위로 키우고 CSS 표시 크기(w/h px)는 유지.
    // 모든 그리기와 좌표 변환(getPos)이 버퍼 픽셀 기준이라, 버퍼만 키워도
    // 가이드 글자·획순 오버레이·필기 잉크가 레티나/모바일에서 선명해진다.
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const bw = Math.max(1, Math.round(w * dpr));
    const bh = Math.max(1, Math.round(h * dpr));

    const base = Math.min(bw, bh);
    this.fontSize = base * 0.72;
    this.lineWidth = Math.max(8, base * 0.03);
    // CSS 크기는 버퍼/표시 비율 일치를 위해 항상 갱신
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';

    // 버퍼 크기가 그대로면 재할당을 건너뛴다. canvas.width 재할당은 백킹스토어를
    // 비우므로, 모바일 주소창 접힘/펼침처럼 너비가 안 변하는 resize 가 떠도
    // 진행 중인 필기가 지워지지 않는다 (세로 모드 캔버스는 너비 기준이라 동일).
    if (this.canvas.width === bw && this.canvas.height === bh) return;

    // 크기가 실제로 바뀌는 경우(회전·가로 주소창 등): preserveInk 면 기존
    // 그림을 오프스크린에 떠둔 뒤 새 버퍼에 비율 유지로 다시 그려 보존한다.
    // 캔버스는 항상 정사각(aspect-ratio 1/1)이라 균일 스케일이라 형태가 유지됨.
    let snapshot = null;
    if (preserveInk && this.canvas.width > 0 && this.canvas.height > 0) {
      try {
        const tmp = document.createElement('canvas');
        tmp.width = this.canvas.width;
        tmp.height = this.canvas.height;
        tmp.getContext('2d').drawImage(this.canvas, 0, 0);
        snapshot = tmp;
      } catch (_e) {
        snapshot = null;
      }
    }

    // 진행 중인 획의 마지막 좌표(lastX/lastY)는 옛 버퍼 픽셀 기준이다. 버퍼가
    // 재할당되면(회전 등) 다음 drawLine 이 옛 좌표→새 좌표로 글자를 가로지르는
    // 점프 선을 그리므로, 잉크 스냅샷처럼 lastX/lastY 도 같은 비율로 재배율한다.
    const _oldW = this.canvas.width;
    const _oldH = this.canvas.height;

    this.canvas.width = bw;
    this.canvas.height = bh;

    if (_oldW > 0 && _oldH > 0) {
      const _sx = bw / _oldW;
      const _sy = bh / _oldH;
      if (typeof this.lastX === 'number') this.lastX *= _sx;
      if (typeof this.lastY === 'number') this.lastY *= _sy;
    }

    if (snapshot) {
      try {
        this.ctx.save();
        this.ctx.globalAlpha = 1;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, bw, bh);
        this.ctx.restore();
      } catch (_e) {
        /* 재배율 실패 시 빈 캔버스로 둔다(데이터 유실보다 안전) */
      }
    }
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
    // 사용자 잉크는 펜 설정(색·굵기)을 따른다(설정 화면에서 변경). TracePen 이
    // 없으면 전달된 기본값 사용. 가이드 글자·획순 애니는 이 메서드를 안 쓴다.
    const penColor = (typeof TracePen !== 'undefined') ? TracePen.color() : color;
    const penScale = (typeof TracePen !== 'undefined') ? TracePen.widthScale() : 1;
    const lineW = ((width != null) ? width : this.lineWidth) * penScale;
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
    ctx.strokeStyle = penColor;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 10;
    ctx.stroke();
    ctx.restore();
  }

  drawDot(x, y, color = '#be3974', size = 6) {
    if (!this.ctx) return;
    const penColor = (typeof TracePen !== 'undefined') ? TracePen.color() : color;
    const penScale = (typeof TracePen !== 'undefined') ? TracePen.widthScale() : 1;
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
    ctx.arc(x, y, size * penScale, 0, Math.PI * 2);
    ctx.fillStyle = penColor;
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
    // 이미 한 손가락으로 그리는 중이면 두 번째 포인터(손바닥·다른 손가락)는
    // 무시한다. 안 그러면 진행 중인 획을 가로채(첫 손가락 onUp 미발생) 첫
    // 손가락이 먹통이 되고 획 평가가 누락된다(터치 폴백은 이미 같은 가드 있음).
    if (activePointerId !== null) { e.preventDefault(); return; }
    e.preventDefault();
    cleanupPointerWin();
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
    if (typeof TraceSound !== 'undefined') TraceSound.stroke();
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

// (제거됨) 캔버스 오버레이 기반 showStrokeOrder/_getStrokePositions/animateStrokeOrder
// — 현재는 strip 기반 playStrokeOrderStrip 만 사용. 위 3개는 호출처가 없어 삭제.

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
  // strokeOrder.js 로드 실패/순서 변경 시 ReferenceError 대신 안전하게 빈 처리(#2).
  const data = (typeof STROKE_ORDER !== 'undefined') ? STROKE_ORDER[ch] : undefined;
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
  const data = (typeof STROKE_ORDER !== 'undefined') ? STROKE_ORDER[ch] : undefined; // (#2)

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

    // 활성 카드를 strip 안에서 가로로만 스크롤 — scrollIntoView(block:'nearest')
    // 는 바깥 .mode-ui 세로 스크롤까지 끌어당겨 그리는 중 화면이 튀므로,
    // 컨테이너 scrollLeft 만 직접 조정한다(세로 위치는 건드리지 않음).
    const active = container.querySelector('.stroke-step.active');
    if (active && typeof container.scrollTo === 'function') {
      const target = active.offsetLeft - (container.clientWidth - active.clientWidth) / 2;
      try {
        container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
      } catch (_) {
        container.scrollLeft = Math.max(0, target);
      }
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

/* ==========================================================================
   획순 애니메이션 — 글자 위에 실제 획을 1획씩 순서대로 그려 보여 준다(교육용).
   완성 판별과는 무관(성공 기준은 면적 커버리지). STROKE_PATHS 데이터가 있는
   글자(자모·숫자)만 동작하고, 없으면 false 를 반환해 호출부가 strip 으로 폴백한다.
   ========================================================================== */

const _traceActiveStrokeAnims = new Set();

function _soDrawArrow(ctx, from, to, size, color) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(to[0] - size * Math.cos(ang - 0.5), to[1] - size * Math.sin(ang - 0.5));
  ctx.lineTo(to[0] - size * Math.cos(ang + 0.5), to[1] - size * Math.sin(ang + 0.5));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function _soDrawNumber(ctx, pos, n, r, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(pos[0], pos[1], r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(r * 1.25)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), pos[0], pos[1]);
  ctx.restore();
}

/**
 * 획순 애니메이션 재생.
 * @param {DrawingCanvas} guideLayer 가이드 캔버스(여기에 그린다)
 * @param {string} ch 글자
 * @param {{ onStep?: (i:number)=>void, onComplete?: ()=>void, perStrokeMs?: number }} [opts]
 * @returns {boolean} 경로 데이터가 있어 재생을 시작했으면 true
 */
function playStrokeOrderAnim(guideLayer, ch, opts) {
  opts = opts || {};
  const paths = (typeof STROKE_PATHS !== 'undefined') ? STROKE_PATHS[ch] : null;
  if (!guideLayer || !guideLayer.canvas || !guideLayer.ctx || !paths || !paths.length) return false;
  const bw = guideLayer.canvas.width;
  const bh = guideLayer.canvas.height;
  if (bw < 2 || bh < 2) return false;

  cancelStrokeOrderAnim(guideLayer);

  const ctx = guideLayer.ctx;
  const STROKE_COLOR = '#7c3aed';
  const FAINT = 'rgba(124, 58, 237, 0.14)';
  const TIP_COLOR = '#be3974';
  const NUM_COLOR = '#be3974';
  const lineW = Math.max(6, Math.min(bw, bh) * 0.05);
  const numR = Math.max(9, Math.min(bw, bh) * 0.05);
  const arrow = Math.max(9, Math.min(bw, bh) * 0.06);
  const PER = (typeof opts.perStrokeMs === 'number') ? opts.perStrokeMs : 620;
  const GAP = 160;
  const totalPer = PER + GAP;

  // 화면 좌표 + 누적 길이 사전 계산
  const strokes = paths.map((pts) => {
    const P = pts.map((p) => [p[0] * bw, p[1] * bh]);
    const seg = [];
    let len = 0;
    for (let i = 1; i < P.length; i++) {
      const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      seg.push(l); len += l;
    }
    return { P, seg, len };
  });

  function pointAt(s, t) {
    if (s.len === 0) return s.P[0];
    let d = t * s.len;
    let i = 0;
    while (i < s.seg.length && d > s.seg[i]) { d -= s.seg[i]; i++; }
    if (i >= s.seg.length) return s.P[s.P.length - 1];
    const a = s.P[i], b = s.P[i + 1];
    const f = s.seg[i] ? d / s.seg[i] : 0;
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  }

  function drawStrokePartial(s, t) {
    ctx.save();
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s.P[0][0], s.P[0][1]);
    let d = t * s.len;
    let k = 0;
    while (k < s.seg.length && d > s.seg[k]) { ctx.lineTo(s.P[k + 1][0], s.P[k + 1][1]); d -= s.seg[k]; k++; }
    const tip = pointAt(s, t);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.restore();
    return tip;
  }

  const token = { canceled: false, raf: 0, guideLayer: guideLayer };
  guideLayer.__soAnim = token;
  _traceActiveStrokeAnims.add(token);
  const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;

  function finish() {
    _traceActiveStrokeAnims.delete(token);
    if (guideLayer.__soAnim === token) guideLayer.__soAnim = null;
    // 끝: 깨끗한 가이드 글자로 복귀(아이가 따라 쓸 수 있게)
    try { ctx.clearRect(0, 0, bw, bh); guideLayer.drawGuide(ch); } catch (_e) { /* ignore */ }
    if (opts.onStep) opts.onStep(0);
    if (opts.onComplete) opts.onComplete();
  }

  function frame(now) {
    if (token.canceled) return;
    const elapsed = now - start;
    const cur = Math.floor(elapsed / totalPer);
    if (cur >= strokes.length) { finish(); return; }
    const within = elapsed - cur * totalPer;
    const t = Math.max(0, Math.min(1, within / PER));

    ctx.clearRect(0, 0, bw, bh);
    // 배경: 모든 획을 흐리게(정렬 일관성) + 글자 윤곽 느낌
    ctx.save();
    ctx.strokeStyle = FAINT;
    ctx.lineWidth = lineW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes) {
      ctx.beginPath();
      ctx.moveTo(s.P[0][0], s.P[0][1]);
      for (let i = 1; i < s.P.length; i++) ctx.lineTo(s.P[i][0], s.P[i][1]);
      ctx.stroke();
    }
    ctx.restore();

    if (opts.onStep) opts.onStep(cur + 1);

    for (let i = 0; i < strokes.length; i++) {
      const s = strokes[i];
      const st = i < cur ? 1 : (i === cur ? t : 0);
      if (st <= 0) continue;
      const tip = drawStrokePartial(s, st);
      _soDrawNumber(ctx, s.P[0], i + 1, numR, NUM_COLOR);
      if (i === cur && st < 1) {
        const prev = pointAt(s, Math.max(0, st - 0.05));
        _soDrawArrow(ctx, prev, tip, arrow, TIP_COLOR);
      }
    }

    token.raf = requestAnimationFrame(frame);
  }

  if (typeof requestAnimationFrame === 'function') {
    token.raf = requestAnimationFrame(frame);
  } else {
    finish();
  }
  return true;
}

function cancelStrokeOrderAnim(guideLayer) {
  if (!guideLayer || !guideLayer.__soAnim) return;
  const token = guideLayer.__soAnim;
  token.canceled = true;
  if (token.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(token.raf);
  _traceActiveStrokeAnims.delete(token);
  guideLayer.__soAnim = null;
}

/** 진행 중인 모든 획순 애니메이션 취소(모드 이탈/정리용). */
function cancelAllStrokeOrderAnims() {
  _traceActiveStrokeAnims.forEach((token) => {
    token.canceled = true;
    if (token.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(token.raf);
    if (token.guideLayer && token.guideLayer.__soAnim === token) token.guideLayer.__soAnim = null;
  });
  _traceActiveStrokeAnims.clear();
}


// setupDrawingEvents 제거됨 — 모든 모드는 attachCanvasPointerDrawing 사용
// (중복 이벤트 리스너로 인해 모바일에서 터치가 두 번 처리되는 버그 수정)

// (제거됨) 호출처 없는 공통 헬퍼 updateFeedback/handleCompletion/getFontSize.
// 각 모드는 자체 updateFeedback 메서드 + traceRenderProgress 를 사용한다.

/** index.html 과 동일 — viewport-fit 로 safe-area 유지. 핀치 줌은 허용한다
 * (캔버스/래퍼는 touch-action:none 으로 그리기 중 줌·스크롤을 막으므로,
 * 전역 줌 잠금은 불필요하고 저시력 사용자 접근성만 해친다 — WCAG 1.4.4). */
const TRACE_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1.0, viewport-fit=cover';

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
  if (document.__traceDragGuardBound) return;
  document.__traceDragGuardBound = true;
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
      if (!el || !el.canvasObj || seen.has(el)) return;
      // 화면에 보이는(활성 모드) 래퍼만 리사이즈 — display:none 인 비활성 모드의
      // 캔버스(한 번 열렸던 모든 모드)까지 매 resize 마다 다시 그리던 낭비 제거.
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      seen.add(el);
      el.canvasObj.resize();
    });
  }

  // orientationchange 는 index.js 가 synthetic 'resize' 로 한 번만 처리한다
  // (과거엔 여기서도 별도 처리해 회전 시 전체 재그리기가 두 번 돌았음).
  window.addEventListener('resize', () => {
    resizeVisibleCanvases();
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
    // ensure parent positioned & overflow:hidden — restore after ripple removed
    const cs = window.getComputedStyle(target);
    const origPos = target.style.position;
    const origOvf = target.style.overflow;
    if (cs.position === 'static') target.style.position = 'relative';
    if (cs.overflow !== 'hidden') target.style.overflow = 'hidden';
    target.appendChild(ripple);
    setTimeout(() => {
      if (ripple && ripple.parentNode) ripple.parentNode.removeChild(ripple);
      target.style.position = origPos;
      target.style.overflow = origOvf;
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

/* ==========================================================================
   커버리지 기반 완성 판정 — "몇 번 그었나(획수)"가 아니라 "가이드 글자를
   실제로 따라 썼는가"로 완성을 판정한다(소중한글식 기초 쓰기 발상).

   원리: 목표 글자를 오프스크린에 깨끗이 래스터화한 마스크와, 사용자의 필기
   레이어를 같은 저해상도로 줄여 픽셀 단위로 비교한다.
     - recall    = 글자(마스크) 픽셀 중 필기가 덮은 비율 → "얼마나 따라 썼나"
     - precision = 필기 픽셀 중 글자 위에 있는 비율 → "엉뚱한 데 안 그렸나"
   둘 다 임계치를 넘으면 완성. 약간의 오차 허용을 위해 마스크/필기를 반경
   r 만큼 팽창(dilate)시켜 비교한다. 이렇게 하면:
     - 자연스러운 적은 획수로 글자를 채워도 완성된다(획수 미달로 영영 미완성 X).
     - 아무 데나 낙서로 횟수만 채워도 글자 모양을 안 덮으면 미완성(precision↓).
   ========================================================================== */

const TRACE_COV_SAMPLE = 112;       // 비교용 저해상도(긴 변 px) — 정확도/성능 균형
const TRACE_COV_RADIUS_RATIO = 0.022; // precision(마스크 팽창) 반경 = 표본 긴 변의 2.2%
// recall(잉크 팽창) 반경은 더 넉넉히 — 얇은 세로/가로 글자(ㅣ ㅡ 1 I l)는
// 마스크가 1~2칸 폭이라, 살짝만 좌우로 빗나가도 recall 이 급락해 거의 맞게 써도
// 완성이 안 되던 문제를 막는다. precision 은 좁은 반경을 유지해 낙서 차단력은 보존.
const TRACE_COV_RECALL_RADIUS_RATIO = 0.038;
const TRACE_COV_RECALL_MIN = 0.85;   // 글자의 85% 이상을 덮어야(거의 다 써야 완성).
// 예전 0.58/5% 는 글자를 절반만 따라 써도 dilation 이 빈 곳을 메워 '완성'으로
// 오판정됐다(부분 작성 → 정답 버그). 측정 기반으로 50~60% 부분 작성은 미완성,
// ~85% 이상 덮어야 완성되도록 좁혔다. 아이의 굵은 펜이 시뮬레이션보다 recall 을
// 더 올려 주므로 실제 완전 따라쓰기는 무리 없이 완성된다.
const TRACE_COV_PRECISION_MIN = 0.55; // 필기의 55% 이상이 글자 위에 있어야(막 긋기·상자
// 채우기 차단). 실제 따라쓰기는 ~0.96+, 낙서(상자채우기·대각선난사·지그재그)는 ≤0.45
// 라 측정 기반으로 0.55 에서 깨끗이 분리된다(낙서 실패, 정상 쓰기 통과).
const TRACE_COV_INK_ALPHA = 40;      // 필기 픽셀로 칠 alpha 하한
const TRACE_COV_MASK_ALPHA = 80;     // 글자 픽셀로 칠 alpha 하한

/** 목표 글자(들)를 가이드와 동일한 배치로 채워 그린다(마스크용, 단색 솔리드). */
function _traceFillGlyphs(ctx, w, h, list, row) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const font = (px) => `${px}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  if (row) {
    // drawGuideRow 와 동일한 셀 배치(최대 4)
    const items = list.slice(0, 4);
    const n = Math.max(1, items.length);
    const cellW = w / n;
    const base = Math.min(cellW, h);
    ctx.font = font(base * 0.62);
    const y = h / 2 + Math.min(cellW, h) * 0.03;
    for (let i = 0; i < items.length; i++) {
      ctx.fillText(items[i], cellW * (i + 0.5), y);
    }
  } else {
    // drawGuide 와 동일한 단일 글자 배치
    ctx.font = font(Math.min(w, h) * 0.72);
    const y = h / 2 + Math.min(w, h) * 0.035;
    ctx.fillText(list[0], w / 2, y);
  }
  ctx.restore();
}

/** boolean 격자(0/1)를 반경 r 만큼 분리형 팽창(가로→세로 max). */
function _traceDilate(src, w, h, r) {
  if (r <= 0) return src;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const x0 = x - r < 0 ? 0 : x - r;
      const x1 = x + r >= w ? w - 1 : x + r;
      let on = 0;
      for (let k = x0; k <= x1; k++) { if (src[row + k]) { on = 1; break; } }
      tmp[row + x] = on;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const y0 = y - r < 0 ? 0 : y - r;
      const y1 = y + r >= h ? h - 1 : y + r;
      let on = 0;
      for (let k = y0; k <= y1; k++) { if (tmp[k * w + x]) { on = 1; break; } }
      out[y * w + x] = on;
    }
  }
  return out;
}

/**
 * 마스크/필기 저해상도 격자 + 팽창 맵을 한 번 계산해 돌려준다(평가·하이라이트 공용).
 * @returns {null | { mw:number, mh:number, mask:Uint8Array, ink:Uint8Array,
 *   maskDil:Uint8Array, inkDil:Uint8Array, maskCount:number, inkCount:number,
 *   list:string[], row:boolean }}
 */
function _traceCoverageMaps(drawCanvas, target, opts) {
  opts = opts || {};
  if (!drawCanvas || !drawCanvas.width || !drawCanvas.height) return null;
  const list = (Array.isArray(target) ? target : [target]).filter((c) => typeof c === 'string' && c.length > 0);
  if (list.length === 0) return null;
  const row = !!opts.row;

  const bw = drawCanvas.width;
  const bh = drawCanvas.height;
  const s = TRACE_COV_SAMPLE / Math.max(bw, bh);
  const mw = Math.max(8, Math.round(bw * s));
  const mh = Math.max(8, Math.round(bh * s));

  let maskData;
  let inkData;
  try {
    const mc = document.createElement('canvas');
    mc.width = mw; mc.height = mh;
    const mctx = mc.getContext('2d');
    _traceFillGlyphs(mctx, mw, mh, list, row);
    maskData = mctx.getImageData(0, 0, mw, mh).data;

    const dc = document.createElement('canvas');
    dc.width = mw; dc.height = mh;
    const dctx = dc.getContext('2d');
    dctx.drawImage(drawCanvas, 0, 0, mw, mh);
    inkData = dctx.getImageData(0, 0, mw, mh).data;
  } catch (_e) {
    return null;
  }

  const N = mw * mh;
  const mask = new Uint8Array(N);
  const ink = new Uint8Array(N);
  let maskCount = 0;
  let inkCount = 0;
  // 마스크 경계상자 — 얇은(1차원) 글자 판별용.
  let minX = mw, maxX = -1, minY = mh, maxY = -1;
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const i = y * mw + x;
      const m = maskData[i * 4 + 3] > TRACE_COV_MASK_ALPHA ? 1 : 0;
      const k = inkData[i * 4 + 3] > TRACE_COV_INK_ALPHA ? 1 : 0;
      mask[i] = m; ink[i] = k;
      if (m) { maskCount++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      if (k) inkCount++;
    }
  }
  if (maskCount === 0) return null;

  const r = Math.max(1, Math.round(TRACE_COV_RADIUS_RATIO * Math.max(mw, mh)));
  // 얇은 글자(ㅣ ㅡ 1 I l 등 한 변이 매우 좁은 1차원 형태)일 때만 recall 쪽
  // 잉크 팽창을 넉넉히 한다. 2차원 글자(ㅁ ㅎ 8 …)는 좁은 반경을 유지해 부분
  // 작성(50~60%)이 조기 완성되지 않게 한다.
  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;
  const thinSpan = Math.min(bboxW, bboxH);
  const isThin = thinSpan <= Math.max(4, 0.16 * Math.max(mw, mh));
  const rRecall = isThin
    ? Math.max(r, Math.round(TRACE_COV_RECALL_RADIUS_RATIO * Math.max(mw, mh)))
    : r;
  return {
    mw, mh, mask, ink,
    // precision 은 항상 좁은 반경(r), recall 은 얇은 글자에서만 넉넉한 반경(rRecall).
    maskDil: _traceDilate(mask, mw, mh, r),
    inkDil: _traceDilate(ink, mw, mh, rRecall),
    maskCount, inkCount, list, row
  };
}

/** maps → recall/precision/progress/done/hasInk. */
function _traceCovFromMaps(maps, recallMin, precisionMin) {
  const N = maps.mw * maps.mh;
  let recallHit = 0;
  let precHit = 0;
  for (let i = 0; i < N; i++) {
    if (maps.mask[i] && maps.inkDil[i]) recallHit++;
    if (maps.ink[i] && maps.maskDil[i]) precHit++;
  }
  const recall = recallHit / maps.maskCount;
  const precision = maps.inkCount ? precHit / maps.inkCount : 0;
  const done = maps.inkCount > 0 && recall >= recallMin && precision >= precisionMin;
  const progress = Math.max(0, Math.min(1, recall / recallMin));
  return { recall, precision, progress, done, hasInk: maps.inkCount > 0 };
}

/**
 * 필기 커버리지 평가.
 * @param {HTMLCanvasElement} drawCanvas 사용자 필기 캔버스(버퍼 기준)
 * @param {string|string[]} target 목표 글자(단일) 또는 음절 배열(가로 행)
 * @param {{ row?: boolean, recallMin?: number, precisionMin?: number }} [opts]
 * @returns {{ recall:number, precision:number, progress:number, done:boolean, hasInk:boolean }}
 */
function traceEvaluateTracing(drawCanvas, target, opts) {
  opts = opts || {};
  const recallMin = typeof opts.recallMin === 'number' ? opts.recallMin : TRACE_COV_RECALL_MIN;
  const precisionMin = typeof opts.precisionMin === 'number' ? opts.precisionMin : TRACE_COV_PRECISION_MIN;
  const fail = { recall: 0, precision: 0, progress: 0, done: false, hasInk: false };
  const maps = _traceCoverageMaps(drawCanvas, target, opts);
  if (!maps) return fail;
  return _traceCovFromMaps(maps, recallMin, precisionMin);
}

/**
 * 미작성 영역 하이라이트 — 가이드 글자 픽셀 중 (팽창된) 필기에 아직 안 덮인
 * 곳을 가이드 캔버스에 따뜻한 핑크로 칠한다. "여기 더 써봐" 교정 피드백.
 */
function _tracePaintMissed(guideLayer, maps) {
  if (!guideLayer || !guideLayer.ctx || !guideLayer.canvas || !maps) return;
  const ctx = guideLayer.ctx;
  const bw = guideLayer.canvas.width;
  const bh = guideLayer.canvas.height;
  if (bw < 2 || bh < 2) return;
  const cw = bw / maps.mw;
  const ch = bh / maps.mh;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(236, 72, 153, 0.34)';
  for (let y = 0; y < maps.mh; y++) {
    for (let x = 0; x < maps.mw; x++) {
      const i = y * maps.mw + x;
      if (maps.mask[i] && !maps.inkDil[i]) {
        ctx.fillRect(x * cw, y * ch, cw + 0.6, ch + 0.6);
      }
    }
  }
  ctx.restore();
}

/**
 * 커버리지 평가 + 가이드 갱신을 한 번에. 평가 후:
 *  - 필기가 있고 미완성이면: 가이드를 다시 그리고 '아직 안 쓴 부분'을 하이라이트.
 *  - 필기가 없거나 완성이면: 가이드를 깨끗이 다시 그린다(이전 하이라이트 제거).
 * dictation 처럼 가이드를 숨겨야 하는 모드는 이 함수를 쓰지 않고 traceEvaluateTracing 사용.
 * @param {HTMLCanvasElement} drawCanvas
 * @param {DrawingCanvas} guideLayer
 * @param {string|string[]} target
 * @param {{row?:boolean, guideColor?:string, recallMin?:number, precisionMin?:number}} [opts]
 * @returns {{ recall:number, precision:number, progress:number, done:boolean, hasInk:boolean }}
 */
function traceCoverageStep(drawCanvas, guideLayer, target, opts) {
  opts = opts || {};
  const recallMin = typeof opts.recallMin === 'number' ? opts.recallMin : TRACE_COV_RECALL_MIN;
  const precisionMin = typeof opts.precisionMin === 'number' ? opts.precisionMin : TRACE_COV_PRECISION_MIN;
  const maps = _traceCoverageMaps(drawCanvas, target, opts);
  if (!maps) return { recall: 0, precision: 0, progress: 0, done: false, hasInk: false };
  const cov = _traceCovFromMaps(maps, recallMin, precisionMin);

  if (guideLayer && guideLayer.canvas && guideLayer.canvas.width > 1 && typeof guideLayer.drawGuide === 'function') {
    guideLayer.clear();
    if (maps.row && typeof guideLayer.drawGuideRow === 'function') {
      guideLayer.drawGuideRow(maps.list, opts.guideColor);
    } else {
      guideLayer.drawGuide(maps.list[0], opts.guideColor);
    }
    if (cov.hasInk && !cov.done) {
      _tracePaintMissed(guideLayer, maps);
    }
  }
  return cov;
}

/* 커버리지 진행 바 — feedback 영역에 채울 HTML. progress(0~1) + 완성 여부. */
function traceRenderCoverage(progress, done, opts) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const pct = Math.round(p * 100);
  const tail = (opts && opts.doneText) || '완성! 🎉';
  if (done) {
    return '<span class="trace-cov done">'
      + '<span class="trace-cov-bar"><span class="trace-cov-fill" style="width:100%"></span></span>'
      + '<span class="trace-cov-text">' + tail + '</span>'
      + '</span>';
  }
  return '<span class="trace-cov">'
    + '<span class="trace-cov-bar"><span class="trace-cov-fill" style="width:' + pct + '%"></span></span>'
    + '<span class="trace-cov-text">' + pct + '%</span>'
    + '</span>';
}
