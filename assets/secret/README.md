# 이스터에그 사진

이 폴더에 `chaeyoon.png` 파일을 두면 비밀 모드 화면에 사진이 뜹니다.

- 권장 형식: 정사각형 (예: 512×512 또는 1024×1024)
- 권장 포맷: PNG (JPG도 OK — 그 경우 `index.html` src와 파일명 같이 변경)
- 파일명: `chaeyoon.png`

## 사진을 git에 올리고 싶지 않다면

`.gitignore` 에 다음 한 줄 추가:

```
assets/secret/chaeyoon.png
```

대신 Netlify CMS 또는 Netlify CLI(`netlify deploy`)로 직접 사이트에만
올리는 방법이 있습니다.

## 사진 없을 때

`onerror="this.style.display='none'"` 처리되어 있어서 이미지가 없거나
404 떨어지면 자동으로 숨겨집니다. 텍스트 메시지만 보입니다.
