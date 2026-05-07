#!/usr/bin/env bash
# 패치 버전 올리고 VERSION 파일과 index.html <title>을 동기화
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

prefix = "한글 따라쓰기"
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
print(new)
PY
