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
    window.currentCharMode = this;
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
    const char = CHAR_ITEMS[idx];
    
    this.charLabel.textContent = `${char.ch} · ${char.name}`;
    this.charSub.textContent = `${this.modeName} ${idx + 1} / ${CHAR_ITEMS.length}`;
    if (this.charLabel) {
      this.charLabel.classList.remove('trace-char-tick');
      void this.charLabel.offsetWidth;
      this.charLabel.classList.add('trace-char-tick');
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
    
    if (strokeCount < char.strokes) {
      const remaining = char.strokes - strokeCount;
      feedbackEl.textContent = `획 ${strokeCount} / ${char.strokes} — ${remaining}획 더!`;
      feedbackEl.style.color = '#888';
    } else {
      feedbackEl.textContent = '잘 했어요! 🎉 다음 글자는 ▶ 를 눌러 주세요.';
      feedbackEl.style.color = '#ec4899';
    }
  }
  
  setupEvents() {
    rebindButtonClickById('clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback(0);
    });

    rebindButtonClickById('hint-btn', () => {
      const ch = CHAR_ITEMS[this.currentIdx].ch;
      if (STROKE_ORDER[ch]) {
        animateStrokeOrder(this.guideLayer, ch);
      } else {
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
    const onPointerDown = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.startPoint = pos;
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this.strokeCount++;
      this.canvas.drawDot(pos.x, pos.y, '#ec4899', 6);
      this.updateFeedback(this.strokeCount);
    };
    
    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const current = this.canvas.getPos(e);
      this.canvas.drawLine(this.canvas.lastX, this.canvas.lastY, current.x, current.y);
      this.canvas.lastX = current.x;
      this.canvas.lastY = current.y;
    };
    
    const onPointerUp = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      this.updateFeedback(this.strokeCount);
      
      const char = CHAR_ITEMS[this.currentIdx];
      if (this.strokeCount >= char.strokes && !this.navigation.getIsDone()) {
        this.navigation.doneSet.add(this.currentIdx);
        this.navigation.renderDots();
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
