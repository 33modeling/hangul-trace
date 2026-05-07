/*
 * 배경음 + 효과음 시스템 — Web Audio API로 합성. 외부 mp3/wav 의존성 0.
 *
 * BGM: 잔잔한 8마디 lullaby 멜로디 무한 반복 (사인파)
 * SFX:
 *   stroke()  — 캔버스 포인터 다운 시 짧은 'tap'
 *   complete() — 완성 분기에서 3노트 상승 패턴
 *
 * 브라우저 자동재생 정책: AudioContext는 사용자 제스처 이후에만
 * resume 가능. 첫 pointerdown/touchstart/keydown 시 lazy init.
 *
 * 설정은 localStorage에 저장 — 페이지 재방문해도 유지됨.
 */
const TRACE_SOUND_KEY_BGM = 'tracing.sound.bgm.v1';
const TRACE_SOUND_KEY_SFX = 'tracing.sound.sfx.v1';

const TraceSound = (() => {
  let ctx = null;
  let bgmTimer = null;
  let bgmGain = null;

  // 기본은 BGM off, SFX on (어린이 학습 환경에서 BGM은 호불호 갈림)
  let bgmEnabled = Utils.loadLocal(TRACE_SOUND_KEY_BGM, '0') === '1';
  let sfxEnabled = Utils.loadLocal(TRACE_SOUND_KEY_SFX, '1') === '1';

  function ensureCtx() {
    if (!ctx) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (Ctor) ctx = new Ctor();
      } catch (_e) {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  /** 단일 톤 합성 — gain envelope 포함 */
  function _tone(freq, duration, gain, type, when, dest) {
    const c = ensureCtx();
    if (!c) return;
    const t = c.currentTime + (when || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(dest || c.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  function stroke() {
    if (!sfxEnabled) return;
    _tone(880, 0.06, 0.045, 'sine');
  }

  function complete() {
    if (!sfxEnabled) return;
    // 도-미-솔 상승 (C5-E5-G5)
    _tone(523, 0.13, 0.06, 'sine', 0);
    _tone(659, 0.13, 0.06, 'sine', 0.13);
    _tone(784, 0.20, 0.07, 'sine', 0.27);
  }

  // 잔잔한 멜로디: [freq, durationSec]
  const BGM_MELODY = [
    [392, 0.6], [440, 0.6], [523, 1.0],
    [440, 0.6], [392, 1.4],
    [349, 0.6], [392, 0.6], [440, 1.0],
    [392, 1.6]
  ];

  function _bgmTickFactory() {
    let i = 0;
    return function tick() {
      if (!bgmEnabled) return;
      const c = ensureCtx();
      if (!c) {
        bgmTimer = setTimeout(tick, 1000);
        return;
      }
      if (!bgmGain) {
        bgmGain = c.createGain();
        bgmGain.gain.value = 0.6;
        bgmGain.connect(c.destination);
      }
      const note = BGM_MELODY[i % BGM_MELODY.length];
      _tone(note[0], note[1] * 0.95, 0.04, 'sine', 0, bgmGain);
      i++;
      bgmTimer = setTimeout(tick, note[1] * 1000);
    };
  }

  function _bgmStart() {
    if (!bgmEnabled) return;
    if (bgmTimer) return;  // 이미 동작 중
    const tick = _bgmTickFactory();
    tick();
  }

  function _bgmStop() {
    if (bgmTimer) clearTimeout(bgmTimer);
    bgmTimer = null;
  }

  function setBgmEnabled(v) {
    bgmEnabled = !!v;
    Utils.saveLocal(TRACE_SOUND_KEY_BGM, bgmEnabled ? '1' : '0');
    if (bgmEnabled) _bgmStart();
    else _bgmStop();
  }

  function setSfxEnabled(v) {
    sfxEnabled = !!v;
    Utils.saveLocal(TRACE_SOUND_KEY_SFX, sfxEnabled ? '1' : '0');
  }

  function isBgmEnabled() { return bgmEnabled; }
  function isSfxEnabled() { return sfxEnabled; }

  function _syncToggleBtn(btn, enabled) {
    if (!btn) return;
    btn.classList.toggle('off', !enabled);
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  function _bindUI() {
    const bgmBtn = document.getElementById('bgm-toggle');
    const sfxBtn = document.getElementById('sfx-toggle');
    _syncToggleBtn(bgmBtn, bgmEnabled);
    _syncToggleBtn(sfxBtn, sfxEnabled);
    if (bgmBtn && !bgmBtn.__traceBound) {
      bgmBtn.__traceBound = true;
      bgmBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setBgmEnabled(!bgmEnabled);
        _syncToggleBtn(bgmBtn, bgmEnabled);
      });
    }
    if (sfxBtn && !sfxBtn.__traceBound) {
      sfxBtn.__traceBound = true;
      sfxBtn.addEventListener('click', (e) => {
        e.preventDefault();
        setSfxEnabled(!sfxEnabled);
        _syncToggleBtn(sfxBtn, sfxEnabled);
      });
    }
  }

  // 첫 사용자 제스처 후 AudioContext 깨움 + BGM이 켜져있으면 시작
  function _firstGestureKick() {
    ensureCtx();
    if (bgmEnabled) _bgmStart();
    document.removeEventListener('pointerdown', _firstGestureKick, true);
    document.removeEventListener('touchstart', _firstGestureKick, true);
    document.removeEventListener('keydown', _firstGestureKick, true);
  }
  document.addEventListener('pointerdown', _firstGestureKick, { once: true, capture: true });
  document.addEventListener('touchstart', _firstGestureKick, { once: true, capture: true });
  document.addEventListener('keydown', _firstGestureKick, { once: true, capture: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bindUI);
  } else {
    _bindUI();
  }

  return {
    stroke,
    complete,
    setBgmEnabled,
    setSfxEnabled,
    isBgmEnabled,
    isSfxEnabled
  };
})();
