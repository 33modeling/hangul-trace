function showMainMenu() {
  document.querySelectorAll('.mode-ui').forEach((el) => el.classList.remove('active'));
  const menu = document.getElementById('main-menu');
  if (menu) menu.style.display = 'flex';
}

function showCharMode() {
  showSingleMode('char');
}

function showWordMode() {
  showSingleMode('word');
}

function showNumberMode() {
  showSingleMode('number');
}

function showEnglishMode() {
  showSingleMode('english');
}

function showMyWordMode() {
  showSingleMode('myword');
}

function showMyWordAddMode() {
  showSingleMode('myword-add');
}

function showAdvancedMode() {
  showSingleMode('advanced');
}

/** click/pointer의 target이 텍스트 노드일 때(버튼 안 ← 문자) closest를 쓰려면 Element 필요 */
function traceClickElement(e) {
  for (const n of e.composedPath()) {
    if (n instanceof Element) return n;
  }
  return null;
}

function showSingleMode(modeName) {
  const panel = document.getElementById(`${modeName}-mode`);
  if (!panel) {
    console.warn('tracing: unknown mode', modeName);
    return;
  }
  const mainMenu = document.getElementById('main-menu');
  if (mainMenu) mainMenu.style.display = 'none';
  document.querySelectorAll('.mode-ui').forEach((el) => el.classList.remove('active'));
  panel.classList.add('active');

  const ModeClass = {
    char: CharMode,
    word: WordMode,
    number: NumberMode,
    english: EnglishMode,
    myword: MyWordMode,
    'myword-add': MyWordAddMode,
    advanced: typeof AdvancedMode !== 'undefined' ? AdvancedMode : undefined
  }[modeName];

  function startMode() {
    try {
      if (modeName === 'char') window.charMode = new ModeClass();
      else if (modeName === 'word') window.wordMode = new ModeClass();
      else if (modeName === 'number') window.numberMode = new ModeClass();
      else if (modeName === 'english') window.englishMode = new ModeClass();
      else if (modeName === 'myword') window.myWordMode = new ModeClass();
      else if (modeName === 'myword-add') window.myWordAddMode = new ModeClass();
      else if (modeName === 'advanced') window.advancedMode = new ModeClass();
    } catch (err) {
      console.error('tracing: mode init failed', modeName, err);
    }
  }

  if (typeof ModeClass !== 'undefined') {
    void panel.offsetWidth;
    startMode();
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
    });
  } else {
    const script = document.createElement('script');
    script.src = `modes/${modeName}/modes.js`;
    script.onload = () => showSingleMode(modeName);
    document.head.appendChild(script);
  }
}

function initAppShell() {
  // 캡처 단계에서 처리: 자식에서 전파가 막혀도 메뉴 카드 탭은 잡힘.
  const app = document.getElementById('app');
  if (app) {
    app.addEventListener(
      'click',
      (e) => {
      const el = traceClickElement(e);
      if (!el) return;
      const back = el.closest(
        '#back-btn, #word-back-btn, #num-back-btn, #eng-back-btn, #myword-back-btn, #myword-add-back-btn, #myword-add-menu-btn, #adv-back-btn'
      );
      if (back && app.contains(back)) {
        e.preventDefault();
        showMainMenu();
        return;
      }

      // prev/next 네비게이션 버튼 (inline onclick 제거 → JS에서 위임 처리)
      const navBtn = el.closest('[data-action="prev"], [data-action="next"]');
      if (navBtn) {
        e.preventDefault();
        const action = navBtn.getAttribute('data-action');
        const id = navBtn.id;
        if (id === 'prev-btn' || id === 'next-btn') {
          if (window.charMode && window.charMode.navigation) {
            window.charMode.navigation[action]();
          }
        } else if (id === 'word-prev-btn' || id === 'word-next-btn') {
          if (window.wordMode && typeof window.wordMode[action] === 'function') {
            window.wordMode[action]();
          }
        } else if (id === 'num-prev-btn' || id === 'num-next-btn') {
          if (window.numberMode && window.numberMode.navigation) {
            window.numberMode.navigation[action]();
          }
        } else if (id === 'eng-prev-btn' || id === 'eng-next-btn') {
          if (window.englishMode && window.englishMode.navigation) {
            window.englishMode.navigation[action]();
          }
        } else if (id === 'myword-prev-btn' || id === 'myword-next-btn') {
          if (window.myWordMode && typeof window.myWordMode[action] === 'function') {
            window.myWordMode[action]();
          }
        } else if (id === 'adv-prev-btn' || id === 'adv-next-btn') {
          if (window.advancedMode && typeof window.advancedMode[action] === 'function') {
            window.advancedMode[action]();
          }
        }
        return;
      }

      const deck = document.getElementById('mode-cards');
      if (!deck || !deck.contains(el)) return;
      const card = el.closest('.mode-card');
      if (!card || !deck.contains(card)) return;
      const mode = card.dataset.mode;
      if (!mode) return;
      e.preventDefault();
      showSingleMode(mode);
      },
      true
    );
  }

  showMainMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppShell);
} else {
  initAppShell();
}

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 150);
});

if (typeof window !== 'undefined') {
  window.showMainMenu = showMainMenu;
  window.showSingleMode = showSingleMode;
  window.showCharMode = showCharMode;
  window.showWordMode = showWordMode;
  window.showNumberMode = showNumberMode;
  window.showEnglishMode = showEnglishMode;
  window.showMyWordMode = showMyWordMode;
  window.showMyWordAddMode = showMyWordAddMode;
  window.showAdvancedMode = showAdvancedMode;
}
