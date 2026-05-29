/** @typedef {{ valid: boolean, message?: string, word?: string, kind?: 'ko'|'en' }} MyWordValidateResult */

const TRACE_MY_WORDS_STORAGE_KEY = 'tracing.myWords.v1';

/** 한 단어당 글자 한도: 1~20글자 (가로 모드는 4글자 윈도우로 슬라이드) */
const TRACE_MY_WORD_MAX_SYLLABLES = 20;
/** 가로 모드에서 한 번에 보이는 글자 수 */
const TRACE_MY_WORD_WINDOW_SIZE = 4;
/** 등록 가능한 전체 단어 개수 한도 */
const TRACE_MY_WORDS_MAX_COUNT = 30;

/** 영문 알파벳 strokes 표 (modes/english/modes.js의 UPPERCASE/LOWERCASE와 동일) */
const TRACE_ENGLISH_STROKES = {
  A: 3, B: 2, C: 1, D: 2, E: 3, F: 3, G: 2, H: 3, I: 1, J: 2,
  K: 3, L: 2, M: 4, N: 3, O: 1, P: 2, Q: 2, R: 3, S: 1, T: 2,
  U: 1, V: 2, W: 4, X: 2, Y: 2, Z: 3,
  a: 2, b: 2, c: 1, d: 2, e: 1, f: 2, g: 2, h: 2, i: 2, j: 2,
  k: 2, l: 1, m: 3, n: 2, o: 1, p: 2, q: 2, r: 1, s: 1, t: 2,
  u: 1, v: 2, w: 4, x: 2, y: 2, z: 2
};

/** 단어를 'ko' / 'en' / null 로 자동 분류 */
function traceClassifyWord(text) {
  if (!text || typeof text !== 'string') return null;
  if (/^[가-힣]+$/.test(text)) return 'ko';
  if (/^[a-zA-Z]+$/.test(text)) return 'en';
  return null;
}

/**
 * 입력 검증.
 * @param {string} raw 사용자 입력 원문
 * @param {'ko'|'en'|'auto'} [kind='auto'] 'auto'면 한·영 자동 판별
 */
function traceValidateMyWordInput(raw, kind) {
  const mode = kind || 'auto';
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { valid: false, message: '단어를 입력하세요.' };
  }
  const letters = Array.from(trimmed);
  if (letters.length > TRACE_MY_WORD_MAX_SYLLABLES) {
    return {
      valid: false,
      message: `최대 ${TRACE_MY_WORD_MAX_SYLLABLES}글자까지 등록할 수 있어요.`
    };
  }

  let resolved = mode;
  if (resolved === 'auto') {
    resolved = traceClassifyWord(trimmed);
    if (!resolved) {
      return {
        valid: false,
        message: '한 단어 안에 한글과 영문을 섞을 수 없어요. 한 가지로만 입력해 주세요.'
      };
    }
  }

  if (resolved === 'ko') {
    for (const ch of letters) {
      if (!/^[가-힣]$/.test(ch)) {
        return { valid: false, message: '한글만 입력할 수 있어요.' };
      }
    }
  } else if (resolved === 'en') {
    for (const ch of letters) {
      if (!/^[a-zA-Z]$/.test(ch)) {
        return { valid: false, message: '영문(a-z, A-Z)만 입력할 수 있어요.' };
      }
    }
  } else {
    return { valid: false, message: '지원하지 않는 입력 종류예요.' };
  }

  return { valid: true, word: letters.join(''), kind: resolved };
}

function traceLoadMyWords() {
  const raw = Utils.loadLocal(TRACE_MY_WORDS_STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => traceValidateMyWordInput(s, 'auto').valid)
    // 개수 상한은 load/save 계층에서 강제 — 외부에서 변조/마이그레이션된
    // 데이터가 상한을 우회해 전부 로드되는 것을 방지.
    .slice(0, TRACE_MY_WORDS_MAX_COUNT);
}

/** 저장 성공 시 true, 실패(용량 초과 등) 시 false 반환. */
function traceSaveMyWords(words) {
  const clean = words
    .filter((s) => typeof s === 'string' && traceValidateMyWordInput(s, 'auto').valid)
    .slice(0, TRACE_MY_WORDS_MAX_COUNT);
  return Utils.saveLocal(TRACE_MY_WORDS_STORAGE_KEY, clean);
}

/**
 * NFD 분해 후 등장하는 conjoining jamo (U+1100~U+11C2) strokes 표.
 *
 * 중요: '강'.normalize('NFD') 의 결과 코드포인트는 U+1100/U+1161/U+11BC
 * (conjoining jamo) 이고, 호환 자모 영역(U+3131~U+3163, 'ㄱ' 'ㅏ' 등)과
 * 다른 영역이다. 기존 코드는 /[ㄱ-ㅎㅏ-ㅣ]/ (호환자모) 정규식으로
 * 매칭을 시도해서 NFD 결과를 한 자모도 잡지 못했고, 그 결과 모든
 * 한글 음절 strokes가 fallback 1로 계산되어 한 획만 그어도 완성으로
 * 판정되는 버그가 있었다.
 *
 * 획수의 단일 소스는 common.js(CHARS)다. 이 표의 값은 CHARS의 기본
 * 자모 획수(ㄱ2 ㄴ2 ㄷ3 ㄹ5 ㅁ4 ㅂ4 ㅅ2 ㅇ1 ㅈ3 ㅊ4 ㅋ3 ㅌ4 ㅍ4 ㅎ3,
 * ㅏ2 … ㅡ1 ㅣ1)에서 파생한다: 쌍자음은 기본의 2배, 겹받침은 구성 자모
 * 획수의 합. (예: ㄲ=4, ㄳ=ㄱ+ㅅ=4, ㄺ=ㄹ+ㄱ=7) 이렇게 해야 '가'가
 * 단어 모드(ㄱ2+ㅏ2=4)와 내 단어/상급 모드에서 동일한 4획으로 일치한다.
 * 과거에는 ㄱ=1 등 다른 셈법을 써서 모드별 완성 기준이 어긋났다.
 */
const TRACE_JAMO_STROKES = {
  /* 초성 (U+1100~U+1112) — CHARS 기준, 쌍자음=2배 */
  'ᄀ': 2, 'ᄁ': 4, 'ᄂ': 2, 'ᄃ': 3, 'ᄄ': 6,
  'ᄅ': 5, 'ᄆ': 4, 'ᄇ': 4, 'ᄈ': 8, 'ᄉ': 2,
  'ᄊ': 4, 'ᄋ': 1, 'ᄌ': 3, 'ᄍ': 6, 'ᄎ': 4,
  'ᄏ': 3, 'ᄐ': 4, 'ᄑ': 4, 'ᄒ': 3,
  /* 중성 (U+1161~U+1175) — CHARS 기준, 복합모음=구성 합 */
  'ᅡ': 2, 'ᅢ': 3, 'ᅣ': 3, 'ᅤ': 4, 'ᅥ': 2,
  'ᅦ': 3, 'ᅧ': 3, 'ᅨ': 4, 'ᅩ': 2, 'ᅪ': 4,
  'ᅫ': 5, 'ᅬ': 3, 'ᅭ': 3, 'ᅮ': 2, 'ᅯ': 4,
  'ᅰ': 5, 'ᅱ': 3, 'ᅲ': 3, 'ᅳ': 1, 'ᅴ': 2, 'ᅵ': 1,
  /* 종성 (U+11A8~U+11C2) — CHARS 기준, 겹받침=구성 자모 합 */
  'ᆨ': 2, 'ᆩ': 4, 'ᆪ': 4, 'ᆫ': 2, 'ᆬ': 5,
  'ᆭ': 5, 'ᆮ': 3, 'ᆯ': 5, 'ᆰ': 7, 'ᆱ': 9,
  'ᆲ': 9, 'ᆳ': 7, 'ᆴ': 9, 'ᆵ': 9, 'ᆶ': 8,
  'ᆷ': 4, 'ᆸ': 4, 'ᆹ': 6, 'ᆺ': 2, 'ᆻ': 4,
  'ᆼ': 1, 'ᆽ': 3, 'ᆾ': 4, 'ᆿ': 3, 'ᇀ': 4,
  'ᇁ': 4, 'ᇂ': 3
};

/** 한글 음절 하나에 대한 획수: NFD 분해 후 jamo strokes 합산 */
function traceMyWordSyllableStrokes(syllable) {
  if (typeof syllable !== 'string' || syllable.length === 0) return 3;
  const parts = syllable.normalize('NFD');
  let sum = 0;
  for (const ch of parts) {
    if (TRACE_JAMO_STROKES[ch] !== undefined) {
      sum += TRACE_JAMO_STROKES[ch];
    } else if (/[ㄱ-ㅎㅏ-ㅣ]/.test(ch)) {
      // 호환 자모로 직접 입력된 경우 (드물지만 안전)
      const item = COMMON.CHARS.find((x) => x.ch === ch);
      sum += item ? item.strokes : 2;
    }
  }
  return Math.max(1, sum);
}

/** 한 글자(한글 음절 또는 영문 letter) strokes — 자동 판별 */
function traceMyWordLetterStrokes(letter) {
  if (typeof letter !== 'string' || letter.length === 0) return 1;
  if (/[가-힣]/.test(letter)) {
    return traceMyWordSyllableStrokes(letter);
  }
  if (TRACE_ENGLISH_STROKES[letter] !== undefined) {
    return TRACE_ENGLISH_STROKES[letter];
  }
  return 2;
}

/** 음절·letter 목록의 strokes 합 (한·영 혼합 안전) */
function traceMyWordStrokeTargetForSyllables(letters) {
  let t = 0;
  for (const s of letters) {
    t += traceMyWordLetterStrokes(s);
  }
  return Math.max(1, t);
}
