/*
 * 문장 모드 — 짧은 문장 읽기·쓰기.
 *
 * 그림(이모지)과 함께 2~3어절 짧은 문장을 보여 주고(읽기, 듣기 TTS), 글자(음절)
 * 하나씩 따라 쓴다(커버리지 완성). 문장의 모든 글자를 다 쓰면 '문장 완성' 보너스.
 * 단어→문장으로 가는 다음 단계.
 */
const SENTENCES = [
  { text: '나는 아기', emoji: '👶' },
  { text: '엄마 사랑해', emoji: '❤️' },
  { text: '아빠 최고', emoji: '👍' },
  { text: '나비 날아', emoji: '🦋' },
  { text: '토끼 깡충', emoji: '🐰' },
  { text: '사과 먹어', emoji: '🍎' },
  { text: '비가 와요', emoji: '🌧️' },
  { text: '해가 떠요', emoji: '☀️' },
  { text: '별이 많아', emoji: '⭐' },
  { text: '꽃이 펴요', emoji: '🌸' },
  { text: '강아지 멍멍', emoji: '🐶' },
  { text: '고양이 야옹', emoji: '🐱' },
  { text: '바다 가자', emoji: '🌊' },
  { text: '노래 불러', emoji: '🎵' },
  { text: '손을 씻어', emoji: '🧼' },
  { text: '책을 읽어', emoji: '📖' },
  { text: '친구 좋아', emoji: '🧒' },
  { text: '우유 마셔', emoji: '🥛' }
];

const TRACE_SENTENCE_PEN = '#be3974';
const TRACE_SENTENCE_GUIDE = 'rgba(167, 139, 250, 0.55)';

class SentenceMode {
  constructor() {
    this.cards = (typeof traceShuffleArray === 'function') ? traceShuffleArray(SENTENCES) : SENTENCES.slice();
    this.sentenceIdx = 0;
    this.syllableIdx = 0;
    this.doneSet = new Set();        // `${sentenceIdx}:${syllableIdx}`
    this.guideLayer = null;
    this.canvas = null;
    this.wrapper = null;
    this.isDrawing = false;
    this._wrapRo = null;
    this._wrapRoRaf = 0;
    this.init();
  }

  _card() { return this.cards[this.sentenceIdx] || { text: '', emoji: '' }; }
  _chars() { return Array.from(this._card().text); }
  /** 공백을 뺀 '따라쓸' 글자들의 (chars 내) 인덱스 목록. */
  _traceIdxs() {
    const out = [];
    this._chars().forEach((ch, i) => { if (ch.trim()) out.push(i); });
    return out;
  }
  _currentChar() {
    const ti = this._traceIdxs();
    if (ti.length === 0) return '';
    const i = Math.min(this.syllableIdx, ti.length - 1);
    return this._chars()[ti[i]] || '';
  }

  init() {
    this.guideLayer = new DrawingCanvas('sn-guide-canvas', 'sn-canvas-wrap');
    this.canvas = new DrawingCanvas('sn-draw-canvas', 'sn-canvas-wrap');
    this.wrapper = document.getElementById('sn-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = { resize() { self._syncCanvases(true); } };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceSentenceRO && typeof window.__traceSentenceRO.disconnect === 'function') {
        try { window.__traceSentenceRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceSentenceRO = null;
      }
      this._wrapRo = new ResizeObserver(() => {
        if (self._wrapRoRaf) cancelAnimationFrame(self._wrapRoRaf);
        self._wrapRoRaf = requestAnimationFrame(() => {
          self._wrapRoRaf = 0;
          const r = self.wrapper.getBoundingClientRect();
          if (r.width >= 8 && r.height >= 8) self._syncCanvases(true);
        });
      });
      this._wrapRo.observe(this.wrapper);
      window.__traceSentenceRO = this._wrapRo;
    }

    this.setupEvents();
    this.updateUI();
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) this._syncCanvases();
    });
    window.sentenceMode = this;
  }

  _reflowWhenReady() {
    const go = () => {
      if (!this.wrapper) return;
      if (this.wrapper.clientWidth < 1) { if (this.wrapper.offsetParent === null) return; requestAnimationFrame(go); return; }
      if (this.guideLayer.canvas.width < 2) this._syncCanvases();
    };
    requestAnimationFrame(go);
  }

  _syncCanvases(preserveInk = false) {
    if (!this.guideLayer || !this.canvas) return;
    const ch = this._currentChar();
    this.guideLayer.resize();
    this.guideLayer.clear();
    if (ch) this.guideLayer.drawGuide(ch, TRACE_SENTENCE_GUIDE);
    if (preserveInk) {
      this.canvas.resize({ preserveInk: true });
    } else {
      this.canvas.resize();
      this.canvas.clear();
    }
  }

  _renderHeader() {
    const card = this._card();
    const emojiEl = document.getElementById('sn-emoji');
    if (emojiEl) emojiEl.textContent = card.emoji;
    const textEl = document.getElementById('sn-text');
    if (textEl) {
      const ti = this._traceIdxs();
      const curPos = ti[Math.min(this.syllableIdx, ti.length - 1)];
      textEl.innerHTML = '';
      this._chars().forEach((ch, i) => {
        if (!ch.trim()) {
          textEl.appendChild(document.createTextNode(' '));
          return;
        }
        const span = document.createElement('span');
        span.className = 'sn-syl' + (i === curPos ? ' current' : '') + (this.doneSet.has(`${this.sentenceIdx}:${ti.indexOf(i)}`) ? ' done' : '');
        span.textContent = ch;
        textEl.appendChild(span);
      });
    }
  }

  updateUI() {
    this._resetDrawingState();
    const ch = this._currentChar();
    const ti = this._traceIdxs();
    const labelEl = document.getElementById('sn-label');
    if (labelEl) labelEl.textContent = ch;
    const subEl = document.getElementById('sn-sub');
    if (subEl) {
      subEl.textContent = `문장 ${this.sentenceIdx + 1} / ${this.cards.length} · 글자 ${this.syllableIdx + 1} / ${ti.length}`;
    }
    const cp = document.getElementById('sn-complete');
    if (cp) cp.textContent = '';
    this._renderHeader();
    this._syncCanvases();
    this.updateFeedback();
    if (typeof TraceTTS !== 'undefined') TraceTTS.speakAuto(ch);
  }

  updateFeedback() {
    const fb = document.getElementById('sn-feedback');
    if (!fb) return null;
    const ch = this._currentChar();
    if (!ch) { fb.innerHTML = ''; return null; }
    const cov = traceCoverageStep(this.canvas.canvas, this.guideLayer, ch, { row: false });
    fb.style.color = '';
    fb.innerHTML = traceRenderCoverage(cov.progress, cov.done, { doneText: '잘 썼어요! 🎉 다음 글자 ▶' });
    return cov;
  }

  _sentenceAllDone() {
    const ti = this._traceIdxs();
    for (let i = 0; i < ti.length; i++) {
      if (!this.doneSet.has(`${this.sentenceIdx}:${i}`)) return false;
    }
    return ti.length > 0;
  }

  _onSyllableComplete() {
    const key = `${this.sentenceIdx}:${this.syllableIdx}`;
    if (this.doneSet.has(key)) return;
    this.doneSet.add(key);
    if (typeof TraceSound !== 'undefined') TraceSound.complete();
    if (typeof TraceRewards !== 'undefined') TraceRewards.award(10);
    this._renderHeader();
    const cp = document.getElementById('sn-complete');
    if (this._sentenceAllDone()) {
      if (cp) cp.textContent = `${this._card().text} 완성! 🎉`;
      if (typeof TraceRewards !== 'undefined') TraceRewards.award(10); // 문장 완성 보너스
    } else if (cp) {
      cp.textContent = `${this._currentChar()} ✓`;
    }
  }

  setupEvents() {
    this._strokeTracker = makeStrokeTracker(this.canvas.canvas);

    rebindButtonClickById('sn-clear-btn', () => {
      this.canvas.clear();
      this.updateFeedback();
    });
    rebindButtonClickById('sn-listen-btn', () => {
      if (typeof TraceTTS !== 'undefined') TraceTTS.speak(this._card().text);
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, TRACE_SENTENCE_PEN, 6);
    };
    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const cur = this.canvas.getPos(e);
      this._strokeTracker.move(cur);
      this.canvas.drawLine(this.canvas.lastX, this.canvas.lastY, cur.x, cur.y, TRACE_SENTENCE_PEN);
      this.canvas.lastX = cur.x;
      this.canvas.lastY = cur.y;
    };
    const onPointerUp = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      this._strokeTracker.end();
      const cov = this.updateFeedback();
      if (cov && cov.done) this._onSyllableComplete();
    };
    const drawCanvas = document.getElementById('sn-draw-canvas');
    if (drawCanvas) {
      attachCanvasPointerDrawing(drawCanvas, { onDown: onPointerDown, onMove: onPointerMove, onUp: onPointerUp });
    }
  }

  _resetDrawingState() {
    this.isDrawing = false;
    if (this.canvas) { this.canvas.lastX = 0; this.canvas.lastY = 0; }
    if (this._strokeTracker && typeof this._strokeTracker.cancel === 'function') {
      try { this._strokeTracker.cancel(); } catch (_) { /* ignore */ }
    }
    const cp = document.getElementById('sn-complete');
    if (cp) cp.textContent = '';
  }

  prev() {
    this._resetDrawingState();
    const ti = this._traceIdxs();
    if (this.syllableIdx > 0) {
      this.syllableIdx--;
    } else {
      this.sentenceIdx = (this.sentenceIdx - 1 + this.cards.length) % this.cards.length;
      this.syllableIdx = Math.max(0, this._traceIdxs().length - 1);
    }
    void ti;
    this.updateUI();
  }

  next() {
    this._resetDrawingState();
    const ti = this._traceIdxs();
    if (this.syllableIdx < ti.length - 1) {
      this.syllableIdx++;
    } else {
      this.sentenceIdx = (this.sentenceIdx + 1) % this.cards.length;
      this.syllableIdx = 0;
    }
    this.updateUI();
  }
}
