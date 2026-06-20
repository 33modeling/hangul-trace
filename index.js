/* 마지막으로 모드에 진입시킨 메뉴 카드 — 메뉴 복귀 시 포커스를 되돌린다. */
let _traceReturnFocusEl = null;

/* 일부 화면(myword-add)은 back/메뉴 버튼에 자체 핸들러를 붙이고, 동시에 index.js
 * 캡처-단계 위임도 같은 버튼을 처리한다 → 한 번의 클릭에 showMainMenu() 가 두 번
 * 호출된다. history.back() 을 두 번 실행하면 메뉴를 지나쳐 페이지를 이탈하므로,
 * pop 이 진행 중인 동안은 추가 back 을 무시한다. popstate 수신 시 해제(#1-UX). */
let _traceBackPending = false;

/**
 * 모드 이탈/전환 시 누수 정리.
 * 과거엔 각 모드가 "같은 모드 재진입" 때만 자기 ResizeObserver/resize 핸들러를
 * 교체했고, 메뉴로 나가거나 다른 모드로 전환하는 네비게이션 경계에서는 아무
 * 정리도 하지 않아 — ResizeObserver 누적, myword/advanced 의 window 'resize'
 * 핸들러가 stale 인스턴스에서 계속 실행, 그리던 도중 이탈 시 window stroke
 * 리스너 잔존 — 등의 누수가 있었다. 여기서 한 곳에 모아 정리한다.
 */
function traceTeardownActiveMode() {
  // 모드 이탈 시 hint fallback 타이머 취소(#8) — 숨겨진/파괴된 캔버스에 stale 그리기 방지
  if (window.__traceHintFallbackTimer) {
    clearTimeout(window.__traceHintFallbackTimer);
    window.__traceHintFallbackTimer = null;
  }
  // 퀴즈 자동 넘김 타이머 — 모드 이탈 후 숨은 패널에 다음 문제 렌더 방지.
  if (window.quizMode && typeof window.quizMode.clearTimer === 'function') {
    try { window.quizMode.clearTimer(); } catch (_e) { /* ignore */ }
  }
  // 진행 중인 획순 애니메이션(rAF) 모두 취소 — 숨은 캔버스에 stale 그리기 방지.
  if (typeof cancelAllStrokeOrderAnims === 'function') {
    try { cancelAllStrokeOrderAnims(); } catch (_e) { /* ignore */ }
  }
  ['__traceCharRO', '__traceWordRO', '__traceNumberRO', '__traceEnglishRO', '__traceMyWordRO', '__traceAdvRO', '__traceWordcardRO', '__tracePhonicsRO', '__traceBatchimRO', '__traceDictationRO', '__traceStrokeOrderRO'].forEach((k) => {
    const ro = window[k];
    if (ro && typeof ro.disconnect === 'function') {
      try { ro.disconnect(); } catch (_e) { /* ignore */ }
    }
    window[k] = null;
  });
  ['__traceMyWordResizeHandler', '__traceAdvResizeHandler'].forEach((k) => {
    const h = window[k];
    if (typeof h === 'function') {
      window.removeEventListener('resize', h);
    }
    window[k] = null;
  });
  // 그리던 도중 이탈 시 window 에 남는 pointer/touch stroke 리스너 정리(#28).
  ['draw-canvas', 'word-draw-canvas', 'num-draw-canvas', 'eng-draw-canvas', 'myword-draw-canvas', 'adv-draw-canvas', 'wc-draw-canvas', 'ph-draw-canvas', 'bt-draw-canvas', 'dt-draw-canvas', 'so-draw-canvas'].forEach((id) => {
    const c = document.getElementById(id);
    if (c && typeof c.__traceDrawUnbind === 'function') {
      try { c.__traceDrawUnbind(); } catch (_e) { /* ignore */ }
    }
  });
}

function showMainMenu(opts) {
  // 기기/브라우저 뒤로가기 통합(#1-UX): 모드 화면에 있으면 history.back() 으로
  // 빠져나가 popstate 가 메뉴를 렌더하게 한다. 이렇게 하면 인앱 back 버튼과
  // 하드웨어/제스처 back 이 동일한 경로(menu base 항목 1개)로 수렴한다.
  const fromHistory = !!(opts && opts.fromHistory);
  if (!fromHistory) {
    if (_traceBackPending) return; // 같은 클릭의 중복 호출 — pop 은 한 번만
    try {
      if (history.state && history.state.traceView === 'mode') {
        _traceBackPending = true;
        history.back();
        return;
      }
    } catch (_e) { _traceBackPending = false; /* History 미지원 — 아래에서 직접 렌더 */ }
  }
  // 진행 중인 stroke order strip 애니메이션 모두 취소 — 메뉴로 나간 뒤에도
  // 타이머가 살아있어 stale DOM을 건드리거나 display:none 요소에 scrollIntoView
  // 호출해 콘솔 경고를 띄우는 문제 방지.
  if (typeof cancelStrokeOrderStrip === 'function') {
    ['stroke-strip', 'num-stroke-strip', 'eng-stroke-strip', 'so-strip'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        cancelStrokeOrderStrip(el);
        el.innerHTML = '';
      }
    });
  }
  traceTeardownActiveMode();
  document.querySelectorAll('.mode-ui').forEach((el) => el.classList.remove('active'));
  const menu = document.getElementById('main-menu');
  if (menu) menu.style.display = 'flex';
  // 메뉴로 돌아올 때 보상 배지(레벨·별·연속일·점수) 갱신.
  if (typeof TraceRewards !== 'undefined') TraceRewards.updateBadge();

  // 포커스 복귀 — 모드를 연 카드로 되돌려 키보드/스크린리더 위치 유지(#20).
  if (_traceReturnFocusEl && document.contains(_traceReturnFocusEl)) {
    try { _traceReturnFocusEl.focus({ preventScroll: true }); } catch (_e) { /* ignore */ }
  }
  _traceReturnFocusEl = null;
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

function showWordCardMode() {
  showSingleMode('wordcard');
}

function showQuizMode() {
  showSingleMode('quiz');
}

function showPhonicsMode() {
  showSingleMode('phonics');
}

function showBatchimMode() {
  showSingleMode('batchim');
}

function showDictationMode() {
  showSingleMode('dictation');
}

function showProgressMode() {
  showSingleMode('progress');
}

function showStrokeOrderMode() {
  showSingleMode('strokeorder');
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

function showSingleMode(modeName, opts) {
  const fromHistory = !!(opts && opts.fromHistory);
  const panel = document.getElementById(`${modeName}-mode`);
  if (!panel) {
    console.warn('tracing: unknown mode', modeName);
    return;
  }
  // 메뉴 카드에서 진입한 경우, 메뉴 복귀 시 그 카드로 포커스를 되돌리려 기억(#20).
  const active = document.activeElement;
  if (active && active.classList && active.classList.contains('mode-card')) {
    _traceReturnFocusEl = active;
  }
  // 이전 모드의 ResizeObserver/resize 핸들러/stroke 리스너 정리 후 전환.
  traceTeardownActiveMode();
  const mainMenu = document.getElementById('main-menu');
  if (mainMenu) mainMenu.style.display = 'none';
  document.querySelectorAll('.mode-ui').forEach((el) => el.classList.remove('active'));
  panel.classList.add('active');

  // History 동기화(#1-UX) — 메뉴→모드는 항목 1개 push, 모드→모드(예: myword→
  // myword-add)는 replace 로 깊이를 1로 유지한다. 어느 화면에서든 back 은 메뉴로
  // 돌아가는 이 앱의 평면 네비게이션과 일치한다. popstate 발(fromHistory) 호출은
  // 재-push 하지 않는다.
  if (!fromHistory) {
    try {
      const st = { traceView: 'mode', mode: modeName };
      if (history.state && history.state.traceView === 'mode') {
        history.replaceState(st, '');
      } else {
        history.pushState(st, '');
      }
    } catch (_e) { /* History 미지원(file:// 등) — DOM 전환만으로 충분 */ }
  }

  const ModeClass = {
    char: CharMode,
    word: WordMode,
    number: NumberMode,
    english: EnglishMode,
    myword: MyWordMode,
    'myword-add': MyWordAddMode,
    advanced: typeof AdvancedMode !== 'undefined' ? AdvancedMode : undefined,
    wordcard: typeof WordCardMode !== 'undefined' ? WordCardMode : undefined,
    quiz: typeof QuizMode !== 'undefined' ? QuizMode : undefined,
    phonics: typeof PhonicsMode !== 'undefined' ? PhonicsMode : undefined,
    batchim: typeof BatchimMode !== 'undefined' ? BatchimMode : undefined,
    dictation: typeof DictationMode !== 'undefined' ? DictationMode : undefined,
    strokeorder: typeof StrokeOrderMode !== 'undefined' ? StrokeOrderMode : undefined,
    progress: typeof ProgressMode !== 'undefined' ? ProgressMode : undefined
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
      else if (modeName === 'wordcard') window.wordCardMode = new ModeClass();
      else if (modeName === 'quiz') window.quizMode = new ModeClass();
      else if (modeName === 'phonics') window.phonicsMode = new ModeClass();
      else if (modeName === 'batchim') window.batchimMode = new ModeClass();
      else if (modeName === 'dictation') window.dictationMode = new ModeClass();
      else if (modeName === 'strokeorder') window.strokeOrderMode = new ModeClass();
      else if (modeName === 'progress') window.progressMode = new ModeClass();
    } catch (err) {
      console.error('tracing: mode init failed', modeName, err);
    }
  }

  if (typeof ModeClass !== 'undefined') {
    void panel.offsetWidth;
    startMode();
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      // 새 패널로 포커스 이동 — 키보드/스크린리더가 모드 전환을 인지하도록(#20).
      try {
        panel.setAttribute('tabindex', '-1');
        panel.focus({ preventScroll: true });
      } catch (_e) { /* ignore */ }
    });
  } else {
    const script = document.createElement('script');
    script.src = `modes/${modeName}/modes.js`;
    // 재호출 시엔 이미 위에서 history 항목을 넣었으므로 중복 push 방지.
    script.onload = () => showSingleMode(modeName, { fromHistory: true });
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
        '#back-btn, #word-back-btn, #num-back-btn, #eng-back-btn, #myword-back-btn, #myword-add-back-btn, #myword-add-menu-btn, #adv-back-btn, #wc-back-btn, #quiz-back-btn, #ph-back-btn, #bt-back-btn, #dt-back-btn, #so-back-btn, #progress-back-btn, #secret-back-btn'
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
        } else if (id === 'wc-prev-btn' || id === 'wc-next-btn') {
          if (window.wordCardMode && typeof window.wordCardMode[action] === 'function') {
            window.wordCardMode[action]();
          }
        } else if (id === 'ph-prev-btn' || id === 'ph-next-btn') {
          if (window.phonicsMode && typeof window.phonicsMode[action] === 'function') {
            window.phonicsMode[action]();
          }
        } else if (id === 'bt-prev-btn' || id === 'bt-next-btn') {
          if (window.batchimMode && typeof window.batchimMode[action] === 'function') {
            window.batchimMode[action]();
          }
        } else if (id === 'dt-prev-btn' || id === 'dt-next-btn') {
          if (window.dictationMode && typeof window.dictationMode[action] === 'function') {
            window.dictationMode[action]();
          }
        } else if (id === 'so-prev-btn' || id === 'so-next-btn') {
          if (window.strokeOrderMode && typeof window.strokeOrderMode[action] === 'function') {
            window.strokeOrderMode[action]();
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

  // History 베이스(메뉴) 항목을 심고 popstate 를 구독한다(#1-UX). 모드 화면에서
  // 기기 하드웨어/제스처 뒤로가기를 눌러도 앱이 종료되는 대신 메뉴로 복귀한다.
  try { history.replaceState({ traceView: 'menu' }, ''); } catch (_e) { /* ignore */ }
  window.addEventListener('popstate', (e) => {
    _traceBackPending = false;
    const st = e.state;
    if (st && st.traceView === 'mode' && st.mode) {
      showSingleMode(st.mode, { fromHistory: true });
    } else {
      showMainMenu({ fromHistory: true });
    }
  });

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
      .register('sw.js', { scope: './' })
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
  window.showWordCardMode = showWordCardMode;
  window.showQuizMode = showQuizMode;
  window.showPhonicsMode = showPhonicsMode;
  window.showBatchimMode = showBatchimMode;
  window.showDictationMode = showDictationMode;
  window.showProgressMode = showProgressMode;
  window.showStrokeOrderMode = showStrokeOrderMode;
}
