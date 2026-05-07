# tracing 배포 가이드

이 프로젝트는 **빌드 없는 정적 파일**입니다. `index.html`, `shared/`, `modes/`가 **사이트 문서 루트**에서 그대로 서빙되면 됩니다. `file://` 대신 **HTTP(S)** 로 여는 것을 권장합니다.

## 호스팅 선택

| 방식 | 적합한 경우 |
|------|-------------|
| **GitHub Pages** | GitHub에 리포가 있고, 브랜치·폴더 기준으로 정적 사이트를 올릴 때 (Actions 워크플로 없이 수동 설정). |
| **Netlify** | Git 연동·미리보기 PR이 필요할 때 (`netlify.toml` 포함). |
| **사내 Nginx / IIS / S3** | 폐쇄망·자체 인프라가 있을 때 — 아래 “정적 트리 복사”만 동일합니다. |

## 1. GitHub Pages (브랜치·폴더)

1. 리포지토리 **Settings → Pages**로 이동합니다.
2. **Build and deployment**에서 **Source**를 **Deploy from a branch**로 두고, 정적 파일이 있는 브랜치(예: `main` / `master`)와 폴더(보통 `/ (root)` 또는 `/docs`)를 지정합니다.
3. 저장소 **루트에** `index.html`, `shared/`, `modes/` 등이 있어야 합니다. 변경 후 **수동으로 푸시**할 때마다 Pages가 갱신됩니다.
4. 배포 URL은 보통 `https://<user>.github.io/<repo>/` 형태입니다.

**모노레포**에서 앱이 하위 폴더에만 있을 경우: 해당 폴더만 Pages의 publish 폴더로 쓰거나, 그 폴더를 문서 루트로 두는 별도 브랜치를 두는 방식을 쓰면 됩니다.

## 2. Netlify

1. Netlify에서 **Add new site → Import an existing project** 후 이 Git 리포 연결.
2. Build command: 비우거나 `echo 'no build'`.
3. **Publish directory**: 리포 루트가 tracing이면 `.` (루트).
4. 배포 후 `index.html`과 `shared/*`, `modes/*` 요청이 404가 아닌지 Network 탭으로 확인.

`netlify.toml`에 `publish = "."` 가 들어 있습니다.

## 3. Nginx (예시)

정적 파일만 두고 `root`가 앱 디렉터리를 가리키면 됩니다.

```nginx
server {
    listen 443 ssl;
    server_name example.example;
    root /var/www/tracing;
    index index.html;
}
```

`shared/`, `modes/` 경로가 그대로 URL에 매핑되므로 별도 SPA용 `try_files` fallback은 필요 없습니다.

## 4. PWA 아이콘 재생성

아이콘 PNG는 `scripts/gen_pwa_icons.py`로 생성합니다.

```bash
python3 scripts/gen_pwa_icons.py
```

## 배포 후 확인

- `/index.html` 로딩, 모드 전환, 캔버스 필기.
- **내 단어**는 `localStorage` — **도메인·스킴(https)이 바뀌면 데이터가 이어지지 않습니다.**

## Service Worker

오프라인 캐시용 Service Worker는 포함하지 않았습니다. 필요하면 별도 설계 후 등록하세요.
