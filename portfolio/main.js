/* =====================================================
   VFAR — 영상 포트폴리오
   ▼ 여기 WORKS 배열만 수정하면 작업물이 갱신됩니다.
   - video    : YouTube / Vimeo URL (예: https://youtu.be/XXXX,
                https://www.youtube.com/watch?v=XXXX,
                https://vimeo.com/123456789). 비워두면 준비중 안내가 표시됩니다.
   - thumbnail: 썸네일 이미지 경로(예: "images/work1.jpg").
                비워두면 YouTube 영상은 자동 썸네일을, 그 외에는
                그라디언트 플레이스홀더를 사용합니다.
===================================================== */

const CATEGORIES = ["전체", "브랜드 필름", "광고", "뮤직비디오", "모션그래픽"];

const WORKS = [
  {
    title: "브랜드 필름 — 도시의 아침",
    client: "Sample Client",
    category: "브랜드 필름",
    video: "",
    thumbnail: "",
  },
  {
    title: "신제품 런칭 캠페인",
    client: "Sample Brand",
    category: "광고",
    video: "",
    thumbnail: "",
  },
  {
    title: "뮤직비디오 — Midnight Run",
    client: "Sample Artist",
    category: "뮤직비디오",
    video: "",
    thumbnail: "",
  },
  {
    title: "타이틀 시퀀스 모션그래픽",
    client: "Sample Studio",
    category: "모션그래픽",
    video: "",
    thumbnail: "",
  },
  {
    title: "기업 홍보 영상",
    client: "Sample Corp",
    category: "브랜드 필름",
    video: "",
    thumbnail: "",
  },
  {
    title: "SNS 숏폼 광고 시리즈",
    client: "Sample Brand",
    category: "광고",
    video: "",
    thumbnail: "",
  },
];

/* 쇼릴(히어로의 '쇼릴 보기' 버튼) 영상 URL */
const SHOWREEL_VIDEO = "";

/* ===================================================== */

/** YouTube/Vimeo URL → 임베드 URL. 지원하지 않으면 null */
function toEmbedUrl(url) {
  if (!url) return null;
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  return null;
}

/** YouTube URL이면 자동 썸네일 URL 반환 */
function autoThumbnail(url) {
  const yt = (url || "").match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return yt ? `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` : null;
}

const FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #2b2138 0%, #6b2f3f 100%)",
  "linear-gradient(135deg, #14243a 0%, #2f5a6b 100%)",
  "linear-gradient(135deg, #33261a 0%, #8a5a2a 100%)",
  "linear-gradient(135deg, #1d2b22 0%, #3f6b4c 100%)",
  "linear-gradient(135deg, #2a1c2e 0%, #5a3f7a 100%)",
  "linear-gradient(135deg, #302020 0%, #7a3f3f 100%)",
];

/* ---------- 작업물 그리드 렌더링 ---------- */
const grid = document.getElementById("worksGrid");
const filtersEl = document.getElementById("filters");

function renderWorks() {
  grid.innerHTML = "";
  WORKS.forEach((work, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "work-card reveal";
    card.dataset.category = work.category;
    card.setAttribute("aria-label", `${work.title} 재생`);

    const thumbSrc = work.thumbnail || autoThumbnail(work.video);
    const thumbHtml = thumbSrc
      ? `<img src="${thumbSrc}" alt="${work.title}" loading="lazy" />`
      : `<div class="thumb-fallback" style="background:${
          FALLBACK_GRADIENTS[i % FALLBACK_GRADIENTS.length]
        }">VFAR</div>`;

    card.innerHTML = `
      <div class="work-card__thumb">
        ${thumbHtml}
        <div class="work-card__play">
          <span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
          </span>
        </div>
      </div>
      <div class="work-card__meta">
        <p class="work-card__cat">${work.category}</p>
        <h3 class="work-card__title">${work.title}</h3>
        <p class="work-card__client">${work.client}</p>
      </div>
    `;
    card.addEventListener("click", () => openLightbox(work.video, work.title));
    grid.appendChild(card);
  });
  observeReveals();
}

/* ---------- 카테고리 필터 ---------- */
function renderFilters() {
  CATEGORIES.forEach((cat, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn" + (i === 0 ? " is-active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      filtersEl
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      grid.querySelectorAll(".work-card").forEach((card) => {
        const show = cat === "전체" || card.dataset.category === cat;
        card.classList.toggle("is-hidden", !show);
      });
    });
    filtersEl.appendChild(btn);
  });
}

/* ---------- 라이트박스 ---------- */
const lightbox = document.getElementById("lightbox");
const lightboxBody = document.getElementById("lightboxBody");
const lightboxClose = document.getElementById("lightboxClose");

function openLightbox(videoUrl, title) {
  const embed = toEmbedUrl(videoUrl);
  lightboxBody.innerHTML = embed
    ? `<iframe src="${embed}" title="${title || "video"}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
    : `<div class="lightbox__empty">
         <strong>영상 준비중</strong>
         <p>main.js의 WORKS 배열에 YouTube 또는 Vimeo URL을 입력하면<br/>이 자리에서 바로 재생됩니다.</p>
       </div>`;
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxBody.innerHTML = "";
  document.body.style.overflow = "";
}

lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && lightbox.classList.contains("is-open")) closeLightbox();
});

document.getElementById("showreelBtn").addEventListener("click", () => {
  openLightbox(SHOWREEL_VIDEO, "Showreel");
});

/* ---------- 내비게이션 ---------- */
const nav = document.getElementById("nav");
const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

window.addEventListener("scroll", () => {
  nav.classList.toggle("is-scrolled", window.scrollY > 24);
});

navToggle.addEventListener("click", () => {
  navToggle.classList.toggle("is-open");
  navLinks.classList.toggle("is-open");
});
navLinks.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    navToggle.classList.remove("is-open");
    navLinks.classList.remove("is-open");
  })
);

/* ---------- 스크롤 리빌 ---------- */
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

function observeReveals() {
  document
    .querySelectorAll(".reveal:not(.is-visible)")
    .forEach((el) => revealObserver.observe(el));
}

/* ---------- 숫자 카운트업 ---------- */
const countObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count);
      const duration = 1400;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      countObserver.unobserve(el);
    });
  },
  { threshold: 0.5 }
);
document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

/* ---------- 초기화 ---------- */
renderFilters();
renderWorks();
observeReveals();
