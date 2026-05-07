/** @typedef {{ valid: boolean, message?: string, word?: string }} MyWordValidateResult */

const TRACE_MY_WORDS_STORAGE_KEY = 'tracing.myWords.v1';

/** 한 단어당 음절 한도: 1~20글자 (가로 모드는 4글자 윈도우로 슬라이드) */
const TRACE_MY_WORD_MAX_SYLLABLES = 20;
/** 가로 모드에서 한 번에 보이는 음절 수 */
const TRACE_MY_WORD_WINDOW_SIZE = 4;
/** 등록 가능한 전체 단어 개수 한도 */
const TRACE_MY_WORDS_MAX_COUNT = 30;

function traceValidateMyWordInput(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { valid: false, message: '단어를 입력하세요.' };
  }
  const syllables = Array.from(trimmed);
  if (syllables.length > TRACE_MY_WORD_MAX_SYLLABLES) {
    return {
      valid: false,
      message: `한글 음절은 최대 ${TRACE_MY_WORD_MAX_SYLLABLES}글자까지 등록할 수 있어요.`
    };
  }
  for (const ch of syllables) {
    if (!/^[가-힣]$/.test(ch)) {
      return { valid: false, message: '완성형 한글(가~힣)만 입력할 수 있어요.' };
    }
  }
  return { valid: true, word: syllables.join('') };
}

function traceLoadMyWords() {
  const raw = Utils.loadLocal(TRACE_MY_WORDS_STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => traceValidateMyWordInput(s).valid);
}

function traceSaveMyWords(words) {
  const clean = words.filter((s) => typeof s === 'string' && traceValidateMyWordInput(s).valid);
  Utils.saveLocal(TRACE_MY_WORDS_STORAGE_KEY, clean);
}

/** 음절 하나에 대한 획수 근사: NFD 자모 나열 후 COMMON.CHARS 합산 */
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

function traceMyWordStrokeTargetForSyllables(syllables) {
  let t = 0;
  for (const s of syllables) {
    t += traceMyWordSyllableStrokes(s);
  }
  return Math.max(1, t);
}
