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

const TRACE_WORD_PEN = '#be3974';
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
          self._syncWordCanvases(true);
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
            self._syncWordCanvases(true);
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

  _syncWordCanvases(preserveInk = false) {
    const w = WORDS[this.currentIdx];
    if (!this.guideLayer || !this.canvas) return;
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(w.syllable, TRACE_WORD_GUIDE_MAIN);
    // 리사이즈 경로(preserveInk)면 그리던 잉크를 비율 유지로 보존, 그 외(네비
    // 게이션·초기 동기화)는 새 글자를 위해 캔버스를 비운다.
    if (preserveInk) {
      this.canvas.resize({ preserveInk: true });
    } else {
      this.canvas.resize();
      this.canvas.clear();
    }
  }

  updateUI() {
    this._resetDrawingState();
    const w = WORDS[this.currentIdx];
    document.getElementById('word-label').textContent = w.syllable;
    document.getElementById('word-sub').textContent = `단어 ${this.currentIdx + 1} / ${WORDS.length}`;
    this._updateStage(w);
    this._syncWordCanvases();
    this.strokeCount = 0;
    this.updateFeedback();
    if (typeof TraceTTS !== 'undefined') TraceTTS.speakAuto(w.syllable);
  }

  /** 초성 예시 단어(파닉스) 칩 — "ㄱ 은 가방🎒 의 ㄱ" 으로 소리·읽기 연결. */
  _updateStage(w) {
    const stage = document.getElementById('word-stage');
    if (!stage) return;
    const ex = (typeof traceConsonantExample === 'function')
      ? traceConsonantExample(w.consonant.ch)
      : null;
    stage.innerHTML = ex
      ? `<span class="hint-pill">자음+모음 쓰기</span>`
        + `<span class="hint-pill word-example">${w.consonant.ch} 은 <b>${ex.word}</b> ${ex.emoji} 의 ${w.consonant.ch}</span>`
      : `<span class="hint-pill">자음+모음 쓰기</span>`;
  }

  /** 완성 판정: 획수가 아니라 가이드 글자 커버리지 기반(렌더만, 완성은 호출부에서). */
  updateFeedback() {
    const feedbackEl = document.getElementById('word-feedback');
    if (!feedbackEl) return null;
    const w = WORDS[this.currentIdx];
    const cov = traceCoverageStep(this.canvas.canvas, this.guideLayer, w.syllable, { row: false });
    feedbackEl.style.color = '';
    feedbackEl.innerHTML = traceRenderCoverage(cov.progress, cov.done, {
      doneText: '완성! 🎉 다음은 ▶'
    });
    return cov;
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
      this._strokeTracker.end();
      const cov = this.updateFeedback();
      if (cov && cov.done && !this.doneSet.has(this.currentIdx)) {
        this.doneSet.add(this.currentIdx);
        const w = WORDS[this.currentIdx];
        document.getElementById('word-complete').textContent = `${w.syllable} ✓`;
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
        if (typeof TraceRewards !== 'undefined') TraceRewards.award(10);
      }
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
    // 완성 라벨 초기화도 여기서 — myword/advanced 의 _resetDrawingState 와
    // 위치를 통일(과거엔 word 만 goTo 에서 따로 지워 드리프트 위험이 있었음).
    const wc = document.getElementById('word-complete');
    if (wc) wc.textContent = '';
  }

  /** 자유 이동 — 어디로든 인덱스 점프, UI/캔버스 깔끔하게 리셋. */
  goTo(idx) {
    if (typeof idx !== 'number' || isNaN(idx)) return;
    this._resetDrawingState();
    this.currentIdx = ((idx % WORDS.length) + WORDS.length) % WORDS.length;
    this.updateUI();
  }

  prev() {
    this.goTo(this.currentIdx - 1);
  }

  next() {
    this.goTo(this.currentIdx + 1);
  }
}
