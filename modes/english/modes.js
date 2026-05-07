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
  { ch: 'L', strokes: 3 },
  { ch: 'M', strokes: 4 },
  { ch: 'N', strokes: 3 },
  { ch: 'O', strokes: 1 },
  { ch: 'P', strokes: 2 },
  { ch: 'Q', strokes: 2 },
  { ch: 'R', strokes: 3 },
  { ch: 'S', strokes: 2 },
  { ch: 'T', strokes: 2 },
  { ch: 'U', strokes: 2 },
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
  { ch: 'e', strokes: 2 },
  { ch: 'f', strokes: 1 },
  { ch: 'g', strokes: 2 },
  { ch: 'h', strokes: 3 },
  { ch: 'i', strokes: 1 },
  { ch: 'j', strokes: 3 },
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
  { ch: 'u', strokes: 2 },
  { ch: 'v', strokes: 2 },
  { ch: 'w', strokes: 4 },
  { ch: 'x', strokes: 2 },
  { ch: 'y', strokes: 2 },
  { ch: 'z', strokes: 2 }
];

class EnglishMode {
  constructor() {
    this.modeName = '영어';
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
    this.wrapper.canvasObj = {
      resize() {
        self._syncCanvases();
      }
    };
    
    this.charLabel = document.getElementById('eng-label');
    this.charSub = document.getElementById('eng-sub');
    this.feedback = document.getElementById('eng-feedback');
    this.hintHint = document.getElementById('eng-stroke-hint');
    this.typeButtons = document.querySelectorAll('.alpha-type-btn');
    
    // 대/소문자별 진도를 따로 보존 — 토글해도 doneSet이 유지됨
    this.doneSetsByType = { upper: new Set(), lower: new Set() };

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
    window.currentEnglishMode = this;
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
    const list = this.getCurrentList();
    const alpha = list[this.currentIdx];
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(alpha.ch);
    this.canvas.resize();
    this.canvas.clear();
  }
  
  getCurrentList() {
    return this.alphaType === 'upper' ? UPPERCASE : LOWERCASE;
  }
  
  /** Navigation 생성 + 현재 alphaType에 해당하는 doneSet 주입 */
  _buildNavigation() {
    const nav = new Navigation(
      this.getCurrentList(),
      this.updateUI.bind(this),
      this.updateFeedback.bind(this),
      this.modeName,
      { dotsId: 'eng-dots', strokeHintId: 'eng-stroke-hint' }
    );
    // Navigation 내부 doneSet 참조를 유형별 set으로 교체 → 진도 유지
    nav.doneSet = this.doneSetsByType[this.alphaType];
    nav.renderDots();
    return nav;
  }

  setupTypeToggle() {
    this.typeButtons.forEach(btn => {
      btn.onclick = () => {
        this.typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.alphaType = btn.dataset.type;
        this.currentIdx = 0;
        this.strokeCount = 0;
        this.navigation = this._buildNavigation();
        this.updateUI(0);
      };
    });
  }
  
  updateUI(idx) {
    this.currentIdx = idx;
    const list = this.getCurrentList();
    const alpha = list[idx];
    
    this.charLabel.textContent = alpha.ch;
    this.charSub.textContent = `알파벳 ${idx + 1} / ${list.length}`;
    
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(alpha.ch);
    this.canvas.resize();
    this.canvas.clear();
    
    this.strokeCount = 0;
    this.updateFeedback(0);
    
    this.hintHint.innerHTML = `
      <span class="hint-pill">${alpha.strokes}획</span>
      <span class="hint-pill">위에서 아래</span>
      <span class="hint-pill">왼쪽에서 오른쪽</span>
    `;
  }
  
  updateFeedback(strokeCount) {
    const list = this.getCurrentList();
    const alpha = list[this.currentIdx];
    const feedbackEl = document.getElementById('eng-feedback');
    
    if (strokeCount < alpha.strokes) {
      const remaining = alpha.strokes - strokeCount;
      feedbackEl.textContent = `획 ${strokeCount} / ${alpha.strokes} — ${remaining} 획 더!`;
      feedbackEl.style.color = '#888';
    } else {
      feedbackEl.textContent = '잘 했어요! 🎉 다음 글자는 ▶ 를 눌러 주세요.';
      feedbackEl.style.color = '#c95886';
    }
  }
  
  setupEvents() {
    rebindButtonClickById('eng-clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback(0);
    });
    rebindButtonClickById('eng-hint-btn', () => {
      const list = this.getCurrentList();
      const ch = list[this.currentIdx].ch;
      if (STROKE_ORDER[ch]) {
        animateStrokeOrder(this.guideLayer, ch);
      } else {
        this.guideLayer.clear();
        this.guideLayer.drawGuide(ch, '#e06699');
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
      this.canvas.drawDot(pos.x, pos.y, '#e06699', 6);
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
      
      const list = this.getCurrentList();
      const alpha = list[this.currentIdx];
      if (this.strokeCount >= alpha.strokes && !this.navigation.getIsDone()) {
        this.navigation.doneSet.add(this.currentIdx);
        this.navigation.renderDots();
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
