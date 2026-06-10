const STATUS_LABELS = {
  queued: "대기 중",
  generating_script: "스크립트 생성 중",
  generating_audio: "음성 합성 중",
  fetching_video: "배경 영상 수집 중",
  building_subtitles: "자막 생성 중",
  rendering: "렌더링 중",
  completed: "완료",
  failed: "실패",
};

let jobsCache = [];

async function fetchHealth() {
  const res = await fetch("/api/health");
  const h = await res.json();
  const banner = document.getElementById("health-banner");
  const parts = [];
  if (!h.ffmpeg) parts.push('<span class="banner error">⚠️ ffmpeg가 없습니다 — brew install ffmpeg</span>');
  if (h.mock_script) parts.push('<span class="banner">ℹ️ ANTHROPIC_API_KEY 미설정 — 샘플 스크립트 모드</span>');
  if (!h.pexels_key) parts.push('<span class="banner">ℹ️ PEXELS_API_KEY 미설정 — 단색 배경 사용</span>');
  banner.innerHTML = parts.join("");
}

async function refreshJobs() {
  const res = await fetch("/api/jobs");
  jobsCache = await res.json();
  renderJobs();
}

function badgeClass(status) {
  if (status === "completed" || status === "failed" || status === "queued") return status;
  return "running";
}

function renderJobs() {
  const el = document.getElementById("jobs");
  if (jobsCache.length === 0) {
    el.innerHTML = '<div class="empty">아직 작업이 없습니다. 주제를 입력해 첫 쇼츠를 만들어 보세요!</div>';
    return;
  }
  el.innerHTML = jobsCache.map((j) => `
    <div class="job">
      <div class="job-info">
        <div class="job-topic">${escapeHtml(j.topic)} <small>(${j.language})</small></div>
        <div class="job-sub">${new Date(j.created_at).toLocaleString()}</div>
        ${j.error ? `<div class="job-error">${escapeHtml(j.error.split("\n")[0])}</div>` : ""}
      </div>
      <span class="badge ${badgeClass(j.status)}">${STATUS_LABELS[j.status] || j.status}</span>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${j.progress}%"></div></div>
        <div class="progress-label">${j.progress}%</div>
      </div>
      <div class="actions">
        ${j.has_video ? `<button class="btn-play" onclick="openPreview('${j.id}')">▶ 보기</button>` : ""}
        <button class="btn-del" onclick="deleteJob('${j.id}')">삭제</button>
      </div>
    </div>
  `).join("");
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

document.getElementById("job-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const topic = document.getElementById("topic").value.trim();
  if (!topic) return;
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  try {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, language: document.getElementById("language").value }),
    });
    if (!res.ok) throw new Error(await res.text());
    document.getElementById("topic").value = "";
    await refreshJobs();
  } catch (err) {
    alert("작업 생성 실패: " + err.message);
  } finally {
    btn.disabled = false;
  }
});

async function deleteJob(id) {
  const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
  if (res.status === 409) {
    alert("실행 중인 작업은 삭제할 수 없습니다.");
    return;
  }
  await refreshJobs();
}

function openPreview(id) {
  const job = jobsCache.find((j) => j.id === id);
  const modal = document.getElementById("preview-modal");
  const video = document.getElementById("preview-video");
  video.src = `/api/jobs/${id}/video`;
  const m = job?.metadata || {};
  document.getElementById("preview-meta").innerHTML = `
    <h3>제목</h3>
    <div class="copy-row"><p>${escapeHtml(m.title || "")}</p><button onclick="copyText(this, ${jsStr(m.title)})">복사</button></div>
    <h3>설명</h3>
    <div class="copy-row"><p>${escapeHtml(m.description || "")}</p><button onclick="copyText(this, ${jsStr(m.description)})">복사</button></div>
    <h3>태그</h3>
    <div class="copy-row"><p>${escapeHtml((m.tags || []).join(", "))}</p><button onclick="copyText(this, ${jsStr((m.tags || []).join(", "))})">복사</button></div>
    <a class="dl-link" href="/api/jobs/${id}/video" download="short_${id}.mp4">⬇ MP4 다운로드</a>
  `;
  modal.classList.remove("hidden");
}

function jsStr(s) {
  return JSON.stringify(s || "").replace(/"/g, "&quot;");
}

async function copyText(btn, text) {
  await navigator.clipboard.writeText(text);
  const orig = btn.textContent;
  btn.textContent = "✓";
  setTimeout(() => (btn.textContent = orig), 1200);
}

function closePreview() {
  const video = document.getElementById("preview-video");
  video.pause();
  video.src = "";
  document.getElementById("preview-modal").classList.add("hidden");
}

document.getElementById("preview-modal").addEventListener("click", (e) => {
  if (e.target.id === "preview-modal") closePreview();
});

fetchHealth();
refreshJobs();
setInterval(refreshJobs, 2000);
