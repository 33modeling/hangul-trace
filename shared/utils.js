// 유틸리티 함수
const Utils = {
  // 랜덤 숫자 생성
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  
  // 배열 셔플
  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },
  
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
  
  // 문자열 포맷팅
  formatStrokes(strokes) {
    return strokes === 1 ? `${strokes}획` : `${strokes}획`;
  },
  
  // 한글 자음 체크
  isConsonant(char) {
    return /[ㄱ-ㅎ]/.test(char);
  },
  
  // 한글 모음 체크
  isVowel(char) {
    return /[ㅏ-ㅣ]/.test(char);
  },
  
  // 숫자 체크
  isNumber(char) {
    return /[0-9]/.test(char);
  },
  
  // 영어 알파벳 체크
  isEnglish(char) {
    return /[a-zA-Z]/.test(char);
  },
  
  // 디바이스 타입 체크
  isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent);
  },
  
  // orientation 체크
  isLandscape() {
    return window.innerWidth > window.innerHeight;
  },
  
  // 딜레이 함수
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

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
