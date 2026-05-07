const TRACE_MYWORD_PEN = '#ec4899';
const TRACE_MYWORD_GUIDE = 'rgba(167, 139, 250, 0.55)';

class MyWordMode {
  constructor() {
    this.words = traceLoadMyWords();
    this.wordIdx = 0;
    this.syllableIdx = 0;     // 세로 모드: 현재 음절 인덱스
    this.windowStart = 0;     // 가로 모드: 4글자 윈도우 시작 인덱스
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

  /** 화면에 실제로 그려지는 음절 목록 */
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

  /** 가로 모드 윈도우 시작점을 음절 길이 안에 클램프 */
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
        // orientation 전환 시 syllableIdx ↔ windowStart 매핑
        const sylLen = self._syllables().length;
        if (L) {
          // 세로 → 가로: 현재 음절이 보이도록 윈도우 시작 잡기
          const maxStart = Math.max(0, sylLen - TRACE_MY_WORD_WINDOW_SIZE);
          self.windowStart = Math.max(0, Math.min(self.syllableIdx, maxStart));
        } else {
          // 가로 → 세로: 윈도우 첫 글자를 현재 음절로
          self.syllableIdx = Math.max(0, Math.min(self.windowStart, sylLen - 1));
        }
        self.strokeCount = 0;
        if (self.canvas) self.canvas.clear();
        self.updateUI();
        return;
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
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this._syncMyWordCanvases();
      }
    });
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

    const visible = this._visibleSyllables();
    if (visible.length === 0) {
      this.guideLayer.clear();
      return;
    }

    if (this._isLandscape()) {
      this.guideLayer.drawGuideRow(visible, TRACE_MYWORD_GUIDE);
    } else {
      this.guideLayer.drawGuide(visible[0], TRACE_MYWORD_GUIDE);
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
      const sylLen = this._syllables().length;
      pill.textContent = this._isLandscape()
        ? (sylLen > TRACE_MY_WORD_WINDOW_SIZE
            ? `가로: ${TRACE_MY_WORD_WINDOW_SIZE}글자 윈도우 슬라이드`
            : '가로: 단어 통째로')
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
      this.windowStart = 0;
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
    this.windowStart = this._clampedWindowStart(syl.length);

    const labelEl = document.getElementById('myword-label');
    const subEl = document.getElementById('myword-sub');

    if (this._isLandscape()) {
      const visible = this._visibleSyllables();
      labelEl.textContent = visible.join('');
      if (syl.length > TRACE_MY_WORD_WINDOW_SIZE) {
        const start = this.windowStart + 1;
        const end = this.windowStart + visible.length;
        subEl.textContent = `내 단어 ${this.wordIdx + 1} / ${this.words.length} · 글자 ${start}-${end} / ${syl.length}`;
      } else {
        subEl.textContent = `내 단어 ${this.wordIdx + 1} / ${this.words.length}`;
      }
    } else {
      const ch = syl[this.syllableIdx];
      labelEl.textContent = ch;
      subEl.textContent = `내 단어 ${this.wordIdx + 1} / ${this.words.length} · 글자 ${this.syllableIdx + 1} / ${syl.length}`;
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
      feedbackEl.style.color = '#ec4899';
      const visibleKey = this._isLandscape()
        ? `L:${this.wordIdx}:${this.windowStart}`
        : `P:${this.wordIdx}:${this.syllableIdx}`;
      if (!this.doneSet.has(visibleKey)) {
        this.doneSet.add(visibleKey);
        const w = this.words[this.wordIdx];
        document.getElementById('myword-complete').textContent = `${w} ✓`;
      }
      feedbackEl.textContent = '완성! 🎉 다음은 ▶ 를 눌러 주세요.';
    }
  }

  setupEvents() {
    /*
     * prev/next 버튼은 index.js의 capture-phase delegation 한 곳에서만
     * 처리한다. 과거에 wireButtonById도 같이 쓰는 바람에 한 번 클릭이
     * 두 번 호출되어 "강아지 마지막 음절 → 토끼" 대신 "강아지 → 토끼 →
     * 강아지"로 되돌아오는 버그가 있었음. 다른 모드와 동일하게 한 경로
     * 만 쓰도록 통일.
     */

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

    if (this._isLandscape()) {
      // 가로: 윈도우를 1칸 왼쪽으로, 0이면 이전 단어의 마지막 윈도우
      if (this.windowStart > 0) {
        this.windowStart--;
      } else {
        this.wordIdx = (this.wordIdx - 1 + this.words.length) % this.words.length;
        const prevSyl = Array.from(this.words[this.wordIdx]);
        this.windowStart = Math.max(0, prevSyl.length - TRACE_MY_WORD_WINDOW_SIZE);
      }
    } else {
      // 세로: 음절 1개 왼쪽으로, 0이면 이전 단어의 마지막 음절
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

    if (this._isLandscape()) {
      // 가로: 윈도우를 1칸 오른쪽으로 슬라이드
      const sylLen = this._syllables().length;
      const maxStart = Math.max(0, sylLen - TRACE_MY_WORD_WINDOW_SIZE);
      if (this.windowStart < maxStart) {
        this.windowStart++;
      } else {
        // 윈도우 끝 → 다음 단어
        this.wordIdx = (this.wordIdx + 1) % this.words.length;
        this.windowStart = 0;
      }
    } else {
      // 세로: 음절 1칸 오른쪽으로
      const syl = this._syllables();
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
  }
}
