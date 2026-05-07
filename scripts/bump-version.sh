#!/usr/bin/env bash
# 패치 버전 올리고 index.html 의 <title>, 메인 <h1> 과 VERSION 동기화
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

repls = [
    (
        root / "index.html",
        "한글 따라쓰기",
        r"<h1>한글 따라쓰기(?:\s+v|v)\d+\.\d+\.\d+</h1>",
    ),
]
for path, prefix, h1_re in repls:
    t = path.read_text(encoding="utf-8")
    t2, n = re.subn(
        r"<title>[^<]*</title>",
        f"<title>{prefix} v{new}</title>",
        t,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"{path.name}: expected one <title>, replaced {n}")
    h1_new = f"<h1>{prefix} v{new}</h1>"
    t2, n = re.subn(h1_re, h1_new, t2, count=1)
    if n != 1:
        raise SystemExit(f"{path.name}: expected one main <h1>, replaced {n}")
    path.write_text(t2, encoding="utf-8")
print(new)
PY
