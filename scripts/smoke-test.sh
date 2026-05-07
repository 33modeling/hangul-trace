#!/usr/bin/env bash
# Static smoke: HTTP 200, 필수 스크립트·문자열 존재, (선택) node로 JS 문법 검사
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${PORT:-4174}"
export PORT

echo "== tracing smoke (root: $ROOT) =="

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 &
  SRV_PID=$!
  sleep 0.4
  cleanup() { kill "$SRV_PID" 2>/dev/null || true; }
  trap cleanup EXIT
  BASE="http://127.0.0.1:${PORT}"
  for path in /index.html /shared/core.js; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" "${BASE}${path}" || echo "000")
    if [[ "$code" != "200" ]]; then
      echo "FAIL: GET $path -> HTTP $code"
      exit 1
    fi
    echo "OK: $path ($code)"
  done
else
  echo "SKIP: python3 없음 — HTTP 서버 검사 생략"
fi

for f in shared/common.js shared/core.js index.js modes/char/modes.js; do
  if ! test -f "$f"; then
    echo "FAIL: missing $f"
    exit 1
  fi
done

if grep -q "const COMMON = { CHARS }" shared/common.js; then
  echo "OK: COMMON 정의"
else
  echo "FAIL: shared/common.js에 COMMON 없음"
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  for f in \
    shared/common.js \
    shared/core.js \
    shared/strokeOrder.js \
    shared/navigation.js \
    shared/utils.js \
    shared/myWords.js \
    shared/sound.js \
    index.js \
    modes/char/modes.js \
    modes/word/modes.js \
    modes/number/modes.js \
    modes/english/modes.js \
    modes/myword/modes.js \
    modes/myword-add/modes.js \
    modes/advanced/modes.js; do
    node --check "$f"
  done
  echo "OK: node --check 모든 모듈"
else
  echo "SKIP: node 없음 — 문법 검사 생략"
fi

echo "== smoke passed =="
