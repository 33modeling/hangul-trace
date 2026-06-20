// 영어 모드 데이터
const UPPERCASE = [
  { ch: 'A', strokes: 3 },
  { ch: 'B', strokes: 2 },
  { ch: 'C', strokes: 1 },
  { ch: 'D', strokes: 2 },
  { ch: 'E', strokes: 3 },
  { ch: 'F', strokes: 3 },
  { ch: 'G', strokes: 2 },
  { ch: 'H', strokes: 3 },
  { ch: 'I', strokes: 1 },
  { ch: 'J', strokes: 2 },
  { ch: 'K', strokes: 3 },
  { ch: 'L', strokes: 2 },
  { ch: 'M', strokes: 4 },
  { ch: 'N', strokes: 3 },
  { ch: 'O', strokes: 1 },
  { ch: 'P', strokes: 2 },
  { ch: 'Q', strokes: 2 },
  { ch: 'R', strokes: 3 },
  { ch: 'S', strokes: 1 },
  { ch: 'T', strokes: 2 },
  { ch: 'U', strokes: 1 },
  { ch: 'V', strokes: 2 },
  { ch: 'W', strokes: 4 },
  { ch: 'X', strokes: 2 },
  { ch: 'Y', strokes: 2 },
  { ch: 'Z', strokes: 3 }
];

const LOWERCASE = [
  { ch: 'a', strokes: 2 },
  { ch: 'b', strokes: 2 },
  { ch: 'c', strokes: 1 },
  { ch: 'd', strokes: 2 },
  { ch: 'e', strokes: 1 },
  { ch: 'f', strokes: 2 },
  { ch: 'g', strokes: 2 },
  { ch: 'h', strokes: 2 },
  { ch: 'i', strokes: 2 },
  { ch: 'j', strokes: 2 },
  { ch: 'k', strokes: 2 },
  { ch: 'l', strokes: 1 },
  { ch: 'm', strokes: 3 },
  { ch: 'n', strokes: 2 },
  { ch: 'o', strokes: 1 },
  { ch: 'p', strokes: 2 },
  { ch: 'q', strokes: 2 },
  { ch: 'r', strokes: 1 },
  { ch: 's', strokes: 1 },
  { ch: 't', strokes: 2 },
  { ch: 'u', strokes: 1 },
  { ch: 'v', strokes: 2 },
  { ch: 'w', strokes: 4 },
  { ch: 'x', strokes: 2 },
  { ch: 'y', strokes: 2 },
  { ch: 'z', strokes: 2 }
];

class EnglishMode {
  constructor() {
    this.modeName = '알파벳';
    this.currentIdx = 0;
    this.alphaType = 'upper';
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
    this.guideLayer = new DrawingCanvas('eng-guide-canvas', 'eng-canvas-wrap');
    this.canvas = new DrawingCanvas('eng-draw-canvas', 'eng-canvas-wrap');
    this.wrapper = document.getElementById('eng-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncCanvases();
        }
      };
    }

    // 다른 모드와 동일하게 ResizeObserver 사용 — 가상키보드 등 wrapper만
    // 변하는 시나리오에서도 캔버스가 정확히 다시 그려지도록.
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceEnglishRO && typeof window.__traceEnglishRO.disconnect === 'function') {
        try { window.__traceEnglishRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceEnglishRO = null;
      }
      this._wrapRoRaf = 0;
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
      window.__traceEnglishRO = this._wrapRo;
    }

    this.charLabel = document.getElementById('eng-label');
    this.charSub = document.getElementById('eng-sub');
    this.feedback = document.getElementById('eng-feedback');
    this.hintHint = document.getElementById('eng-stroke-hint');
    this.typeButtons = document.querySelectorAll('.alpha-type-btn');
    
    // 대/소문자별 진도를 따로 보존 — 토글해도 doneSet이 유지됨
    this.doneSetsByType = { upper: new Set(), lower: new Set() };
    // 완료 진도 복원 (#5) — 대/소문자 각각 별도 키
    traceLoadDoneInto(this.doneSetsByType.upper, 'tracing.done.english.upper.v1', UPPERCASE.length);
    traceLoadDoneInto(this.doneSetsByType.lower, 'tracing.done.english.lower.v1', LOWERCASE.length);

    this.setupTypeToggle();
    this.navigation = this._buildNavigation();
    window.englishMode = this;

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
    const list = this.getCurrentList();
    const alpha = list[this.currentIdx];
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(alpha.ch);
    this.canvas.resize({ preserveInk: true });
  }
  
  getCurrentList() {
    return this.alphaType === 'upper' ? UPPERCASE : LOWERCASE;
  }
  
  /** Navigation 생성 + 현재 alphaType에 해당하는 doneSet 주입 */
  _buildNavigation() {
    // 유형별 진도 Set 을 생성자에 주입(#4) — 생성 후 doneSet 참조를 직접 교체하던
    // 캡슐화 위반을 제거. 생성자가 주입된 Set 기준으로 점을 렌더한다.
    const nav = new Navigation(
      this.getCurrentList(),
      this.updateUI.bind(this),
      this.updateFeedback.bind(this),
      this.modeName,
      { dotsId: 'eng-dots', strokeHintId: 'eng-stroke-hint' },
      this.doneSetsByType[this.alphaType]
    );
    return nav;
  }

  setupTypeToggle() {
    const syncPressed = () => {
      this.typeButtons.forEach((b) => {
        const on = b.dataset.type === this.alphaType;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    };
    syncPressed();
    this.typeButtons.forEach(btn => {
      btn.onclick = () => {
        this.alphaType = btn.dataset.type;
        syncPressed();

        this.currentIdx = 0;
        this.strokeCount = 0;
        this.navigation = this._buildNavigation();
        this.updateUI(0);
      };
    });
  }
  
  updateUI(idx) {
    this.currentIdx = idx;
    // hint fallback 타이머 취소(#8)
    if (window.__traceHintFallbackTimer) {
      clearTimeout(window.__traceHintFallbackTimer);
      window.__traceHintFallbackTimer = null;
    }
    const _strip = document.getElementById('eng-stroke-strip');
    if (_strip) {
      cancelStrokeOrderStrip(_strip);
      _strip.innerHTML = '';
    }
    const list = this.getCurrentList();
    const alpha = list[idx];

    if (this.charLabel) this.charLabel.textContent = alpha.ch; // (#9)
    if (this.charSub) this.charSub.textContent = `알파벳 ${idx + 1} / ${list.length}`;
    
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(alpha.ch);
    this.canvas.resize();
    this.canvas.clear();

    this.strokeCount = 0;
    this.updateFeedback();

    if (this.hintHint) this.hintHint.innerHTML = `
      <span class="hint-pill">${alpha.strokes}획</span>
      <span class="hint-pill">위에서 아래</span>
      <span class="hint-pill">왼쪽에서 오른쪽</span>
    `;
  }

  /** 현재 목표 알파벳 + 행 여부(단일 글자). */
  _currentTarget() {
    const list = this.getCurrentList();
    return { target: list[this.currentIdx].ch, row: false };
  }

  updateFeedback() {
    const feedbackEl = document.getElementById('eng-feedback');
    if (!feedbackEl) return null; // (#9)
    const { target, row } = this._currentTarget();
    const cov = traceEvaluateTracing(this.canvas.canvas, target, { row });
    feedbackEl.style.color = '';
    feedbackEl.innerHTML = traceRenderCoverage(cov.progress, cov.done, {
      doneText: '잘 했어요! 🎉 다음은 ▶'
    });
    return cov;
  }
  
  setupEvents() {
    rebindButtonClickById('eng-clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback();
    });
    rebindButtonClickById('eng-hint-btn', () => {
      const list = this.getCurrentList();
      const ch = list[this.currentIdx].ch;
      const strip = document.getElementById('eng-stroke-strip');
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
      // 완성 판정: 가이드 알파벳 커버리지 기반.
      const cov = this.updateFeedback();
      if (cov && cov.done && !this.navigation.getIsDone()) {
        this.navigation.markDone(this.currentIdx); // (#4)
        // 현재 유형(대/소문자)의 진도를 저장 (#5)
        traceSaveDone(
          this.alphaType === 'upper' ? 'tracing.done.english.upper.v1' : 'tracing.done.english.lower.v1',
          this.navigation.doneSet
        );
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
        if (typeof TraceRewards !== 'undefined') TraceRewards.award(10);
      }
    };
    
    const canvas = document.getElementById('eng-draw-canvas');
    if (!canvas) return;
    attachCanvasPointerDrawing(canvas, {
      onDown: onPointerDown,
      onMove: onPointerMove,
      onUp: onPointerUp
    });
  }
}
