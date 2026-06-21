/*
 * 나의 기록(진척) 화면 — 스티커 도감 + 부모 대시보드.
 *
 * 캔버스 없는 정적 화면. 보상 엔진(TraceRewards)과 모드별 완료 진도
 * (localStorage doneSet)를 읽어 보여 준다:
 *   - 오늘의 목표 링 + 레벨·점수·별·연속일
 *   - 스티커 도감(해금/잠금 그리드)
 *   - 모드별 완료 현황(자모·숫자·영어·아는 단어·내 단어)
 *   - 진행 기록 초기화(부모용, 확인 후) — 사용자가 등록한 '내 단어'는 보존.
 */
class ProgressMode {
  constructor() {
    this.init();
  }

  init() {
    this.render();
    rebindButtonClickById('progress-reset-btn', () => this._reset());
    window.progressMode = this;
  }

  _doneCount(key, total) {
    const arr = (typeof Utils !== 'undefined') ? Utils.loadLocal(key, []) : [];
    const max = Math.max(0, Number(total) || 0);
    const seen = new Set();
    if (Array.isArray(arr)) {
      arr.forEach((x) => {
        if (Number.isInteger(x) && x >= 0 && x < max) seen.add(x);
      });
    }
    return { n: seen.size, total: max };
  }

  _vocabTotal() {
    return (typeof TRACE_VOCAB !== 'undefined' && Array.isArray(TRACE_VOCAB)) ? TRACE_VOCAB.length : 0;
  }

  _myWordsCount() {
    const arr = (typeof Utils !== 'undefined') ? Utils.loadLocal('tracing.myWords.v1', []) : [];
    return Array.isArray(arr) ? arr.length : 0;
  }

  _statRow(label, n, total) {
    const pct = total > 0 ? Math.round((n / total) * 100) : 0;
    return (
      `<div class="pg-stat-row">`
      + `<span class="pg-stat-label">${label}</span>`
      + `<span class="pg-stat-bar"><span class="pg-stat-fill" style="width:${pct}%"></span></span>`
      + `<span class="pg-stat-num">${n}/${total}</span>`
      + `</div>`
    );
  }

  render() {
    const g = (typeof TraceRewards !== 'undefined') ? TraceRewards.get() : null;
    const stk = (typeof TraceRewards !== 'undefined') ? TraceRewards.stickers() : [];

    // 헤더: 레벨/점수/오늘 목표 링
    const headEl = document.getElementById('progress-head');
    if (headEl && g) {
      const goalPct = g.goal > 0 ? Math.min(100, Math.round((g.todayCount / g.goal) * 100)) : 0;
      headEl.innerHTML =
        `<div class="pg-ring" style="--pg-pct:${goalPct}">`
        + `<div class="pg-ring-inner"><span class="pg-ring-num">${g.todayCount}/${g.goal}</span><span class="pg-ring-cap">오늘 목표</span></div>`
        + `</div>`
        + `<div class="pg-head-stats">`
        + `<div class="pg-level">Lv.${g.level} <b>${g.title}</b></div>`
        + `<div class="pg-chips">`
        + `<span class="pg-chip">⭐ 별 ${g.stars}</span>`
        + `<span class="pg-chip">🔥 ${g.streak}일</span>`
        + `<span class="pg-chip">🏅 스티커 ${g.stickersEarned}/${g.stickersTotal}</span>`
        + `<span class="pg-chip">${g.score}점</span>`
        + `</div></div>`;
    }

    // 주간 학습 달력
    this._renderWeekly();

    // 스티커 도감
    const stkEl = document.getElementById('progress-stickers');
    if (stkEl) {
      stkEl.innerHTML = stk.map((s) =>
        `<div class="pg-sticker${s.earned ? ' earned' : ' locked'}" title="${s.label}">`
        + `<span class="pg-sticker-emoji" aria-hidden="true">${s.earned ? s.emoji : '🔒'}</span>`
        + `<span class="pg-sticker-label">${s.label}</span>`
        + `</div>`
      ).join('');
    }

    // 모드별 완료 현황 (부모 대시보드)
    const statsEl = document.getElementById('progress-stats');
    if (statsEl) {
      const char = this._doneCount('tracing.done.char.v1', 24);
      const num = this._doneCount('tracing.done.number.v1', 10);
      const up = this._doneCount('tracing.done.english.upper.v1', 26);
      const low = this._doneCount('tracing.done.english.lower.v1', 26);
      const known = this._doneCount('tracing.wordcard.known.v1', this._vocabTotal());
      const myWords = this._myWordsCount();
      statsEl.innerHTML =
        this._statRow('자음·모음', char.n, char.total)
        + this._statRow('숫자', num.n, num.total)
        + this._statRow('알파벳 대문자', up.n, up.total)
        + this._statRow('알파벳 소문자', low.n, low.total)
        + this._statRow('아는 단어', known.n, known.total)
        + `<div class="pg-stat-row"><span class="pg-stat-label">내 단어</span>`
        + `<span class="pg-stat-bar"><span class="pg-stat-fill" style="width:0%"></span></span>`
        + `<span class="pg-stat-num">${myWords}개</span></div>`;
    }
  }

  _renderWeekly() {
    const el = document.getElementById('progress-weekly');
    if (!el) return;
    const active = (typeof TraceRewards !== 'undefined' && typeof TraceRewards.activeDays === 'function')
      ? TraceRewards.activeDays() : [];
    const activeSet = new Set(active);
    const dows = ['일', '월', '화', '수', '목', '금', '토'];
    const cells = [];
    const now = new Date();
    // 최근 7일(오늘 포함, 왼→오 과거→오늘)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const on = activeSet.has(key);
      const isToday = i === 0;
      cells.push(
        `<div class="pg-day${on ? ' on' : ''}${isToday ? ' today' : ''}">`
        + `<span class="pg-dow">${dows[d.getDay()]}</span>`
        + `<span class="pg-day-mark">${on ? '⭐' : '·'}</span>`
        + `</div>`
      );
    }
    el.innerHTML = cells.join('');
  }

  _reset() {
    const ok = (typeof window !== 'undefined' && typeof window.confirm === 'function')
      ? window.confirm('학습 기록(점수·레벨·완료·스티커)을 모두 지울까요?\n등록한 「내 단어」는 지워지지 않아요.')
      : true;
    if (!ok) return;
    const keys = [
      'tracing.done.char.v1',
      'tracing.done.number.v1',
      'tracing.done.english.upper.v1',
      'tracing.done.english.lower.v1',
      'tracing.wordcard.known.v1'
    ];
    keys.forEach((k) => {
      try { localStorage.removeItem(k); } catch (_e) { /* 무시 */ }
    });
    // 보상 엔진은 메모리 상태까지 초기화(reset). 점수·레벨·스티커 즉시 0으로.
    if (typeof TraceRewards !== 'undefined') {
      try { TraceRewards.reset(); } catch (_e) { /* 무시 */ }
    }
    this.render();
  }
}
