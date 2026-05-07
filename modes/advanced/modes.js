/*
 * 상급 단어 모드 — 쌍자음(ㄲ ㄸ ㅃ ㅆ ㅉ), 복잡 모음(ㅙ ㅞ ㅢ ㅒ ㅖ),
 * 어려운 받침(ㄶ ㄺ ㄻ ㄼ ㄾ ㅀ ㅄ) 위주의 고정 단어셋.
 *
 * MyWordMode와 동일한 슬라이딩 윈도우 + 세로 1글자 학습 패턴을
 * 동일하게 적용했고, 데이터 소스만 ADVANCED_WORDS 고정 배열을 사용.
 */
const ADVANCED_WORDS = [
  // 쌍자음 시작 (단음절·다음절 섞음)
  '깎다', '까치', '꽉', '꿰다', '꿈', '꽃밭', '꼬리',
  '뽑다', '볶음', '뿌리', '뼈', '뺨', '뻔',
  '딸기', '땀', '뚜껑', '뜻',
  '싹', '쌀', '쑥', '씨앗',
  '짜장', '쪽지', '찜질',
  // 복잡 모음 (ㅖ ㅙ ㅞ ㅢ ㅒ)
  '혜성', '훼손', '예의', '의자', '얘기',
  '괘종', '궤도', '왜', '웬일', '뇌',
  // 어려운 받침 (ㄺ ㄶ ㄻ ㄼ ㄾ ㅀ ㅄ)
  '닭', '흙', '굵다', '맑다', '읽다', '옳다',
  '끓다', '짧다', '얇다', '값', '몫', '없다', '핥다',
  // 쌍받침 + ㅙ ㅔ
  '봤다', '갔다', '됐다', '했다',
  // 어려운 음절
  '쾌청', '췌장', '꿩', '뺑소니', '뼘',
];

const TRACE_ADV_PEN = '#ec4899';
const TRACE_ADV_GUIDE = 'rgba(167, 139, 250, 0.55)';

class AdvancedMode {
  constructor() {
    this.words = ADVANCED_WORDS;
    this.wordIdx = 0;
    this.syllableIdx = 0;
    this.windowStart = 0;
    this.strokeCount = 0;
    this.guideLayer = null;
    this.canvas = null;
    this.wrapper = null;
    this.isDrawing = false;
    this.doneSet = new Set();
    this._wrapRo = null;
    this._wrapRoRaf = 0;
    this._lastLandscape = null;
    this._onResizeBound = null;

    this.init();
  }

  _isLandscape() {
    return typeof Utils !== 'undefined' && Utils.isLandscape();
  }

  _syllables() {
    const w = this.words[this.wordIdx];
    return w ? Array.from(w) : [];
  }

  _visibleSyllables() {
    const syl = this._syllables();
    if (syl.length === 0) return [];
    if (this._isLandscape()) {
      const start = this._clampedWindowStart(syl.length);
      return syl.slice(start, start + TRACE_MY_WORD_WINDOW_SIZE);
    }
    const ch = syl[Math.min(this.syllableIdx, syl.length - 1)];
    return ch ? [ch] : [];
  }

  _clampedWindowStart(sylLen) {
    const maxStart = Math.max(0, sylLen - TRACE_MY_WORD_WINDOW_SIZE);
    return Math.max(0, Math.min(this.windowStart, maxStart));
  }

  _strokeTarget() {
    const visible = this._visibleSyllables();
    if (visible.length === 0) return 1;
    return traceMyWordStrokeTargetForSyllables(visible);
  }

  init() {
    this.guideLayer = new DrawingCanvas('adv-guide-canvas', 'adv-canvas-wrap');
    this.canvas = new DrawingCanvas('adv-draw-canvas', 'adv-canvas-wrap');
    this.wrapper = document.getElementById('adv-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncCanvases();
        }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceAdvRO && typeof window.__traceAdvRO.disconnect === 'function') {
        try {
          window.__traceAdvRO.disconnect();
        } catch (_e) {
          /* ignore */
        }
        window.__traceAdvRO = null;
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
      window.__traceAdvRO = this._wrapRo;
    }

    this._onResizeBound = () => {
      const L = self._isLandscape();
      if (self._lastLandscape !== null && self._lastLandscape !== L) {
        const sylLen = self._syllables().length;
        if (L) {
          const maxStart = Math.max(0, sylLen - TRACE_MY_WORD_WINDOW_SIZE);
          self.windowStart = Math.max(0, Math.min(self.syllableIdx, maxStart));
        } else {
          self.syllableIdx = Math.max(0, Math.min(self.windowStart, sylLen - 1));
        }
        self.strokeCount = 0;
        if (self.canvas) self.canvas.clear();
        self.updateUI();
        return;
      }
      self._lastLandscape = L;
      self._syncCanvases();
    };
    if (typeof window.__traceAdvResizeHandler === 'function') {
      window.removeEventListener('resize', window.__traceAdvResizeHandler);
    }
    window.__traceAdvResizeHandler = this._onResizeBound;
    window.addEventListener('resize', this._onResizeBound);

    this._lastLandscape = this._isLandscape();
    this.setupEvents();
    this.updateUI();
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this._syncCanvases();
      }
    });
    window.advancedMode = this;
  }

  _reflowWhenReady() {
    const go = () => {
      if (!this.wrapper) return;
      if (this.wrapper.clientWidth < 1) {
        requestAnimationFrame(go);
        return;
      }
      if (this.guideLayer.canvas.width < 2) {
        this._syncCanvases();
      }
    };
    requestAnimationFrame(go);
  }

  _syncCanvases() {
    if (!this.guideLayer || !this.canvas) return;
    this.guideLayer.resize();
    this.canvas.resize();
    this.canvas.clear();

    const visible = this._visibleSyllables();
    if (visible.length === 0) {
      this.guideLayer.clear();
      return;
    }

    if (this._isLandscape()) {
      this.guideLayer.drawGuideRow(visible, TRACE_ADV_GUIDE);
    } else {
      this.guideLayer.drawGuide(visible[0], TRACE_ADV_GUIDE);
    }
  }

  updateUI() {
    const pill = document.getElementById('adv-hint-pill');
    if (pill) {
      const sylLen = this._syllables().length;
      pill.textContent = this._isLandscape()
        ? (sylLen > TRACE_MY_WORD_WINDOW_SIZE
            ? `가로: ${TRACE_MY_WORD_WINDOW_SIZE}글자 윈도우 슬라이드`
            : '가로: 단어 통째로')
        : '세로: 한 글자씩 따라 써요 — 어려운 음절 위주';
    }

    if (this.wordIdx >= this.words.length) this.wordIdx = 0;
    const word = this.words[this.wordIdx];
    const syl = Array.from(word);
    if (this.syllableIdx >= syl.length) this.syllableIdx = 0;
    this.windowStart = this._clampedWindowStart(syl.length);

    const labelEl = document.getElementById('adv-label');
    const subEl = document.getElementById('adv-sub');

    if (this._isLandscape()) {
      const visible = this._visibleSyllables();
      labelEl.textContent = visible.join('');
      if (syl.length > TRACE_MY_WORD_WINDOW_SIZE) {
        const start = this.windowStart + 1;
        const end = this.windowStart + visible.length;
        subEl.textContent = `상급 ${this.wordIdx + 1} / ${this.words.length} · 글자 ${start}-${end} / ${syl.length}`;
      } else {
        subEl.textContent = `상급 ${this.wordIdx + 1} / ${this.words.length}`;
      }
    } else {
      const ch = syl[this.syllableIdx];
      labelEl.textContent = ch;
      subEl.textContent = `상급 ${this.wordIdx + 1} / ${this.words.length} · 글자 ${this.syllableIdx + 1} / ${syl.length}`;
    }

    this.strokeCount = 0;
    document.getElementById('adv-complete').textContent = '';
    this._syncCanvases();
    this.updateFeedback();
  }

  updateFeedback() {
    const feedbackEl = document.getElementById('adv-feedback');
    const target = this._strokeTarget();
    if (this.strokeCount < target) {
      const remaining = target - this.strokeCount;
      feedbackEl.textContent = `획 ${this.strokeCount} / ${target} — ${remaining}획 더!`;
      feedbackEl.style.color = '#888';
    } else {
      feedbackEl.style.color = '#ec4899';
      const visibleKey = this._isLandscape()
        ? `L:${this.wordIdx}:${this.windowStart}`
        : `P:${this.wordIdx}:${this.syllableIdx}`;
      if (!this.doneSet.has(visibleKey)) {
        this.doneSet.add(visibleKey);
        const w = this.words[this.wordIdx];
        document.getElementById('adv-complete').textContent = `${w} ✓`;
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
      }
      feedbackEl.textContent = '완성! 🎉 다음은 ▶ 를 눌러 주세요.';
    }
  }

  setupEvents() {
    rebindButtonClickById('adv-clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback();
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this.strokeCount++;
      this.canvas.drawDot(pos.x, pos.y, TRACE_ADV_PEN, 6);
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
        TRACE_ADV_PEN
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

    const drawCanvas = document.getElementById('adv-draw-canvas');
    if (drawCanvas) {
      attachCanvasPointerDrawing(drawCanvas, {
        onDown: onPointerDown,
        onMove: onPointerMove,
        onUp: onPointerUp
      });
    }
  }

  prev() {
    if (this._isLandscape()) {
      if (this.windowStart > 0) {
        this.windowStart--;
      } else {
        this.wordIdx = (this.wordIdx - 1 + this.words.length) % this.words.length;
        const prevSyl = Array.from(this.words[this.wordIdx]);
        this.windowStart = Math.max(0, prevSyl.length - TRACE_MY_WORD_WINDOW_SIZE);
      }
    } else {
      if (this.syllableIdx > 0) {
        this.syllableIdx--;
      } else {
        this.wordIdx = (this.wordIdx - 1 + this.words.length) % this.words.length;
        const prevSyl = Array.from(this.words[this.wordIdx]);
        this.syllableIdx = Math.max(0, prevSyl.length - 1);
      }
    }
    this.updateUI();
  }

  next() {
    if (this._isLandscape()) {
      const sylLen = this._syllables().length;
      const maxStart = Math.max(0, sylLen - TRACE_MY_WORD_WINDOW_SIZE);
      if (this.windowStart < maxStart) {
        this.windowStart++;
      } else {
        this.wordIdx = (this.wordIdx + 1) % this.words.length;
        this.windowStart = 0;
      }
    } else {
      const syl = this._syllables();
      if (this.syllableIdx < syl.length - 1) {
        this.syllableIdx++;
      } else {
        this.wordIdx = (this.wordIdx + 1) % this.words.length;
        this.syllableIdx = 0;
      }
    }
    const wc = document.getElementById('adv-complete');
    if (wc) wc.textContent = '';
    this.updateUI();
  }
}
