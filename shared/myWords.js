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
  K: 3, L: 3, M: 4, N: 3, O: 1, P: 2, Q: 2, R: 3, S: 2, T: 2,
  U: 2, V: 2, W: 4, X: 2, Y: 2, Z: 3,
  a: 2, b: 2, c: 1, d: 2, e: 2, f: 1, g: 2, h: 3, i: 1, j: 3,
  k: 2, l: 1, m: 3, n: 2, o: 1, p: 2, q: 2, r: 1, s: 1, t: 2,
  u: 2, v: 2, w: 4, x: 2, y: 2, z: 2
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
        return { valid: false, message: '한글(가~힣)만 입력할 수 있어요.' };
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
    .filter((s) => traceValidateMyWordInput(s, 'auto').valid);
}

function traceSaveMyWords(words) {
  const clean = words.filter(
    (s) => typeof s === 'string' && traceValidateMyWordInput(s, 'auto').valid
  );
  Utils.saveLocal(TRACE_MY_WORDS_STORAGE_KEY, clean);
}

/** 한글 음절 하나에 대한 획수 근사: NFD 자모 분해 후 COMMON.CHARS 합산 */
function traceMyWordSyllableStrokes(syllable) {
  if (typeof syllable !== 'string' || syllable.length !== 1) return 3;
  const parts = syllable.normalize('NFD');
  let sum = 0;
  for (const ch of parts) {
    if (/[ㄱ-ㅎㅏ-ㅣ]/.test(ch)) {
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
