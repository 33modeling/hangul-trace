// 단어 모드 데이터 (CHARS는 common.js의 COMMON에서만 의존)
const WORDS = [];
const CONSONANTS = COMMON.CHARS.slice(0, 14);
const VOWELS = COMMON.CHARS.slice(14, 24);

/** 초성+중성 → 음절(가 등). 표준 한글 음절 U+AC00 규칙. */
function traceComposeHangulCv(cho, jung) {
  const CHO = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];
  const JUNG = [
    'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
  ];
  const ci = CHO.indexOf(cho);
  const ji = JUNG.indexOf(jung);
  if (ci < 0 || ji < 0) return String(cho) + String(jung);
  return String.fromCodePoint(0xac00 + ci * 588 + ji * 28);
}

CONSONANTS.forEach((cons) => {
  VOWELS.forEach((vow) => {
    WORDS.push({
      consonant: cons,
      vowel: vow,
      word: cons.ch + vow.ch,
      syllable: traceComposeHangulCv(cons.ch, vow.ch)
    });
  });
});

function traceWordStrokeTarget(w) {
  return w.consonant.strokes + w.vowel.strokes;
}

const TRACE_WORD_PEN = '#e06699';
const TRACE_WORD_GUIDE_MAIN = 'rgba(224, 102, 153, 0.48)';

class WordMode {
  constructor() {
    this.currentIdx = 0;
    this.guideLayer = null;
    this.canvas = null;
    this.wrapper = null;
    this.strokeCount = 0;
    this.isDrawing = false;
    this.startPoint = { x: 0, y: 0 };
    this.doneSet = new Set();
    this._wrapRo = null;
    this._wrapRoRaf = 0;

    this.init();
  }

  init() {
    this.guideLayer = new DrawingCanvas('word-guide-canvas', 'word-canvas-wrap');
    this.canvas = new DrawingCanvas('word-draw-canvas', 'word-canvas-wrap');
    this.wrapper = document.getElementById('word-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncWordCanvases();
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
            self._syncWordCanvases();
          }
        });
      });
      this._wrapRo.observe(this.wrapper);
    }

    this.updateUI();
    this.setupEvents();
    this._reflowWhenReady();
    window.wordMode = this;
  }

  _reflowWhenReady() {
    const go = () => {
      if (!this.wrapper) return;
      if (this.wrapper.clientWidth < 1) {
        requestAnimationFrame(go);
        return;
      }
      if (this.guideLayer.canvas.width < 2) {
        this.updateUI();
      }
    };
    requestAnimationFrame(go);
  }

  _syncWordCanvases() {
    const w = WORDS[this.currentIdx];
    if (!this.guideLayer || !this.canvas) return;
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(w.syllable, TRACE_WORD_GUIDE_MAIN);
    this.canvas.resize();
    this.canvas.clear();
  }

  updateUI() {
    const w = WORDS[this.currentIdx];
    document.getElementById('word-label').textContent = w.syllable;
    document.getElementById('word-sub').textContent = `단어 ${this.currentIdx + 1} / ${WORDS.length}`;
    this._syncWordCanvases();
    this.strokeCount = 0;
    this.updateFeedback();
  }

  updateFeedback() {
    const w = WORDS[this.currentIdx];
    const target = traceWordStrokeTarget(w);
    const feedbackEl = document.getElementById('word-feedback');
    if (this.strokeCount < target) {
      const remaining = target - this.strokeCount;
      feedbackEl.textContent = `획 ${this.strokeCount} / ${target} — ${remaining}획 더!`;
      feedbackEl.style.color = '#888';
    } else {
      feedbackEl.style.color = '#c95886';
      if (!this.doneSet.has(this.currentIdx)) {
        this.doneSet.add(this.currentIdx);
        document.getElementById('word-complete').textContent = `${w.syllable} ✓`;
      }
      feedbackEl.textContent = '완성! 🎉 다음 단어는 ▶ 를 눌러 주세요.';
    }
  }

  setupEvents() {
    rebindButtonClickById('word-clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback();
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.startPoint = pos;
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this.strokeCount++;
      this.canvas.drawDot(pos.x, pos.y, TRACE_WORD_PEN, 6);
      this.updateFeedback();
    };

    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const current = this.canvas.getPos(e);
      this.canvas.drawLine(
        this.canvas.lastX,
        this.canvas.lastY,
        current.x,
        current.y,
        TRACE_WORD_PEN
      );
      this.canvas.lastX = current.x;
      this.canvas.lastY = current.y;
    };

    const onPointerUp = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      this.updateFeedback();
    };

    const drawCanvas = document.getElementById('word-draw-canvas');
    if (drawCanvas) {
      attachCanvasPointerDrawing(drawCanvas, {
        onDown: onPointerDown,
        onMove: onPointerMove,
        onUp: onPointerUp
      });
    }
  }

  prev() {
    this.currentIdx = (this.currentIdx - 1 + WORDS.length) % WORDS.length;
    this.updateUI();
  }

  next() {
    const w = WORDS[this.currentIdx];
    const target = traceWordStrokeTarget(w);
    if (this.strokeCount >= target) {
      this.currentIdx = (this.currentIdx + 1) % WORDS.length;
      const wc = document.getElementById('word-complete');
      if (wc) wc.textContent = '';
      this.updateUI();
      return;
    }
    this.currentIdx = (this.currentIdx + 1) % WORDS.length;
    const wc = document.getElementById('word-complete');
    if (wc) wc.textContent = '';
    this.updateUI();
  }
}
