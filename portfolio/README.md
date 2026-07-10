# VFAR — 영상 포트폴리오 사이트

다크 시네마틱 톤의 반응형 영상 포트폴리오 정적 사이트입니다. 빌드 과정 없이 HTML/CSS/JS 세 파일로 동작합니다.

## 구성

| 파일 | 역할 |
|------|------|
| `index.html` | 페이지 구조 (히어로 · 작업물 · 소개 · 컨택트) |
| `style.css` | 스타일 (다크 테마, 반응형, 애니메이션) |
| `main.js` | 작업물 데이터, 필터, 라이트박스, 스크롤 효과 |

## 내 영상 넣는 법

`main.js` 상단의 `WORKS` 배열만 수정하면 됩니다.

```js
const WORKS = [
  {
    title: "브랜드 필름 — 도시의 아침",   // 작품 제목
    client: "클라이언트명",
    category: "브랜드 필름",              // CATEGORIES 중 하나
    video: "https://youtu.be/XXXXXXXXXXX", // YouTube 또는 Vimeo URL
    thumbnail: "",                        // 비워두면 YouTube 자동 썸네일 사용
  },
  // ...
];
```

- **video**: YouTube(`youtu.be/…`, `watch?v=…`, `shorts/…`) 및 Vimeo(`vimeo.com/…`) URL 지원. 카드를 클릭하면 라이트박스에서 바로 재생됩니다.
- **thumbnail**: 직접 만든 썸네일 이미지 경로를 넣을 수 있습니다(예: `images/work1.jpg`). 비워두면 YouTube 영상은 자동 썸네일을 가져오고, 그 외에는 그라디언트 플레이스홀더가 표시됩니다.
- **쇼릴**: `SHOWREEL_VIDEO` 상수에 쇼릴 영상 URL을 넣으면 히어로의 "쇼릴 보기" 버튼과 연결됩니다.
- **카테고리**: `CATEGORIES` 배열을 수정하면 필터 버튼이 자동으로 갱신됩니다.

연락처 이메일, SNS 링크, 소개 문구는 `index.html`의 About / Contact 섹션에서 수정하세요.

## 로컬에서 보기

```bash
cd portfolio
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 열기
```

## 배포 (GitHub Pages)

1. 저장소 **Settings → Pages**로 이동
2. Source를 `Deploy from a branch`로 설정하고 브랜치와 `/portfolio` 대신 루트만 지원하는 경우, `portfolio` 내용을 별도 브랜치(`gh-pages`) 루트에 두거나 GitHub Actions 배포를 사용하세요.

Netlify / Vercel에서는 `portfolio` 디렉토리를 퍼블리시 디렉토리로 지정하면 바로 배포됩니다.
