/*
 * 받침(종성) 모드 — 읽기 입문의 다음 단계.
 *
 * 파닉스(자음+모음=가) 다음은 받침: 자음 + 모음 + 받침 = 글자(가+ㅇ=강).
 *   [ㄱ·기역] + [ㅏ·아] + [ㅇ·이응] = [강]
 * 일상에서 자주 쓰는 받침 음절을 모아, 분해해서 3타일로 보여 주고 따라 쓴다
 * (커버리지로 완성 판정). 기본 자음 초성 + 기본 받침(ㄱㄴㄹㅁㅂㅅㅇ) 위주.
 */
const TRACE_BT_PEN = '#be3974';
const TRACE_BT_GUIDE = 'rgba(167, 139, 250, 0.55)';

/* 일상 받침 음절(아이 친화적, 기본 초성·기본 받침이라 자모 이름이 모두 있음). */
const BATCHIM_SYLLABLES = [
  '강', '공', '곰', '방', '종', '콩', '봉',
  '산', '손', '눈', '문', '돈', '신',
  '달', '말', '물', '발', '불', '별', '길', '칼',
  '밤', '봄', '김', '감', '솜', '잠',
  '밥', '입', '집', '컵',
  '옷', '못', '빗',
  '책', '약', '학', '국', '목', '박'
];

const _BT_CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const _BT_JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const _BT_JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function _traceJamoName(ch) {
  const item = (typeof COMMON !== 'undefined') ? COMMON.CHARS.find((x) => x.ch === ch) : null;
  return item ? item.name : '';
}

function _traceDecomposeSyllable(s) {
  if (typeof s !== 'string' || s.length === 0) return null;
  const code = s.charCodeAt(0) - 0xac00;
  if (code < 0 || code >= 11172) return null;
  return {
    cho: _BT_CHO[Math.floor(code / 588)],
    jung: _BT_JUNG[Math.floor((code % 588) / 28)],
    jong: _BT_JONG[code % 28]
  };
}

const BATCHIM_ITEMS = BATCHIM_SYLLABLES
  .map((s) => {
    const d = _traceDecomposeSyllable(s);
    if (!d || !d.jong) return null;
    return { syllable: s, cho: d.cho, jung: d.jung, jong: d.jong };
  })
  .filter(Boolean);

class BatchimMode {
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
    return BATCHIM_ITEMS[this.currentIdx];
  }

  init() {
    this.guideLayer = new DrawingCanvas('bt-guide-canvas', 'bt-canvas-wrap');
    this.canvas = new DrawingCanvas('bt-draw-canvas', 'bt-canvas-wrap');
    this.wrapper = document.getElementById('bt-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() {
          self._syncCanvases(true);
        }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceBatchimRO && typeof window.__traceBatchimRO.disconnect === 'function') {
        try { window.__traceBatchimRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceBatchimRO = null;
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
      window.__traceBatchimRO = this._wrapRo;
    }

    this.setupEvents();
    this.updateUI();
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) {
        this._syncCanvases();
      }
    });
    window.batchimMode = this;
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
    this.guideLayer.drawGuide(it.syllable, TRACE_BT_GUIDE);
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
    const labelEl = document.getElementById('bt-label');
    if (labelEl) labelEl.textContent = it.syllable;
    const subEl = document.getElementById('bt-sub');
    if (subEl) subEl.textContent = `받침 ${this.currentIdx + 1} / ${BATCHIM_ITEMS.length}`;
    this._updateCombo(it);
    this._syncCanvases();
    this.updateFeedback();
    if (typeof TraceTTS !== 'undefined') TraceTTS.speakAuto(it.syllable);
  }

  _updateCombo(it) {
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('bt-cons-ch', it.cho);
    set('bt-cons-name', _traceJamoName(it.cho));
    set('bt-vow-ch', it.jung);
    set('bt-vow-name', _traceJamoName(it.jung));
    set('bt-jong-ch', it.jong);
    set('bt-jong-name', _traceJamoName(it.jong));
    set('bt-syl-ch', it.syllable);

    const exEl = document.getElementById('bt-example');
    if (exEl) {
      const m = (typeof traceWordMeaning === 'function') ? traceWordMeaning(it.syllable) : null;
      if (m && m.meaning) {
        exEl.textContent = `${it.syllable} — ${m.meaning}`;
        exEl.hidden = false;
      } else {
        exEl.textContent = `받침은 글자 아래에 붙어요`;
        exEl.hidden = false;
      }
    }
  }

  _currentTarget() {
    return { target: this._current().syllable, row: false };
  }

  updateFeedback() {
    const feedbackEl = document.getElementById('bt-feedback');
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

    rebindButtonClickById('bt-clear-btn', () => {
      this.canvas.clear();
      this.updateFeedback();
    });

    rebindButtonClickById('bt-speak-btn', () => {
      if (typeof TraceTTS !== 'undefined') TraceTTS.speak(this._current().syllable);
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, TRACE_BT_PEN, 6);
    };

    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const current = this.canvas.getPos(e);
      this._strokeTracker.move(current);
      this.canvas.drawLine(this.canvas.lastX, this.canvas.lastY, current.x, current.y, TRACE_BT_PEN);
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
        const completeEl = document.getElementById('bt-complete');
        if (completeEl) completeEl.textContent = `${it.syllable} ✓`;
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
        if (typeof TraceRewards !== 'undefined') TraceRewards.award(12);
      }
    };

    const drawCanvas = document.getElementById('bt-draw-canvas');
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
    const wc = document.getElementById('bt-complete');
    if (wc) wc.textContent = '';
  }

  goTo(idx) {
    if (typeof idx !== 'number' || isNaN(idx)) return;
    this._resetDrawingState();
    const n = BATCHIM_ITEMS.length;
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
