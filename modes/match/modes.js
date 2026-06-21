/*
 * 짝맞추기 미니게임 — 단어↔그림 기억 게임.
 *
 * 6쌍(단어 카드 + 그림 카드) 12장을 뒤집어 놓고, 두 장을 뒤집어 같은 단어면
 * 짝(맞음)으로 남는다. 다 맞히면 보상. 기존 어휘를 재사용한 가벼운 놀이.
 */
const TRACE_MATCH_PAIRS = 6;

class MatchMode {
  constructor() {
    this.cards = [];
    this.flipped = [];
    this.matched = new Set();
    this.lock = false;
    this.moves = 0;
    this._timer = null;
    this.init();
  }

  init() {
    rebindButtonClickById('match-new-btn', () => this._newGame());
    this._newGame();
    window.matchMode = this;
  }

  clearTimer() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  _newGame() {
    this.clearTimer();
    const pool = (typeof TRACE_VOCAB !== 'undefined') ? TRACE_VOCAB : [];
    const picks = (typeof traceShuffleArray === 'function' ? traceShuffleArray(pool) : pool.slice()).slice(0, TRACE_MATCH_PAIRS);
    const cards = [];
    picks.forEach((it, pid) => {
      cards.push({ pid, face: 'word', word: it.word, emoji: it.emoji });
      cards.push({ pid, face: 'emoji', word: it.word, emoji: it.emoji });
    });
    this.cards = (typeof traceShuffleArray === 'function') ? traceShuffleArray(cards) : cards;
    this.flipped = [];
    this.matched = new Set();
    this.lock = false;
    this.moves = 0;
    this._render();
    this._updateStatus();
  }

  _updateStatus() {
    const el = document.getElementById('match-status');
    if (el) {
      const left = TRACE_MATCH_PAIRS - this.matched.size / 2;
      el.textContent = `남은 짝 ${left} · 시도 ${this.moves}`;
    }
  }

  _faceText(i) {
    const c = this.cards[i];
    const up = this.flipped.indexOf(i) >= 0 || this.matched.has(i);
    if (!up) return '';
    return c.face === 'emoji' ? c.emoji : c.word;
  }

  _render() {
    const grid = document.getElementById('match-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    this.cards.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      const up = this.flipped.indexOf(i) >= 0 || this.matched.has(i);
      b.className = 'match-card' + (up ? ' up' : '') + (this.matched.has(i) ? ' matched' : '')
        + (c.face === 'emoji' ? ' is-emoji' : ' is-word');
      b.dataset.idx = String(i);
      b.setAttribute('aria-label', up ? this._faceText(i) : '뒤집힌 카드');
      b.textContent = up ? this._faceText(i) : '?';
      b.addEventListener('click', () => this._onCard(i), { passive: true });
      frag.appendChild(b);
    });
    grid.appendChild(frag);
  }

  _refreshCard(i) {
    const grid = document.getElementById('match-grid');
    if (!grid) return;
    const b = grid.querySelector(`.match-card[data-idx="${i}"]`);
    if (!b) return;
    const c = this.cards[i];
    const up = this.flipped.indexOf(i) >= 0 || this.matched.has(i);
    b.className = 'match-card' + (up ? ' up' : '') + (this.matched.has(i) ? ' matched' : '')
      + (c.face === 'emoji' ? ' is-emoji' : ' is-word');
    b.textContent = up ? this._faceText(i) : '?';
    b.setAttribute('aria-label', up ? this._faceText(i) : '뒤집힌 카드');
  }

  _onCard(i) {
    if (this.lock) return;
    if (this.matched.has(i)) return;
    if (this.flipped.indexOf(i) >= 0) return;
    if (this.flipped.length >= 2) return;
    this.flipped.push(i);
    this._refreshCard(i);
    if (this.flipped.length === 2) {
      this.moves++;
      this._updateStatus();
      this._check();
    }
  }

  _check() {
    const [a, b] = this.flipped;
    if (this.cards[a].pid === this.cards[b].pid) {
      // 짝 맞음
      this.matched.add(a);
      this.matched.add(b);
      this.flipped = [];
      this._refreshCard(a);
      this._refreshCard(b);
      this._updateStatus();
      if (typeof TraceSound !== 'undefined') TraceSound.complete();
      if (typeof TraceRewards !== 'undefined') TraceRewards.award(6);
      if (this.matched.size === this.cards.length) {
        const st = document.getElementById('match-status');
        if (st) st.textContent = `다 맞혔어요! 🎉 (시도 ${this.moves})`;
        if (typeof TraceRewards !== 'undefined') TraceRewards.award(15);
      }
    } else {
      // 안 맞음 — 잠깐 보여 주고 다시 뒤집기
      this.lock = true;
      this._timer = setTimeout(() => {
        this._timer = null;
        const f = this.flipped.slice();
        this.flipped = [];
        f.forEach((idx) => this._refreshCard(idx));
        this.lock = false;
      }, 800);
    }
  }
}
