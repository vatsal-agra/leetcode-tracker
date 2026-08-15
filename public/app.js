/* ============================================================================
   DSA Mission Control — SPA
   ========================================================================== */
"use strict";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const S = {
  state: null,
  view: (location.hash || "#dashboard").slice(1),
  logFilters: { q: "", month: "", topic: "", type: "", diff: "", auto: "" },
  charts: {},
  countedUp: false,
};

const TYPES = ["Block", "Wildcard", "Redo", "Timed", "Contest"];
const DIFFS = ["Easy", "Medium", "Hard"];

/* ------------------------------------------------------------------ utils */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]}`;
}
function timeago(ts) {
  if (!ts) return "never";
  const s = Math.floor(Date.now() / 1000 - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function num(n) { return n == null ? "—" : n.toLocaleString("en-IN"); }

function toast(msg, ok = true) {
  const t = document.createElement("div");
  t.className = `toast ${ok ? "ok" : "err"}`;
  t.innerHTML = `<svg><use href="#${ok ? "i-check" : "i-x"}"/></svg><span>${esc(msg)}</span>`;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = ".4s"; setTimeout(() => t.remove(), 400); }, 3800);
}

function countUp(el, target, suffix = "", decimals = 0) {
  const dur = 900, t0 = performance.now();
  function tick(t) {
    const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * e).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  const pw = localStorage.getItem("dsa_pw");
  if (pw) headers["Authorization"] = "Bearer " + pw;
  const r = await fetch(path, { headers, ...opts });
  if (r.status === 401) { showLock(); throw new Error("locked"); }
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

function showLock() {
  if ($("#lock-screen")) return;
  const d = document.createElement("div");
  d.id = "lock-screen";
  d.className = "modal-back open";
  d.innerHTML = `<div class="modal" style="width:360px;text-align:center">
    <div style="font-size:34px;margin-bottom:10px">🎯</div>
    <h3 style="margin-bottom:6px">DSA Mission Control</h3>
    <p style="font-size:12px;color:var(--mut);margin-bottom:16px">this tracker is private — enter the access password</p>
    <input class="input" id="lock-pw" type="password" placeholder="password" style="width:100%">
    <div class="modal-actions" style="justify-content:center">
      <button class="btn btn-primary" id="lock-go" style="width:100%">Unlock</button>
    </div></div>`;
  document.body.appendChild(d);
  const go = () => {
    const v = $("#lock-pw").value;
    if (!v) return;
    localStorage.setItem("dsa_pw", v);
    d.remove();
    reload().catch(() => { localStorage.removeItem("dsa_pw"); toast("Wrong password", false); showLock(); });
  };
  $("#lock-go").onclick = go;
  $("#lock-pw").onkeydown = e => { if (e.key === "Enter") go(); };
  setTimeout(() => $("#lock-pw").focus(), 50);
}
async function reload() {
  S.state = await api("/api/state");
  renderChrome();
  render(S.view);
}
async function patchProblem(id, patch) {
  try {
    await api(`/api/problem/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    await reload();
    return true;
  } catch (e) { toast("Update failed: " + e.message, false); return false; }
}

/* ------------------------------------------------------------------ chrome */
function renderChrome() {
  const st = S.state, k = st.kpi, lc = st.lc, sync = st.sync.last;
  $("#side-user").textContent = "@" + lc.username;
  $("#side-rank").textContent = lc.ranking ? `rank ${num(lc.ranking)}` : "rank —";
  const dot = $("#sync-dot");
  dot.className = "sync-dot " + (sync ? (sync.ok ? "ok" : "err") : "");
  dot.title = sync ? `last sync ${timeago(sync.ts)} · ${sync.message}` : "no sync yet";
  $("#last-sync").textContent = sync ? `synced ${timeago(sync.ts)}` : "";
  $("#nav-log-count").textContent = st.problems.length || "";
  $("#nav-redo-count").textContent = k.open_flags || "";
  $("#nav-sd-count").textContent = st.sysdesign ? `${st.sysdesign.done}/${st.sysdesign.total}` : "";
  $$(".nav-item, .tab-item").forEach(a => a.classList.toggle("active", a.dataset.view === S.view));
  const titles = {
    dashboard: ["Dashboard", "no deadlines — just progress · auto-synced from LeetCode"],
    topics: ["Topics", "the full interview syllabus — 18 blocks, done at your pace"],
    log: ["Problem Log", "every solve, auto-captured · edit anything inline"],
    redo: ["Redo Queue", "flagged problems — re-solve them whenever, the tracker notices"],
    sysdesign: ["System Design", "43 topics · spin the picker, learn one, tick it off"],
    playbook: ["Playbook", "the rules that make the numbers real"],
    settings: ["Settings", "engine room"],
  };
  const [t, sub] = titles[S.view] || titles.dashboard;
  $("#page-title").textContent = t;
  $("#page-sub").textContent = sub;
}

/* ------------------------------------------------------------------ dashboard */
function ringSVG(pct) {
  const r = 46, c = 2 * Math.PI * r;
  return `
  <div class="ring-wrap">
    <svg viewBox="0 0 104 104">
      <circle class="ring-bg" cx="52" cy="52" r="${r}"/>
      <circle class="ring-fg" cx="52" cy="52" r="${r}" stroke-dasharray="${c}"
              stroke-dashoffset="${c * (1 - Math.min(1, pct / 100))}"/>
    </svg>
    <div class="ring-center"><div><b>${pct}%</b><br><span>COMPLETE</span></div></div>
  </div>`;
}

function renderDashboard(el) {
  const st = S.state, k = st.kpi, lc = st.lc, sd = st.sysdesign;
  const sinceB = lc.since_baseline;

  const review = st.problems.filter(p => p.needs_review);
  el.innerHTML = `
  ${st.cross_check ? `<div class="warnbar"><svg><use href="#i-flag"/></svg>${esc(st.cross_check)}</div>` : ""}
  ${review.length ? `
  <div class="card review-card">
    <div class="card-h"><svg><use href="#i-bolt"/></svg>Needs your call
      <span class="spacer"></span>
      <span style="letter-spacing:0;text-transform:none;font-weight:600">these can be solved more than one way — which did you use?</span></div>
    <div class="card-b" style="display:flex;flex-direction:column;gap:4px">
      ${review.map(p => `
        <div class="review-row" data-id="${p.id}">
          <span class="feed-dot ${p.difficulty || "na"}"></span>
          <div class="review-title">${esc(p.title)}<span class="review-date">${fmtDate(p.date_solved)}</span></div>
          <div class="cands">
            ${(p.candidates.length ? p.candidates : S.state.topics.map(t => t.name).slice(0, 4)).map(cd => `
              <button class="cand-chip ${cd === p.topic ? "guess" : ""}" data-topic="${esc(cd)}">
                ${esc(cd)}${cd === p.topic ? " · current guess" : ""}</button>`).join("")}
          </div>
        </div>`).join("")}
    </div>
  </div>` : ""}

  <div class="grid g-kpi ${review.length ? "mt" : ""}">
    <div class="card kpi2">
      <div class="kpi2-top">
        <span class="kpi-label"><svg><use href="#i-bolt"/></svg>LeetCode — total solved</span>
        <span class="chip ${st.sync.last && st.sync.last.ok ? "live" : "off"}" style="text-transform:none">${st.sync.last && st.sync.last.ok ? "synced" : "sync issue"}</span>
      </div>
      <div class="kpi2-mid">
        <span class="kpi-huge" id="cu-lift">${num(lc.lifetime)}</span>
        <span class="kpi2-total">problems<br>crushed</span>
        ${sinceB != null && sinceB > 0 ? `<span class="delta-chip good" style="margin:0"><svg><use href="#i-trend"/></svg>+${sinceB} since tracking began</span>` : ""}
      </div>
      <div class="bar"><i class="${k.pct >= 100 ? "full" : ""}" style="width:${Math.min(100, k.pct)}%"></i></div>
      <div class="kpi2-foot">
        <span><span style="color:var(--easy)">● ${lc.easy ?? "—"} easy</span> ·
          <span style="color:var(--med)">● ${lc.medium ?? "—"} medium</span> ·
          <span style="color:var(--hard)">● ${lc.hard ?? "—"} hard</span></span>
        <span>${k.done} / ${k.total_target} tracked · rank <b>${num(lc.ranking)}</b></span>
      </div>
    </div>

    <div class="card kpi2 sd-kpi" onclick="location.hash='#sysdesign'">
      <div class="kpi2-top">
        <span class="kpi-label"><svg><use href="#i-sys"/></svg>System design — topics mastered</span>
        <span class="chip live" style="text-transform:none;color:var(--violet);background:rgba(167,139,250,.11)">picker</span>
      </div>
      <div class="kpi2-mid">
        <span class="kpi-huge">${sd.done}</span>
        <span class="kpi2-total">of ${sd.total}<br>topics</span>
        ${sd.pick ? `<span class="delta-chip good" style="margin:0;color:var(--violet);background:rgba(167,139,250,.11)"><svg><use href="#i-target"/></svg>${esc(sd.pick)}</span>`
                  : `<span class="delta-chip good" style="margin:0;color:var(--violet);background:rgba(167,139,250,.11)"><svg><use href="#i-sync"/></svg>spin the picker →</span>`}
      </div>
      <div class="bar"><i class="${sd.pct >= 100 ? "full" : ""}" style="width:${Math.min(100, sd.pct)}%"></i></div>
      <div class="kpi2-foot">
        <span>${sd.concepts.filter(c => c.done).length} / ${sd.concepts.length} core concepts · ${sd.problems.filter(p => p.done).length} / ${sd.problems.length} design problems</span>
        <span style="color:var(--violet);font-weight:700">open →</span>
      </div>
    </div>
  </div>

  <div class="grid g-mid mt">
    <div class="card">
      <div class="card-h"><svg><use href="#i-layers"/></svg>Topic snapshot<span class="spacer"></span>
        <a href="#topics" style="letter-spacing:0;text-transform:none;color:var(--indigo);font-weight:700">all topics →</a></div>
      <div class="card-b">
        ${st.topics.map(t => `
          <div class="tbar-row">
            <div class="tbar-name">${esc(t.name)}</div>
            <div class="bar thin"><i class="${t.pct >= 100 ? "full" : ""}" style="width:${Math.min(100, t.pct)}%"></i></div>
            <div class="tbar-num"><b>${t.block_done}</b> / ${t.target}</div>
          </div>`).join("")}
      </div>
    </div>
    <div class="card">
      <div class="card-h"><svg><use href="#i-layers"/></svg>Splits</div>
      <div class="card-b">
        <div class="donut-box"><canvas id="ch-donut"></canvas></div>
        <div class="legend" style="margin-top:14px">
          ${DIFFS.map(d => `<div class="legend-row"><i style="background:var(--${d === "Easy" ? "easy" : d === "Medium" ? "med" : "hard"})"></i>${d}<b>${st.difficulty_split[d]}</b></div>`).join("")}
          <div style="height:1px;background:var(--line);margin:4px 0"></div>
          ${TYPES.map(t => `<div class="legend-row"><span class="tpill ${t}">${t}</span><b style="margin-left:auto">${st.type_split[t]}</b></div>`).join("")}
        </div>
      </div>
    </div>
  </div>

  <div class="grid g-bottom mt" style="grid-template-columns:1fr">
    <div class="card">
      <div class="card-h"><svg><use href="#i-bolt"/></svg>Recent activity<span class="spacer"></span>
        <span style="letter-spacing:0;text-transform:none;font-weight:600">auto-captured ⚡</span></div>
      <div class="card-b feed">
        ${st.problems.slice(0, 10).map(p => `
          <div class="feed-row">
            <span class="feed-dot ${p.difficulty || "na"}"></span>
            <div class="feed-main">
              <div class="feed-title">${esc(p.title)}</div>
              <div class="feed-meta"><span class="tpill ${p.type}">${p.type}</span><span>${esc(p.topic)}</span>
                ${p.auto ? '<span class="auto-badge"><svg><use href="#i-bolt"/></svg>AUTO</span>' : ""}</div>
            </div>
          </div>`).join("") || `<div class="empty"><b>Nothing yet</b>solve something — it shows up here on its own</div>`}
      </div>
    </div>
  </div>`;

  if (!S.countedUp) {
    if (lc.lifetime != null) countUp($("#cu-lift", el), lc.lifetime);
    S.countedUp = true;
  }
  $$(".review-row", el).forEach(row => {
    const id = +row.dataset.id;
    $$(".cand-chip", row).forEach(chip => chip.onclick = async () => {
      const topic = chip.dataset.topic;
      if (await patchProblem(id, { topic, needs_review: 0 }))
        toast(`Filed under ${topic} ⚡`);
    });
  });
  drawDonut();
}

/* charts */
function chartDefaults() {
  if (!window.Chart) return false;
  Chart.defaults.color = "#5d6678";
  Chart.defaults.font.family = "'Segoe UI Variable Display','Segoe UI',Inter,sans-serif";
  Chart.defaults.font.size = 10.5;
  Chart.defaults.borderColor = "rgba(148,163,184,.07)";
  return true;
}

function drawDonut() {
  if (!chartDefaults()) return;
  const el = $("#ch-donut");
  if (!el) return;
  const ds = S.state.difficulty_split;
  S.charts.donut?.destroy();
  S.charts.donut = new Chart(el, {
    type: "doughnut",
    data: {
      labels: DIFFS,
      datasets: [{ data: DIFFS.map(d => ds[d]), backgroundColor: ["#2dd4a7", "#fbbf24", "#f87171"],
                   borderColor: "#0e1424", borderWidth: 3, hoverOffset: 5 }],
    },
    options: {
      cutout: "72%", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#141c31", displayColors: false } },
    },
    plugins: [{
      id: "center",
      afterDraw(c) {
        const { width, height } = c; const g = c.ctx;
        const total = DIFFS.reduce((a, d) => a + ds[d], 0);
        g.save(); g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "800 26px 'Segoe UI Variable Display','Segoe UI'"; g.fillStyle = "#e9edf7";
        g.fillText(total, width / 2, height / 2 - 8);
        g.font = "700 9px 'Segoe UI'"; g.fillStyle = "#5d6678"; g.letterSpacing = "1px";
        g.fillText("SOLVED", width / 2, height / 2 + 14); g.restore();
      },
    }],
  });
}

/* ------------------------------------------------------------------ system design */
const slugify = n => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
S.sd = { mode: "grid", topic: null, attempt: null, answers: {}, result: null };
S._qbank = {};

function sdFind(name) {
  const sd = S.state.sysdesign;
  return [...sd.concepts, ...sd.problems].find(t => t.name === name);
}

function renderSysdesign(el) {
  const mode = S.sd.mode;
  if (mode === "topic") return renderSdTopic(el);
  if (mode === "test") return renderSdTest(el);
  if (mode === "result") return renderSdResult(el);
  renderSdGrid(el);
}

function renderSdGrid(el) {
  const sd = S.state.sysdesign;
  const remaining = [...sd.concepts, ...sd.problems].filter(t => !t.done).map(t => t.name);
  const section = (title, items, hint) => `
    <div class="card mt">
      <div class="card-h"><svg><use href="#i-sys"/></svg>${title}<span class="spacer"></span>
        <span style="letter-spacing:0;text-transform:none;font-weight:600">${items.filter(i => i.done).length} / ${items.length} · ${hint}</span></div>
      <div class="card-b sd-grid">
        ${items.map(t => `
          <button class="sd-chip ${t.done ? "done" : ""} ${sd.pick === t.name ? "picked" : ""}" data-name="${esc(t.name)}">
            <span class="sd-tick"><svg><use href="#i-check"/></svg></span>
            <span class="sd-name">${esc(t.name)}</span>
            ${t.score != null && !t.done ? `<span class="sd-score fail">best ${t.score}%</span>` : ""}
            ${t.done ? `<span class="sd-score pass">${t.score != null ? t.score + "%" : "✓"}</span>` : ""}
            ${sd.pick === t.name ? '<span class="sd-flag">current pick</span>' : ""}
          </button>`).join("")}
      </div>
    </div>`;

  el.innerHTML = `
  <div class="card picker-card">
    <div class="picker-left">
      <div class="kpi-label">${sd.pick ? "Current pick — study it, then test out of it" : "No pick yet"}</div>
      <div class="picker-name ${sd.pick ? "" : "empty"}" id="picker-name">
        ${sd.pick ? esc(sd.pick) : remaining.length ? "spin to get today's topic" : "all 43 passed — you absolute legend"}
      </div>
      <div class="picker-actions">
        ${sd.pick ? `
          <button class="btn btn-primary" id="pick-test"><svg><use href="#i-bolt"/></svg>I'm ready — take the test</button>
          <button class="btn btn-ghost" id="pick-again"><svg><use href="#i-sync"/></svg>Spin again</button>` : `
          <button class="btn btn-primary btn-spin" id="btn-spin" ${remaining.length ? "" : "disabled"}>
            <svg><use href="#i-sync"/></svg>Spin the picker</button>`}
      </div>
    </div>
    <div class="picker-right">
      <div class="picker-count"><b>${sd.done}</b><span>/ ${sd.total} topics<br>passed</span></div>
      <div class="bar" style="width:150px"><i class="${sd.pct >= 100 ? "full" : ""}" style="width:${Math.min(100, sd.pct)}%"></i></div>
    </div>
  </div>
  ${section("Core concepts", sd.concepts, "enter a card to take its test")}
  ${section("Design problems", sd.problems, "full mock designs")}
  <p style="font-size:11.5px;color:var(--dim);margin-top:14px">a topic only ticks when you score <b>≥ ${sd.pass_mark}%</b> on its 20-question test — 8 easy · 8 medium · 4 hard, no explanations given, missed ones are yours to research.</p>`;

  $$(".sd-chip", el).forEach(chip => chip.onclick = () => {
    if (S._spinning) return;
    S.sd = { mode: "topic", topic: chip.dataset.name, attempt: null, answers: {}, result: null };
    renderSysdesign($("#view-sysdesign"));
  });
  const spinBtn = $("#btn-spin", el);
  if (spinBtn) spinBtn.onclick = () => runSpin(el, remaining);
  const again = $("#pick-again", el);
  if (again) again.onclick = () => runSpin(el, remaining.filter(n => n !== sd.pick));
  const testBtn = $("#pick-test", el);
  if (testBtn) testBtn.onclick = () => {
    S.sd = { mode: "topic", topic: sd.pick, attempt: null, answers: {}, result: null };
    renderSysdesign($("#view-sysdesign"));
  };
}

function renderSdTopic(el) {
  const sd = S.state.sysdesign;
  const t = sdFind(S.sd.topic);
  if (!t) { S.sd.mode = "grid"; return renderSdGrid(el); }
  const status = t.done
    ? `<span class="chip complete">passed · ${t.score != null ? t.score + "%" : "done"}</span>`
    : t.score != null
      ? `<span class="chip missed">best ${t.score}% — below the ${sd.pass_mark}% bar</span>`
      : `<span class="chip upcoming">not attempted yet</span>`;
  el.innerHTML = `
  <a class="sd-back" id="sd-back">← all topics</a>
  <div class="card picker-card" style="margin-top:12px">
    <div class="picker-left">
      <div class="kpi-label" style="display:flex;gap:10px;align-items:center">Topic test ${sd.pick === t.name ? '<span class="sd-flag">current pick</span>' : ""}</div>
      <div class="picker-name">${esc(t.name)}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px">${status}</div>
      <div class="picker-actions">
        <button class="btn btn-primary btn-spin" id="sd-start"><svg><use href="#i-bolt"/></svg>${t.score != null && !t.done ? "Retake the test" : t.done ? "Take it again (for pride)" : "Start the test"}</button>
      </div>
    </div>
    <div class="picker-right" style="max-width:300px">
      <div style="font-size:11.5px;color:var(--mut);line-height:1.75">
        <b style="color:var(--text)">20 questions</b> — 8 easy · 8 medium · 4 hard<br>
        pass at <b style="color:var(--text)">≥ ${sd.pass_mark}%</b> to tick the topic<br>
        no explanations — missed questions are<br>yours to research afterwards
      </div>
    </div>
  </div>`;
  $("#sd-back", el).onclick = () => { S.sd.mode = "grid"; renderSysdesign(el); };
  $("#sd-start", el).onclick = async () => {
    const slug = slugify(t.name);
    try {
      if (!S._qbank[slug]) {
        const r = await fetch(`/questions/${slug}.json`);
        if (!r.ok) throw new Error(`questions not found (${r.status})`);
        S._qbank[slug] = await r.json();
      }
      const shuf = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const groups = { easy: [], medium: [], hard: [] };
      S._qbank[slug].questions.forEach(q => (groups[q.difficulty] || groups.easy).push(q));
      const seq = [...shuf(groups.easy), ...shuf(groups.medium), ...shuf(groups.hard)];
      S.sd.attempt = seq.map(q => {
        const om = shuf([0, 1, 2, 3]);
        return { q: q.q, difficulty: q.difficulty, opts: om.map(o => q.options[o]), correct: om.indexOf(q.answer) };
      });
      S.sd.answers = {};
      S.sd.mode = "test";
      renderSysdesign(el);
      $("#view-sysdesign").scrollIntoView();
    } catch (e) { toast("Couldn't load the test: " + e.message, false); }
  };
}

function renderSdTest(el) {
  const t = S.sd;
  const total = t.attempt.length;
  const answered = Object.keys(t.answers).length;
  el.innerHTML = `
  <div class="test-head card">
    <div>
      <div class="kpi-label">Test in progress</div>
      <div style="font-size:16px;font-weight:800;margin-top:3px">${esc(t.topic)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:14px">
      <span class="test-progress" id="test-progress">${answered} / ${total} answered</span>
      <button class="btn btn-ghost" id="test-abandon">Abandon</button>
      <button class="btn btn-primary" id="test-submit" ${answered === total ? "" : "disabled"}>Submit</button>
    </div>
  </div>
  ${t.attempt.map((q, i) => `
    <div class="card q-card" data-i="${i}">
      <div class="q-head"><span class="q-num">${String(i + 1).padStart(2, "0")}</span>
        <span class="pill ${q.difficulty === "easy" ? "Easy" : q.difficulty === "medium" ? "Medium" : "Hard"}">${q.difficulty}</span></div>
      <div class="q-text">${esc(q.q)}</div>
      <div class="q-opts">
        ${q.opts.map((o, oi) => `
          <button class="opt ${t.answers[i] === oi ? "sel" : ""}" data-oi="${oi}">
            <span class="opt-letter">${"ABCD"[oi]}</span><span>${esc(o)}</span>
          </button>`).join("")}
      </div>
    </div>`).join("")}
  <div class="test-foot">
    <button class="btn btn-primary btn-spin" id="test-submit-2" ${answered === total ? "" : "disabled"}>Submit test</button>
  </div>`;

  const refresh = () => {
    const n = Object.keys(t.answers).length;
    $("#test-progress", el).textContent = `${n} / ${total} answered`;
    const ok = n === total;
    $("#test-submit", el).disabled = !ok;
    $("#test-submit-2", el).disabled = !ok;
  };
  $$(".q-card", el).forEach(card => {
    const qi = +card.dataset.i;
    $$(".opt", card).forEach(opt => opt.onclick = () => {
      t.answers[qi] = +opt.dataset.oi;
      $$(".opt", card).forEach(o => o.classList.toggle("sel", o === opt));
      refresh();
    });
  });
  const submit = async () => {
    if (Object.keys(t.answers).length !== total) return;
    const missed = [];
    let correct = 0;
    t.attempt.forEach((q, i) => {
      if (t.answers[i] === q.correct) correct++;
      else missed.push({ q: q.q, yours: q.opts[t.answers[i]], difficulty: q.difficulty });
    });
    const pct = Math.round(correct / total * 100);
    let resp = null;
    try {
      resp = await api("/api/sd", { method: "POST", body: JSON.stringify({ action: "score", name: t.topic, pct }) });
    } catch (e) { if (e.message !== "locked") toast("Score not saved: " + e.message, false); }
    t.result = { pct, correct, total, missed, passed: resp ? resp.passed : pct >= (S.state.sysdesign.pass_mark || 75) };
    t.mode = "result";
    try { S.state = await api("/api/state"); } catch {}
    renderChrome();
    renderSysdesign(el);
    window.scrollTo(0, 0);
    $("#view-sysdesign").scrollIntoView();
  };
  $("#test-submit", el).onclick = submit;
  $("#test-submit-2", el).onclick = submit;
  $("#test-abandon", el).onclick = () => {
    if (!confirm("Abandon this attempt? Nothing will be recorded.")) return;
    S.sd = { mode: "topic", topic: t.topic, attempt: null, answers: {}, result: null };
    renderSysdesign(el);
  };
}

function renderSdResult(el) {
  const t = S.sd, r = t.result;
  el.innerHTML = `
  <div class="card result-card ${r.passed ? "pass" : "fail"}">
    <div class="result-pct">${r.pct}%</div>
    <div class="result-verdict">${r.passed ? "PASSED — topic ticked ✓" : `NOT YET — the bar is ${S.state.sysdesign.pass_mark || 75}%`}</div>
    <div class="result-sub">${r.correct} of ${r.total} correct · ${esc(t.topic)}</div>
    <div class="picker-actions" style="justify-content:center;margin-top:18px">
      ${r.passed ? "" : `<button class="btn btn-primary" id="res-retake"><svg><use href="#i-sync"/></svg>Retake when ready</button>`}
      <button class="btn ${r.passed ? "btn-primary" : "btn-ghost"}" id="res-back">Back to topics</button>
    </div>
  </div>
  ${r.missed.length ? `
  <div class="card mt">
    <div class="card-h"><svg><use href="#i-flag"/></svg>You missed ${r.missed.length} — go find out why<span class="spacer"></span>
      <span style="letter-spacing:0;text-transform:none;font-weight:600">no answers given, that's the point</span></div>
    <div class="card-b">
      ${r.missed.map(m => `
        <div class="missed-row">
          <span class="pill ${m.difficulty === "easy" ? "Easy" : m.difficulty === "medium" ? "Medium" : "Hard"}">${m.difficulty}</span>
          <div><div class="missed-q">${esc(m.q)}</div>
          <div class="missed-a">your answer: ${esc(m.yours)}</div></div>
        </div>`).join("")}
    </div>
  </div>` : `<div class="card mt"><div class="empty"><b>Flawless.</b>not a single miss — that's how it's done.</div></div>`}`;
  const retake = $("#res-retake", el);
  if (retake) retake.onclick = () => { S.sd = { mode: "topic", topic: t.topic, attempt: null, answers: {}, result: null }; renderSysdesign(el); };
  $("#res-back", el).onclick = () => { S.sd = { mode: "grid", topic: null, attempt: null, answers: {}, result: null }; renderSysdesign(el); };
}

function runSpin(el, remaining) {
  if (S._spinning || !remaining.length) return;
  S._spinning = true;
  const target = remaining[Math.floor(Math.random() * remaining.length)];
  const chips = $$(".sd-chip", el).filter(c => remaining.includes(c.dataset.name));
  const byName = Object.fromEntries(chips.map(c => [c.dataset.name, c]));
  const nameEl = $("#picker-name", el);
  nameEl.classList.remove("empty");
  const steps = Math.min(26, Math.max(14, remaining.length * 2));
  let i = 0, prev = null;
  const step = () => {
    let name;
    if (i >= steps) name = target;
    else do { name = remaining[Math.floor(Math.random() * remaining.length)]; }
    while (name === prev && remaining.length > 1);
    prev = name;
    if (prev && byName[prev]) chips.forEach(c => c.classList.remove("rolling"));
    const chip = byName[name];
    if (chip) { chip.classList.add("rolling"); chip.scrollIntoView({ block: "nearest", behavior: "instant" }); }
    nameEl.textContent = name;
    if (i >= steps) {
      setTimeout(async () => {
        chips.forEach(c => c.classList.remove("rolling"));
        if (chip) chip.classList.add("picked");
        nameEl.classList.add("landed");
        try {
          await api("/api/sd", { method: "POST", body: JSON.stringify({ action: "pick", name: target }) });
          toast(`Today's mission: ${target} 🎯`);
        } catch {}
        S._spinning = false;
        await reload();
      }, 420);
      return;
    }
    i++;
    setTimeout(step, 52 + i * i * 0.55);
  };
  step();
}

/* ------------------------------------------------------------------ topics */
function renderTopics(el) {
  const st = S.state;
  el.innerHTML = `<div class="tgrid">
    ${st.topics.map(t => `
      <div class="card tcard" data-topic="${esc(t.name)}">
        <div class="tcard-top">
          <div><div class="tcard-name">${esc(t.name)}</div></div>
          ${t.pct >= 100 ? '<span class="cold fresh">complete</span>' : t.touches ? '<span class="cold warm">in progress</span>' : ""}
        </div>
        <div class="tcard-nums"><b>${t.block_done}</b><span>/ ${t.target} block</span>
          <span style="margin-left:auto">${t.touches} touch${t.touches === 1 ? "" : "es"}</span></div>
        <div class="bar"><i class="${t.pct >= 100 ? "full" : ""}" style="width:${Math.min(100, t.pct)}%"></i></div>
        <div class="tcard-mix">
          <i class="e">${t.easy} easy</i><i class="m">${t.medium} med</i><i class="h">${t.hard} hard</i>
        </div>
      </div>`).join("")}
  </div>`;
  $$(".tcard", el).forEach(c => c.onclick = () => {
    S.logFilters = { q: "", month: "", topic: c.dataset.topic, type: "", diff: "", auto: "" };
    location.hash = "#log";
  });
}

/* ------------------------------------------------------------------ log */
function renderLog(el) {
  const st = S.state, f = S.logFilters;
  el.innerHTML = `
  <div class="log-tools">
    <input class="input log-search" id="lf-q" placeholder="Search title, topic, tag…" value="${esc(f.q)}">
    <select class="select" id="lf-topic"><option value="">All topics</option>
      ${st.topics.map(t => `<option ${f.topic === t.name ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
    <select class="select" id="lf-type"><option value="">All types</option>
      ${TYPES.map(t => `<option ${f.type === t ? "selected" : ""}>${t}</option>`).join("")}</select>
    <select class="select" id="lf-diff"><option value="">Any difficulty</option>
      ${DIFFS.map(d => `<option ${f.diff === d ? "selected" : ""}>${d}</option>`).join("")}</select>
    <button class="btn btn-primary" id="btn-add"><svg><use href="#i-plus"/></svg>Add</button>
    <span class="log-count" id="log-count"></span>
  </div>
  <div id="log-tbl"></div>`;

  const paintTable = () => {
    const q = S.logFilters;
    const rows = st.problems.filter(p =>
      (!q.q || (p.title + p.topic + (p.lc_tags || []).join(" ")).toLowerCase().includes(q.q.toLowerCase())) &&
      (!q.topic || p.topic === q.topic) &&
      (!q.type || p.type === q.type) &&
      (!q.diff || p.difficulty === q.diff));
    $("#log-count", el).textContent = `${rows.length} of ${st.problems.length}`;
    const box = $("#log-tbl", el);
    box.innerHTML = `
    <div class="card table-wrap">
      <table class="log">
        <thead><tr>
          <th>Problem</th><th>Diff</th><th>Topic</th><th>Type</th>
          <th title="minutes">Time</th><th title="solved without editorial">Clean</th>
          <th title="flag for redo">Flag</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(p => `
          <tr data-id="${p.id}">
            <td><div class="prob-title">
              ${p.lc_id ? `<span class="lc-num">#${p.lc_id}</span>` : ""}
              <span class="t" title="${esc(p.lc_tags.join(", "))}">${esc(p.title)}</span>
              ${p.auto ? '<span class="auto-badge" title="auto-captured from LeetCode"><svg><use href="#i-bolt"/></svg></span>' : ""}
              ${p.needs_review ? '<span class="review-badge" title="ambiguous topic — pick the approach you used (dashboard has one-click chips)">?</span>' : ""}
              ${(p.auto || p.lc_id) ? `<a href="https://leetcode.com/problems/${esc(p.slug)}/" target="_blank" title="open on LeetCode"><svg><use href="#i-ext"/></svg></a>` : ""}
            </div></td>
            <td>${p.difficulty ? `<span class="pill ${p.difficulty}">${p.difficulty}</span>` : '<span class="pill na">—</span>'}</td>
            <td><select class="mini-select ${p.needs_review ? "attn" : ""}" data-f="topic">
              ${st.topics.map(t => `<option ${p.topic === t.name ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></td>
            <td><select class="mini-select" data-f="type">
              ${TYPES.map(t => `<option ${p.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></td>
            <td><input class="mini-input" data-f="time_min" type="number" min="0" value="${p.time_min ?? ""}" placeholder="—"></td>
            <td><button class="icon-btn ${p.no_editorial ? "ok" : ""}" data-f="no_editorial" title="${p.no_editorial ? "solved clean" : "needed editorial"}"><svg><use href="#i-check"/></svg></button></td>
            <td><button class="icon-btn ${p.flag_redo && !p.redo_done ? "on" : ""}" data-f="flag_redo" title="${p.flag_redo ? (p.redo_done ? "redo done" : "flagged for redo") : "flag for redo"}"><svg><use href="#i-flag"/></svg></button></td>
            <td><input class="mini-input" data-f="notes" style="width:150px;text-align:left" value="${esc(p.notes || "")}" placeholder="pattern note…"></td>
            <td><button class="icon-btn danger" data-f="del" title="delete entry"><svg><use href="#i-trash"/></svg></button></td>
          </tr>`).join("")}
        </tbody>
      </table>
      ${!rows.length ? `<div class="empty"><svg><use href="#i-list"/></svg><b>No entries match</b>adjust the filters, or go solve something 🙂</div>` : ""}
    </div>`;

    $$("tbody tr", box).forEach(tr => {
      const id = +tr.dataset.id;
      const p = st.problems.find(x => x.id === id);
      $$("[data-f]", tr).forEach(ctl => {
        const fk = ctl.dataset.f;
        if (fk === "del") ctl.onclick = async () => {
          if (!confirm(`Delete "${p.title}" from the log?`)) return;
          try {
            await api(`/api/problem/${id}`, { method: "DELETE" });
            toast("Entry deleted");
            await reload();
          } catch (e) { toast("Delete failed: " + e.message, false); }
        };
        else if (fk === "no_editorial") ctl.onclick = () => patchProblem(id, { no_editorial: p.no_editorial ? 0 : 1 });
        else if (fk === "flag_redo") ctl.onclick = () => patchProblem(id, { flag_redo: p.flag_redo ? 0 : 1, redo_done: 0 });
        else if (fk === "time_min") ctl.onchange = () => patchProblem(id, { time_min: ctl.value === "" ? null : +ctl.value });
        else if (fk === "notes") ctl.onchange = () => patchProblem(id, { notes: ctl.value });
        else ctl.onchange = () => patchProblem(id, { [fk]: ctl.value });
      });
    });
  };

  const refilter = () => {
    S.logFilters = {
      q: $("#lf-q", el).value, month: "", topic: $("#lf-topic", el).value,
      type: $("#lf-type", el).value, diff: $("#lf-diff", el).value, auto: "",
    };
    paintTable();
  };
  $("#lf-q", el).oninput = () => { clearTimeout(S._qt); S._qt = setTimeout(refilter, 220); };
  ["lf-topic", "lf-type", "lf-diff"].forEach(id => $("#" + id, el).onchange = refilter);
  $("#btn-add", el).onclick = openAddModal;
  paintTable();
}

function openAddModal() {
  const st = S.state;
  $("#modal").innerHTML = `
    <h3>Add a problem manually</h3>
    <div class="set-row"><label>Title</label><input class="input" id="am-title" placeholder="e.g. Two Sum"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="set-row"><label>Date</label><input class="input" id="am-date" type="date" value="${st.today}"></div>
      <div class="set-row"><label>Difficulty</label><select class="select" id="am-diff">
        ${DIFFS.map(d => `<option>${d}</option>`).join("")}</select></div>
      <div class="set-row"><label>Topic</label><select class="select" id="am-topic">
        ${st.topics.map(t => `<option>${esc(t.name)}</option>`).join("")}</select></div>
      <div class="set-row"><label>Type</label><select class="select" id="am-type">
        ${TYPES.map(t => `<option>${t}</option>`).join("")}</select></div>
      <div class="set-row"><label>Time (min)</label><input class="input" id="am-time" type="number" min="0" placeholder="25"></div>
      <div class="set-row"><label>Flag redo?</label><select class="select" id="am-flag"><option value="0">No</option><option value="1">Yes</option></select></div>
    </div>
    <div class="set-row"><label>Notes / pattern</label><input class="input" id="am-notes" placeholder="always move the shorter wall inward…"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="am-cancel">Cancel</button>
      <button class="btn btn-primary" id="am-save">Add to log</button>
    </div>`;
  $("#modal-back").classList.add("open");
  $("#am-cancel").onclick = closeModal;
  $("#am-save").onclick = async () => {
    const title = $("#am-title").value.trim();
    if (!title) { toast("Give it a title", false); return; }
    if (!$("#am-date").value) { toast("Pick a date", false); return; }
    try {
      await api("/api/problem", { method: "POST", body: JSON.stringify({
        title, date_solved: $("#am-date").value, difficulty: $("#am-diff").value,
        topic: $("#am-topic").value, type: $("#am-type").value,
        time_min: $("#am-time").value ? +$("#am-time").value : null,
        flag_redo: $("#am-flag").value === "1", notes: $("#am-notes").value,
      })});
      closeModal(); toast("Added to log"); await reload();
    } catch (e) { toast("Add failed: " + e.message, false); }
  };
}
function closeModal() { $("#modal-back").classList.remove("open"); }

/* ------------------------------------------------------------------ redo */
function renderRedo(el) {
  const st = S.state;
  if (!st.redo.length) {
    el.innerHTML = `<div class="card"><div class="empty">
      <svg><use href="#i-check"/></svg><b>Queue is clear</b>
      flag a problem in the log when the editorial saved you — it lands here with a +7 day due date.<br>
      re-solving it on LeetCode clears the flag automatically.</div></div>`;
    return;
  }
  el.innerHTML = `<div class="redo-list">
    ${st.redo.map(r => `
      <div class="card redo-item">
        <div class="redo-main">
          <div class="redo-title">${esc(r.title)}</div>
          <div class="redo-meta">
            ${r.difficulty ? `<span class="pill ${r.difficulty}">${r.difficulty}</span>` : ""}
            <span class="tpill">${esc(r.topic)}</span>
            <a href="https://leetcode.com/problems/${esc(r.slug)}/" target="_blank" style="color:var(--indigo);font-size:11px;font-weight:700">open on LeetCode ↗</a>
          </div>
        </div>
        <button class="btn btn-ghost" data-id="${r.id}"><svg><use href="#i-check"/></svg>Mark redone</button>
      </div>`).join("")}
  </div>
  <p style="font-size:11.5px;color:var(--dim);margin-top:14px">no due dates here — whenever you're ready, just re-solve it on LeetCode: the next sync files it as a <b>Redo</b> entry and clears the flag on its own.</p>`;
  $$("[data-id]", el).forEach(b => b.onclick = async () => {
    if (await patchProblem(+b.dataset.id, { redo_done: 1 })) toast("Marked redone");
  });
}

/* ------------------------------------------------------------------ playbook */
function renderPlaybook(el) {
  el.innerHTML = `<div class="pb-grid">
    ${S.state.playbook.map((r, i) => `
      <div class="card pb-card">
        <div class="pb-num">${String(i + 1).padStart(2, "0")}</div>
        <div class="pb-title">${esc(r.title)}</div>
        <div class="pb-body">${esc(r.body)}</div>
      </div>`).join("")}
  </div>`;
}

/* ------------------------------------------------------------------ settings */
function renderSettings(el) {
  const s = S.state.settings, sync = S.state.sync.last;
  el.innerHTML = `
  <div class="set-grid">
    <div class="card" style="padding:20px">
      <div class="card-h" style="padding:0 0 14px"><svg><use href="#i-user"/></svg>LeetCode link</div>
      <div class="set-row"><label>Username</label><input class="input" id="s-user" value="${esc(s.username)}"></div>
      <div class="set-row"><label>Baseline solved (on ${fmtDate(s.baseline_date)})</label>
        <input class="input" id="s-base" type="number" value="${s.baseline_total}">
        <span class="hint">your lifetime total the day the roadmap started — powers the "since Jul 11" stat</span></div>
      <div class="set-row"><label>Auto-sync every (minutes)</label><input class="input" id="s-mins" type="number" min="5" value="${s.sync_minutes}"></div>
      <div class="set-actions">
        <button class="btn btn-primary" id="s-save">Save</button>
        <button class="btn btn-ghost" id="s-sync"><svg><use href="#i-sync"/></svg>Sync now</button>
      </div>
    </div>
    <div class="card" style="padding:20px">
      <div class="card-h" style="padding:0 0 14px"><svg><use href="#i-gear"/></svg>Data</div>
      <div class="set-row"><label>Last sync</label>
        <span class="hint">${sync ? `${timeago(sync.ts)} — ${esc(sync.message)}` : "never"}</span></div>
      <div class="set-row"><label>Storage</label>
        <span class="hint">SQLite at <code style="color:var(--mut)">dsa-tracker/data/tracker.db</code> — back it up by copying the file.</span></div>
      <div class="set-actions">
        <button class="btn btn-ghost" id="s-export">Export JSON</button>
        <button class="btn btn-ghost" id="s-import">Import backup…</button>
        <input type="file" id="s-import-file" accept=".json,application/json" style="display:none">
      </div>
      <div style="margin-top:22px;font-size:11.5px;color:var(--dim);line-height:1.7">
        Sync engine: official LeetCode GraphQL (recent accepted submissions + per-problem topic tags),
        with the Vercel mirror as fallback for profile stats. Nothing is written anywhere
        except this tracker's own storage — LeetCode calls are read-only.
        On the cloud version, set an <b style="color:var(--mut)">APP_PASSWORD</b> environment variable in
        Netlify to keep the tracker private; Import accepts the JSON exported from the desktop version.
      </div>
    </div>
  </div>`;
  $("#s-save", el).onclick = async () => {
    try {
      await api("/api/settings", { method: "PATCH", body: JSON.stringify({
        username: $("#s-user").value.trim(),
        baseline_total: +$("#s-base").value,
        sync_minutes: Math.max(5, +$("#s-mins").value || 30),
      })});
      toast("Settings saved");
      await reload();
    } catch (e) { toast("Save failed: " + e.message, false); }
  };
  $("#s-sync", el).onclick = syncNow;
  $("#s-export", el).onclick = async () => {
    try {
      const data = await api("/api/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = Object.assign(document.createElement("a"),
        { href: URL.createObjectURL(blob), download: "dsa-tracker-export.json" });
      a.click(); URL.revokeObjectURL(a.href);
    } catch (e) { toast("Export failed: " + e.message, false); }
  };
  $("#s-import", el).onclick = () => $("#s-import-file", el).click();
  $("#s-import-file", el).onchange = async ev => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const r = await api("/api/import", { method: "POST", body: JSON.stringify(payload) });
      toast(`Imported ${r.imported} entries`);
      await reload();
    } catch (e) {
      toast(e.message.includes("404") ? "Import is a cloud-version feature" : "Import failed: " + e.message, false);
    }
    ev.target.value = "";
  };
}

/* ------------------------------------------------------------------ sync + router */
async function syncNow() {
  const btn = $("#btn-sync");
  btn.classList.add("syncing"); btn.disabled = true;
  try {
    const r = await api("/api/sync", { method: "POST" });
    if (r.ok) toast(r.added ? `Sync complete — ${r.added} new solve${r.added > 1 ? "s" : ""} captured ⚡` : "Sync complete — you're up to date");
    else toast("Sync failed: " + r.message, false);
  } catch (e) { toast("Sync failed: " + e.message, false); }
  btn.classList.remove("syncing"); btn.disabled = false;
  await reload();
}

const RENDERERS = {
  dashboard: renderDashboard, topics: renderTopics, log: renderLog,
  redo: renderRedo, sysdesign: renderSysdesign, playbook: renderPlaybook, settings: renderSettings,
};

function render(view) {
  if (!S.state) return;
  S.view = RENDERERS[view] ? view : "dashboard";
  $$(".view").forEach(v => v.classList.remove("active"));
  const el = $(`#view-${S.view}`);
  el.classList.add("active");
  RENDERERS[S.view](el);
  renderChrome();
}

window.addEventListener("hashchange", () => render((location.hash || "#dashboard").slice(1)));
$("#btn-sync").onclick = syncNow;
$("#modal-back").addEventListener("click", e => { if (e.target.id === "modal-back") closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

/* refresh the "synced Xm ago" label every minute */
setInterval(() => { if (S.state) renderChrome(); }, 60000);
/* background: re-pull state every 5 min so an auto-sync shows up (never mid-test) */
setInterval(async () => {
  if (S.sd.mode === "test") return;
  try { S.state = await api("/api/state"); render(S.view); } catch {}
}, 300000);

(async function boot() {
  try {
    await reload();
  } catch (e) {
    if (e.message === "locked") return; // lock screen is showing
    document.body.innerHTML = `<div style="display:grid;place-items:center;height:100vh;color:#98a2b8;font-family:'Segoe UI'">
      <div style="text-align:center"><h2 style="color:#e9edf7">Can't reach the tracker</h2>
      <p style="margin-top:8px">local: start it with <code>Start DSA Tracker.bat</code> · cloud: check the Netlify deploy log — then refresh</p></div></div>`;
  }
})();
