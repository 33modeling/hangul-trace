/*
 * 상급 단어 모드 — 쌍자음(ㄲ ㄸ ㅃ ㅆ ㅉ), 복잡 모음(ㅙ ㅞ ㅢ ㅒ ㅖ),
 * 어려운 받침(ㄶ ㄺ ㄻ ㄼ ㄾ ㅀ ㅄ) 위주의 고정 단어셋.
 *
 * MyWordMode와 동일한 슬라이딩 윈도우 + 세로 1글자 학습 패턴을
 * 동일하게 적용했고, 데이터 소스만 ADVANCED_WORDS 고정 배열을 사용.
 */
/**
 * 상급 단어 셋 — 카테고리별로 정리되어 있지만, 사용시엔 _shuffledWords() 가
 * Fisher-Yates 로 매번 새로 섞어주기 때문에 순서는 무작위가 된다.
 */
const ADVANCED_WORDS = [
  // ── 쌍자음 시작 (단음절·다음절) ─────────────────────
  '깎다', '까치', '꽉', '꿰다', '꿈', '꽃밭', '꼬리',
  '꼭지', '꼬마', '깜빡', '꼴찌', '꽃잎', '깡통',
  '뽑다', '볶음', '뿌리', '뼈', '뺨', '뻔',
  '뽀뽀', '뿔', '뼘', '빨강', '빵',
  '딸기', '땀', '뚜껑', '뜻', '땅콩', '떡',
  '뚱뚱', '딱지', '띠', '뜀틀',
  '싹', '쌀', '쑥', '씨앗', '쌍둥이', '씁쓸',
  '쏟다', '쑥쑥', '쓸다',
  '짜장', '쪽지', '찜질', '짝꿍', '짖다', '쭉',
  '쩔쩔', '쫀득', '쪼각',

  // ── 복잡 모음 (ㅖ ㅙ ㅞ ㅢ ㅒ) ──────────────────────
  '혜성', '훼손', '예의', '의자', '얘기',
  '계산', '폐기', '제비', '예술', '의사',
  '괘종', '궤도', '왜', '웬일', '뇌', '쇄도',
  '회사', '뇌물', '괴물', '왠지', '왜냐',

  // ── 어려운 받침 (ㄺ ㄶ ㄻ ㄼ ㄾ ㅀ ㅄ) ─────────────
  '닭', '흙', '굵다', '맑다', '읽다', '옳다',
  '닳다', '많다', '않다', '끊다', '귀찮다',
  '끓다', '짧다', '얇다', '값', '몫', '없다', '핥다',
  '삶다', '닮다', '굶다', '밟다', '여덟', '넓다',
  '잃다', '뚫다', '싫다',

  // ── 쌍받침 + 복합 종성 (받침 ㅆ ㄶ ㄶ ㄾ ㅀ) ────────
  '봤다', '갔다', '됐다', '했다', '왔다', '췄다',
  '컸다', '있다', '없었다', '쌌다',

  // ── 어려운 음절 / 일상 단어 ──────────────────────
  '쾌청', '췌장', '꿩', '뺑소니', '뼘',
  '괜찮', '얹다', '얻다', '뀐다', '뀌다',
  '쑥쓰럽', '뺨치다', '깨끗', '뚜렷',

  // ── 자주 틀리는 받침 단어 ────────────────────────
  '입학', '학교', '책상', '연필', '학생',
  '읽기', '듣기', '쓰기', '잡기',
];

const TRACE_ADV_PEN = '#be3974';
const TRACE_ADV_GUIDE = 'rgba(167, 139, 250, 0.55)';

class AdvancedMode {
  constructor() {
    // 매 입장마다 단어 순서를 새로 섞어 새 느낌으로 학습.
    // 원본 ADVANCED_WORDS 는 건드리지 않고 복사본을 shuffle 한다.
    this.words = this._shuffleWords(ADVANCED_WORDS);
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

  /**
   * Fisher-Yates shuffle — 원본 배열은 변경하지 않고 새 배열을 반환.
   * Math.random() 기반이라 cryptographically secure 하진 않지만 학습 순서
   * 무작위화엔 충분.
   */
  _shuffleWords(source) {
    const arr = (Array.isArray(source) ? source : []).slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
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
          self._syncCanvases(true);
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
            self._syncCanvases(true);
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
        // 전환 분기 안에서도 _lastLandscape 갱신 — 후속 resize에서 분기가 반복 재실행
        // 되어 stroke 진행도가 사라지는 버그 방지.
        self._lastLandscape = L;
        return;
      }
      self._lastLandscape = L;
      // 일반 resize 의 캔버스 재동기화는 initCommon 의 전역 resize 리스너
      // (resizeVisibleCanvases → canvasObj.resize)가 담당 — 여기서 또 부르면
      // 같은 캔버스를 매 resize 마다 두 번 그리므로 호출하지 않는다.
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

  _syncCanvases(preserveInk = false) {
    if (!this.guideLayer || !this.canvas) return;
    this.guideLayer.resize();
    // 리사이즈 경로(preserveInk)면 그리던 잉크를 비율 유지로 보존, 그 외는 비움.
    if (preserveInk) {
      this.canvas.resize({ preserveInk: true });
    } else {
      this.canvas.resize();
      this.canvas.clear();
    }

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
    feedbackEl.style.color = '';
    feedbackEl.innerHTML = traceRenderProgress(this.strokeCount, target, {
      doneText: '완성! 🎉 다음은 ▶'
    });
    if (this.strokeCount >= target) {
      const visibleKey = this._isLandscape()
        ? `L:${this.wordIdx}:${this.windowStart}`
        : `P:${this.wordIdx}:${this.syllableIdx}`;
      if (!this.doneSet.has(visibleKey)) {
        this.doneSet.add(visibleKey);
        const w = this.words[this.wordIdx];
        document.getElementById('adv-complete').textContent = `${w} ✓`;
        if (typeof TraceSound !== 'undefined') TraceSound.complete();
      }
    }
  }

  setupEvents() {
    this._strokeTracker = makeStrokeTracker(this.canvas.canvas);

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
      this._strokeTracker.begin(pos);
      this.canvas.drawDot(pos.x, pos.y, TRACE_ADV_PEN, 6);
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
        TRACE_ADV_PEN
      );
      this.canvas.lastX = current.x;
      this.canvas.lastY = current.y;
    };

    const onPointerUp = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      this.isDrawing = false;
      const realStroke = this._strokeTracker.end();
      if (realStroke) {
        this.strokeCount++;
      }
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
    this._resetDrawingState();
    if (this._isLandscape()) {
      // 가로: 한 페이지(=WINDOW_SIZE)씩 왼쪽으로 점프
      if (this.windowStart > 0) {
        this.windowStart = Math.max(0, this.windowStart - TRACE_MY_WORD_WINDOW_SIZE);
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

  /** mid-stroke 이동 시 잔여 상태 정리. */
  _resetDrawingState() {
    this.isDrawing = false;
    if (this.canvas) {
      this.canvas.lastX = 0;
      this.canvas.lastY = 0;
    }
    if (this._strokeTracker && typeof this._strokeTracker.cancel === 'function') {
      try { this._strokeTracker.cancel(); } catch (_) {}
    }
    const wc = document.getElementById('adv-complete');
    if (wc) wc.textContent = '';
  }

  next() {
    this._resetDrawingState();
    if (this._isLandscape()) {
      // 가로: 한 페이지(=WINDOW_SIZE)씩 오른쪽으로 점프
      const sylLen = this._syllables().length;
      const maxStart = Math.max(0, sylLen - TRACE_MY_WORD_WINDOW_SIZE);
      if (this.windowStart < maxStart) {
        this.windowStart = Math.min(maxStart, this.windowStart + TRACE_MY_WORD_WINDOW_SIZE);
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
