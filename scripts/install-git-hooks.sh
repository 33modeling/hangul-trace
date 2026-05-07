#!/usr/bin/env bash
# 저장소 루트에서: core.hooksPath 를 .githooks 로 설정 (pre-push 에서 버전 자동 범프)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
chmod +x .githooks/pre-push 2>/dev/null || true
chmod +x scripts/bump-version.sh
git config core.hooksPath .githooks
echo "core.hooksPath=.githooks 설정됨 (pre-push 시 patch 버전 + 커밋 후 한 번 더 push 필요할 수 있음)"
