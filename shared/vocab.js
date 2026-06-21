/*
 * 어휘 데이터셋 — 단어 카드/퀴즈/뜻 표시 공용.
 *
 * 소중한글식 학습(뜻 이해·단어 암기·처음 글 익히기)을 위해, 따라쓰기만 하던
 * 기존 데이터에 "뜻 + 그림(이모지) + 분류"를 더한다. 발음은 텍스트 우선이라
 * 음원 없이 글자·뜻·그림으로 구성한다.
 *
 * 규칙:
 *  - word 는 한글 1~4글자(단어 카드가 한 행에 통째로 보여주므로 4글자 이하).
 *  - emoji 는 단어를 직관적으로 떠올리게 하는 한 글자.
 *  - meaning 은 아이 눈높이의 한 줄 설명.
 */
const TRACE_VOCAB = [
  // ── 동물 ──────────────────────────────
  { word: '강아지', meaning: '멍멍 짖는 귀여운 동물', emoji: '🐶', category: '동물' },
  { word: '고양이', meaning: '야옹 우는 부드러운 동물', emoji: '🐱', category: '동물' },
  { word: '토끼', meaning: '귀가 길고 깡충 뛰는 동물', emoji: '🐰', category: '동물' },
  { word: '곰', meaning: '크고 힘센 숲속 동물', emoji: '🐻', category: '동물' },
  { word: '사자', meaning: '갈기가 멋진 동물의 왕', emoji: '🦁', category: '동물' },
  { word: '코끼리', meaning: '코가 길고 몸집이 큰 동물', emoji: '🐘', category: '동물' },
  { word: '호랑이', meaning: '줄무늬가 있는 무서운 동물', emoji: '🐯', category: '동물' },
  { word: '병아리', meaning: '삐약삐약 우는 아기 닭', emoji: '🐤', category: '동물' },
  { word: '거북이', meaning: '느리지만 단단한 등껍질 동물', emoji: '🐢', category: '동물' },
  { word: '물고기', meaning: '물속에서 헤엄치는 동물', emoji: '🐟', category: '동물' },

  // ── 과일 ──────────────────────────────
  { word: '사과', meaning: '빨갛고 동그란 과일', emoji: '🍎', category: '과일' },
  { word: '바나나', meaning: '노랗고 길쭉한 과일', emoji: '🍌', category: '과일' },
  { word: '포도', meaning: '보라색 알이 모인 과일', emoji: '🍇', category: '과일' },
  { word: '딸기', meaning: '빨갛고 씨가 송송한 과일', emoji: '🍓', category: '과일' },
  { word: '수박', meaning: '크고 줄무늬가 있는 여름 과일', emoji: '🍉', category: '과일' },
  { word: '복숭아', meaning: '말랑하고 향긋한 분홍 과일', emoji: '🍑', category: '과일' },

  // ── 음식 ──────────────────────────────
  { word: '밥', meaning: '매일 먹는 하얀 쌀밥', emoji: '🍚', category: '음식' },
  { word: '김밥', meaning: '김에 밥과 재료를 만 음식', emoji: '🍙', category: '음식' },
  { word: '빵', meaning: '폭신하고 고소한 먹거리', emoji: '🍞', category: '음식' },
  { word: '우유', meaning: '하얗고 고소한 마실 것', emoji: '🥛', category: '음식' },
  { word: '계란', meaning: '닭이 낳은 동그란 알', emoji: '🥚', category: '음식' },
  { word: '라면', meaning: '꼬불꼬불한 면 요리', emoji: '🍜', category: '음식' },
  { word: '사탕', meaning: '달콤한 작은 간식', emoji: '🍬', category: '음식' },

  // ── 자연 ──────────────────────────────
  { word: '나무', meaning: '잎과 가지가 자라는 식물', emoji: '🌳', category: '자연' },
  { word: '꽃', meaning: '예쁘게 피는 식물의 한 부분', emoji: '🌸', category: '자연' },
  { word: '해', meaning: '낮에 환하게 비추는 별', emoji: '☀️', category: '자연' },
  { word: '달', meaning: '밤하늘에 뜨는 둥근 것', emoji: '🌙', category: '자연' },
  { word: '별', meaning: '밤하늘에 반짝이는 작은 빛', emoji: '⭐', category: '자연' },
  { word: '구름', meaning: '하늘에 떠 있는 하얀 것', emoji: '☁️', category: '자연' },
  { word: '바다', meaning: '넓고 파란 짠 물', emoji: '🌊', category: '자연' },
  { word: '산', meaning: '높이 솟은 땅', emoji: '⛰️', category: '자연' },

  // ── 가족 ──────────────────────────────
  { word: '엄마', meaning: '나를 낳아 주신 여자 어른', emoji: '👩', category: '가족' },
  { word: '아빠', meaning: '나를 지켜 주는 남자 어른', emoji: '👨', category: '가족' },
  { word: '아기', meaning: '아주 어린 사람', emoji: '👶', category: '가족' },
  { word: '할머니', meaning: '엄마·아빠의 어머니', emoji: '👵', category: '가족' },
  { word: '할아버지', meaning: '엄마·아빠의 아버지', emoji: '👴', category: '가족' },

  // ── 물건 ──────────────────────────────
  { word: '가방', meaning: '물건을 넣어 메는 것', emoji: '🎒', category: '물건' },
  { word: '연필', meaning: '글씨를 쓰는 도구', emoji: '✏️', category: '물건' },
  { word: '책', meaning: '글과 그림이 담긴 것', emoji: '📖', category: '물건' },
  { word: '시계', meaning: '시간을 알려 주는 물건', emoji: '⏰', category: '물건' },
  { word: '우산', meaning: '비 올 때 쓰는 것', emoji: '☂️', category: '물건' },
  { word: '신발', meaning: '발에 신는 것', emoji: '👟', category: '물건' },
  { word: '모자', meaning: '머리에 쓰는 것', emoji: '🧢', category: '물건' },
  { word: '공', meaning: '굴리고 차는 둥근 것', emoji: '⚽', category: '물건' },

  // ── 탈것 ──────────────────────────────
  { word: '자동차', meaning: '바퀴로 달리는 탈것', emoji: '🚗', category: '탈것' },
  { word: '버스', meaning: '여러 사람이 타는 큰 차', emoji: '🚌', category: '탈것' },
  { word: '기차', meaning: '길게 이어져 달리는 탈것', emoji: '🚂', category: '탈것' },
  { word: '비행기', meaning: '하늘을 나는 탈것', emoji: '✈️', category: '탈것' },
  { word: '자전거', meaning: '두 바퀴로 타는 탈것', emoji: '🚲', category: '탈것' },

  // ── 몸 ────────────────────────────────
  { word: '눈', meaning: '사물을 보는 몸의 부분', emoji: '👁️', category: '몸' },
  { word: '코', meaning: '냄새를 맡는 몸의 부분', emoji: '👃', category: '몸' },
  { word: '입', meaning: '말하고 먹는 몸의 부분', emoji: '👄', category: '몸' },
  { word: '귀', meaning: '소리를 듣는 몸의 부분', emoji: '👂', category: '몸' },
  { word: '손', meaning: '물건을 잡는 몸의 부분', emoji: '✋', category: '몸' },
  { word: '발', meaning: '서고 걷는 몸의 부분', emoji: '🦶', category: '몸' },
  { word: '이', meaning: '음식을 씹는 하얀 것', emoji: '🦷', category: '몸' },
  { word: '팔', meaning: '어깨에서 손까지', emoji: '💪', category: '몸' },
  { word: '다리', meaning: '서고 걷게 하는 몸', emoji: '🦵', category: '몸' },
  { word: '혀', meaning: '맛을 보는 입속 부분', emoji: '👅', category: '몸' },

  // ── 동물 (추가) ───────────────────────
  { word: '돼지', meaning: '꿀꿀 우는 분홍 동물', emoji: '🐷', category: '동물' },
  { word: '오리', meaning: '꽥꽥 우는 물새', emoji: '🦆', category: '동물' },
  { word: '개구리', meaning: '개굴개굴 뛰는 동물', emoji: '🐸', category: '동물' },
  { word: '펭귄', meaning: '뒤뚱뒤뚱 걷는 새', emoji: '🐧', category: '동물' },
  { word: '나비', meaning: '날개가 예쁜 곤충', emoji: '🦋', category: '동물' },
  { word: '벌', meaning: '윙윙 나는 꿀 곤충', emoji: '🐝', category: '동물' },
  { word: '뱀', meaning: '길게 기어 다니는 동물', emoji: '🐍', category: '동물' },
  { word: '원숭이', meaning: '나무를 잘 타는 동물', emoji: '🐵', category: '동물' },
  { word: '다람쥐', meaning: '도토리를 모으는 동물', emoji: '🐿️', category: '동물' },
  { word: '여우', meaning: '꼬리가 복슬한 동물', emoji: '🦊', category: '동물' },

  // ── 과일 (추가) ───────────────────────
  { word: '귤', meaning: '주황색 새콤한 과일', emoji: '🍊', category: '과일' },
  { word: '키위', meaning: '초록색 털 있는 과일', emoji: '🥝', category: '과일' },
  { word: '레몬', meaning: '노랗고 신 과일', emoji: '🍋', category: '과일' },
  { word: '체리', meaning: '빨갛고 작은 과일', emoji: '🍒', category: '과일' },
  { word: '멜론', meaning: '달고 향긋한 초록 과일', emoji: '🍈', category: '과일' },
  { word: '망고', meaning: '노랗고 말랑한 과일', emoji: '🥭', category: '과일' },

  // ── 음식 (추가) ───────────────────────
  { word: '피자', meaning: '둥글게 자른 빵 요리', emoji: '🍕', category: '음식' },
  { word: '치즈', meaning: '노랗고 고소한 것', emoji: '🧀', category: '음식' },
  { word: '케이크', meaning: '생일에 먹는 단 빵', emoji: '🍰', category: '음식' },
  { word: '햄버거', meaning: '빵 사이에 넣은 음식', emoji: '🍔', category: '음식' },
  { word: '떡', meaning: '쫄깃한 쌀 간식', emoji: '🍡', category: '음식' },
  { word: '과자', meaning: '바삭한 단 간식', emoji: '🍪', category: '음식' },
  { word: '꿀', meaning: '벌이 만든 단 것', emoji: '🍯', category: '음식' },

  // ── 자연 (추가) ───────────────────────
  { word: '비', meaning: '하늘에서 내리는 물', emoji: '🌧️', category: '자연' },
  { word: '눈송이', meaning: '하늘에서 내리는 하얀 것', emoji: '❄️', category: '자연' },
  { word: '무지개', meaning: '비 온 뒤 일곱 빛깔', emoji: '🌈', category: '자연' },
  { word: '불', meaning: '뜨겁고 빨간 것', emoji: '🔥', category: '자연' },
  { word: '돌', meaning: '단단한 작은 바위', emoji: '🪨', category: '자연' },
  { word: '풀', meaning: '땅에 자라는 초록 식물', emoji: '🌿', category: '자연' },
  { word: '번개', meaning: '번쩍 빛나는 하늘 빛', emoji: '⚡', category: '자연' },

  // ── 가족 (추가) ───────────────────────
  { word: '형', meaning: '남자아이의 손위 남자', emoji: '👦', category: '가족' },
  { word: '누나', meaning: '남자아이의 손위 여자', emoji: '👧', category: '가족' },
  { word: '친구', meaning: '같이 노는 또래', emoji: '🧒', category: '가족' },
  { word: '선생님', meaning: '가르쳐 주시는 분', emoji: '🧑‍🏫', category: '가족' },

  // ── 물건 (추가) ───────────────────────
  { word: '의자', meaning: '앉을 때 쓰는 가구', emoji: '🪑', category: '물건' },
  { word: '침대', meaning: '잠잘 때 눕는 곳', emoji: '🛏️', category: '물건' },
  { word: '칫솔', meaning: '이를 닦는 도구', emoji: '🪥', category: '물건' },
  { word: '열쇠', meaning: '문을 여는 것', emoji: '🔑', category: '물건' },
  { word: '풍선', meaning: '바람 넣어 부푸는 것', emoji: '🎈', category: '물건' },
  { word: '인형', meaning: '안고 노는 장난감', emoji: '🧸', category: '물건' },
  { word: '북', meaning: '둥둥 치는 악기', emoji: '🥁', category: '물건' },
  { word: '카메라', meaning: '사진을 찍는 물건', emoji: '📷', category: '물건' },

  // ── 탈것 (추가) ───────────────────────
  { word: '배', meaning: '물 위를 가는 탈것', emoji: '⛵', category: '탈것' },
  { word: '트럭', meaning: '짐을 싣는 큰 차', emoji: '🚚', category: '탈것' },
  { word: '택시', meaning: '태워 주는 노란 차', emoji: '🚕', category: '탈것' },
  { word: '오토바이', meaning: '두 바퀴 엔진 탈것', emoji: '🏍️', category: '탈것' },
  { word: '로켓', meaning: '우주로 가는 탈것', emoji: '🚀', category: '탈것' }
];

/** 어휘 카테고리 목록(등장 순서, 중복 제거). */
function traceVocabCategories() {
  const seen = [];
  TRACE_VOCAB.forEach((v) => { if (seen.indexOf(v.category) < 0) seen.push(v.category); });
  return seen;
}

/** 카테고리로 필터(없거나 '전체'면 전부). */
function traceVocabByCategory(cat) {
  if (!cat || cat === '전체') return TRACE_VOCAB.slice();
  return TRACE_VOCAB.filter((v) => v.category === cat);
}

/** 카테고리 선택 칩 렌더(단어카드·퀴즈·받아쓰기 공용). */
function traceRenderCategoryChips(container, current, onSelect) {
  if (!container) return;
  const cur = current || '전체';
  const cats = ['전체'].concat(traceVocabCategories());
  container.innerHTML = '';
  const frag = document.createDocumentFragment();
  cats.forEach((cat) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat-chip' + (cat === cur ? ' active' : '');
    b.textContent = cat;
    b.setAttribute('aria-pressed', cat === cur ? 'true' : 'false');
    b.addEventListener('click', () => { if (typeof onSelect === 'function') onSelect(cat); }, { passive: true });
    frag.appendChild(b);
  });
  container.appendChild(frag);
}

/** 정답과 같은 풀(카테고리)에서 오답 n개 — 풀이 작으면 전체에서 보충. */
function traceVocabDistractorsFrom(pool, answerWord, n) {
  let cand = (Array.isArray(pool) ? pool : TRACE_VOCAB).filter((x) => x.word !== answerWord);
  if (cand.length < n) {
    const extra = TRACE_VOCAB.filter((x) => x.word !== answerWord && !cand.some((c) => c.word === x.word));
    cand = cand.concat(extra);
  }
  return traceShuffleArray(cand).slice(0, Math.max(0, n));
}

/*
 * 자음 예시 단어(파닉스) — 단어 모드에서 음절의 초성을 실제 단어로 연결해
 * "ㄱ은 가방의 ㄱ" 처럼 소리·읽기를 익히게 한다(소중한글 조합 원리 발상).
 * 호환 자모(ㄱ~ㅎ) 키.
 */
const TRACE_CONSONANT_EXAMPLES = {
  'ㄱ': { word: '가방', emoji: '🎒' },
  'ㄴ': { word: '나무', emoji: '🌳' },
  'ㄷ': { word: '다리', emoji: '🦵' },
  'ㄹ': { word: '라면', emoji: '🍜' },
  'ㅁ': { word: '모자', emoji: '🧢' },
  'ㅂ': { word: '바나나', emoji: '🍌' },
  'ㅅ': { word: '사과', emoji: '🍎' },
  'ㅇ': { word: '아기', emoji: '👶' },
  'ㅈ': { word: '자동차', emoji: '🚗' },
  'ㅊ': { word: '책', emoji: '📖' },
  'ㅋ': { word: '코끼리', emoji: '🐘' },
  'ㅌ': { word: '토끼', emoji: '🐰' },
  'ㅍ': { word: '포도', emoji: '🍇' },
  'ㅎ': { word: '해', emoji: '☀️' }
};

/* 상급 모드 단어 중 일상 단어 일부의 뜻 — 상급 모드 뜻 칩 표시용. */
const TRACE_ADV_MEANINGS = {
  '딸기': '빨갛고 씨가 송송한 과일',
  '빵': '폭신하고 고소한 먹거리',
  '꽃밭': '꽃이 모여 핀 곳',
  '꿈': '잠잘 때 보는 이야기, 이루고 싶은 것',
  '뿌리': '식물을 땅에 붙잡아 주는 부분',
  '학교': '함께 공부하는 곳',
  '책상': '앉아서 공부하는 가구',
  '연필': '글씨를 쓰는 도구',
  '학생': '학교에서 배우는 사람',
  '읽기': '글을 소리 내거나 눈으로 보는 것',
  '쓰기': '글씨를 적는 것',
  '듣기': '소리를 귀로 받아들이는 것',
  '닭': '꼬끼오 우는 새, 알을 낳음',
  '의자': '앉을 때 쓰는 가구',
  '의사': '아픈 곳을 고쳐 주는 사람',
  '회사': '어른들이 일하는 곳',
  '예의': '남을 존중하는 바른 태도',
  '땅콩': '고소한 작은 열매',
  '빨강': '사과 같은 붉은 색',
  '거울': '얼굴을 비춰 보는 물건'
};

/** word → { meaning, emoji } (어휘셋 우선, 상급 뜻 보조). 없으면 null. */
function traceWordMeaning(word) {
  if (typeof word !== 'string' || !word) return null;
  const v = TRACE_VOCAB.find((x) => x.word === word);
  if (v) return { meaning: v.meaning, emoji: v.emoji };
  if (TRACE_ADV_MEANINGS[word]) return { meaning: TRACE_ADV_MEANINGS[word], emoji: '' };
  return null;
}

/** 음절(또는 호환자모)의 초성에 대한 예시 단어. 없으면 null. */
function traceConsonantExample(syllableOrJamo) {
  if (typeof syllableOrJamo !== 'string' || !syllableOrJamo) return null;
  let cho = null;
  const ch = syllableOrJamo[0];
  if (/[가-힣]/.test(ch)) {
    // 완성형 음절 → NFD 분해의 첫 conjoining 초성 → 호환 자모로 환산
    const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code < 11172) cho = CHO[Math.floor(code / 588)];
  } else if (/[ㄱ-ㅎ]/.test(ch)) {
    cho = ch;
  }
  if (!cho) return null;
  // 쌍자음은 기본 자음 예시로 환원
  const fold = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
  const key = fold[cho] || cho;
  return TRACE_CONSONANT_EXAMPLES[key] || null;
}

/** Fisher-Yates 셔플(원본 불변, 새 배열 반환). */
function traceShuffleArray(source) {
  const arr = (Array.isArray(source) ? source : []).slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** 어휘셋에서 정답 1개를 제외하고 무작위 n개를 뽑는다(퀴즈 오답 보기용). */
function traceVocabDistractors(answerWord, n) {
  const pool = TRACE_VOCAB.filter((x) => x.word !== answerWord);
  return traceShuffleArray(pool).slice(0, Math.max(0, n));
}
