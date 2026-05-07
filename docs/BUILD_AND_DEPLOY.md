# 채윤 한글 — 웹앱 제작 · 배포 · TWA 출시 가이드

어린이용 한글/숫자/영어 따라쓰기 PWA `채윤 한글` 의 코드 구조, 로컬 개발,
Netlify 배포, PWA(서비스 워커·매니페스트), 그리고 안드로이드 TWA 패키지
출시까지 한 번에 정리한 문서. 한 번 셋업이 끝나면 작업 흐름은
`코드 수정 → push → 사이트 자동 갱신 → 필요 시 TWA 재패키지` 의 반복.

---

## 1. 프로젝트 정체

| 항목 | 값 |
|---|---|
| 이름 | 채윤 한글 |
| 타입 | 정적 SPA + PWA (빌드 단계 없음) |
| 언어 | vanilla HTML/CSS/JS (외부 런타임 의존 0) |
| 개발 의존성 | `@playwright/test` 단 1개 |
| 호스팅 | Netlify (`https://ubiquitous-toffee.netlify.app`) |
| 안드로이드 | TWA (Trusted Web Activity) — 호스팅 사이트 갱신 = 앱 갱신 |
| 디자인 톤 | 라벤더(`#a78bfa`) + 핑크(`#ec4899`) 듀오톤 |

## 2. 디렉토리 구조

```
tracing-dev/
├── index.html              # 단일 진입점 — 모든 모드 패널 정의
├── index.js                # 모드 라우팅 · 이스터에그 · SW 등록
├── manifest.webmanifest    # PWA 메타 (name, icons, theme)
├── netlify.toml            # 빌드 없음 · 헤더 (assetlinks Content-Type, SW no-cache)
├── VERSION                 # 단일 진리 버전 (M.m.p)
├── package.json            # scripts: smoke / test / version:* (devDep: playwright)
├── .well-known/
│   └── assetlinks.json     # TWA Digital Asset Links (SHA-256는 빌드 후 채움)
├── shared/
│   ├── common.js           # COMMON.CHARS — 자모 24개 (strokes 단일 소스)
│   ├── core.js             # DrawingCanvas · attachCanvasPointerDrawing · makeStrokeTracker · traceWaitForFonts
│   ├── strokeOrder.js      # 시각 분해 단계 (steps) — 자모/숫자/영문 86종
│   ├── navigation.js       # Navigation 클래스 (prev/next, dots, doneSet)
│   ├── utils.js            # localStorage, 분류, 버튼 바인딩 헬퍼
│   ├── myWords.js          # 사용자 단어 검증·저장 (한·영, NFD jamo strokes)
│   ├── sound.js            # TraceSound (BGM·stroke·complete·click SFX)
│   ├── styles.css          # 디자인 시스템 (팔레트 + 컴포넌트)
│   └── sw.js               # Service Worker (cache-first)
├── modes/
│   ├── char/modes.js       # 자모 모드 (24)
│   ├── word/modes.js       # 단어 모드 (140 — 자음·모음 조합)
│   ├── advanced/modes.js   # 상급 모드 (50 — 쌍자음·복잡 모음·어려운 받침)
│   ├── number/modes.js     # 숫자 0–9
│   ├── english/modes.js    # 알파벳 모드 (대·소문자, 토글)
│   ├── myword/modes.js     # 내 단어 (가로 4글자 슬라이딩 윈도우)
│   └── myword-add/modes.js # 내 단어 추가 (한·영 토글, 30개 한도, ↟↑↓↡✕)
├── icons/
│   ├── icon-source.png     # 1254×1254 원본 (사용자 제공)
│   ├── icon-192.png        # any purpose
│   ├── icon-512.png        # any purpose
│   ├── icon-maskable-192.png
│   └── icon-maskable-512.png
├── assets/
│   └── secret/
│       ├── chaeyoon.png    # 이스터에그 사진
│       └── README.md
├── scripts/
│   ├── smoke-test.sh       # HTTP 200 + node --check 모든 모듈
│   ├── bump-version.sh     # patch++ + index.html <title> 동기화
│   ├── install-git-hooks.sh
│   └── gen_pwa_icons.py    # icon-source → 4종 PNG 자동 생성 (Pillow)
├── tests/e2e/              # Playwright 테스트 5 spec, 30+ case
├── docs/
│   ├── DEPLOY.md           # 호스팅별 가이드 (GitHub Pages/Netlify/Nginx)
│   └── BUILD_AND_DEPLOY.md # 본 문서
└── .githooks/pre-push      # 자동 patch bump (last commit이 'chore: bump' 가 아닐 때만)
```

## 3. 기능 요약

**모드 7개**
- 자모(24) · 단어(140) · 상급(50) · 내 단어(사용자 등록) · 내 단어 추가 ·
  숫자(10) · 알파벳(52)

**내 단어 모드**
- 1단어 1~20글자, 한글 또는 영문(혼용 X)
- 등록 한도 30개, 카운터 표시(`X / 30`), 도달 시 입력 disabled
- 가로 모드 4글자 슬라이딩 윈도우(긴 단어가 한 글자씩 옆으로 이동)
- 세로 모드 한 글자씩 학습
- 단어 순서 5버튼: 맨 위/한 칸 위/한 칸 아래/맨 아래/삭제

**stroke 카운트**
- 거리 기반 — `dist >= max(18px, 캔버스 짧은 변 8%)` 일 때만 1획 인정
- onPointerUp 시점에 카운트 (예전 onDown 즉시 카운트는 톡 찍기로 완성되는 버그 있었음)

**사운드**
- 메뉴 토글: 🎼 배경음 / 🔔 효과음 (localStorage 저장)
- BGM: 8마디 사인파 lullaby 무한 반복
- SFX: stroke(880Hz tap) · complete(C-E-G 상승) · click(620Hz triangle, 모든 button)
- AudioContext lazy init (브라우저 자동재생 정책 대응)

**이스터에그**
- byline의 "통통이"를 5초 안에 15회 클릭 → 비밀 모드 (사진 + 메시지)
- 외관상 일반 텍스트 — cursor/hover 변화 없음

## 4. 디자인 시스템 (`shared/styles.css`)

CSS 변수 한 곳에서 관리. 색·그림자·그라데이션 모두 `:root` 토큰으로.

```css
:root {
  --trace-accent:        #a78bfa;  /* 라벤더 — 메인 */
  --trace-accent-dark:   #7c3aed;  /* CTA 텍스트 */
  --trace-pink:          #ec4899;  /* 핑크 — 보조 강조 */
  --trace-success:       #ec4899;  /* 완료 메시지 */
  --trace-page:          #f5edff;  /* 옅은 라벤더 페이지 bg */
  --trace-surface:       #ffffff;  /* 카드 흰색 */
  --trace-chip:          #f3e8ff;  /* 옅은 라벤더 칩 */
  --trace-gradient-soft: linear-gradient(135deg, #f5edff 0%, #ffe8f3 100%);
  --trace-gradient-primary: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
  --trace-shadow-card:   0 4px 16px rgba(124, 58, 237, 0.08);
}
```

레이아웃 원칙
- 메뉴 카드: `grid` (≥480px에서 2열)
- 모드 안 toolbar: `.mode-toolbar` 한 클래스로 통일
- 캔버스 위 hint 영역: 같은 셀렉터 그룹으로 일관 마진(8px / min-height 26px)
- `:empty` 셀렉터로 빈 영역은 공간 안 차지(`#word-complete:empty` 등)
- `@media (max-width: 380px)` 좁은 폰: 버튼 44×44, 폰트 -2px

## 5. 로컬 개발

```bash
# 가장 빠른 길 (Python만 있으면 OK)
cd tracing-dev
python3 -m http.server 8000
open http://127.0.0.1:8000/index.html
```

또는 Live Server, Netlify CLI(`netlify dev`) 등 무엇이든 정적 서버면 됨.
**`file://` 직접 열기는 비추** — Service Worker 등록 실패, 일부 fetch 차단.

## 6. 테스트

### Smoke (Node 없어도 동작)

```bash
bash scripts/smoke-test.sh
```

- HTTP 200 (`/index.html`, `/shared/core.js`)
- `shared/common.js`에 `const COMMON = { CHARS }` 존재 확인
- `node --check` 모든 JS 모듈 (Node 있으면)

### Playwright E2E (3 브라우저 매트릭스)

```bash
npm install
npx playwright install chromium firefox webkit
npm test                        # 모든 브라우저
npm test -- --project=webkit    # Safari만
npm run test:headed             # 브라우저 띄워서 확인
```

스펙 5개:
- `index.spec.js` — 메인 메뉴, 모드 진입, 캔버스 픽셀 검사
- `core-bugs.spec.js` — 버퍼/CSS 사이즈 매치, 가이드 글자 표시, 모든 모드 회귀
- `touch-events.spec.js` — 터치 드로잉, 지우기, 획순 보기
- `responsive.spec.js` — 회전 시 캔버스 리사이즈, 캔버스 max-height 55%
- `mobile-ui.spec.js` — iPhone SE/14, iPad Mini, Galaxy S21 매트릭스

## 7. 버전 관리

- 단일 진리: `VERSION` 파일 (`M.m.p`)
- `index.html` `<title>` 자동 동기화 (메인 `<h1>`은 버전 표시 X)
- `.githooks/pre-push` 가 push 직전 마지막 commit 메시지를 보고:
  - `chore: bump version*` 이면 통과
  - 아니면 `bump-version.sh` 실행 → `chore: bump version <new>` commit 후 `exit 1` → 같은 브랜치에서 한 번 더 `git push`
- 처음 한 번 활성화: `bash scripts/install-git-hooks.sh`

수동 bump:

```bash
bash scripts/bump-version.sh   # 0.0.30 → 0.0.31, index.html title 갱신
```

## 8. Netlify 배포

### 첫 셋업

1. https://app.netlify.com/start 접속
2. **Import an existing project** → GitHub → `33modeling/hangul-trace` 선택
3. Branch `main`, build command 비움(`netlify.toml` 사용), publish directory `.`
4. Deploy → URL 받음 (예: `https://ubiquitous-toffee.netlify.app`)

### 자동 재배포 흐름

- `dev` 브랜치에서 작업 → push → Netlify는 main만 보므로 변화 없음
- PR 또는 ff-merge로 `main`에 합치고 push → **Netlify 30초 안에 자동 재배포**

```bash
# 로컬에서 ff-merge로 한 번에 main 갱신
git checkout main
git merge dev --ff-only
git push origin main
git checkout dev
```

### `netlify.toml`

```toml
[build]
  publish = "."
  command = "true"

# TWA Digital Asset Links — Content-Type 강제 + 짧은 캐시
[[headers]]
  for = "/.well-known/assetlinks.json"
  [headers.values]
    Content-Type  = "application/json"
    Cache-Control = "public, max-age=300"

# Service Worker 자체는 캐시하지 말기 (즉시 갱신 반영)
[[headers]]
  for = "/shared/sw.js"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
```

## 9. PWA — Manifest · Service Worker · Asset Links

### `manifest.webmanifest`

```json
{
  "name": "채윤 한글",
  "short_name": "채윤 한글",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "theme_color": "#a78bfa",
  "background_color": "#f5edff",
  "icons": [
    { "src": "icons/icon-192.png",          "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png",          "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Service Worker (`shared/sw.js`)

- cache-first, install 시 ASSETS prefetch, activate 시 옛 버전 청소
- **자산이 바뀌면 `CACHE` 키를 같이 올려야** 옛 사용자 SW가 새 자산 받음
  ```js
  const CACHE = 'tracing-vN';   // ← 여기 bump
  ```
- TWA verification 의 'verified' 요건 충족(반드시 fetch 핸들러 등록)

### 아이콘 자동 빌드

원본 `icons/icon-source.png`(정사각, 1024px+ 권장)만 두면 한 번에 4종 생성:

```bash
pip install Pillow --break-system-packages   # 한 번만
python3 scripts/gen_pwa_icons.py
```

생성:
- `icon-192.png`, `icon-512.png` (any purpose, 그대로 리사이즈)
- `icon-maskable-192.png`, `icon-maskable-512.png` (80% safe area + 라벤더 패딩)

### Digital Asset Links (`.well-known/assetlinks.json`)

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.netlify.ubiquitous_toffee.twa",
      "sha256_cert_fingerprints": ["AB:CD:..."]
    }
  }
]
```

`sha256_cert_fingerprints` 는 PWABuilder가 APK 서명 후 알려주는 값으로 교체.

## 10. TWA APK 빌드 (PWABuilder.com)

가장 빠르고 추천하는 길.

1. https://www.pwabuilder.com 접속
2. URL 칸에 `https://ubiquitous-toffee.netlify.app` 입력 → **Start**
3. Manifest / Service Worker / Security 점수 모두 초록 확인
4. 우상단 **Package For Stores** → **Android** 카드 → **Generate Package**
5. 옵션 입력

| 필드 | 값 |
|---|---|
| Package ID | `app.netlify.ubiquitous_toffee.twa` |
| App name | `채윤 한글` |
| Launcher name | `채윤 한글` |
| App version code | `1` (Play Console 업로드마다 +1) |
| App version name | `0.0.30` (또는 현재 VERSION) |
| Display | `standalone` |
| Theme color | `#a78bfa` |
| Background | `#f5edff` |
| Signing key | **New** — PWABuilder 자동 생성. 비번 안전하게 보관 (분실 시 갱신 불가) |

6. **Download** → ZIP 받음
   - `app-release-bundle.aab` (Play Store)
   - `app-release-signed.apk` (직접 설치 테스트)
   - `assetlinks.json` ★
   - `signing-key-info.txt` (절대 공개 X)

7. ZIP 안의 `assetlinks.json` 내용을 우리 repo `.well-known/assetlinks.json` 의 placeholder에 붙여넣고 push → Netlify 재배포 → TWA verification 활성화

### 대안: Bubblewrap CLI

직접 자동화 / CI 빌드용. 로컬에 Java 17+ 와 Android SDK build-tools 필요(1GB+).

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://ubiquitous-toffee.netlify.app/manifest.webmanifest
bubblewrap build
```

PWABuilder가 첫 출시엔 더 가벼움 — Bubblewrap은 자동화 단계로 가면 검토.

## 11. Google Play Store 등록

### 비용

| 항목 | 비용 |
|---|---|
| Google Play Console 개발자 계정 | **$25 (한 번만, 평생)** |
| 앱 등록 / 업데이트 / 호스팅 | 무료 |
| 앱 서명 (Google Play App Signing) | 무료 |
| 무료 앱이면 수수료 | 0 |

iOS 안 가는 한 진짜 비용은 $25 한 번뿐.

### 단계

1. https://play.google.com/console 가입 → $25 결제
2. **새 앱 만들기** → 이름·언어·앱 종류 입력
3. 좌측 **테스트 → 내부 테스트** 트랙 → AAB 업로드 (`app-release-bundle.aab`)
4. 가족/지인 이메일을 테스터로 추가 → 초대 링크로 설치 테스트
5. 콘텐츠 평가(IARC) — 무료, 어린이용이면 ESRB / GRAC 폼
6. 개인정보 처리방침 페이지 URL — 정적 페이지 하나(예: `policy.html`) 호스팅
7. 만 13세 미만 대상이면 **Designed for Families** 프로그램 추가 검토 + COPPA 안내
8. **프로덕션 트랙**에 승격 → 심사 → 출시

## 12. 캐시 / 배포 트러블슈팅

### 새 아이콘이 안 보일 때

1. `https://ubiquitous-toffee.netlify.app/VERSION` 직접 열어 최신 버전 확인 — 옛날이면 Netlify 배포 아직
2. `https://ubiquitous-toffee.netlify.app/icons/icon-512.png` 직접 열어 카툰 보이는지 — 단색이면 자산 안 갱신
3. Service Worker 캐시 — `shared/sw.js` 의 `CACHE = 'tracing-vN'` 값을 +1 하고 push
4. 사용자 브라우저: DevTools → **Application** → **Storage** → **Clear site data** → 새로고침
5. 또는 시크릿/InCognito 창에서 한 번 열기 (캐시 0)

### PWABuilder 점수 캐시

- URL에 임의 쿼리 붙이기: `?v=2` 등 → 분석 다시
- 또는 PWABuilder 메인 → URL 다시 입력

### TWA verification failed

- `.well-known/assetlinks.json` 의 `sha256_cert_fingerprints` 값이 PWABuilder가 알려준 실제 키와 일치해야
- `package_name` 도 PWABuilder 옵션에서 입력한 Package ID와 정확히 일치
- Netlify에서 Content-Type이 `application/json` 으로 응답하는지 (이미 `netlify.toml` 처리)

### 만든 APK 폰에 직접 설치 (테스트용)

1. `app-release-signed.apk` 를 안드로이드 폰으로 전송 (Drive/Slack/USB)
2. 안드로이드 설정 → 보안 → "출처 알 수 없는 앱 설치" → Chrome/Drive 허용
3. 파일 매니저에서 APK 탭 → 설치
4. 첫 실행 시 verification 검사 (assetlinks.json 검증) — 통과 시 toolbar 없이 풀스크린, 실패 시 Custom Tab처럼 toolbar 노출

## 13. 일상 작업 흐름 요약

```bash
# 1. dev 브랜치에서 코드 수정
git checkout dev
# ... 편집 ...

# 2. 검증
bash scripts/smoke-test.sh
npm test                        # 선택

# 3. commit
git add .
git commit -m "feat(...): ..."

# 4. push (hook이 patch bump 후 exit 1)
git push origin dev
# 'chore: bump version 0.0.X' 자동 commit 됨, 한 번 더:
git push origin dev

# 5. main 동기화 (Netlify 자동 재배포)
git checkout main
git merge dev --ff-only
git push origin main
git checkout dev

# 6. (자산 변경 있었으면) shared/sw.js 의 CACHE 'tracing-vN' bump
# 7. (TWA 갱신 필요하면) PWABuilder에서 새 AAB 만들고 Play Console 업로드
```

## 14. 향후 개선 아이디어

- 단어 모드/myword/advanced 의 prev/next 로직을 `Navigation` 클래스로 통합 (지금은 직접 구현)
- DPR(devicePixelRatio) 처리 — 레티나에서 캔버스 글씨 선명도 ↑
- iOS 출시 — Capacitor wrapper로 같은 코드 재사용
- 커스텀 도메인 (예: `chaeyoon.kr`) — TWA 출시 후 가능
- Workbox 도입 — SW를 더 정교하게(런타임 캐시 정책, BGM 지연 캐시 등)
- 진짜 한국어 표준 획순 데이터베이스 통합 — 현재 strokes는 jamo NFD 합산 근사

---

마지막 업데이트: v0.0.30 (2026-05-08)
