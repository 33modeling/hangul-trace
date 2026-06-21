/*
 * 복습 모드 — 약점 집중.
 *
 * 아직 완료하지 못한 자모·숫자·알파벳을 한곳에 모아(완료 진도의 역집합) 섞어서
 * 따라쓰기로 복습한다. 완성하면 해당 카테고리의 완료 진도에도 그대로 반영되고
 * (자모/숫자/알파벳 모드·나의 기록에 즉시 반영) 보상을 받는다. 큐는 완료할수록
 * 줄어든다. 모두 익혔으면 친절한 빈 상태 + '그래도 한 번 더' 옵션.
 *
 * 데이터: 기존 done-set localStorage 키를 읽어 미완료 항목을 모은다.
 *   자모 tracing.done.char.v1(24) · 숫자 .number.v1(10) ·
 *   알파벳 .english.upper.v1(26) / .lower.v1(26)
 */
const TRACE_REVIEW_PEN = '#be3974';

class ReviewMode {
  constructor() {
    this.queue = [];
    this.currentIdx = 0;
    this.extra = false;       // 다 익힌 뒤 '그래도 복습' 모드(진도와 무관)
    this.guideLayer = null;
    this.canvas = null;
    this.wrapper = null;
    this.isDrawing = false;
    this._wrapRo = null;
    this._wrapRoRaf = 0;
    this._advanceTimer = null;
    this._advancing = false;  // 완성→다음 넘김 중 입력 잠금

    this.init();
  }

  _categories() {
    const cats = [];
    if (typeof COMMON !== 'undefined' && Array.isArray(COMMON.CHARS)) {
      cats.push({ items: COMMON.CHARS, key: 'tracing.done.char.v1', label: '자음/모음', hasName: true });
    }
    if (typeof NUMBERS !== 'undefined' && Array.isArray(NUMBERS)) {
      cats.push({ items: NUMBERS, key: 'tracing.done.number.v1', label: '숫자', hasName: true });
    }
    if (typeof UPPERCASE !== 'undefined' && Array.isArray(UPPERCASE)) {
      cats.push({ items: UPPERCASE, key: 'tracing.done.english.upper.v1', label: '알파벳 대문자', hasName: false });
    }
    if (typeof LOWERCASE !== 'undefined' && Array.isArray(LOWERCASE)) {
      cats.push({ items: LOWERCASE, key: 'tracing.done.english.lower.v1', label: '알파벳 소문자', hasName: false });
    }
    return cats;
  }

  _doneSet(key) {
    const arr = (typeof Utils !== 'undefined') ? Utils.loadLocal(key, []) : [];
    return new Set(Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n)) : []);
  }

  /** 미완료 항목 큐 생성(없으면 빈 배열). */
  _buildQueue() {
    const q = [];
    this._categories().forEach((cat) => {
      const done = this._doneSet(cat.key);
      cat.items.forEach((it, idx) => {
        if (!done.has(idx)) {
          q.push({ ch: it.ch, name: cat.hasName ? it.name : '', cat: cat.label, key: cat.key, idx });
        }
      });
    });
    return (typeof traceShuffleArray === 'function') ? traceShuffleArray(q) : q;
  }

  /** 다 익힌 경우용 — 전체에서 무작위 12개(진도 반영 안 함). */
  _buildExtraQueue() {
    const all = [];
    this._categories().forEach((cat) => {
      cat.items.forEach((it, idx) => {
        all.push({ ch: it.ch, name: cat.hasName ? it.name : '', cat: cat.label, key: cat.key, idx });
      });
    });
    const shuffled = (typeof traceShuffleArray === 'function') ? traceShuffleArray(all) : all;
    return shuffled.slice(0, 12);
  }

  _current() {
    return this.queue[this.currentIdx] || null;
  }

  init() {
    this.guideLayer = new DrawingCanvas('rv-guide-canvas', 'rv-canvas-wrap');
    this.canvas = new DrawingCanvas('rv-draw-canvas', 'rv-canvas-wrap');
    this.wrapper = document.getElementById('rv-canvas-wrap');
    const self = this;
    if (this.wrapper) {
      this.wrapper.canvasObj = {
        resize() { self._syncCanvases(true); }
      };
    }
    if (typeof ResizeObserver !== 'undefined' && this.wrapper) {
      if (window.__traceReviewRO && typeof window.__traceReviewRO.disconnect === 'function') {
        try { window.__traceReviewRO.disconnect(); } catch (_e) { /* ignore */ }
        window.__traceReviewRO = null;
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
      window.__traceReviewRO = this._wrapRo;
    }

    this.queue = this._buildQueue();
    this.extra = false;
    this.currentIdx = 0;

    this.setupEvents();
    this.updateUI();
    this._reflowWhenReady();
    traceWaitForFonts(() => {
      if (this.wrapper && this.wrapper.clientWidth > 0) this._syncCanvases();
    });
    window.reviewMode = this;
  }

  _reflowWhenReady() {
    const go = () => {
      if (!this.wrapper) return;
      if (this.wrapper.clientWidth < 1) { requestAnimationFrame(go); return; }
      if (this.guideLayer.canvas.width < 2) this._syncCanvases();
    };
    requestAnimationFrame(go);
  }

  /** 자동 넘김 타이머 정리(모드 이탈 시에도). */
  clearTimer() {
    if (this._advanceTimer) { clearTimeout(this._advanceTimer); this._advanceTimer = null; }
  }

  _syncCanvases(preserveInk = false) {
    if (!this.guideLayer || !this.canvas) return;
    if (typeof cancelStrokeOrderAnim === 'function') cancelStrokeOrderAnim(this.guideLayer);
    const it = this._current();
    this.guideLayer.resize();
    this.guideLayer.clear();
    if (it) this.guideLayer.drawGuide(it.ch);
    if (preserveInk) {
      this.canvas.resize({ preserveInk: true });
    } else {
      this.canvas.resize();
      this.canvas.clear();
    }
  }

  _setHidden(id, hidden) {
    const el = document.getElementById(id);
    if (el) el.hidden = !!hidden;
  }

  updateUI() {
    this._resetDrawingState();
    this.clearTimer();
    const empty = this.queue.length === 0;
    const emptyEl = document.getElementById('review-empty');
    const wrapEl = document.getElementById('rv-canvas-wrap');
    const navEl = document.getElementById('rv-nav');
    const tbEl = document.getElementById('rv-toolbar');

    if (empty) {
      if (emptyEl) emptyEl.hidden = false;
      if (wrapEl) wrapEl.style.display = 'none';
      if (navEl) navEl.style.display = 'none';
      if (tbEl) tbEl.style.display = 'none';
      const fb = document.getElementById('rv-feedback');
      if (fb) fb.innerHTML = '';
      const cp = document.getElementById('rv-complete');
      if (cp) cp.textContent = '';
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    if (wrapEl) wrapEl.style.display = '';
    if (navEl) navEl.style.display = '';
    if (tbEl) tbEl.style.display = '';

    if (this.currentIdx >= this.queue.length) this.currentIdx = 0;
    const it = this._current();
    const labelEl = document.getElementById('rv-label');
    if (labelEl) labelEl.textContent = it.name ? `${it.ch} · ${it.name}` : it.ch;
    const subEl = document.getElementById('rv-sub');
    if (subEl) {
      const head = this.extra ? '복습(한 번 더)' : '복습';
      subEl.textContent = `${head} ${this.currentIdx + 1} / ${this.queue.length} · ${it.cat}`;
    }
    const cp = document.getElementById('rv-complete');
    if (cp) cp.textContent = '';
    const hint = document.getElementById('rv-stroke-hint');
    if (hint) {
      hint.innerHTML = `<span class="hint-pill">남은 복습 ${this.queue.length}개</span><span class="hint-pill">따라 써서 익혀요</span>`;
    }

    this._syncCanvases();
    this.updateFeedback();
    if (typeof TraceTTS !== 'undefined') TraceTTS.speakAuto(it.ch);
  }

  updateFeedback() {
    const fb = document.getElementById('rv-feedback');
    if (!fb) return null;
    const it = this._current();
    if (!it) { fb.innerHTML = ''; return null; }
    const cov = traceCoverageStep(this.canvas.canvas, this.guideLayer, it.ch, { row: false });
    fb.style.color = '';
    fb.innerHTML = traceRenderCoverage(cov.progress, cov.done, { doneText: '익혔어요! 🎉' });
    return cov;
  }

  /** 완성 처리 — 진도 저장 + 보상 + 큐에서 제거 후 다음으로. */
  _onComplete() {
    const it = this._current();
    if (!it) return;
    if (!this.extra) {
      // 해당 카테고리 완료 진도에 반영(자모/숫자/알파벳·나의 기록에 즉시 반영)
      const done = this._doneSet(it.key);
      done.add(it.idx);
      if (typeof traceSaveDone === 'function') traceSaveDone(it.key, done);
    }
    if (typeof TraceSound !== 'undefined') TraceSound.complete();
    if (typeof TraceRewards !== 'undefined') TraceRewards.award(10);
    const cp = document.getElementById('rv-complete');
    if (cp) cp.textContent = `${it.ch} ✓`;

    // 큐에서 '즉시' 제거(취소 불가) — 완료 글자가 큐에 남거나, 자동 넘김 중
    // prev/next 를 눌러 splice 가 취소돼 점수가 중복되던 문제 방지. 잠깐(900ms)
    // 완성 표시를 보여 준 뒤 다음 항목으로 넘어가며, 그동안 입력은 잠근다.
    this.queue.splice(this.currentIdx, 1);
    if (this.currentIdx >= this.queue.length) this.currentIdx = 0;
    this._advancing = true;
    this.clearTimer();
    this._advanceTimer = setTimeout(() => {
      this._advanceTimer = null;
      this._advancing = false;
      this.updateUI();
    }, 900);
  }

  setupEvents() {
    this._strokeTracker = makeStrokeTracker(this.canvas.canvas);

    rebindButtonClickById('rv-clear-btn', () => {
      this.canvas.clear();
      this.updateFeedback();
    });
    rebindButtonClickById('rv-hint-btn', () => {
      const it = this._current();
      if (!it) return;
      const strip = document.getElementById('rv-stroke-strip');
      const played = (typeof playStrokeOrderAnim === 'function') && playStrokeOrderAnim(this.guideLayer, it.ch, {
        onStep: (n) => { if (strip && typeof renderStrokeOrderStrip === 'function') renderStrokeOrderStrip(strip, it.ch, n); }
      });
      if (!played && strip && typeof playStrokeOrderStrip === 'function') {
        playStrokeOrderStrip(strip, this.guideLayer, it.ch);
      }
    });
    rebindButtonClickById('rv-speak-btn', () => {
      const it = this._current();
      if (it && typeof TraceTTS !== 'undefined') TraceTTS.speak(it.ch);
    });
    rebindButtonClickById('review-extra-btn', () => {
      this.extra = true;
      this.queue = this._buildExtraQueue();
      this.currentIdx = 0;
      this.updateUI();
    });

    const onPointerDown = (e) => {
      e.preventDefault();
      if (this._advancing) return; // 완성→다음 넘김 중에는 입력 잠금
      const strip = document.getElementById('rv-stroke-strip');
      if (strip && typeof cancelStrokeOrderStrip === 'function') cancelStrokeOrderStrip(strip);
      if (this.guideLayer && this.guideLayer.__soAnim) {
        cancelStrokeOrderAnim(this.guideLayer);
        const it0 = this._current();
        this.guideLayer.clear();
        if (it0) this.guideLayer.drawGuide(it0.ch);
      }
      this.isDrawing = true;
      const pos = this.canvas.getPos(e);
      this.canvas.lastX = pos.x;
      this.canvas.lastY = pos.y;
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, TRACE_REVIEW_PEN, 6);
    };
    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const cur = this.canvas.getPos(e);
      this._strokeTracker.move(cur);
      this.canvas.drawLine(this.canvas.lastX, this.canvas.lastY, cur.x, cur.y, TRACE_REVIEW_PEN);
      this.canvas.lastX = cur.x;
      this.canvas.lastY = cur.y;
    };
    const onPointerUp = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      this._strokeTracker.end();
      const cov = this.updateFeedback();
      // 자동 넘김 진행 중이면(이미 완성 처리됨) 중복 방지
      if (cov && cov.done && !this._advancing) {
        this._onComplete();
      }
    };
    const drawCanvas = document.getElementById('rv-draw-canvas');
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
  }

  goTo(idx) {
    if (this.queue.length === 0 || this._advancing) return; // 넘김 중 나비게이션 무시
    this.clearTimer();
    const n = this.queue.length;
    this.currentIdx = ((idx % n) + n) % n;
    this.updateUI();
  }

  prev() { this.goTo(this.currentIdx - 1); }
  next() { this.goTo(this.currentIdx + 1); }
}
