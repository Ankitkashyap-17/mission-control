const STAGES = [
  { key: "applied", label: "Applied", color: "#5B8DEF" },
  { key: "interview", label: "Interview", color: "#E8A33D" },
  { key: "offer", label: "Offer", color: "#4CAF7D" },
  { key: "rejected", label: "Rejected", color: "#D1495B" },
];

const STORAGE_KEY = "jobtracker:jobs";

// Once your backend is running, point this at it (e.g. http://localhost:5000/api/match)
const MATCH_API_URL = "https://mission-control-backend-q3md.onrender.com/match";

let jobs = loadJobs();
let filter = "all";
let query = "";

function loadJobs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveJobs() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Rendering ----------

function render() {
  renderRail();
  renderList();
}

function renderRail() {
  const counts = { applied: 0, interview: 0, offer: 0, rejected: 0 };
  jobs.forEach((j) => (counts[j.stage] = (counts[j.stage] || 0) + 1));

  const rail = document.getElementById("rail");
  rail.innerHTML = "";

  STAGES.forEach((s, i) => {
    const node = document.createElement("div");
    node.className = "rail-node";
    node.innerHTML = `
      <div class="rail-dot" style="background:${s.color}; box-shadow:0 0 0 4px ${s.color}22;"></div>
      <div class="rail-info">
        <span class="rail-count" style="color:${s.color}">${counts[s.key] || 0}</span>
        <span class="rail-label">${s.label}</span>
      </div>
    `;
    rail.appendChild(node);
    if (i < STAGES.length - 1) {
      const line = document.createElement("div");
      line.className = "rail-line";
      rail.appendChild(line);
    }
  });

  const total = document.createElement("div");
  total.className = "rail-node total";
  total.innerHTML = `
    <span class="rail-count">${jobs.length}</span>
    <span class="rail-label">Total</span>
  `;
  rail.appendChild(total);
}

function renderList() {
  const list = document.getElementById("jobList");
  list.innerHTML = "";

  const filtered = jobs
    .filter((j) => filter === "all" || j.stage === filter)
    .filter((j) => {
      const q = query.toLowerCase();
      return !q || j.company.toLowerCase().includes(q) || j.role.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent =
      jobs.length === 0
        ? "No applications yet. Add your first one to start tracking."
        : "Nothing matches this filter.";
    list.appendChild(empty);
    return;
  }

  filtered.forEach((job) => list.appendChild(renderJobCard(job)));
}

function stageInfo(stage) {
  return STAGES.find((s) => s.key === stage) || STAGES[0];
}

function renderJobCard(job) {
  const s = stageInfo(job.stage);
  const card = document.createElement("div");
  card.className = "job-card";
  card.innerHTML = `
    <div class="job-top">
      <div>
        <div class="job-role">${escapeHtml(job.role)}</div>
        <div class="job-company">${escapeHtml(job.company)}</div>
      </div>
      <span class="pill" style="color:${s.color}; border-color:${s.color}55; background:${s.color}14;">${s.label}</span>
    </div>
    <div class="job-meta">
      <span>${job.date}</span>
      ${job.link ? `<a href="${escapeAttr(job.link)}" target="_blank" rel="noreferrer">Listing ↗</a>` : ""}
      ${job.match ? `<span class="match-tag">AI match: ${job.match.match_percent}%</span>` : ""}
    </div>
    ${job.notes ? `<div class="job-notes">${escapeHtml(job.notes)}</div>` : ""}
    <div class="job-actions">
      <button class="btn ghost small" data-action="edit">Edit</button>
      <button class="btn ghost small" data-action="match">${job.match ? "View AI match" : "AI match score"}</button>
      <button class="btn ghost small danger" data-action="delete">Delete</button>
    </div>
    <div class="match-panel-slot"></div>
  `;

  card.querySelector('[data-action="delete"]').addEventListener("click", () => {
    jobs = jobs.filter((j) => j.id !== job.id);
    saveJobs();
    render();
  });

  card.querySelector('[data-action="edit"]').addEventListener("click", () => {
    openForm(job);
  });

  card.querySelector('[data-action="match"]').addEventListener("click", () => {
    const slot = card.querySelector(".match-panel-slot");
    if (slot.childElementCount > 0) {
      slot.innerHTML = "";
      return;
    }
    slot.appendChild(renderMatchPanel(job));
  });

  return card;
}

function renderMatchPanel(job) {
  const panel = document.createElement("div");
  panel.className = "match-panel";

  if (job.match) {
    panel.innerHTML = matchResultHtml(job.match);
    panel.querySelector('[data-action="rerun"]').addEventListener("click", () => {
      job.match = null;
      saveJobs();
      panel.innerHTML = "";
      panel.appendChild(renderMatchPanel(job));
    });
    return panel;
  }

  panel.innerHTML = `
    <label class="field">
      <span>Job description</span>
      <textarea rows="4" data-field="jd" placeholder="Paste the JD here..."></textarea>
    </label>
    <label class="field">
      <span>Your resume (text)</span>
      <textarea rows="4" data-field="resume" placeholder="Paste your resume text here..."></textarea>
    </label>
    <div class="error-text" data-error style="display:none;"></div>
    <button class="btn primary" data-action="run">Run AI match score</button>
  `;

  const btn = panel.querySelector('[data-action="run"]');
  const errBox = panel.querySelector("[data-error]");

  btn.addEventListener("click", async () => {
    const jd = panel.querySelector('[data-field="jd"]').value.trim();
    const resume = panel.querySelector('[data-field="resume"]').value.trim();

    if (!jd || !resume) {
      errBox.style.display = "block";
      errBox.textContent = "Paste both the job description and your resume text.";
      return;
    }

    errBox.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Scoring match...";

    try {
      const result = await getMatchScore(jd, resume);
      job.match = result;
      saveJobs();
      panel.innerHTML = "";
      panel.appendChild(renderMatchPanel(job));
      renderList(); // refresh match-tag on card meta line
    } catch (e) {
      errBox.style.display = "block";
      errBox.textContent = e.message || "Couldn't score the match right now.";
      btn.disabled = false;
      btn.textContent = "Run AI match score";
    }
  });

  return panel;
}

function matchResultHtml(result) {
  const kw = (result.missing_keywords || [])
    .map((k) => `<span class="kw">${escapeHtml(k)}</span>`)
    .join("");
  const sugg = (result.suggestions || [])
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");

  return `
    <div class="result">
      <div class="score-row">
        <div class="score-ring" style="background:conic-gradient(#E8A33D calc(${result.match_percent} * 1%), #2A3444 0);">
          <span>${result.match_percent}%</span>
        </div>
        <div class="score-label">Resume match to this role</div>
      </div>
      ${kw ? `<div class="kw-block"><span class="block-label">Missing keywords</span><div class="kw-list">${kw}</div></div>` : ""}
      ${sugg ? `<div class="kw-block"><span class="block-label">Suggestions</span><ul class="sugg-list">${sugg}</ul></div>` : ""}
      <button class="btn ghost small" data-action="rerun">Run again</button>
    </div>
  `;
}

// ---------- AI match call ----------
// This calls YOUR backend (Express/Node etc), which should hold the Anthropic
// API key server-side and forward the request to Claude. Never put an API key
// directly in this frontend file.

async function getMatchScore(jd, resume) {
  const response = await fetch(MATCH_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobDescription: jd, resume }),
  });

  if (!response.ok) {
    throw new Error("Backend not reachable yet. Set up /api/match first.");
  }

  const data = await response.json();
  // Expected shape from backend:
  // { match_percent: number, missing_keywords: string[], suggestions: string[] }
  return data;
}

// ---------- Form ----------

const formEl = document.getElementById("jobForm");
let editingId = null;

function openForm(job) {
  editingId = job ? job.id : null;
  document.getElementById("f-company").value = job ? job.company : "";
  document.getElementById("f-role").value = job ? job.role : "";
  document.getElementById("f-link").value = job ? job.link || "" : "";
  document.getElementById("f-notes").value = job ? job.notes || "" : "";
  document.getElementById("f-stage").value = job ? job.stage : "applied";
  document.getElementById("f-date").value = job ? job.date : new Date().toISOString().slice(0, 10);
  formEl.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeForm() {
  formEl.style.display = "none";
  editingId = null;
}

document.getElementById("toggleFormBtn").addEventListener("click", () => {
  if (formEl.style.display === "block") {
    closeForm();
  } else {
    openForm(null);
  }
});

document.getElementById("cancelFormBtn").addEventListener("click", closeForm);

document.getElementById("saveJobBtn").addEventListener("click", () => {
  const company = document.getElementById("f-company").value.trim();
  const role = document.getElementById("f-role").value.trim();
  if (!company || !role) return;

  const jobData = {
    id: editingId || uid(),
    company,
    role,
    link: document.getElementById("f-link").value.trim(),
    notes: document.getElementById("f-notes").value.trim(),
    stage: document.getElementById("f-stage").value,
    date: document.getElementById("f-date").value,
  };

  if (editingId) {
    const existing = jobs.find((j) => j.id === editingId);
    jobData.match = existing ? existing.match : undefined;
    jobs = jobs.map((j) => (j.id === editingId ? jobData : j));
  } else {
    jobs.unshift(jobData);
  }

  saveJobs();
  closeForm();
  render();
});

// ---------- Toolbar ----------

document.getElementById("searchInput").addEventListener("input", (e) => {
  query = e.target.value;
  renderList();
});

document.getElementById("filterTabs").addEventListener("click", (e) => {
  if (!e.target.dataset.filter) return;
  filter = e.target.dataset.filter;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  e.target.classList.add("active");
  renderList();
});

// ---------- Helpers ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/"/g, "&quot;");
}

// ---------- Init ----------

render();
document.getElementById('matchBtn').addEventListener('click', async () => {
  const resume = document.getElementById('resumeInput').value;
  const jobDescription = document.getElementById('jobInput').value;
  const resultDiv = document.getElementById('matchResult');

  resultDiv.textContent = "Checking match...";

  try {
    const response = await fetch('https://mission-control-backend-q3md.onrender.com/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume, jobDescription })
    });

    const data = await response.json();
    const parsed = JSON.parse(data.result);

    resultDiv.innerHTML = `<strong>Score:</strong> ${parsed.score}/100<br><strong>Reason:</strong> ${parsed.reason}`;
  } catch (error) {
    resultDiv.textContent = "Error: " + error.message;
  }
});