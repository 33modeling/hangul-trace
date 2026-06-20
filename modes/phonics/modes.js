/*
 * 첫걸음(파닉스) 모드 — 처음 한글을 익히는 용도.
 *
 * 소중한글식 "조합 원리": 자음 + 모음 = 글자 를 시각적으로 보여 준다.
 *   [ ㄱ · 기역 ] + [ ㅏ · 아 ] = [ 가 ]
 * 자음에는 예시 단어(파닉스)를 곁들여 소리·읽기를 연결하고("ㄱ 은 가방의 ㄱ"),
 * 만들어진 글자를 캔버스에 따라 쓴다(커버리지로 완성 판정). 음원 없이 텍스트.
 *
 * 데이터: 기본 자음 14 × 기본 모음 10 = 140 조합(자음 우선 순서: 가 갸 거 겨 …).
 */
const TRACE_PH_PEN = '#be3974';
const TRACE_PH_GUIDE = 'rgba(167, 139, 250, 0.55)';

/** 초성+중성 → 음절(표준 U+AC00). 다른 모드와 독립되게 자체 정의. */
function _tracePhonicsCompose(cho, jung) {
  const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const ci = CHO.indexOf(cho);
  const ji = JUNG.indexOf(jung);
  if (ci < 0 || ji < 0) return String(cho) + String(jung);
  return String.fromCodePoint(0xac00 + ci * 588 + ji * 28);
}

const PHONICS_ITEMS = (function () {
  const cons = COMMON.CHARS.slice(0, 14);
  const vows = COMMON.CHARS.slice(14, 24);
  const out = [];
  cons.forEach((c) => {
    vows.forEach((v) => {
      out.push({ cons: c, vow: v, syllable: _tracePhonicsCompose(c.ch, v.ch) });
    });
  });
  return out;
})();

class PhonicsMode {
  constructor() {
    this.currentIdx = 0;
    this.guideLayer = null;
    this.canvas = null;
    this.wrapper = null;
    this.isDrawing = false;
    this.doneSet = new Set();
    this._wrapRo = null;
    this._wrapRoRaf = 0;

    this.init();
  }

  _current() {
    return PHONICS_ITEMS[this.currentIdx];
  }

  init() {
    this.guideLayer = new DrawingCanvas('ph-guide-canvas', 'ph-canvas-wrap');
    this.canvas = new DrawingCanvas('ph-draw-canvas', 'ph-canvas-wrap');
    this.wrapper = document.getElementById('ph-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncCanvases(true);
        }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__tracePhonicsRO && typeof window.__tracePhonicsRO.disconnect === 'function') {
        try { window.__tracePhonicsRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__tracePhonicsRO = null;
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
      window.__tracePhonicsRO = this._wrapRo;
    }

    this.setupEvents();
    this.updateUI();
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this._syncCanvases();
      }
    });
    window.phonicsMode = this;
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
    const it = this._current();
    this.guideLayer.resize();
    this.guideLayer.clear();
    this.guideLayer.drawGuide(it.syllable, TRACE_PH_GUIDE);
    if (preserveInk) {
      this.canvas.resize({ preserveInk: true });
    } else {
      this.canvas.resize();
      this.canvas.clear();
    }
  }

  updateUI() {
    this._resetDrawingState();
    const it = this._current();
    const labelEl = document.getElementById('ph-label');
    if (labelEl) labelEl.textContent = it.syllable;
    const subEl = document.getElementById('ph-sub');
    if (subEl) subEl.textContent = `첫걸음 ${this.currentIdx + 1} / ${PHONICS_ITEMS.length}`;
    this._updateCombo(it);
    this._syncCanvases();
    this.updateFeedback();
  }

  /** 조합 타일 + 자음 예시 단어 갱신. */
  _updateCombo(it) {
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('ph-cons-ch', it.cons.ch);
    set('ph-cons-name', it.cons.name);
    set('ph-vow-ch', it.vow.ch);
    set('ph-vow-name', it.vow.name);
    set('ph-syl-ch', it.syllable);

    const exEl = document.getElementById('ph-example');
    if (exEl) {
      const ex = (typeof traceConsonantExample === 'function')
        ? traceConsonantExample(it.cons.ch)
        : null;
      if (ex) {
        exEl.innerHTML = `${it.cons.ch} 은 <b>${ex.word}</b> ${ex.emoji} 의 ${it.cons.ch}`;
        exEl.hidden = false;
      } else {
        exEl.textContent = '';
        exEl.hidden = true;
      }
    }
  }

  _currentTarget() {
    return { target: this._current().syllable, row: false };
  }

  /** 완성 판정: 커버리지 기반(렌더만, 완성은 호출부에서). */
  updateFeedback() {
    const feedbackEl = document.getElementById('ph-feedback');
    if (!feedbackEl) return null;
    const { target, row } = this._currentTarget();
    const cov = traceEvaluateTracing(this.canvas.canvas, target, { row });
    feedbackEl.style.color = '';
    feedbackEl.innerHTML = traceRenderCoverage(cov.progress, cov.done, {
      doneText: '완성! 🎉 다음은 ▶'
    });
    return cov;
  }

  setupEvents() {
    this._strokeTracker = makeStrokeTracker(this.canvas.canvas);

    rebindButtonClickById('ph-clear-btn', () => {
      this.canvas.clear();
      this.updateFeedback();
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, TRACE_PH_PEN, 6);
    };

    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const current = this.canvas.getPos(e);
      this._strokeTracker.move(current);
      this.canvas.drawLine(this.canvas.lastX, this.canvas.lastY, current.x, current.y, TRACE_PH_PEN);
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
        const it = this._current();
        const completeEl = document.getElementById('ph-complete');
        if (completeEl) completeEl.textContent = `${it.syllable} ✓`;
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
      }
    };

    const drawCanvas = document.getElementById('ph-draw-canvas');
    if (drawCanvas) {
      attachCanvasPointerDrawing(drawCanvas, {
        onDown: onPointerDown,
        onMove: onPointerMove,
        onUp: onPointerUp
      });
    }
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
    const wc = document.getElementById('ph-complete');
    if (wc) wc.textContent = '';
  }

  goTo(idx) {
    if (typeof idx !== 'number' || isNaN(idx)) return;
    this._resetDrawingState();
    const n = PHONICS_ITEMS.length;
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
