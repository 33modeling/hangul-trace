const TRACE_MYWORD_PEN = '#e06699';
const TRACE_MYWORD_GUIDE = 'rgba(224, 102, 153, 0.48)';

class MyWordMode {
  constructor() {
    this.words = traceLoadMyWords();
    this.wordIdx = 0;
    this.syllableIdx = 0;
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

  _strokeTarget() {
    const syl = this._syllables();
    if (syl.length === 0) return 1;
    if (this._isLandscape()) {
      return traceMyWordStrokeTargetForSyllables(syl);
    }
    const one = syl[this.syllableIdx] || syl[0];
    return traceMyWordStrokeTargetForSyllables([one]);
  }

  init() {
    this.words = traceLoadMyWords();
    this.guideLayer = new DrawingCanvas('myword-guide-canvas', 'myword-canvas-wrap');
    this.canvas = new DrawingCanvas('myword-draw-canvas', 'myword-canvas-wrap');
    this.wrapper = document.getElementById('myword-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncMyWordCanvases();
        }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceMyWordRO && typeof window.__traceMyWordRO.disconnect === 'function') {
        try {
          window.__traceMyWordRO.disconnect();
        } catch (_e) {
          /* ignore */
        }
        window.__traceMyWordRO = null;
      }
      this._wrapRo = new ResizeObserver(() => {
        if (self._wrapRoRaf) cancelAnimationFrame(self._wrapRoRaf);
        self._wrapRoRaf = requestAnimationFrame(() => {
          self._wrapRoRaf = 0;
          const r = self.wrapper.getBoundingClientRect();
          if (r.width >= 8 && r.height >= 8) {
            self._syncMyWordCanvases();
          }
        });
      });
      this._wrapRo.observe(this.wrapper);
      window.__traceMyWordRO = this._wrapRo;
    }

    this._onResizeBound = () => {
      const L = self._isLandscape();
      if (self._lastLandscape !== null && self._lastLandscape !== L) {
        self.strokeCount = 0;
        if (self.canvas) self.canvas.clear();
        self.updateFeedback();
      }
      self._lastLandscape = L;
      self._syncMyWordCanvases();
    };
    if (typeof window.__traceMyWordResizeHandler === 'function') {
      window.removeEventListener('resize', window.__traceMyWordResizeHandler);
    }
    window.__traceMyWordResizeHandler = this._onResizeBound;
    window.addEventListener('resize', this._onResizeBound);

    this._lastLandscape = this._isLandscape();
    this.setupEvents();
    this.updateUI();
    this._reflowWhenReady();
    window.myWordMode = this;
  }

  _reflowWhenReady() {
    const go = () => {
      if (!this.wrapper) return;
      if (this.wrapper.clientWidth < 1) {
        requestAnimationFrame(go);
        return;
      }
      if (this.guideLayer.canvas.width < 2) {
        this._syncMyWordCanvases();
      }
    };
    requestAnimationFrame(go);
  }

  _syncMyWordCanvases() {
    if (!this.guideLayer || !this.canvas) return;
    this.guideLayer.resize();
    this.canvas.resize();
    this.canvas.clear();

    if (this.words.length === 0) {
      this.guideLayer.clear();
      return;
    }

    const syl = this._syllables();
    if (syl.length === 0) {
      this.guideLayer.clear();
      return;
    }

    if (this._isLandscape()) {
      this.guideLayer.drawGuideRow(syl, TRACE_MYWORD_GUIDE);
    } else {
      const ch = syl[Math.min(this.syllableIdx, syl.length - 1)] || syl[0];
      this.guideLayer.drawGuide(ch, TRACE_MYWORD_GUIDE);
    }
  }

  _setNavDisabled(disabled) {
    const p = document.getElementById('myword-prev-btn');
    const n = document.getElementById('myword-next-btn');
    for (const el of [p, n]) {
      if (!el) continue;
      el.disabled = disabled;
      if (!disabled) {
        el.removeAttribute('disabled');
      }
    }
  }

  updateUI() {
    this.words = traceLoadMyWords();
    const pill = document.getElementById('myword-hint-pill');
    if (pill) {
      pill.textContent = this._isLandscape()
        ? '가로: 단어 글자 한꺼번에 (최대 4글자)'
        : '세로: 한 글자씩 따라 써요';
    }

    if (this.words.length === 0) {
      document.getElementById('myword-label').textContent = '등록된 단어 없음';
      document.getElementById('myword-sub').textContent = '「내 단어 추가」에서 단어를 넣어 주세요';
      document.getElementById('myword-complete').textContent = '';
      this.strokeCount = 0;
      this._setNavDisabled(true);
      this._syncMyWordCanvases();
      this.updateFeedback();
      return;
    }

    this._setNavDisabled(false);
    if (this.wordIdx >= this.words.length) this.wordIdx = 0;
    let word = this.words[this.wordIdx];
    if (typeof word !== 'string' || word.length === 0) {
      this.wordIdx = 0;
      this.syllableIdx = 0;
      this.words = traceLoadMyWords();
      if (this.words.length === 0) {
        document.getElementById('myword-label').textContent = '등록된 단어 없음';
        document.getElementById('myword-sub').textContent = '「내 단어 추가」에서 단어를 넣어 주세요';
        document.getElementById('myword-complete').textContent = '';
        this.strokeCount = 0;
        this._setNavDisabled(true);
        this._syncMyWordCanvases();
        this.updateFeedback();
        return;
      }
      word = this.words[this.wordIdx];
    }
    const syl = Array.from(word);
    if (this.syllableIdx >= syl.length) this.syllableIdx = 0;

    if (this._isLandscape()) {
      document.getElementById('myword-label').textContent = word;
      document.getElementById('myword-sub').textContent = `내 단어 ${this.wordIdx + 1} / ${this.words.length}`;
    } else {
      const ch = syl[this.syllableIdx];
      document.getElementById('myword-label').textContent = ch;
      document.getElementById('myword-sub').textContent = `내 단어 ${this.wordIdx + 1} / ${this.words.length} · 글자 ${this.syllableIdx + 1} / ${syl.length}`;
    }

    this.strokeCount = 0;
    document.getElementById('myword-complete').textContent = '';
    this._syncMyWordCanvases();
    this.updateFeedback();
  }

  updateFeedback() {
    const feedbackEl = document.getElementById('myword-feedback');
    const target = this._strokeTarget();
    if (this.words.length === 0) {
      feedbackEl.textContent = '「단어 추가」로 첫 단어를 등록해 보세요.';
      feedbackEl.style.color = '#888';
      return;
    }
    if (this.strokeCount < target) {
      const remaining = target - this.strokeCount;
      feedbackEl.textContent = `획 ${this.strokeCount} / ${target} — ${remaining}획 더!`;
      feedbackEl.style.color = '#888';
    } else {
      feedbackEl.style.color = '#c95886';
      const key = `${this.wordIdx}-${this.syllableIdx}-${this._isLandscape() ? 'L' : 'P'}`;
      if (!this.doneSet.has(key)) {
        this.doneSet.add(key);
        const w = this.words[this.wordIdx];
        document.getElementById('myword-complete').textContent = `${w} ✓`;
      }
      feedbackEl.textContent = '완성! 🎉 다음은 ▶ 를 눌러 주세요.';
    }
  }

  setupEvents() {
    wireButtonById('myword-prev-btn', () => {
      const m = window.myWordMode;
      if (m && typeof m.prev === 'function') m.prev();
    });
    wireButtonById('myword-next-btn', () => {
      const m = window.myWordMode;
      if (m && typeof m.next === 'function') m.next();
    });

    rebindButtonClickById('myword-clear-btn', () => {
      this.canvas.clear();
      this.strokeCount = 0;
      this.updateFeedback();
    });

    rebindButtonClickById('myword-goto-add-btn', () => {
      if (typeof window.showSingleMode === 'function') {
        window.showSingleMode('myword-add');
      }
    });

    const onPointerDown = (e) => {
      if (this.words.length === 0) return;
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this.strokeCount++;
      this.canvas.drawDot(pos.x, pos.y, TRACE_MYWORD_PEN, 6);
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
        TRACE_MYWORD_PEN
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

    const drawCanvas = document.getElementById('myword-draw-canvas');
    if (drawCanvas) {
      attachCanvasPointerDrawing(drawCanvas, {
        onDown: onPointerDown,
        onMove: onPointerMove,
        onUp: onPointerUp
      });
    }
  }

  prev() {
    this.words = traceLoadMyWords();
    if (this.words.length === 0) return;
    const syl = this._syllables();
    if (this._isLandscape()) {
      this.wordIdx = (this.wordIdx - 1 + this.words.length) % this.words.length;
      this.syllableIdx = 0;
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
    this.words = traceLoadMyWords();
    if (this.words.length === 0) return;
    const target = this._strokeTarget();
    const syl = this._syllables();

    if (this.strokeCount >= target) {
      if (this._isLandscape()) {
        this.wordIdx = (this.wordIdx + 1) % this.words.length;
        this.syllableIdx = 0;
      } else {
        if (this.syllableIdx < syl.length - 1) {
          this.syllableIdx++;
        } else {
          this.wordIdx = (this.wordIdx + 1) % this.words.length;
          this.syllableIdx = 0;
        }
      }
      const wc = document.getElementById('myword-complete');
      if (wc) wc.textContent = '';
      this.updateUI();
      return;
    }

    if (this._isLandscape()) {
      this.wordIdx = (this.wordIdx + 1) % this.words.length;
      this.syllableIdx = 0;
    } else {
      this.wordIdx = (this.wordIdx + 1) % this.words.length;
      this.syllableIdx = 0;
    }
    const wc = document.getElementById('myword-complete');
    if (wc) wc.textContent = '';
    this.updateUI();
  }
}
