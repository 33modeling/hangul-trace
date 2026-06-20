// 숫자 모드 데이터
const NUMBERS = [
  { ch: '0', name: '영', strokes: 1 },
  { ch: '1', name: '일', strokes: 1 },
  { ch: '2', name: '이', strokes: 1 },
  { ch: '3', name: '삼', strokes: 1 },
  { ch: '4', name: '사', strokes: 2 },
  { ch: '5', name: '오', strokes: 2 },
  { ch: '6', name: '육', strokes: 1 },
  { ch: '7', name: '칠', strokes: 1 },
  { ch: '8', name: '팔', strokes: 1 },
  { ch: '9', name: '구', strokes: 1 },
];

class NumberMode {
  constructor() {
    this.modeName = '숫자';
    this.currentIdx = 0;
    this.canvas = null;
    this.wrapper = null;
    this.navigation = null;
    this.doneSet = new Set();
    this.strokeCount = 0;
    this.isDrawing = false;
    this.startPoint = { x: 0, y: 0 };
    
    this.init();
  }
  
  init() {
    this.guideLayer = new DrawingCanvas('num-guide-canvas', 'num-canvas-wrap');
    this.canvas = new DrawingCanvas('num-draw-canvas', 'num-canvas-wrap');
    this.wrapper = document.getElementById('num-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncCanvases();
        }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceNumberRO && typeof window.__traceNumberRO.disconnect === 'function') {
        try { window.__traceNumberRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceNumberRO = null;
      }
      this._wrapRo = new ResizeObserver(() => {
        if (self._wrapRoRaf) cancelAnimationFrame(self._wrapRoRaf);
        self._wrapRoRaf = requestAnimationFrame(() => {
          self._wrapRoRaf = 0;
          const r = self.wrapper.getBoundingClientRect();
          if (r.width >= 8 && r.height >= 8) {
            self._syncCanvases();
          }
        });
      });
      this._wrapRo.observe(this.wrapper);
      window.__traceNumberRO = this._wrapRo;
    }
    
    this.charLabel = document.getElementById('num-label');
    this.charSub = document.getElementById('num-sub');
    this.feedback = document.getElementById('num-feedback');
    this.hintHint = document.getElementById('num-stroke-hint');
    
    this.navigation = new Navigation(
      NUMBERS,
      this.updateUI.bind(this),
      this.updateFeedback.bind(this),
      this.modeName,
      { dotsId: 'num-dots', strokeHintId: 'num-stroke-hint' }
    );
    // 완료 진도 복원 (#5)
    traceLoadDoneInto(this.navigation.doneSet, 'tracing.done.number.v1', NUMBERS.length);
    this.navigation.renderDots();
    window.numberMode = this;

    this.setupEvents();
    this.updateUI(0);
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this.updateUI(this.currentIdx);
      }
    });
  }

  _reflowWhenReady() {
    const go = () => {
      if (!this.wrapper) return;
      if (this.wrapper.clientWidth < 1) {
        requestAnimationFrame(go);
        return;
      }
      if (this.guideLayer.canvas.width < 2) {
        this.updateUI(this.currentIdx);
      }
    };
    requestAnimationFrame(go);
  }

  _syncCanvases() {
    // 리사이즈 동기화 전용 — 그리던 잉크를 비율 유지로 보존.
    const num = NUMBERS[this.currentIdx];
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(num.ch);
    this.canvas.resize({ preserveInk: true });
  }
  
  updateUI(idx) {
    this.currentIdx = idx;
    // hint fallback 타이머 취소(#8)
    if (window.__traceHintFallbackTimer) {
      clearTimeout(window.__traceHintFallbackTimer);
      window.__traceHintFallbackTimer = null;
    }
    const _strip = document.getElementById('num-stroke-strip');
    if (_strip) {
      cancelStrokeOrderStrip(_strip);
      _strip.innerHTML = '';
    }
    const num = NUMBERS[idx];

    if (this.charLabel) this.charLabel.textContent = `${num.ch} · ${num.name}`; // (#9)
    if (this.charSub) this.charSub.textContent = `숫자 ${idx + 1} / ${NUMBERS.length}`;
    
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(num.ch);
    this.canvas.resize();
    this.canvas.clear();

    this.strokeCount = 0;
    this.updateFeedback();

    if (this.hintHint) this.hintHint.innerHTML = `
      <span class="hint-pill">${num.strokes}획</span>
      <span class="hint-pill">위에서 아래</span>
      <span class="hint-pill">왼쪽에서 오른쪽</span>
    `;
  }

  /** 현재 목표 숫자 + 행 여부(숫자는 단일 글자). */
  _currentTarget() {
    return { target: NUMBERS[this.currentIdx].ch, row: false };
  }

  updateFeedback() {
    const feedbackEl = document.getElementById('num-feedback');
    if (!feedbackEl) return null; // (#9)
    const { target, row } = this._currentTarget();
    const cov = traceCoverageStep(this.canvas.canvas, this.guideLayer, target, { row });
    feedbackEl.style.color = '';
    feedbackEl.innerHTML = traceRenderCoverage(cov.progress, cov.done, {
      doneText: '잘 했어요! 🎉 다음은 ▶'
    });
    return cov;
  }
  
  setupEvents() {
    rebindButtonClickById('num-clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback();
    });
    rebindButtonClickById('num-hint-btn', () => {
      const ch = NUMBERS[this.currentIdx].ch;
      const strip = document.getElementById('num-stroke-strip');
      if (STROKE_ORDER[ch]) {
        playStrokeOrderStrip(strip, this.guideLayer, ch);
      } else {
        if (strip) strip.innerHTML = '';
        this.guideLayer.clear();
        this.guideLayer.drawGuide(ch, '#be3974');
        if (window.__traceHintFallbackTimer) clearTimeout(window.__traceHintFallbackTimer);
        window.__traceHintFallbackTimer = setTimeout(() => { // (#8)
          window.__traceHintFallbackTimer = null;
          this.guideLayer.resize();
          this.guideLayer.drawGuide(ch);
        }, 1000);
      }
    });
    
    this.setupDrawingEvents();
  }
  
  setupDrawingEvents() {
    this._strokeTracker = makeStrokeTracker(this.canvas.canvas);

    const onPointerDown = (e) => {
      e.preventDefault();
      const _strip = document.getElementById('num-stroke-strip');
      if (_strip && typeof cancelStrokeOrderStrip === 'function') cancelStrokeOrderStrip(_strip);
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.startPoint = pos;
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, '#be3974', 6);
    };

    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const current = this.canvas.getPos(e);
      this._strokeTracker.move(current);
      this.canvas.drawLine(this.canvas.lastX, this.canvas.lastY, current.x, current.y);
      this.canvas.lastX = current.x;
      this.canvas.lastY = current.y;
    };

    const onPointerUp = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      this._strokeTracker.end();
      // 완성 판정: 가이드 숫자 커버리지 기반.
      const cov = this.updateFeedback();
      if (cov && cov.done && !this.navigation.getIsDone()) {
        this.navigation.markDone(this.currentIdx); // (#4)
        traceSaveDone('tracing.done.number.v1', this.navigation.doneSet); // (#5)
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
        if (typeof TraceRewards !== 'undefined') TraceRewards.award(10);
      }
    };
    
    const canvas = document.getElementById('num-draw-canvas');
    if (!canvas) return;
    attachCanvasPointerDrawing(canvas, {
      onDown: onPointerDown,
      onMove: onPointerMove,
      onUp: onPointerUp
    });
  }
}
