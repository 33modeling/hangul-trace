#!/usr/bin/env python3
"""
PWA 아이콘 생성기 — icons/icon-source.png 를 192/512 PNG + maskable
버전으로 리사이즈한다.

사용 전제: icons/icon-source.png 가 존재 (정사각, 1024px+ 권장).
의존성: Pillow (PIL).

  python3 scripts/gen_pwa_icons.py

만들어지는 파일 (모두 icons/ 아래):
  - icon-192.png            (any purpose)
  - icon-512.png            (any purpose)
  - icon-maskable-192.png   (80% safe area + 라벤더 배경)
  - icon-maskable-512.png   (80% safe area + 라벤더 배경)

이전 stdlib-only 버전은 단색 라벤더 PNG만 만들었지만, 이제는 실제
캐릭터 아이콘이 들어가서 Pillow가 필요하다. 설치:
  pip install Pillow --break-system-packages
"""
from __future__ import annotations

from pathlib import Path

LAVENDER_BG = (167, 139, 250, 255)  # #a78bfa — manifest theme_color와 동일
SAFE_AREA = 0.80                     # maskable 안전영역 (80%)


def _build_any(src, size: int, out: Path) -> None:
    src.resize((size, size)).save(out, "PNG", optimize=True)


def _build_maskable(src, size: int, out: Path) -> None:
    from PIL import Image
    inner = int(size * SAFE_AREA)
    pad = (size - inner) // 2
    canvas = Image.new("RGBA", (size, size), LAVENDER_BG)
    inner_img = src.resize((inner, inner))
    canvas.paste(inner_img, (pad, pad), inner_img)
    canvas.save(out, "PNG", optimize=True)


def main() -> None:
    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        raise SystemExit(
            "Pillow가 필요합니다. 설치: pip install Pillow --break-system-packages"
        )
    from PIL import Image

    root = Path(__file__).resolve().parent.parent
    icons = root / "icons"
    source = icons / "icon-source.png"
    if not source.exists():
        raise SystemExit(
            f"{source} 가 없습니다. 정사각 카툰 아이콘 원본을 그 위치에 두세요."
        )
    src = Image.open(source).convert("RGBA")
    # 정사각이 아니면 가운데 크롭
    w, h = src.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    src = src.crop((left, top, left + side, top + side))

    _build_any(src, 192, icons / "icon-192.png")
    _build_any(src, 512, icons / "icon-512.png")
    _build_maskable(src, 192, icons / "icon-maskable-192.png")
    _build_maskable(src, 512, icons / "icon-maskable-512.png")
    print("Wrote 4 icons under", icons)


if __name__ == "__main__":
    main()
