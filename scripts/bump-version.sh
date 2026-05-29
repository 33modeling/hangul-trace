#!/usr/bin/env bash
# 패치 버전 올리고 VERSION 파일, index.html <title>, sw.js CACHE 를 동기화
# (메인 <h1>은 버전 표기를 빼서 더 이상 갱신하지 않음)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export TRACING_ROOT="$ROOT"
exec python3 - <<'PY'
import pathlib, re, os

root = pathlib.Path(os.environ["TRACING_ROOT"])
vf = root / "VERSION"
ver = vf.read_text(encoding="utf-8").strip()
parts = ver.split(".")
if len(parts) != 3 or not all(p.isdigit() for p in parts):
    raise SystemExit(f"VERSION must be M.m.p digits, got: {ver!r}")
parts[-1] = str(int(parts[-1]) + 1)
new = ".".join(parts)
vf.write_text(new + "\n", encoding="utf-8")

prefix = "채윤 한글"
index_html = root / "index.html"
t = index_html.read_text(encoding="utf-8")
t2, n = re.subn(
    r"<title>[^<]*</title>",
    f"<title>{prefix} v{new}</title>",
    t,
    count=1,
)
if n != 1:
    raise SystemExit(f"index.html: expected one <title>, replaced {n}")
index_html.write_text(t2, encoding="utf-8")

# Service Worker 캐시 버전을 VERSION 과 동기화 — 안 올리면 returning 사용자가
# 옛 빌드에 고정되므로 배포 시 반드시 함께 갱신한다.
sw = root / "sw.js"
s = sw.read_text(encoding="utf-8")
s2, sn = re.subn(
    r"const CACHE = 'tracing-v[^']*';",
    f"const CACHE = 'tracing-v{new}';",
    s,
    count=1,
)
if sn != 1:
    raise SystemExit(f"sw.js: expected one CACHE line, replaced {sn}")
sw.write_text(s2, encoding="utf-8")

print(new)
PY
