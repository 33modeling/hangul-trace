/*
 * 획순 익히기 모드 — 글자를 '획 순서대로' 쓰는 법만 집중해서 익힌다.
 *
 * 화면 아래 획순 카드(1획·2획…)를 항상 보여 주고, ▶ 재생 버튼으로 순서를
 * 차례로 강조해 시연한다. 아이는 가이드 글자를 따라 쓰고(커버리지로 완성 판정,
 * 미작성 영역은 핑크로 안내), 완성하면 보상을 받는다.
 *
 * 대상: 한글 자모 24 + 숫자 10 (모두 STROKE_ORDER 데이터가 있는 글자).
 */
const TRACE_SO_PEN = '#be3974';

const STROKEORDER_ITEMS = (function () {
  const jamo = (typeof COMMON !== 'undefined' && Array.isArray(COMMON.CHARS))
    ? COMMON.CHARS.map((c) => ({ ch: c.ch, name: c.name }))
    : [];
  const digits = [
    { ch: '1', name: '일' }, { ch: '2', name: '이' }, { ch: '3', name: '삼' },
    { ch: '4', name: '사' }, { ch: '5', name: '오' }, { ch: '6', name: '육' },
    { ch: '7', name: '칠' }, { ch: '8', name: '팔' }, { ch: '9', name: '구' },
    { ch: '0', name: '영' }
  ];
  return jamo.concat(digits);
})();

class StrokeOrderMode {
  constructor() {
    this.currentIdx = 0;
    this.guideLayer = null;
    this.canvas = null;
    this.wrapper = null;
    this.isDrawing = false;
    this.doneSet = new Set();
    // 완료 진도 복원 (#5) — 재방문에도 완료 항목이 유지돼 점수 중복 적립 방지
    traceLoadDoneInto(this.doneSet, 'tracing.done.strokeorder.v1', STROKEORDER_ITEMS.length);
    this._wrapRo = null;
    this._wrapRoRaf = 0;

    this.init();
  }

  _current() {
    return STROKEORDER_ITEMS[this.currentIdx] || { ch: '', name: '' };
  }

  init() {
    this.guideLayer = new DrawingCanvas('so-guide-canvas', 'so-canvas-wrap');
    this.canvas = new DrawingCanvas('so-draw-canvas', 'so-canvas-wrap');
    this.wrapper = document.getElementById('so-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncCanvases(true);
        }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceStrokeOrderRO && typeof window.__traceStrokeOrderRO.disconnect === 'function') {
        try { window.__traceStrokeOrderRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceStrokeOrderRO = null;
      }
      this._wrapRo = new ResizeObserver(() => {
        if (self._wrapRoRaf) cancelAnimationFrame(self._wrapRoRaf);
        self._wrapRoRaf = requestAnimationFrame(() => {
          self._wrapRoRaf = 0;
          const r = self.wrapper.getBoundingClientRect();
          if (r.width >= 8 && r.height >= 8) {
            self._syncCanvases(true);
          }
        });
      });
      this._wrapRo.observe(this.wrapper);
      window.__traceStrokeOrderRO = this._wrapRo;
    }

    this.setupEvents();
    this.updateUI();
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this._syncCanvases();
      }
    });
    window.strokeOrderMode = this;
  }

  _reflowWhenReady() {
    const go = () => {
      if (!this.wrapper) return;
      if (this.wrapper.clientWidth < 1) {
        if (this.wrapper.offsetParent === null) return; // 모드가 숨겨졌으면(teardown) rAF 루프 종료
        requestAnimationFrame(go);
        return;
      }
      if (this.guideLayer.canvas.width < 2) {
        this._syncCanvases();
      }
    };
    requestAnimationFrame(go);
  }

  _syncCanvases(preserveInk = false) {
    if (!this.guideLayer || !this.canvas) return;
    // 가이드 버퍼 재할당 전에 진행 중인 획순 애니메이션 취소(stale 좌표 방지).
    if (typeof cancelStrokeOrderAnim === 'function') cancelStrokeOrderAnim(this.guideLayer);
    const it = this._current();
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(it.ch);
    if (preserveInk) {
      this.canvas.resize({ preserveInk: true });
    } else {
      this.canvas.resize();
      this.canvas.clear();
    }
  }

  updateUI() {
    this._resetDrawingState();
    // 글자 이동 시 진행 중이던 획순 재생(카드·애니메이션) 취소.
    const strip = document.getElementById('so-strip');
    if (strip && typeof cancelStrokeOrderStrip === 'function') cancelStrokeOrderStrip(strip);
    if (typeof cancelStrokeOrderAnim === 'function') cancelStrokeOrderAnim(this.guideLayer);

    const it = this._current();
    const labelEl = document.getElementById('so-label');
    if (labelEl) labelEl.textContent = `${it.ch} · ${it.name}`;
    const subEl = document.getElementById('so-sub');
    if (subEl) {
      const steps = (typeof STROKE_ORDER !== 'undefined' && STROKE_ORDER[it.ch]) ? STROKE_ORDER[it.ch].steps.length : 0;
      subEl.textContent = `획순 ${this.currentIdx + 1} / ${STROKEORDER_ITEMS.length} · ${steps}획`;
    }
    const completeEl = document.getElementById('so-complete');
    if (completeEl) completeEl.textContent = '';

    this._syncCanvases();
    // 획순 카드 정적 표시(강조 없음).
    if (strip && typeof renderStrokeOrderStrip === 'function') {
      renderStrokeOrderStrip(strip, it.ch, 0);
    }
    this.updateFeedback();
    if (typeof TraceTTS !== 'undefined') TraceTTS.speakAuto(it.ch);
  }

  _currentTarget() {
    return { target: this._current().ch, row: false };
  }

  updateFeedback() {
    const feedbackEl = document.getElementById('so-feedback');
    if (!feedbackEl) return null;
    const { target, row } = this._currentTarget();
    const cov = traceCoverageStep(this.canvas.canvas, this.guideLayer, target, { row });
    feedbackEl.style.color = '';
    feedbackEl.innerHTML = traceRenderCoverage(cov.progress, cov.done, {
      doneText: '잘 했어요! 🎉 다음은 ▶'
    });
    return cov;
  }

  _play() {
    const it = this._current();
    const strip = document.getElementById('so-strip');
    // 시연 전 캔버스를 깨끗이 — 시연 중에는 가이드 글자만 보이게.
    this.canvas.clear();
    // 글자 위 1획씩 실제 획 애니메이션(자모·숫자 모두 경로 데이터 있음). 카드도 동기 강조.
    const played = (typeof playStrokeOrderAnim === 'function') && playStrokeOrderAnim(this.guideLayer, it.ch, {
      onStep: (n) => {
        if (strip && typeof renderStrokeOrderStrip === 'function') renderStrokeOrderStrip(strip, it.ch, n);
      }
    });
    if (!played && strip && typeof playStrokeOrderStrip === 'function') {
      playStrokeOrderStrip(strip, this.guideLayer, it.ch);
    }
  }

  setupEvents() {
    this._strokeTracker = makeStrokeTracker(this.canvas.canvas);

    rebindButtonClickById('so-play-btn', () => this._play());

    rebindButtonClickById('so-clear-btn', () => {
      this.canvas.clear();
      this.updateFeedback();
    });

    rebindButtonClickById('so-speak-btn', () => {
      if (typeof TraceTTS !== 'undefined') TraceTTS.speak(this._current().ch);
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      // 그리기 시작하면 진행 중인 획순 재생을 멈추고 가이드를 깨끗한 글자로 되돌린다.
      const strip = document.getElementById('so-strip');
      if (strip && typeof cancelStrokeOrderStrip === 'function') {
        cancelStrokeOrderStrip(strip);
        if (typeof renderStrokeOrderStrip === 'function') renderStrokeOrderStrip(strip, this._current().ch, 0);
      }
      if (this.guideLayer && this.guideLayer.__soAnim) {
        cancelStrokeOrderAnim(this.guideLayer);
        this.guideLayer.clear();
        this.guideLayer.drawGuide(this._current().ch);
      }
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, TRACE_SO_PEN, 6);
    };

    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const current = this.canvas.getPos(e);
      this._strokeTracker.move(current);
      this.canvas.drawLine(this.canvas.lastX, this.canvas.lastY, current.x, current.y, TRACE_SO_PEN);
      this.canvas.lastX = current.x;
      this.canvas.lastY = current.y;
    };

    const onPointerUp = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      this._strokeTracker.end();
      const cov = this.updateFeedback();
      if (cov && cov.done && !this.doneSet.has(this.currentIdx)) {
        this.doneSet.add(this.currentIdx);
        traceSaveDone('tracing.done.strokeorder.v1', this.doneSet); // (#5)
        const completeEl = document.getElementById('so-complete');
        if (completeEl) completeEl.textContent = `${this._current().ch} ✓`;
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
        if (typeof TraceRewards !== 'undefined') TraceRewards.award(10);
      }
    };

    const drawCanvas = document.getElementById('so-draw-canvas');
    if (drawCanvas) {
      attachCanvasPointerDrawing(drawCanvas, {
        onDown: onPointerDown,
        onMove: onPointerMove,
        onUp: onPointerUp
      });
    }
  }

  _resetDrawingState() {
    this.isDrawing = false;
    if (this.canvas) {
      this.canvas.lastX = 0;
      this.canvas.lastY = 0;
    }
    if (this._strokeTracker && typeof this._strokeTracker.cancel === 'function') {
      try { this._strokeTracker.cancel(); } catch (_) { /* ignore */ }
    }
    const wc = document.getElementById('so-complete');
    if (wc) wc.textContent = '';
  }

  goTo(idx) {
    if (typeof idx !== 'number' || isNaN(idx)) return;
    this._resetDrawingState();
    const n = STROKEORDER_ITEMS.length;
    this.currentIdx = ((idx % n) + n) % n;
    this.updateUI();
  }

  prev() {
    this.goTo(this.currentIdx - 1);
  }

  next() {
    this.goTo(this.currentIdx + 1);
  }
}
