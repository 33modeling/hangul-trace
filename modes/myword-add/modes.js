class MyWordAddMode {
  constructor() {
    this.words = traceLoadMyWords();
    this.kind = 'ko'; // 'ko' | 'en' — 입력 종류 토글
    this.init();
  }

  init() {
    this.words = traceLoadMyWords();
    this.renderList();
    this.bindForm();
    this._applyKindUI();
    window.myWordAddMode = this;
  }

  _applyKindUI() {
    const buttons = document.querySelectorAll('.myword-kind-btn');
    buttons.forEach((b) => {
      b.classList.toggle('active', b.dataset.kind === this.kind);
      b.setAttribute('aria-pressed', b.dataset.kind === this.kind ? 'true' : 'false');
    });
    const input = document.getElementById('myword-add-input');
    if (input) {
      input.placeholder = this.kind === 'en'
        ? '영단어 입력 (1~20글자, a-z / A-Z)'
        : '단어 입력 (1~20글자, 한글)';
      input.value = '';
    }
    const msg = document.getElementById('myword-add-msg');
    if (msg) msg.textContent = '';
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

    // 한글/영문 토글
    const kindButtons = document.querySelectorAll('.myword-kind-btn');
    kindButtons.forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const next = btn.dataset.kind === 'en' ? 'en' : 'ko';
        if (next === this.kind) return;
        this.kind = next;
        this._applyKindUI();
      };
    });

    const submitWord = () => {
      if (this.words.length >= TRACE_MY_WORDS_MAX_COUNT) {
        if (msg) {
          msg.textContent = `단어는 최대 ${TRACE_MY_WORDS_MAX_COUNT}개까지만 등록할 수 있어요. 기존 단어를 지운 뒤 다시 시도해 주세요.`;
          msg.style.color = '#c44';
        }
        return;
      }
      const raw = input ? input.value : '';
      const res = traceValidateMyWordInput(raw, this.kind);
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
      // 저장 직전 최신 스토리지로 재로드(#6) — 다른 탭이 그새 추가/삭제했을 수 있어
      // in-memory 스냅샷에 push 하면 상대 탭의 변경을 덮어쓴다. 재로드 후 한도·중복을
      // 다시 확인한 다음 저장한다.
      const latest = traceLoadMyWords();
      if (latest.length >= TRACE_MY_WORDS_MAX_COUNT) {
        if (msg) {
          msg.textContent = `단어는 최대 ${TRACE_MY_WORDS_MAX_COUNT}개까지만 등록할 수 있어요. 기존 단어를 지운 뒤 다시 시도해 주세요.`;
          msg.style.color = '#c44';
        }
        this.renderList();
        return;
      }
      if (latest.includes(res.word)) {
        if (msg) {
          msg.textContent = '이미 목록에 있는 단어예요.';
          msg.style.color = '#a60';
        }
        this.renderList();
        return;
      }
      latest.push(res.word);
      const saved = traceSaveMyWords(latest);
      // 저장이 실패하면(용량 초과·사파리 사생활모드 등) 단어가 새로고침 후
      // 사라지므로, 성공으로 안내하지 않고 실패를 알린다. renderList()가
      // 스토리지 기준으로 메모리 목록을 되돌린다.
      if (!saved) {
        if (msg) {
          msg.textContent = '저장 공간이 부족해 단어를 추가하지 못했어요. 기존 단어를 지운 뒤 다시 시도해 주세요.';
          msg.style.color = '#c44';
        }
        this.renderList();
        return;
      }
      if (input) input.value = '';
      if (msg) {
        msg.textContent = `「${res.word}」을(를) 추가했어요.`;
        msg.style.color = '#2a7';
      }
      this.renderList();
    };
    this._submitWord = submitWord;

    rebindButtonClickById('myword-add-submit', submitWord);

    // Enter 키로도 추가 — 모바일 키보드의 '완료/enter' 키 대응 (입력이 <form>이
    // 아니라서 기본 submit 동작이 없으므로 직접 처리). 중복 바인딩 방지 위해
    // 이전 핸들러 제거 후 재바인딩.
    if (input) {
      if (input.__traceEnterHandler) {
        input.removeEventListener('keydown', input.__traceEnterHandler);
      }
      const onEnter = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (!input.disabled) submitWord();
      };
      input.addEventListener('keydown', onEnter);
      input.__traceEnterHandler = onEnter;
    }

    const listEl = document.getElementById('myword-add-list');
    if (listEl) {
      // 이전 mode 인스턴스의 핸들러가 stale closure 로 남으면 새 단어가
      // 안 보이게 (덮어쓰임) 되는 문제가 있어서, 매 setupEvents 마다 기존
      // 핸들러를 제거하고 새로 바인딩한다.
      if (listEl.__traceDelegateHandler) {
        listEl.removeEventListener('click', listEl.__traceDelegateHandler);
      }
      const handler = (e) => {
        // 항상 최신 모드 인스턴스를 통해 동작하도록 window.myWordAddMode 사용.
        const inst = (typeof window !== 'undefined' && window.myWordAddMode) || this;
        const btn = e.target.closest('button[data-action]');
        if (!btn || !listEl.contains(btn)) return;
        const li = btn.closest('li[data-index]');
        if (!li) return;
        const idx = parseInt(li.getAttribute('data-index'), 10);
        // 스토리지 기준으로 최신 단어 목록 다시 로드 — DOM/메모리 사이의 race
        // 방지 (사용자가 빠르게 추가→정렬 클릭 시).
        inst.words = traceLoadMyWords();
        if (Number.isNaN(idx) || idx < 0 || idx >= inst.words.length) return;

        const action = btn.getAttribute('data-action');
        if (action === 'del') {
          inst.words.splice(idx, 1);
          traceSaveMyWords(inst.words);
          if (msg) msg.textContent = '';
          inst.renderList();
          return;
        }
        if (action === 'top' && idx > 0) {
          const w = inst.words.splice(idx, 1)[0];
          inst.words.unshift(w);
          traceSaveMyWords(inst.words);
          if (msg) msg.textContent = '';
          inst.renderList();
          return;
        }
        if (action === 'up' && idx > 0) {
          const t = inst.words[idx - 1];
          inst.words[idx - 1] = inst.words[idx];
          inst.words[idx] = t;
          traceSaveMyWords(inst.words);
          if (msg) msg.textContent = '';
          inst.renderList();
          return;
        }
        if (action === 'down' && idx < inst.words.length - 1) {
          const t = inst.words[idx + 1];
          inst.words[idx + 1] = inst.words[idx];
          inst.words[idx] = t;
          traceSaveMyWords(inst.words);
          if (msg) msg.textContent = '';
          inst.renderList();
          return;
        }
        if (action === 'bottom' && idx < inst.words.length - 1) {
          const w = inst.words.splice(idx, 1)[0];
          inst.words.push(w);
          traceSaveMyWords(inst.words);
          if (msg) msg.textContent = '';
          inst.renderList();
        }
      };
      listEl.addEventListener('click', handler);
      listEl.__traceDelegateHandler = handler;
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
      const isFirst = i === 0;
      const isLast = i === this.words.length - 1;
      // 단어 문자열은 textContent 로 분리 삽입(#7) — innerHTML 보간을 피해 XSS 벡터 제거.
      // 액션 버튼 영역은 사용자 데이터가 없는 정적 마크업이라 innerHTML 로 둔다.
      const wordSpan = document.createElement('span');
      wordSpan.className = 'myword-add-word';
      wordSpan.textContent = w;
      const actions = document.createElement('span');
      actions.className = 'myword-add-actions';
      actions.innerHTML = `
        <button type="button" class="tool-btn myword-add-mini" data-action="top" aria-label="맨 위로" title="맨 위로" ${isFirst ? 'disabled' : ''}>↟</button>
        <button type="button" class="tool-btn myword-add-mini" data-action="up" aria-label="한 칸 위로" title="한 칸 위로" ${isFirst ? 'disabled' : ''}>↑</button>
        <button type="button" class="tool-btn myword-add-mini" data-action="down" aria-label="한 칸 아래로" title="한 칸 아래로" ${isLast ? 'disabled' : ''}>↓</button>
        <button type="button" class="tool-btn myword-add-mini" data-action="bottom" aria-label="맨 아래로" title="맨 아래로" ${isLast ? 'disabled' : ''}>↡</button>
        <button type="button" class="tool-btn myword-add-mini myword-add-del" data-action="del" aria-label="삭제" title="삭제">✕</button>
      `;
      li.appendChild(wordSpan);
      li.appendChild(actions);
      listEl.appendChild(li);
    });
  }
}
