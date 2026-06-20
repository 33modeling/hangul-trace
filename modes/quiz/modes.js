/*
 * 퀴즈 모드 — 뜻↔단어 양방향 4지선다(받아쓰기·뜻맞히기 보조).
 *
 * 소중한글식 이해/암기 점검: 음원 없이 텍스트·그림으로
 *   - 뜻 맞히기: 그림+뜻을 보고 알맞은 "단어"를 고른다.
 *   - 단어 맞히기: 단어를 보고 알맞은 "뜻"을 고른다.
 * 정답을 누르면 점수가 오르고 잠시 뒤 다음 문제로 넘어간다. 캔버스 없음.
 */
class QuizMode {
  constructor() {
    this.qType = 'meaning'; // 'meaning'(뜻→단어) | 'word'(단어→뜻)
    this.score = 0;
    this.current = null;    // { answer, options }
    this.locked = false;    // 정답 후 보기 잠금
    this._advanceTimer = null;

    this.init();
  }

  init() {
    this.setupToggle();
    rebindButtonClickById('quiz-next-btn', () => this.nextQuestion());
    this.score = 0;
    this._updateScore();
    this.nextQuestion();
    window.quizMode = this;
  }

  _pool() {
    return (typeof TRACE_VOCAB !== 'undefined') ? TRACE_VOCAB : [];
  }

  setupToggle() {
    this.typeButtons = document.querySelectorAll('.quiz-type-btn');
    const sync = () => {
      this.typeButtons.forEach((b) => {
        const on = b.dataset.qtype === this.qType;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    };
    sync();
    this.typeButtons.forEach((btn) => {
      btn.onclick = () => {
        if (!btn.dataset.qtype) return;
        this.qType = btn.dataset.qtype;
        sync();
        this.nextQuestion();
      };
    });
  }

  /** 진행 중 자동 넘김 타이머 정리 — 모드 이탈 시에도 호출(누수 방지). */
  clearTimer() {
    if (this._advanceTimer) {
      clearTimeout(this._advanceTimer);
      this._advanceTimer = null;
    }
  }

  nextQuestion() {
    this.clearTimer();
    this.locked = false;
    const pool = this._pool();
    if (pool.length < 4) {
      const promptEl = document.getElementById('quiz-prompt');
      if (promptEl) promptEl.textContent = '문제를 낼 단어가 부족해요.';
      return;
    }
    const answer = traceShuffleArray(pool)[0];
    const distractors = traceVocabDistractors(answer.word, 3);
    const options = traceShuffleArray([answer].concat(distractors));
    this.current = { answer, options };
    this._renderQuestion();
  }

  _renderQuestion() {
    const promptEl = document.getElementById('quiz-prompt');
    const optionsEl = document.getElementById('quiz-options');
    const fbEl = document.getElementById('quiz-feedback');
    if (fbEl) {
      fbEl.textContent = '';
      fbEl.style.color = '';
    }
    if (!this.current) return;
    const { answer, options } = this.current;

    if (promptEl) {
      if (this.qType === 'meaning') {
        promptEl.innerHTML =
          `<span class="quiz-emoji" aria-hidden="true">${answer.emoji}</span>`
          + `<span class="quiz-q-meaning">${answer.meaning}</span>`
          + `<span class="quiz-q-ask">이 단어는 무엇일까요?</span>`;
      } else {
        promptEl.innerHTML =
          `<span class="quiz-q-word">${answer.word}</span>`
          + `<span class="quiz-q-ask">무슨 뜻일까요?</span>`;
      }
    }

    if (optionsEl) {
      // 뜻 보기는 길어 한 줄에 하나씩, 단어 보기는 2열.
      optionsEl.className = 'quiz-options' + (this.qType === 'word' ? ' quiz-options-single' : '');
      optionsEl.innerHTML = '';
      const frag = document.createDocumentFragment();
      options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-option';
        btn.dataset.word = opt.word;
        if (this.qType === 'meaning') {
          // 보기 = 단어. textContent 로 안전하게(데이터는 정적이지만 일관성).
          btn.textContent = opt.word;
        } else {
          const em = document.createElement('span');
          em.className = 'quiz-opt-emoji';
          em.setAttribute('aria-hidden', 'true');
          em.textContent = opt.emoji;
          const tx = document.createElement('span');
          tx.textContent = opt.meaning;
          btn.appendChild(em);
          btn.appendChild(tx);
        }
        btn.addEventListener('click', () => this._choose(opt, btn), { passive: true });
        frag.appendChild(btn);
      });
      optionsEl.appendChild(frag);
    }
  }

  _choose(opt, btn) {
    if (this.locked) return;
    const correct = opt.word === this.current.answer.word;
    const fbEl = document.getElementById('quiz-feedback');
    if (correct) {
      this.locked = true;
      btn.classList.add('correct');
      this.score++;
      this._updateScore();
      if (fbEl) {
        fbEl.textContent = '정답이에요! 🎉';
        fbEl.style.color = 'var(--trace-success)';
      }
      document.querySelectorAll('.quiz-option').forEach((b) => {
        b.disabled = true;
        if (b !== btn) b.classList.add('dim');
      });
      if (typeof TraceSound !== 'undefined') TraceSound.complete();
      this._advanceTimer = setTimeout(() => {
        this._advanceTimer = null;
        this.nextQuestion();
      }, 1100);
    } else {
      btn.classList.add('wrong');
      btn.disabled = true;
      if (fbEl) {
        fbEl.textContent = '다시 한 번 골라 볼까요?';
        fbEl.style.color = 'var(--trace-danger)';
      }
    }
  }

  _updateScore() {
    const el = document.getElementById('quiz-score');
    if (el) el.textContent = `맞은 개수 ${this.score}`;
  }
}
