// 자모 모드 데이터
const CHAR_ITEMS = COMMON.CHARS;

class CharMode {
  constructor() {
    this.modeName = '자모';
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
    this.guideLayer = new DrawingCanvas('guide-canvas', 'canvas-wrap');
    this.canvas = new DrawingCanvas('draw-canvas', 'canvas-wrap');
    this.wrapper = document.getElementById('canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncCanvases();
        }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      // 메뉴 ↔ 모드 왕복으로 인스턴스가 새로 만들어질 때 이전 RO 가
      // 그대로 살아있어 stale 상태로 stale char 그리는 버그 방지.
      if (window.__traceCharRO && typeof window.__traceCharRO.disconnect === 'function') {
        try { window.__traceCharRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceCharRO = null;
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
      window.__traceCharRO = this._wrapRo;
    }
    
    this.charLabel = document.getElementById('char-label');
    this.charSub = document.getElementById('char-sub');
    this.feedback = document.getElementById('feedback');
    this.hintHint = document.getElementById('stroke-hint');
    
    this.navigation = new Navigation(
      CHAR_ITEMS,
      this.updateUI.bind(this),
      this.updateFeedback.bind(this),
      this.modeName,
      { dotsId: 'mode-dots' }
    );
    // 완료 진도 복원 (#5) — 새로고침에도 완료 점 유지
    traceLoadDoneInto(this.navigation.doneSet, 'tracing.done.char.v1', CHAR_ITEMS.length);
    this.navigation.renderDots();
    window.charMode = this;

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
    // 리사이즈 동기화 전용 — 사용자가 그리던 잉크를 비율 유지로 보존(회전·
    // 주소창 변화로 캔버스 크기가 바뀌어도 필기가 지워지지 않게).
    const char = CHAR_ITEMS[this.currentIdx];
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(char.ch);
    this.canvas.resize({ preserveInk: true });
  }
  
  updateUI(idx) {
    this.currentIdx = idx;
    // 글자 이동 시 hint fallback 타이머 취소(#8) — 이전 글자로 가이드를 덮어쓰지 않게
    if (window.__traceHintFallbackTimer) {
      clearTimeout(window.__traceHintFallbackTimer);
      window.__traceHintFallbackTimer = null;
    }
    // 새 글자 진입 시 이전 글자의 stroke strip 잔재 제거
    const _strip = document.getElementById('stroke-strip');
    if (_strip) {
      cancelStrokeOrderStrip(_strip);
      _strip.innerHTML = '';
    }
    const char = CHAR_ITEMS[idx];
    
    if (this.charLabel) {
      this.charLabel.textContent = `${char.ch} · ${char.name}`;
      this.charLabel.classList.remove('trace-char-tick');
      void this.charLabel.offsetWidth;
      this.charLabel.classList.add('trace-char-tick');
    }
    if (this.charSub) {
      this.charSub.textContent = `${this.modeName} ${idx + 1} / ${CHAR_ITEMS.length}`;
    }
    
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(char.ch);
    this.canvas.resize();
    this.canvas.clear();

    this.strokeCount = 0;
    this.updateFeedback();

    this.hintHint.innerHTML = `
      <span class="hint-pill">${char.strokes}획</span>
      <span class="hint-pill">위에서 아래</span>
      <span class="hint-pill">왼쪽에서 오른쪽</span>
    `;

    if (typeof TraceTTS !== 'undefined') TraceTTS.speakAuto(char.ch);
  }
  
  /** 현재 목표 글자 + 행 여부(자모는 단일 글자). */
  _currentTarget() {
    return { target: CHAR_ITEMS[this.currentIdx].ch, row: false };
  }

  updateFeedback() {
    const feedbackEl = document.getElementById('feedback');
    if (!feedbackEl) return null;
    const { target, row } = this._currentTarget();
    const cov = traceEvaluateTracing(this.canvas.canvas, target, { row });
    feedbackEl.style.color = '';
    feedbackEl.innerHTML = traceRenderCoverage(cov.progress, cov.done, {
      doneText: '잘 했어요! 🎉 다음은 ▶'
    });
    return cov;
  }
  
  setupEvents() {
    rebindButtonClickById('clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback();
    });

    rebindButtonClickById('hint-btn', () => {
      const ch = CHAR_ITEMS[this.currentIdx].ch;
      const strip = document.getElementById('stroke-strip');
      if (STROKE_ORDER[ch]) {
        // 새 디자인: 캔버스 아래 카드 strip + 카드 순차 하이라이트.
        // 캔버스는 글자만 깔끔하게 유지.
        playStrokeOrderStrip(strip, this.guideLayer, ch);
      } else {
        // STROKE_ORDER 데이터 없는 글자: 글자 자체를 잠깐 강조하는 fallback.
        // 타이머 핸들을 공용 window 슬롯에 저장해 글자 이동/모드 이탈 시 취소할 수
        // 있게 한다(#8) — 안 하면 1초 뒤 stale ch 로 가이드를 덮어쓰는 깜빡임 발생.
        if (strip) strip.innerHTML = '';
        this.guideLayer.clear();
        this.guideLayer.drawGuide(ch, '#be3974');
        if (window.__traceHintFallbackTimer) clearTimeout(window.__traceHintFallbackTimer);
        window.__traceHintFallbackTimer = setTimeout(() => {
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
      // 완성 판정: 획수가 아니라 가이드 글자 커버리지로(소중한글식).
      const cov = this.updateFeedback();
      if (cov && cov.done && !this.navigation.getIsDone()) {
        this.navigation.markDone(this.currentIdx); // (#4)
        traceSaveDone('tracing.done.char.v1', this.navigation.doneSet); // (#5)
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
        if (typeof TraceRewards !== 'undefined') TraceRewards.award(10);
      }
    };
    
    const canvas = document.getElementById('draw-canvas');
    if (!canvas) return;
    attachCanvasPointerDrawing(canvas, {
      onDown: onPointerDown,
      onMove: onPointerMove,
      onUp: onPointerUp
    });
  }
}
