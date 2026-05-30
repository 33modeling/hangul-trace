// 유틸리티 함수
const Utils = {
  // 로컬 스토리지 저장 — 성공 시 true, 실패(용량 초과/사파리 사생활모드/저장 비활성) 시 false
  saveLocal(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('localStorage save failed:', e);
      return false;
    }
  },

  // 로컬 스토리지 조회
  loadLocal(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
      console.warn('localStorage load failed:', e);
      return defaultValue;
    }
  },

  // orientation 체크 (myword/advanced 가로·세로 분기에서 사용)
  isLandscape() {
    return window.innerWidth > window.innerHeight;
  }
};

/**
 * 모드별 완료 진도(인덱스 Set) 복원 (#5).
 * 새로고침/재방문에도 자모·숫자·영어 완료 점이 유지되도록 localStorage 에서 읽어
 * doneSet 에 채운다. 저장된 인덱스 중 현재 항목 수(count) 범위를 벗어난 값은 버린다
 * (데이터가 줄어든 경우 방어).
 */
function traceLoadDoneInto(doneSet, key, count) {
  if (!doneSet || !key) return doneSet;
  const arr = Utils.loadLocal(key, []);
  if (Array.isArray(arr)) {
    arr.forEach((i) => {
      if (Number.isInteger(i) && i >= 0 && i < count) doneSet.add(i);
    });
  }
  return doneSet;
}

/** 완료 진도(인덱스 Set)를 localStorage 에 저장 (#5). */
function traceSaveDone(key, doneSet) {
  if (!key || !doneSet) return;
  Utils.saveLocal(key, Array.from(doneSet));
}

/** 고정 DOM에 클릭 한 번 연결 (버블 단계, passive: false) */
function bindButtonClick(el, handler) {
  if (!el || typeof handler !== 'function') return;
  el.addEventListener(
    'click',
    (e) => {
      e.preventDefault();
      handler();
    },
    { passive: false }
  );
}

/** 재진입 시 중복 리스너를 피하려 노드를 갈아끼운 뒤 클릭 연결 */
function rebindButtonClickById(id, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  const neu = el.cloneNode(true);
  el.replaceWith(neu);
  bindButtonClick(neu, handler);
}

/** id에 onclick 한 줄 연결 — 메뉴로 버튼과 동일. 좌우 전환(prev/next)은 WebView에서 clone+click보다 안정적인 경우가 많음 */
function wireButtonById(id, handler) {
  const el = document.getElementById(id);
  if (!el || typeof handler !== 'function') return;
  el.onclick = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    handler();
  };
}
