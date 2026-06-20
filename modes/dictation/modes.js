/*
 * 그림 받아쓰기 모드 — 재인(고르기)을 넘어 재생(직접 쓰기) 학습.
 *
 * 그림(이모지)+뜻만 보여 주고 단어는 숨긴다. 아이가 단어를 떠올려 빈 칸에
 * 직접 따라 쓰면 커버리지로 채점한다(가이드 글자 없이 시작 → 진짜 받아쓰기).
 * 모르면 "정답 보기"로 가이드를 띄워 따라 쓴다.
 *   - 정답 보기 없이 맞히면(외웠으면) 보너스 점수.
 *   - 정답 보기 후 따라 써도 점수.
 * 어휘셋(TRACE_VOCAB)과 커버리지 엔진을 재사용.
 */
const TRACE_DT_PEN = '#be3974';
const TRACE_DT_GUIDE = 'rgba(167, 139, 250, 0.55)';

class DictationMode {
  constructor() {
    this.cards = (typeof TRACE_VOCAB !== 'undefined') ? traceShuffleArray(TRACE_VOCAB) : [];
    this.currentIdx = 0;
    this.guideLayer = null;
    this.canvas = null;
    this.wrapper = null;
    this.isDrawing = false;
    this.revealed = false;     // 정답(가이드)을 띄웠는가
    this.solvedSet = new Set(); // 맞힌 단어
    this._wrapRo = null;
    this._wrapRoRaf = 0;

    this.init();
  }

  _current() {
    return this.cards[this.currentIdx] || { word: '', meaning: '', emoji: '', category: '' };
  }

  _syllables() {
    const c = this._current();
    return c.word ? Array.from(c.word) : [];
  }

  init() {
    this.guideLayer = new DrawingCanvas('dt-guide-canvas', 'dt-canvas-wrap');
    this.canvas = new DrawingCanvas('dt-draw-canvas', 'dt-canvas-wrap');
    this.wrapper = document.getElementById('dt-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncCanvases(true);
        }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceDictationRO && typeof window.__traceDictationRO.disconnect === 'function') {
        try { window.__traceDictationRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceDictationRO = null;
      }
      this._wrapRo = new ResizeObserver(() => {
        if (self._wrapRoRaf) cancelAnimationFrame(self._wrapRoRaf);
        self._wrapRoRaf = requestAnimationFrame(() => {
          self._wrapRoRaf = 0;
          const r = self.wrapper.getBoundingClientRect();
          if (r.width >= 8 && r.height >= 8) {
            self._syncCanvases(true);
          }
        });
      });
      this._wrapRo.observe(this.wrapper);
      window.__traceDictationRO = this._wrapRo;
    }

    this.setupEvents();
    this.updateUI();
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this._syncCanvases();
      }
    });
    window.dictationMode = this;
  }

  _reflowWhenReady() {
    const go = () => {
      if (!this.wrapper) return;
      if (this.wrapper.clientWidth < 1) {
        requestAnimationFrame(go);
        return;
      }
      if (this.canvas.canvas.width < 2) {
        this._syncCanvases();
      }
    };
    requestAnimationFrame(go);
  }

  _syncCanvases(preserveInk = false) {
    if (!this.guideLayer || !this.canvas) return;
    this.guideLayer.resize();
    this.guideLayer.clear();
    // 정답을 띄운 경우에만 가이드 글자를 그린다(평소엔 빈 칸).
    if (this.revealed) {
      const syl = this._syllables();
      if (syl.length) this.guideLayer.drawGuideRow(syl, TRACE_DT_GUIDE);
    }
    if (preserveInk) {
      this.canvas.resize({ preserveInk: true });
    } else {
      this.canvas.resize();
      this.canvas.clear();
    }
  }

  updateUI() {
    this._resetDrawingState();
    if (this.cards.length === 0) return;
    if (this.currentIdx >= this.cards.length) this.currentIdx = 0;
    this.revealed = false;
    const c = this._current();

    const emojiEl = document.getElementById('dt-emoji');
    if (emojiEl) emojiEl.textContent = c.emoji;
    const meanEl = document.getElementById('dt-meaning');
    if (meanEl) meanEl.textContent = c.meaning;
    const ansEl = document.getElementById('dt-answer');
    if (ansEl) { ansEl.textContent = ''; ansEl.hidden = true; }
    const subEl = document.getElementById('dt-sub');
    if (subEl) subEl.textContent = `받아쓰기 ${this.currentIdx + 1} / ${this.cards.length} · 맞힌 단어 ${this.solvedSet.size}`;
    const completeEl = document.getElementById('dt-complete');
    if (completeEl) completeEl.textContent = '';

    this._syncCanvases();
    this.updateFeedback();
  }

  _currentTarget() {
    return { target: this._syllables(), row: true };
  }

  updateFeedback() {
    const fb = document.getElementById('dt-feedback');
    if (!fb) return null;
    const { target, row } = this._currentTarget();
    const cov = traceEvaluateTracing(this.canvas.canvas, target, { row });
    fb.style.color = '';
    fb.innerHTML = traceRenderCoverage(cov.progress, cov.done, {
      doneText: this.revealed ? '잘 썼어요! 🎉' : '정답! 외웠어요! ⭐'
    });
    return cov;
  }

  _reveal() {
    if (this.revealed) return;
    this.revealed = true;
    const c = this._current();
    const ansEl = document.getElementById('dt-answer');
    if (ansEl) { ansEl.textContent = `정답: ${c.word}`; ansEl.hidden = false; }
    // 가이드를 띄우되 그리던 잉크는 보존.
    this._syncCanvases(true);
    this.updateFeedback();
    if (typeof TraceTTS !== 'undefined') TraceTTS.speak(c.word);
  }

  setupEvents() {
    this._strokeTracker = makeStrokeTracker(this.canvas.canvas);

    rebindButtonClickById('dt-clear-btn', () => {
      this.canvas.clear();
      this.updateFeedback();
    });

    rebindButtonClickById('dt-reveal-btn', () => {
      this._reveal();
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, TRACE_DT_PEN, 6);
    };

    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const current = this.canvas.getPos(e);
      this._strokeTracker.move(current);
      this.canvas.drawLine(this.canvas.lastX, this.canvas.lastY, current.x, current.y, TRACE_DT_PEN);
      this.canvas.lastX = current.x;
      this.canvas.lastY = current.y;
    };

    const onPointerUp = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      this._strokeTracker.end();
      const cov = this.updateFeedback();
      if (cov && cov.done) {
        const w = this._current().word;
        if (!this.solvedSet.has(w)) {
          this.solvedSet.add(w);
          // 정답 보기 없이 맞히면(외웠으면) 보너스.
          const memorized = !this.revealed;
          const ansEl = document.getElementById('dt-answer');
          if (ansEl) { ansEl.textContent = `정답: ${w}`; ansEl.hidden = false; }
          const completeEl = document.getElementById('dt-complete');
          if (completeEl) completeEl.textContent = memorized ? `${w} ⭐ 외웠어요!` : `${w} ✓`;
          const subEl = document.getElementById('dt-sub');
          if (subEl) subEl.textContent = `받아쓰기 ${this.currentIdx + 1} / ${this.cards.length} · 맞힌 단어 ${this.solvedSet.size}`;
          if (typeof TraceSound !== 'undefined') TraceSound.complete();
          if (typeof TraceRewards !== 'undefined') TraceRewards.award(memorized ? 20 : 12);
        }
      }
    };

    const drawCanvas = document.getElementById('dt-draw-canvas');
    if (drawCanvas) {
      attachCanvasPointerDrawing(drawCanvas, {
        onDown: onPointerDown,
        onMove: onPointerMove,
        onUp: onPointerUp
      });
    }
  }

  _resetDrawingState() {
    this.isDrawing = false;
    if (this.canvas) {
      this.canvas.lastX = 0;
      this.canvas.lastY = 0;
    }
    if (this._strokeTracker && typeof this._strokeTracker.cancel === 'function') {
      try { this._strokeTracker.cancel(); } catch (_) { /* ignore */ }
    }
    const wc = document.getElementById('dt-complete');
    if (wc) wc.textContent = '';
  }

  goTo(idx) {
    if (typeof idx !== 'number' || isNaN(idx) || this.cards.length === 0) return;
    this._resetDrawingState();
    const n = this.cards.length;
    this.currentIdx = ((idx % n) + n) % n;
    this.updateUI();
  }

  prev() {
    this.goTo(this.currentIdx - 1);
  }

  next() {
    this.goTo(this.currentIdx + 1);
  }
}
