/*
 * 단어 카드 모드 — 그림(이모지) + 단어 + 뜻 + 따라쓰기 + "아는 단어" 암기 토글.
 *
 * 소중한글식 단어 학습: 단어를 그림·뜻과 함께 보여 의미를 이해시키고, 한 행에
 * 통째로 가이드를 깔아 따라 쓰게 하며(커버리지로 완성 판정), 외운 단어는
 * "아는 단어"로 표시해 진도를 localStorage 에 남긴다.
 */
const TRACE_WC_PEN = '#be3974';
const TRACE_WC_GUIDE = 'rgba(167, 139, 250, 0.55)';
const TRACE_WC_KNOWN_KEY = 'tracing.wordcard.known.v1';

class WordCardMode {
  constructor() {
    // 매 입장마다 카드 순서를 새로 섞어 새 느낌으로 학습(원본 불변).
    this.cards = (typeof TRACE_VOCAB !== 'undefined') ? traceShuffleArray(TRACE_VOCAB) : [];
    this.currentIdx = 0;
    this.guideLayer = null;
    this.canvas = null;
    this.wrapper = null;
    this.isDrawing = false;
    this.tracedSet = new Set();          // 이번 세션에 따라쓰기 완성한 단어
    this.knownSet = new Set(this._loadKnown()); // 아는 단어(영구 저장)
    this._wrapRo = null;
    this._wrapRoRaf = 0;

    this.init();
  }

  _loadKnown() {
    const arr = (typeof Utils !== 'undefined') ? Utils.loadLocal(TRACE_WC_KNOWN_KEY, []) : [];
    return Array.isArray(arr) ? arr.filter((w) => typeof w === 'string') : [];
  }

  _saveKnown() {
    if (typeof Utils !== 'undefined') Utils.saveLocal(TRACE_WC_KNOWN_KEY, Array.from(this.knownSet));
  }

  _current() {
    return this.cards[this.currentIdx] || { word: '', meaning: '', emoji: '', category: '' };
  }

  _syllables() {
    const c = this._current();
    return c.word ? Array.from(c.word) : [];
  }

  init() {
    this.guideLayer = new DrawingCanvas('wc-guide-canvas', 'wc-canvas-wrap');
    this.canvas = new DrawingCanvas('wc-draw-canvas', 'wc-canvas-wrap');
    this.wrapper = document.getElementById('wc-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncCanvases(true);
        }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceWordcardRO && typeof window.__traceWordcardRO.disconnect === 'function') {
        try { window.__traceWordcardRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceWordcardRO = null;
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
      window.__traceWordcardRO = this._wrapRo;
    }

    this.setupEvents();
    this.updateUI();
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this._syncCanvases();
      }
    });
    window.wordCardMode = this;
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

  _syncCanvases(preserveInk = false) {
    if (!this.guideLayer || !this.canvas) return;
    this.guideLayer.resize();
    this.guideLayer.clear();
    const syl = this._syllables();
    if (syl.length) this.guideLayer.drawGuideRow(syl, TRACE_WC_GUIDE); // 단어 전체를 한 행에
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
    const c = this._current();

    const labelEl = document.getElementById('wc-label');
    if (labelEl) labelEl.textContent = c.word;
    this._updateSub();
    const emojiEl = document.getElementById('wc-emoji');
    if (emojiEl) emojiEl.textContent = c.emoji;
    const meanEl = document.getElementById('wc-meaning');
    if (meanEl) meanEl.textContent = c.meaning;
    const catEl = document.getElementById('wc-cat');
    if (catEl) catEl.textContent = c.category;
    const completeEl = document.getElementById('wc-complete');
    if (completeEl) completeEl.textContent = '';

    this._syncCanvases();
    this._syncKnownBtn();
    this.updateFeedback();
    if (typeof TraceTTS !== 'undefined') TraceTTS.speakAuto(c.word);
  }

  _updateSub() {
    const subEl = document.getElementById('wc-sub');
    if (subEl) {
      subEl.textContent = `단어카드 ${this.currentIdx + 1} / ${this.cards.length} · 아는 단어 ${this.knownSet.size}`;
    }
  }

  _syncKnownBtn() {
    const btn = document.getElementById('wc-known-btn');
    if (!btn) return;
    const known = this.knownSet.has(this._current().word);
    btn.classList.toggle('active', known);
    btn.setAttribute('aria-pressed', known ? 'true' : 'false');
    const lbl = btn.querySelector('.wc-known-label');
    if (lbl) lbl.textContent = known ? '아는 단어 ✓' : '아는 단어';
  }

  _currentTarget() {
    return { target: this._syllables(), row: true };
  }

  updateFeedback() {
    const fb = document.getElementById('wc-feedback');
    if (!fb) return null;
    const { target, row } = this._currentTarget();
    const cov = traceCoverageStep(this.canvas.canvas, this.guideLayer, target, { row });
    fb.style.color = '';
    fb.innerHTML = traceRenderCoverage(cov.progress, cov.done, { doneText: '잘 썼어요! 🎉' });
    return cov;
  }

  setupEvents() {
    this._strokeTracker = makeStrokeTracker(this.canvas.canvas);

    rebindButtonClickById('wc-clear-btn', () => {
      this.canvas.clear();
      this.updateFeedback();
    });

    rebindButtonClickById('wc-known-btn', () => {
      this._toggleKnown();
    });

    rebindButtonClickById('wc-speak-btn', () => {
      if (typeof TraceTTS !== 'undefined') TraceTTS.speak(this._current().word);
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, TRACE_WC_PEN, 6);
    };

    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const current = this.canvas.getPos(e);
      this._strokeTracker.move(current);
      this.canvas.drawLine(this.canvas.lastX, this.canvas.lastY, current.x, current.y, TRACE_WC_PEN);
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
        if (!this.tracedSet.has(w)) {
          this.tracedSet.add(w);
          const completeEl = document.getElementById('wc-complete');
          if (completeEl) completeEl.textContent = `${w} ✓`;
          if (typeof TraceSound !== 'undefined') TraceSound.complete();
          if (typeof TraceRewards !== 'undefined') TraceRewards.award(15);
        }
      }
    };

    const drawCanvas = document.getElementById('wc-draw-canvas');
    if (drawCanvas) {
      attachCanvasPointerDrawing(drawCanvas, {
        onDown: onPointerDown,
        onMove: onPointerMove,
        onUp: onPointerUp
      });
    }
  }

  _toggleKnown() {
    const w = this._current().word;
    if (!w) return;
    if (this.knownSet.has(w)) {
      this.knownSet.delete(w);
    } else {
      this.knownSet.add(w);
      if (typeof TraceSound !== 'undefined') TraceSound.complete();
    }
    this._saveKnown();
    this._syncKnownBtn();
    this._updateSub();
  }

  /** mid-stroke 이동 시 잔여 상태 정리. */
  _resetDrawingState() {
    this.isDrawing = false;
    if (this.canvas) {
      this.canvas.lastX = 0;
      this.canvas.lastY = 0;
    }
    if (this._strokeTracker && typeof this._strokeTracker.cancel === 'function') {
      try { this._strokeTracker.cancel(); } catch (_) { /* ignore */ }
    }
    const wc = document.getElementById('wc-complete');
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
