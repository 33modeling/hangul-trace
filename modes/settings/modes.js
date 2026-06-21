/*
 * 설정 모드 — 펜 색상·굵기 변경 + 발음(TTS) 켜기/끄기.
 * 캔버스 없는 정적 화면. 펜 설정은 TracePen(전역)으로 모든 따라쓰기에 즉시 적용.
 * (배경음·효과음 토글은 메인 화면에 있음.)
 */
class SettingsMode {
  constructor() {
    this.init();
  }

  init() {
    this.renderColors();
    this.renderWidths();
    this.renderJudge();
    this.renderSound();
    this.renderTts();
    this.renderPreview();
    rebindButtonClickById('settings-tts-btn', () => {
      if (typeof TraceTTS !== 'undefined') {
        TraceTTS.setAuto(!TraceTTS.isAuto());
        this.renderTts();
      }
    });
    rebindButtonClickById('settings-bgm-btn', () => {
      if (typeof TraceSound !== 'undefined') {
        TraceSound.setBgmEnabled(!TraceSound.isBgmEnabled());
        TraceSound.syncUI();
        this.renderSound();
      }
    });
    rebindButtonClickById('settings-sfx-btn', () => {
      if (typeof TraceSound !== 'undefined') {
        TraceSound.setSfxEnabled(!TraceSound.isSfxEnabled());
        TraceSound.syncUI();
        this.renderSound();
      }
    });
    window.settingsMode = this;
  }

  renderJudge() {
    const wrap = document.getElementById('settings-judge');
    if (!wrap || typeof traceJudgeLevel !== 'function') return;
    const cur = traceJudgeLevel();
    wrap.innerHTML = '';
    (typeof TRACE_JUDGE_LEVELS !== 'undefined' ? TRACE_JUDGE_LEVELS : []).forEach((lv) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pen-width-btn' + (lv.id === cur ? ' active' : '');
      b.textContent = lv.label;
      b.setAttribute('aria-pressed', lv.id === cur ? 'true' : 'false');
      b.addEventListener('click', () => {
        if (typeof traceSetJudgeLevel === 'function') traceSetJudgeLevel(lv.id);
        this.renderJudge();
      }, { passive: true });
      wrap.appendChild(b);
    });
  }

  renderSound() {
    if (typeof TraceSound === 'undefined') return;
    const bgm = document.getElementById('settings-bgm-btn');
    if (bgm) {
      const on = TraceSound.isBgmEnabled();
      bgm.classList.toggle('off', !on);
      bgm.setAttribute('aria-pressed', on ? 'true' : 'false');
      const lbl = bgm.querySelector('.sound-label');
      if (lbl) lbl.textContent = on ? '배경음 켜짐' : '배경음 꺼짐';
    }
    const sfx = document.getElementById('settings-sfx-btn');
    if (sfx) {
      const on = TraceSound.isSfxEnabled();
      sfx.classList.toggle('off', !on);
      sfx.setAttribute('aria-pressed', on ? 'true' : 'false');
      const lbl = sfx.querySelector('.sound-label');
      if (lbl) lbl.textContent = on ? '효과음 켜짐' : '효과음 꺼짐';
    }
  }

  renderColors() {
    const wrap = document.getElementById('settings-colors');
    if (!wrap || typeof TracePen === 'undefined') return;
    const cur = TracePen.color();
    wrap.innerHTML = '';
    TracePen.COLORS.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pen-swatch' + (c.color === cur ? ' selected' : '');
      b.style.background = c.color;
      b.setAttribute('aria-label', c.label);
      b.setAttribute('aria-pressed', c.color === cur ? 'true' : 'false');
      b.addEventListener('click', () => {
        TracePen.setColor(c.color);
        this.renderColors();
        this.renderPreview();
      }, { passive: true });
      wrap.appendChild(b);
    });
  }

  renderWidths() {
    const wrap = document.getElementById('settings-widths');
    if (!wrap || typeof TracePen === 'undefined') return;
    const cur = TracePen.widthId();
    wrap.innerHTML = '';
    TracePen.WIDTHS.forEach((w) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pen-width-btn' + (w.id === cur ? ' active' : '');
      b.textContent = w.label;
      b.setAttribute('aria-pressed', w.id === cur ? 'true' : 'false');
      b.addEventListener('click', () => {
        TracePen.setWidth(w.id);
        this.renderWidths();
        this.renderPreview();
      }, { passive: true });
      wrap.appendChild(b);
    });
  }

  renderTts() {
    const b = document.getElementById('settings-tts-btn');
    if (!b) return;
    if (typeof TraceTTS === 'undefined' || !TraceTTS.isSupported()) {
      b.style.display = 'none';
      const row = document.getElementById('settings-tts-row');
      if (row) row.style.display = 'none';
      return;
    }
    const on = TraceTTS.isAuto();
    b.classList.toggle('off', !on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const lbl = b.querySelector('.sound-label');
    if (lbl) lbl.textContent = on ? '발음 켜짐' : '발음 꺼짐';
  }

  renderPreview() {
    const cv = document.getElementById('settings-preview');
    if (!cv || typeof TracePen === 'undefined') return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const cssW = cv.clientWidth || 280;
    const cssH = cv.clientHeight || 76;
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const base = Math.max(8, Math.min(cv.width, cv.height) * 0.16);
    ctx.strokeStyle = TracePen.color();
    ctx.lineWidth = base * TracePen.widthScale();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 물결 모양 샘플 획
    const w = cv.width, h = cv.height;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.5);
    ctx.bezierCurveTo(w * 0.32, h * 0.12, w * 0.5, h * 0.88, w * 0.68, h * 0.5);
    ctx.bezierCurveTo(w * 0.78, h * 0.28, w * 0.84, h * 0.6, w * 0.88, h * 0.5);
    ctx.stroke();
  }
}
