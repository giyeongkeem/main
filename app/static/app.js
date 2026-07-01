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

const TERMINAL = new Set(["completed", "failed"]);
let jobsCache = [];
let pollTimer = null;

// Single fetch wrapper: surfaces auth failures and non-OK responses uniformly.
async function api(path, options) {
  const res = await fetch(path, options);
  if (res.status === 401) {
    throw new Error("인증이 필요합니다. 페이지를 새로고침해 로그인하세요.");
  }
  return res;
}

async function fetchHealth() {
  try {
    const h = await (await api("/api/health")).json();
    const banner = document.getElementById("health-banner");
    const parts = [];
    if (!h.ffmpeg) parts.push('<span class="banner error">⚠️ ffmpeg가 없습니다 — brew install ffmpeg</span>');
    if (h.mock_script) parts.push('<span class="banner">ℹ️ ANTHROPIC_API_KEY 미설정 — 샘플 스크립트 모드</span>');
    if (!h.pexels_key) parts.push('<span class="banner">ℹ️ PEXELS_API_KEY 미설정 — 단색 배경 사용</span>');
    banner.innerHTML = parts.join("");
  } catch {
    /* health is best-effort; ignore transient failures */
  }
}

async function refreshJobs() {
  try {
    jobsCache = await (await api("/api/jobs")).json();
    renderJobs();
  } catch {
    /* keep the last render on a transient poll failure */
  }
  scheduleNextPoll();
}

// Poll fast (2s) only while a job is active; back off to 15s when everything is
// terminal so an idle open tab doesn't hammer the server indefinitely.
function scheduleNextPoll() {
  if (pollTimer) clearTimeout(pollTimer);
  const active = jobsCache.some((j) => !TERMINAL.has(j.status));
  pollTimer = setTimeout(refreshJobs, active ? 2000 : 15000);
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
        <div class="job-topic">${escapeHtml(j.topic)} <small>(${escapeHtml(j.language)})</small></div>
        <div class="job-sub">${new Date(j.created_at).toLocaleString()}</div>
        ${j.error ? `<div class="job-error">${escapeHtml(j.error.split("\n")[0])}</div>` : ""}
      </div>
      <span class="badge ${badgeClass(j.status)}">${STATUS_LABELS[j.status] || j.status}</span>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${j.progress}%"></div></div>
        <div class="progress-label">${j.progress}%</div>
      </div>
      <div class="actions">
        ${j.has_video ? `<button class="btn-play" data-action="play" data-id="${escapeHtml(j.id)}">▶ 보기</button>` : ""}
        <button class="btn-del" data-action="delete" data-id="${escapeHtml(j.id)}">삭제</button>
      </div>
    </div>
  `).join("");
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

// Event delegation: job ids come from data attributes, never interpolated into
// executable HTML — no inline handlers, so metadata text can't inject script.
document.getElementById("jobs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "play") openPreview(id);
  else if (btn.dataset.action === "delete") deleteJob(id);
});

document.getElementById("job-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const topic = document.getElementById("topic").value.trim();
  if (!topic) return;
  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  try {
    const res = await api("/api/jobs", {
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
  const res = await api(`/api/jobs/${id}`, { method: "DELETE" });
  if (res.status === 409) {
    alert("처리 중인 작업은 삭제할 수 없습니다. 완료 또는 실패 후 삭제하세요.");
    return;
  }
  await refreshJobs();
}

// Build the preview modal with DOM APIs and textContent — metadata strings are
// set as text, never parsed as HTML, so they cannot execute.
function openPreview(id) {
  const job = jobsCache.find((j) => j.id === id);
  const video = document.getElementById("preview-video");
  video.src = `/api/jobs/${id}/video`;
  const m = (job && job.metadata) || {};
  const meta = document.getElementById("preview-meta");
  meta.replaceChildren(
    metaField("제목", m.title || ""),
    metaField("설명", m.description || ""),
    metaField("태그", (m.tags || []).join(", ")),
    downloadLink(id),
  );
  document.getElementById("preview-modal").classList.remove("hidden");
}

function metaField(label, value) {
  const h3 = document.createElement("h3");
  h3.textContent = label;
  const row = document.createElement("div");
  row.className = "copy-row";
  const p = document.createElement("p");
  p.textContent = value;
  const btn = document.createElement("button");
  btn.textContent = "복사";
  btn.addEventListener("click", () => copyText(btn, value));
  row.append(p, btn);
  const frag = document.createDocumentFragment();
  frag.append(h3, row);
  return frag;
}

function downloadLink(id) {
  const a = document.createElement("a");
  a.className = "dl-link";
  a.href = `/api/jobs/${id}/video`;
  a.download = `short_${id}.mp4`;
  a.textContent = "⬇ MP4 다운로드";
  return a;
}

async function copyText(btn, text) {
  try {
    // clipboard API requires a secure context — unavailable over http://<LAN IP>
    if (!navigator.clipboard) throw new Error("no clipboard API");
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
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
