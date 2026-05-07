class MyWordAddMode {
  constructor() {
    this.words = traceLoadMyWords();
    this.init();
  }

  init() {
    this.words = traceLoadMyWords();
    this.renderList();
    this.bindForm();
    window.myWordAddMode = this;
  }

  _updateCounter() {
    const el = document.getElementById('myword-add-counter');
    if (el) {
      el.textContent = `${this.words.length} / ${TRACE_MY_WORDS_MAX_COUNT}`;
      el.classList.toggle('full', this.words.length >= TRACE_MY_WORDS_MAX_COUNT);
    }
    const input = document.getElementById('myword-add-input');
    const submit = document.getElementById('myword-add-submit');
    const full = this.words.length >= TRACE_MY_WORDS_MAX_COUNT;
    if (input) input.disabled = full;
    if (submit) submit.disabled = full;
  }

  bindForm() {
    const input = document.getElementById('myword-add-input');
    const msg = document.getElementById('myword-add-msg');

    const goMenu = () => {
      if (typeof window.showMainMenu === 'function') {
        window.showMainMenu();
      }
    };
    wireButtonById('myword-add-menu-btn', goMenu);
    wireButtonById('myword-add-back-btn', goMenu);

    rebindButtonClickById('myword-add-submit', () => {
      if (this.words.length >= TRACE_MY_WORDS_MAX_COUNT) {
        if (msg) {
          msg.textContent = `단어는 최대 ${TRACE_MY_WORDS_MAX_COUNT}개까지만 등록할 수 있어요. 기존 단어를 지운 뒤 다시 시도해 주세요.`;
          msg.style.color = '#c44';
        }
        return;
      }
      const raw = input ? input.value : '';
      const res = traceValidateMyWordInput(raw);
      if (!res.valid) {
        if (msg) {
          msg.textContent = res.message || '';
          msg.style.color = '#c44';
        }
        return;
      }
      if (this.words.includes(res.word)) {
        if (msg) {
          msg.textContent = '이미 목록에 있는 단어예요.';
          msg.style.color = '#a60';
        }
        return;
      }
      this.words.push(res.word);
      traceSaveMyWords(this.words);
      if (input) input.value = '';
      if (msg) {
        msg.textContent = `「${res.word}」을(를) 추가했어요.`;
        msg.style.color = '#2a7';
      }
      this.renderList();
    });

    const listEl = document.getElementById('myword-add-list');
    if (listEl && !listEl.__traceDelegated) {
      listEl.__traceDelegated = true;
      listEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn || !listEl.contains(btn)) return;
        const li = btn.closest('li[data-index]');
        if (!li) return;
        const idx = parseInt(li.getAttribute('data-index'), 10);
        if (Number.isNaN(idx) || idx < 0 || idx >= this.words.length) return;

        const action = btn.getAttribute('data-action');
        if (action === 'del') {
          this.words.splice(idx, 1);
          traceSaveMyWords(this.words);
          if (msg) msg.textContent = '';
          this.renderList();
          return;
        }
        if (action === 'up' && idx > 0) {
          const t = this.words[idx - 1];
          this.words[idx - 1] = this.words[idx];
          this.words[idx] = t;
          traceSaveMyWords(this.words);
          if (msg) msg.textContent = '';
          this.renderList();
          return;
        }
        if (action === 'down' && idx < this.words.length - 1) {
          const t = this.words[idx + 1];
          this.words[idx + 1] = this.words[idx];
          this.words[idx] = t;
          traceSaveMyWords(this.words);
          if (msg) msg.textContent = '';
          this.renderList();
        }
      });
    }
  }

  renderList() {
    this.words = traceLoadMyWords();
    const listEl = document.getElementById('myword-add-list');
    this._updateCounter();
    if (!listEl) return;
    listEl.innerHTML = '';
    if (this.words.length === 0) {
      const li = document.createElement('li');
      li.className = 'myword-add-empty';
      li.textContent = '등록된 단어가 없어요. 위에서 추가해 보세요.';
      listEl.appendChild(li);
      return;
    }
    this.words.forEach((w, i) => {
      const li = document.createElement('li');
      li.className = 'myword-add-row';
      li.setAttribute('data-index', String(i));
      li.innerHTML = `
        <span class="myword-add-word">${w}</span>
        <span class="myword-add-actions">
          <button type="button" class="tool-btn myword-add-mini" data-action="up" aria-label="위로" ${i === 0 ? 'disabled' : ''}>위</button>
          <button type="button" class="tool-btn myword-add-mini" data-action="down" aria-label="아래로" ${i === this.words.length - 1 ? 'disabled' : ''}>아래</button>
          <button type="button" class="tool-btn myword-add-mini" data-action="del" aria-label="삭제">삭제</button>
        </span>
      `;
      listEl.appendChild(li);
    });
  }
}
