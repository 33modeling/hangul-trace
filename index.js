function showMainMenu() {
  // 진행 중인 stroke order strip 애니메이션 모두 취소 — 메뉴로 나간 뒤에도
  // 타이머가 살아있어 stale DOM을 건드리거나 display:none 요소에 scrollIntoView
  // 호출해 콘솔 경고를 띄우는 문제 방지.
  if (typeof cancelStrokeOrderStrip === 'function') {
    ['stroke-strip', 'num-stroke-strip', 'eng-stroke-strip'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        cancelStrokeOrderStrip(el);
        el.innerHTML = '';
      }
    });
  }
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

/* === 이스터에그: byline '통통이' 15클릭 → 비밀 모드 ===
 * 외관상 일반 텍스트라 모르는 사람에겐 보이지 않음.
 * 5초 안에 15회 누르지 못하면 카운트 자동 리셋.
 */
const TRACE_SECRET_TARGET = 15;
const TRACE_SECRET_RESET_MS = 5000;
let _traceSecretClicks = 0;
let _traceSecretTimer = null;

function _traceTriggerSecret() {
  _traceSecretClicks = 0;
  if (_traceSecretTimer) {
    clearTimeout(_traceSecretTimer);
    _traceSecretTimer = null;
  }
  document.querySelectorAll('.mode-ui').forEach((el) => el.classList.remove('active'));
  const main = document.getElementById('main-menu');
  if (main) main.style.display = 'none';
  const panel = document.getElementById('secret-mode');
  if (panel) panel.classList.add('active');
}

function initSecretEgg() {
  const trigger = document.getElementById('secret-trigger');
  if (!trigger) return;
  trigger.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      _traceSecretClicks += 1;
      if (_traceSecretTimer) clearTimeout(_traceSecretTimer);
      _traceSecretTimer = setTimeout(() => {
        _traceSecretClicks = 0;
        _traceSecretTimer = null;
      }, TRACE_SECRET_RESET_MS);
      if (_traceSecretClicks >= TRACE_SECRET_TARGET) {
        _traceTriggerSecret();
      }
    },
    { passive: false }
  );
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
        '#back-btn, #word-back-btn, #num-back-btn, #eng-back-btn, #myword-back-btn, #myword-add-back-btn, #myword-add-menu-btn, #adv-back-btn, #secret-back-btn'
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

  initSecretEgg();
  initIntroScreen();
  showMainMenu();
}

/* === 인트로 화면 ===
 * 첫 진입 시 보이는 splash 화면. 화면 터치 한 번에 fade-out → 메뉴.
 * 사용자가 추후 로그인 화면을 이 자리에 끼워넣을 예정. */
function initIntroScreen() {
  // VERSION 파일에서 버전 읽어 표시 (실패해도 placeholder 유지)
  fetch('VERSION')
    .then((r) => (r.ok ? r.text() : ''))
    .then((v) => {
      const ver = (v || '').trim();
      if (!ver) return;
      document.querySelectorAll('.intro-version, .menu-version').forEach((el) => {
        el.textContent = 'v' + ver;
      });
    })
    .catch(() => {});

  const intro = document.getElementById('intro-screen');
  if (!intro) return;
  let dismissed = false;
  const dismiss = (e) => {
    if (dismissed) return;
    dismissed = true;
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    intro.classList.add('intro-dismiss');
    setTimeout(() => {
      intro.style.display = 'none';
    }, 380);
  };
  intro.addEventListener('click', dismiss);
  intro.addEventListener('touchstart', dismiss, { passive: false });
  intro.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') dismiss(e);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppShell);
} else {
  initAppShell();
}

// Service Worker 등록 — 오프라인 + PWA install 점수.
// file:// 에서 직접 열면 등록 실패하므로 https/http만.
if (
  'serviceWorker' in navigator &&
  (location.protocol === 'https:' || location.protocol === 'http:')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('shared/sw.js', { scope: './' })
      .catch((err) => {
        console.warn('tracing: SW register failed', err);
      });
  });
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
