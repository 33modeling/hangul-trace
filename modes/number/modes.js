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
    this.wrapper.canvasObj = {
      resize() {
        self._syncCanvases();
      }
    };
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
    window.numberMode = this;

    this.setupEvents();
    this.updateUI(0);
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this.updateUI(this.currentIdx);
      }
    });
    window.currentNumberMode = this;
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
    const num = NUMBERS[this.currentIdx];
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(num.ch);
    this.canvas.resize();
    this.canvas.clear();
  }
  
  updateUI(idx) {
    this.currentIdx = idx;
    const _strip = document.getElementById('num-stroke-strip');
    if (_strip) {
      cancelStrokeOrderStrip(_strip);
      _strip.innerHTML = '';
    }
    const num = NUMBERS[idx];
    
    this.charLabel.textContent = `${num.ch} · ${num.name}`;
    this.charSub.textContent = `숫자 ${idx + 1} / ${NUMBERS.length}`;
    
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(num.ch);
    this.canvas.resize();
    this.canvas.clear();
    
    this.strokeCount = 0;
    this.updateFeedback(0);
    
    this.hintHint.innerHTML = `
      <span class="hint-pill">${num.strokes}획</span>
      <span class="hint-pill">위에서 아래</span>
      <span class="hint-pill">왼쪽에서 오른쪽</span>
    `;
  }
  
  updateFeedback(strokeCount) {
    const num = NUMBERS[this.currentIdx];
    const feedbackEl = document.getElementById('num-feedback');
    
    if (strokeCount < num.strokes) {
      const remaining = num.strokes - strokeCount;
      feedbackEl.textContent = `획 ${strokeCount} / ${num.strokes} — ${remaining}획 더!`;
      feedbackEl.style.color = '#888';
    } else {
      feedbackEl.textContent = '잘 했어요! 🎉 다음 숫자는 ▶ 를 눌러 주세요.';
      feedbackEl.style.color = '#ec4899';
    }
  }
  
  setupEvents() {
    rebindButtonClickById('num-clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback(0);
    });
    rebindButtonClickById('num-hint-btn', () => {
      const ch = NUMBERS[this.currentIdx].ch;
      const strip = document.getElementById('num-stroke-strip');
      if (STROKE_ORDER[ch]) {
        playStrokeOrderStrip(strip, this.guideLayer, ch);
      } else {
        if (strip) strip.innerHTML = '';
        this.guideLayer.clear();
        this.guideLayer.drawGuide(ch, '#ec4899');
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
      this.canvas.drawDot(pos.x, pos.y, '#ec4899', 6);
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

      const num = NUMBERS[this.currentIdx];
      if (this.strokeCount >= num.strokes && !this.navigation.getIsDone()) {
        this.navigation.doneSet.add(this.currentIdx);
        this.navigation.renderDots();
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
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
