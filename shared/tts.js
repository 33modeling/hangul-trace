/*
 * 발음 듣기(TTS) — Web Speech API(ko-KR). 음원·서버 불필요.
 *
 * - 메뉴 "발음" 토글(#tts-toggle): 켜면 새 글자/단어로 넘어갈 때 자동으로 읽어 준다.
 *   기본 off(앞서 텍스트 우선을 택한 사용자 선호 존중). localStorage 저장.
 * - TraceTTS.speak(text): 🔊 듣기 버튼 등 명시적 호출은 토글과 무관하게 항상 읽는다.
 * - TraceTTS.speakAuto(text): 토글이 켜져 있을 때만 읽는다(모드 updateUI 에서 호출).
 * - 미지원 브라우저/음성 없으면 조용히 무시하고 토글 버튼은 숨긴다.
 *
 * sound.js 처럼 자체 초기화 IIFE. 의존: Utils(utils.js).
 */
const TraceTTS = (function () {
  const KEY = 'tracing.tts.v1';
  const supported = (typeof window !== 'undefined') && ('speechSynthesis' in window)
    && (typeof SpeechSynthesisUtterance !== 'undefined');
  let auto = false;
  let voice = null;

  function load() {
    const v = (typeof Utils !== 'undefined') ? Utils.loadLocal(KEY, false) : false;
    auto = !!v;
  }
  function save() {
    if (typeof Utils !== 'undefined') Utils.saveLocal(KEY, auto);
  }

  function pickVoice() {
    if (!supported) return;
    try {
      const vs = window.speechSynthesis.getVoices() || [];
      voice = vs.find((v) => /^ko/i.test(v.lang)) || vs.find((v) => /korea/i.test(v.name)) || null;
    } catch (_e) { voice = null; }
  }

  function speak(text) {
    if (!supported || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'ko-KR';
      if (voice) u.voice = voice;
      u.rate = 0.85;  // 아이가 따라 하기 좋게 약간 느리게
      u.pitch = 1.1;
      window.speechSynthesis.speak(u);
    } catch (_e) { /* 무시 */ }
  }

  // 자동 발음 중복 차단 — 모드 진입 시 updateUI 가 (생성+fonts.ready+reflow)로
  // 여러 번 불려 같은 글자를 cancel+재시작하며 더듬는 문제 방지. 같은 텍스트가
  // 짧은 시간(800ms) 안에 다시 오면 무시한다(다른 글자로 이동하면 정상 발음).
  let _lastAutoText = '';
  let _lastAutoAt = 0;
  function speakAuto(text) {
    if (!auto || !text) return;
    const now = Date.now();
    if (text === _lastAutoText && (now - _lastAutoAt) < 800) {
      _lastAutoAt = now;
      return;
    }
    _lastAutoText = text;
    _lastAutoAt = now;
    speak(text);
  }

  function syncToggle() {
    const b = document.getElementById('tts-toggle');
    if (!b) return;
    b.classList.toggle('off', !auto);
    b.setAttribute('aria-pressed', auto ? 'true' : 'false');
  }

  function setAuto(on) {
    auto = !!on;
    save();
    syncToggle();
  }

  function toggle() {
    setAuto(!auto);
    if (auto) speak('안녕'); // 켜질 때 한 번 들려 주기
  }

  function boot() {
    load();
    if (supported) {
      pickVoice();
      try {
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = pickVoice;
        }
      } catch (_e) { /* 무시 */ }
    }
    const b = document.getElementById('tts-toggle');
    if (b) {
      if (!supported) {
        b.style.display = 'none';
      } else {
        b.addEventListener('click', (e) => {
          e.preventDefault();
          toggle();
        }, { passive: false });
      }
    }
    syncToggle();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  return { speak, speakAuto, isAuto: () => auto, isSupported: () => supported, setAuto };
})();
