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
    const char = CHAR_ITEMS[this.currentIdx];
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(char.ch);
    this.canvas.resize();
    this.canvas.clear();
  }
  
  updateUI(idx) {
    this.currentIdx = idx;
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
    this.updateFeedback(0);
    
    this.hintHint.innerHTML = `
      <span class="hint-pill">${char.strokes}획</span>
      <span class="hint-pill">위에서 아래</span>
      <span class="hint-pill">왼쪽에서 오른쪽</span>
    `;
  }
  
  updateFeedback(strokeCount) {
    const char = CHAR_ITEMS[this.currentIdx];
    const feedbackEl = document.getElementById('feedback');
    feedbackEl.style.color = '';
    feedbackEl.innerHTML = traceRenderProgress(strokeCount, char.strokes, {
      doneText: '잘 했어요! 🎉 다음은 ▶'
    });
  }
  
  setupEvents() {
    rebindButtonClickById('clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback(0);
    });

    rebindButtonClickById('hint-btn', () => {
      const ch = CHAR_ITEMS[this.currentIdx].ch;
      const strip = document.getElementById('stroke-strip');
      if (STROKE_ORDER[ch]) {
        // 새 디자인: 캔버스 아래 카드 strip + 카드 순차 하이라이트.
        // 캔버스는 글자만 깔끔하게 유지.
        playStrokeOrderStrip(strip, this.guideLayer, ch);
      } else {
        // STROKE_ORDER 데이터 없는 글자: 글자 자체를 잠깐 강조하는 fallback
        if (strip) strip.innerHTML = '';
        this.guideLayer.clear();
        this.guideLayer.drawGuide(ch, '#be3974');
        setTimeout(() => {
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
      const realStroke = this._strokeTracker.end();
      if (realStroke) {
        this.strokeCount++;
      }
      this.updateFeedback(this.strokeCount);

      const char = CHAR_ITEMS[this.currentIdx];
      if (this.strokeCount >= char.strokes && !this.navigation.getIsDone()) {
        this.navigation.doneSet.add(this.currentIdx);
        this.navigation.renderDots();
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
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
