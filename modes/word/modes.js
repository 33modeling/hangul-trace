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

const TRACE_WORD_PEN = '#ec4899';
const TRACE_WORD_GUIDE_MAIN = 'rgba(167, 139, 250, 0.55)';

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
      if (window.__traceWordRO && typeof window.__traceWordRO.disconnect === 'function') {
        try { window.__traceWordRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceWordRO = null;
      }
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
      window.__traceWordRO = this._wrapRo;
    }

    this.updateUI();
    this.setupEvents();
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this._syncWordCanvases();
      }
    });
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
      feedbackEl.style.color = '#ec4899';
      if (!this.doneSet.has(this.currentIdx)) {
        this.doneSet.add(this.currentIdx);
        document.getElementById('word-complete').textContent = `${w.syllable} ✓`;
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
      }
      feedbackEl.textContent = '완성! 🎉 다음 단어는 ▶ 를 눌러 주세요.';
    }
  }

  setupEvents() {
    this._strokeTracker = makeStrokeTracker(this.canvas.canvas);

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
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, TRACE_WORD_PEN, 6);
    };

    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const current = this.canvas.getPos(e);
      this._strokeTracker.move(current);
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
      const realStroke = this._strokeTracker.end();
      if (realStroke) {
        this.strokeCount++;
      }
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

  /** mid-stroke 중 이동시 isDrawing/lastXY/strokeTracker가 남아 다음 화면에 spike line 생기는 것을 방지. */
  _resetDrawingState() {
    this.isDrawing = false;
    if (this.canvas) {
      this.canvas.lastX = 0;
      this.canvas.lastY = 0;
    }
    if (this._strokeTracker && typeof this._strokeTracker.cancel === 'function') {
      try { this._strokeTracker.cancel(); } catch (_) { /* tracker may not have cancel */ }
    }
  }

  /** 자유 이동 — 어디로든 인덱스 점프, UI/캔버스 깔끔하게 리셋. */
  goTo(idx) {
    if (typeof idx !== 'number' || isNaN(idx)) return;
    this._resetDrawingState();
    this.currentIdx = ((idx % WORDS.length) + WORDS.length) % WORDS.length;
    const wc = document.getElementById('word-complete');
    if (wc) wc.textContent = '';
    this.updateUI();
  }

  prev() {
    this.goTo(this.currentIdx - 1);
  }

  next() {
    this.goTo(this.currentIdx + 1);
  }
}
