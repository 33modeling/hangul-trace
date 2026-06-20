/*
 * 보상·진척 엔진 — 흥미 유발용.
 *
 * 어떤 모드든 한 글자/단어/문제를 완성하면 TraceRewards.award(점수, 칭찬여부)를
 * 호출한다. 그러면:
 *   - 점수가 쌓이고 레벨이 오른다(레벨업 시 별 +1, 큰 축하).
 *   - 매번 칭찬 토스트("잘했어요! 👏" + "+10")가 떠서 계속 칭찬받는 느낌.
 *   - 하루 단위 연속 학습일(streak)을 센다.
 * 진척은 localStorage 에 저장되고, 메인 메뉴 배지(레벨·별·연속일)로 보여 준다.
 *
 * sound.js 처럼 자체 초기화하는 IIFE. 의존: Utils(utils.js).
 */
const TraceRewards = (function () {
  const KEY = 'tracing.rewards.v1';
  const PRAISES = [
    '잘했어요! 👏', '최고예요! 🌟', '대단해요! 🎉', '멋져요! ✨',
    '완벽해요! 💯', '훌륭해요! 🏆', '좋아요! 😊', '신나요! 🎈',
    '그렇지! 👍', '척척박사! 🦊'
  ];
  const LEVEL_TITLES = [
    '한글 새싹 🌱', '한글 꼬마 🐣', '한글 친구 🐥', '한글 박사 🦉',
    '한글 마법사 🧙', '한글 왕 👑', '한글 별 🌟', '한글 전설 🏆'
  ];

  function blank() {
    return { score: 0, stars: 0, streak: 0, lastDay: '', count: 0 };
  }

  let state = blank();
  let booted = false;

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

  function praise() {
    return PRAISES[Math.floor(Math.random() * PRAISES.length)];
  }

  function get() {
    return {
      score: state.score,
      level: levelFor(state.score),
      title: levelTitle(levelFor(state.score)),
      stars: state.stars,
      streak: state.streak,
      count: state.count,
      nextLevelScore: scoreForLevel(levelFor(state.score) + 1)
    };
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
  function showToast(points, leveledUp, level) {
    if (typeof document === 'undefined') return;
    const el = ensureToast();
    const plus = points > 0 ? `<span class="trt-points">+${points}</span>` : '';
    if (leveledUp) {
      el.innerHTML = `<span class="trt-praise">레벨 업! ⭐ ${levelTitle(level)}</span>${plus}`;
      el.classList.add('levelup');
    } else {
      el.innerHTML = `<span class="trt-praise">${praise()}</span>${plus}`;
      el.classList.remove('levelup');
    }
    // 재트리거: 애니메이션 리셋
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
      el.classList.remove('show');
      _toastTimer = null;
    }, leveledUp ? 1800 : 1200);
  }

  /* ---- DOM: 메뉴 배지 ---- */
  function updateBadge() {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('menu-reward-badge');
    if (!el) return;
    const g = get();
    el.innerHTML =
      `<span class="rb-level">Lv.${g.level} <b>${g.title}</b></span>`
      + `<span class="rb-stat">⭐ ${g.stars}</span>`
      + `<span class="rb-stat">🔥 ${g.streak}일</span>`
      + `<span class="rb-stat">${g.score}점</span>`;
  }

  /**
   * 완성 보상. 점수를 더하고 레벨/별/연속일을 갱신한 뒤 칭찬 토스트를 띄운다.
   * @param {number} points 획득 점수(기본 10)
   * @returns {{score:number, level:number, leveledUp:boolean}}
   */
  function award(points) {
    if (!booted) boot();
    const pts = (typeof points === 'number' && points > 0) ? Math.round(points) : 10;
    touchStreak();
    const before = levelFor(state.score);
    state.score += pts;
    state.count += 1;
    const after = levelFor(state.score);
    const leveledUp = after > before;
    if (leveledUp) state.stars += 1;
    save();
    showToast(pts, leveledUp, after);
    updateBadge();
    return { score: state.score, level: after, leveledUp };
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

  return { award, praise, get, updateBadge, level: () => levelFor(state.score) };
})();
