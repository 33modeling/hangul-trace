# tracing — Korean Tracing (Copy Practice) Web App

A static web app for children to learn Hangul and basic letters by tracing on a canvas. Modes include consonants/vowels, short words, digits 0–9, and English (upper/lower case).

## Project layout

```
tracing/
├── index.html          # Main entry
├── index.js            # Menu & mode switching
├── shared/
│   ├── common.js       # Char data and COMMON (shared CHARS)
│   ├── core.js         # DrawingCanvas and shared canvas helpers
│   ├── navigation.js   # Navigation and dot indicators
│   ├── styles.css      # UI styles
│   └── utils.js        # localStorage, character checks, etc.
├── manifest.webmanifest # PWA (install / standalone)
├── icons/               # PWA icons (regenerate: scripts/gen_pwa_icons.py)
├── docs/
│   └── DEPLOY.md        # Hosting (GitHub Pages, Netlify, Nginx)
└── modes/
    ├── char/modes.js   # Consonant/vowel mode (24 items)
    ├── word/modes.js   # Word mode (140 combinations)
    ├── myword/         # User word list practice
    ├── myword-add/     # Edit user word list
    ├── number/modes.js # Digits 0–9
    └── english/modes.js # English A–Z / a–z
```

## How to run

Open `index.html` in a browser. No build step is required. For a local static server (optional), use Live Server, `python -m http.server`, or similar.

```bash
# Example (open in default browser, macOS)
open index.html
```

## Testing

**Quick smoke (no Node install):** checks HTTP 200 for pages, `COMMON` in `shared/common.js`, and runs `node --check` on JS when `node` is available.

```bash
bash scripts/smoke-test.sh
# or: npm run smoke   (after npm install)
```

**End-to-end (Playwright, needs Node + browsers):**

```bash
npm install
npx playwright install chromium
npm test
```

Tests load `index.html` over a local `python3 -m http.server`, assert no page errors, and that guide/draw canvases get a non-zero size (and sample non-transparent pixels on the guide layer).

## Deployment (웹앱 배포)

정적 호스팅만 하면 됩니다. **GitHub Pages**, **Netlify**, **Nginx** 등 절차와 PWA 아이콘 재생성은 [docs/DEPLOY.md](docs/DEPLOY.md)를 참고하세요.

- **PWA**: 루트의 `manifest.webmanifest`와 `icons/` — 아이콘은 `python3 scripts/gen_pwa_icons.py`로 다시 만들 수 있습니다.
- **Netlify**: 저장소 루트의 `netlify.toml` (`publish = "."`).
- **GitHub Pages**: Settings → Pages에서 브랜치·폴더로 정적 배포(자동화 워크플로 없음). 자세한 절차는 [docs/DEPLOY.md](docs/DEPLOY.md) 참고.
