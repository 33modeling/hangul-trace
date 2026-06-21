/*
 * 보상·진척 엔진 — 흥미 유발용.
 *
 * 어떤 모드든 한 글자/단어/문제를 완성하면 TraceRewards.award(점수)를 호출한다.
 * 그러면:
 *   - 점수가 쌓이고 레벨이 오른다(레벨업 시 별 +1, 큰 축하).
 *   - 매번 칭찬 토스트("잘했어요! 👏" + "+10")가 떠서 계속 칭찬받는 느낌.
 *   - 하루 단위 연속 학습일(streak)과 오늘 완성 수(데일리 목표)를 센다.
 *   - 누적 기록이 조건을 넘으면 스티커를 획득한다(새 스티커 토스트).
 * 진척은 localStorage 에 저장되고, 메인 메뉴 배지로 보여 준다. 자세한 기록과
 * 스티커 도감은 「나의 기록」(progress) 화면에서 본다.
 *
 * sound.js 처럼 자체 초기화하는 IIFE. 의존: Utils(utils.js).
 */
const TraceRewards = (function () {
  const KEY = 'tracing.rewards.v1';
  const DAILY_GOAL = 10;
  const PRAISES = [
    '잘했어요! 👏', '최고예요! 🌟', '대단해요! 🎉', '멋져요! ✨',
    '완벽해요! 💯', '훌륭해요! 🏆', '좋아요! 😊', '신나요! 🎈',
    '그렇지! 👍', '척척박사! 🦊'
  ];
  const LEVEL_TITLES = [
    '한글 새싹 🌱', '한글 꼬마 🐣', '한글 친구 🐥', '한글 박사 🦉',
    '한글 마법사 🧙', '한글 왕 👑', '한글 별 🌟', '한글 전설 🏆'
  ];

  /* 스티커 도감 — 누적 기록만으로 해금(별도 추적 불필요, 결정적). */
  const STICKERS = [
    { id: 'first', emoji: '✏️', label: '첫 글자', cond: (s) => s.count >= 1 },
    { id: 'five', emoji: '🖐️', label: '5글자', cond: (s) => s.count >= 5 },
    { id: 'ten', emoji: '🔟', label: '10글자', cond: (s) => s.count >= 10 },
    { id: 'lv3', emoji: '🦉', label: '레벨 3', cond: (s) => s.level >= 3 },
    { id: 'twentyfive', emoji: '🌟', label: '25글자', cond: (s) => s.count >= 25 },
    { id: 'streak3', emoji: '🔥', label: '3일 연속', cond: (s) => s.streak >= 3 },
    { id: 'fifty', emoji: '🏅', label: '50글자', cond: (s) => s.count >= 50 },
    { id: 'lv5', emoji: '🧙', label: '레벨 5', cond: (s) => s.level >= 5 },
    { id: 'stars5', emoji: '⭐', label: '별 5개', cond: (s) => s.stars >= 5 },
    { id: 'hundred', emoji: '💯', label: '100글자', cond: (s) => s.count >= 100 },
    { id: 'streak7', emoji: '📅', label: '7일 연속', cond: (s) => s.streak >= 7 },
    { id: 'twohundred', emoji: '🏆', label: '200글자', cond: (s) => s.count >= 200 },
    { id: 'lv7', emoji: '🦅', label: '레벨 7', cond: (s) => s.level >= 7 },
    { id: 'streak14', emoji: '📆', label: '14일 연속', cond: (s) => s.streak >= 14 },
    { id: 'stars10', emoji: '🌠', label: '별 10개', cond: (s) => s.stars >= 10 },
    { id: 'threehundred', emoji: '🎖️', label: '300글자', cond: (s) => s.count >= 300 },
    { id: 'lv8', emoji: '👑', label: '레벨 8', cond: (s) => s.level >= 8 },
    { id: 'fivehundred', emoji: '🏵️', label: '500글자', cond: (s) => s.count >= 500 }
  ];

  function blank() {
    return {
      score: 0, stars: 0, streak: 0, lastDay: '', count: 0, dayCount: 0, dayCountDay: '',
      activeDays: [], goalCelebratedDay: ''
    };
  }

  let state = blank();
  let booted = false;
  let _comboCount = 0;   // 짧은 시간 안에 연속 완성한 콤보
  let _lastAwardAt = 0;

  function load() {
    const d = (typeof Utils !== 'undefined') ? Utils.loadLocal(KEY, null) : null;
    state = (d && typeof d === 'object') ? Object.assign(blank(), d) : blank();
  }

  function save() {
    if (typeof Utils !== 'undefined') Utils.saveLocal(KEY, state);
  }

  /** 누적 점수 → 레벨(1부터). 50,200,450,800… (제곱 곡선)으로 천천히 오른다. */
  function levelFor(score) {
    return Math.floor(Math.sqrt(Math.max(0, score) / 50)) + 1;
  }

  /** 다음 레벨까지 필요한 점수 경계. */
  function scoreForLevel(level) {
    const n = Math.max(0, level - 1);
    return 50 * n * n;
  }

  function levelTitle(level) {
    return LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.max(0, level - 1))];
  }

  function dayStr(d) {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function touchStreak() {
    const today = dayStr(new Date());
    if (state.lastDay === today) return;
    const yesterday = dayStr(new Date(Date.now() - 86400000));
    state.streak = (state.lastDay === yesterday) ? (state.streak + 1) : 1;
    state.lastDay = today;
  }

  function touchDay() {
    const today = dayStr(new Date());
    if (state.dayCountDay !== today) {
      state.dayCountDay = today;
      state.dayCount = 0;
    }
  }

  function praise() {
    return PRAISES[Math.floor(Math.random() * PRAISES.length)];
  }

  /** 현재 상태의 파생 통계(스티커 조건 평가용). */
  function statsFrom(st) {
    return {
      score: st.score,
      level: levelFor(st.score),
      stars: st.stars,
      streak: st.streak,
      count: st.count
    };
  }

  function earnedSet(stats) {
    const set = new Set();
    STICKERS.forEach((s) => { if (s.cond(stats)) set.add(s.id); });
    return set;
  }

  function get() {
    const lv = levelFor(state.score);
    const earned = earnedSet(statsFrom(state));
    return {
      score: state.score,
      level: lv,
      title: levelTitle(lv),
      stars: state.stars,
      streak: state.streak,
      count: state.count,
      todayCount: (state.dayCountDay === dayStr(new Date())) ? state.dayCount : 0,
      goal: DAILY_GOAL,
      stickersEarned: earned.size,
      stickersTotal: STICKERS.length,
      nextLevelScore: scoreForLevel(lv + 1)
    };
  }

  /** 스티커 도감 목록 — [{id, emoji, label, earned}]. */
  function stickers() {
    const earned = earnedSet(statsFrom(state));
    return STICKERS.map((s) => ({ id: s.id, emoji: s.emoji, label: s.label, earned: earned.has(s.id) }));
  }

  /* ---- DOM: 칭찬 토스트 ---- */
  function ensureToast() {
    let el = document.getElementById('trace-reward-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'trace-reward-toast';
      el.className = 'trace-reward-toast';
      el.setAttribute('aria-live', 'polite');
      (document.getElementById('app') || document.body).appendChild(el);
    }
    return el;
  }

  let _toastTimer = null;
  function flashToast(html, cls, ms) {
    if (typeof document === 'undefined') return;
    const el = ensureToast();
    el.className = 'trace-reward-toast' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
    // 재트리거: 애니메이션 리셋
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      el.classList.remove('show');
      _toastTimer = null;
    }, ms);
  }

  function showPraiseToast(points, leveledUp, level, combo) {
    const plus = points > 0 ? `<span class="trt-points">+${points}</span>` : '';
    if (leveledUp) {
      flashToast(`<span class="trt-praise">레벨 업! ⭐ ${levelTitle(level)}</span>${plus}`, 'levelup', 1800);
    } else {
      const comboTxt = (combo >= 3) ? `<span class="trt-combo">콤보 x${combo}!</span> ` : '';
      flashToast(`${comboTxt}<span class="trt-praise">${praise()}</span>${plus}`, combo >= 3 ? 'combo' : '', 1200);
    }
  }

  function showStickerToast(sticker) {
    flashToast(
      `<span class="trt-praise">새 스티커! ${sticker.emoji} ${sticker.label}</span>`,
      'sticker',
      2000
    );
  }

  /* ---- DOM: 메뉴 배지 ---- */
  function updateBadge() {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('menu-reward-badge');
    if (!el) return;
    const g = get();
    el.innerHTML =
      `<span class="rb-level">Lv.${g.level} <b>${g.title}</b></span>`
      + `<span class="rb-stat">🎯 ${g.todayCount}/${g.goal}</span>`
      + `<span class="rb-stat">⭐ ${g.stars}</span>`
      + `<span class="rb-stat">🔥 ${g.streak}일</span>`
      + `<span class="rb-stat">${g.score}점</span>`;
  }

  /**
   * 완성 보상. 점수를 더하고 레벨/별/연속일/오늘 수를 갱신한 뒤 토스트를 띄운다.
   * 새 스티커가 해금되면 스티커 토스트를 우선한다.
   * @param {number} points 획득 점수(기본 10)
   * @returns {{score:number, level:number, leveledUp:boolean, newSticker:?object}}
   */
  function award(points) {
    if (!booted) boot();
    const pts = (typeof points === 'number' && points > 0) ? Math.round(points) : 10;
    // 스티커 기준선은 streak/day 갱신 '전'에 떠야 한다 — 그래야 이번 완성으로
    // streak 가 임계(3·7일)를 넘는 순간 streak 스티커를 '새로' 획득으로 감지한다.
    const beforeEarned = earnedSet(statsFrom(state));
    const beforeLevel = levelFor(state.score);

    touchStreak();
    touchDay();
    const today = dayStr(new Date());

    // 활동일 기록(주간 달력용) — 최근 60일만 유지.
    if (!Array.isArray(state.activeDays)) state.activeDays = [];
    if (state.activeDays.indexOf(today) < 0) {
      state.activeDays.push(today);
      if (state.activeDays.length > 60) state.activeDays = state.activeDays.slice(-60);
    }

    // 콤보: 8초 안에 연속 완성하면 콤보 누적(보너스 최대 +8).
    const now = (typeof Date.now === 'function') ? Date.now() : 0;
    _comboCount = (now - _lastAwardAt < 8000) ? (_comboCount + 1) : 1;
    _lastAwardAt = now;
    const comboBonus = Math.min(8, Math.max(0, _comboCount - 1) * 2);
    const total = pts + comboBonus;

    state.score += total;
    state.count += 1;
    state.dayCount += 1;

    // 오늘 목표(10개) 달성 — 하루 한 번 축하.
    const hitDailyGoal = state.dayCount === DAILY_GOAL && state.goalCelebratedDay !== today;
    if (hitDailyGoal) state.goalCelebratedDay = today;

    const afterLevel = levelFor(state.score);
    const leveledUp = afterLevel > beforeLevel;
    if (leveledUp) state.stars += 1;

    // 별 증가까지 반영한 최종 통계로 새 스티커 판정.
    const newSticker = STICKERS.find((s) => s.cond(statsFrom(state)) && !beforeEarned.has(s.id)) || null;

    save();
    if (newSticker) {
      showStickerToast(newSticker);
    } else if (leveledUp) {
      // 레벨업 축하가 최우선(오늘 목표 달성과 겹쳐도 레벨업을 보여 준다).
      showPraiseToast(total, true, afterLevel, _comboCount);
    } else if (hitDailyGoal) {
      flashToast(`<span class="trt-praise">오늘 목표 달성! 🎯 ${DAILY_GOAL}개</span> <span class="trt-points">+${total}</span>`, 'levelup', 1800);
    } else {
      showPraiseToast(total, false, afterLevel, _comboCount);
    }
    updateBadge();
    return { score: state.score, level: afterLevel, leveledUp, newSticker, combo: _comboCount };
  }

  /** 메모리 상태까지 초기화(부모용 진행 기록 리셋). localStorage 키도 제거. */
  function reset() {
    state = blank();
    booted = true;
    _comboCount = 0;   // 콤보 누적도 초기화(리셋 직후 옛 콤보가 이어지지 않게)
    _lastAwardAt = 0;
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); } catch (_e) { /* 무시 */ }
    save();
    updateBadge();
  }

  function boot() {
    if (booted) return;
    booted = true;
    load();
    updateBadge();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  /** 활동일 목록(주간 달력용) — 'YYYY-M-D' 문자열 배열. */
  function activeDays() {
    return Array.isArray(state.activeDays) ? state.activeDays.slice() : [];
  }

  return {
    award, praise, get, stickers, updateBadge, reset, activeDays,
    level: () => levelFor(state.score)
  };
})();
