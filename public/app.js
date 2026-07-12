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
  $("#streak-num").textContent = k.streak;
  $("#nav-log-count").textContent = st.problems.length || "";
  $("#nav-redo-count").textContent = k.open_flags || "";
  $$(".nav-item").forEach(a => a.classList.toggle("active", a.dataset.view === S.view));
  const titles = {
    dashboard: ["Dashboard", "Jul 11 → Dec 31 · 320 problems · auto-synced from LeetCode"],
    roadmap: ["Roadmap", "six months, planned to the problem"],
    topics: ["Topics", "the full interview syllabus — 18 blocks"],
    log: ["Problem Log", "every solve, auto-captured · edit anything inline"],
    redo: ["Redo Queue", "spaced repetition — flag it, re-solve it 7 days later"],
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
  const st = S.state, k = st.kpi, lc = st.lc;
  const cur = st.months.find(m => m.start <= st.today && st.today <= m.end)
    || st.months.find(m => m.status === "upcoming") || st.months[st.months.length - 1];
  const paceGood = k.pace >= k.required;
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
    <div class="card kpi">
      ${ringSVG(k.pct)}
      <div>
        <div class="kpi-label">Problems solved</div>
        <div class="kpi-big"><span id="cu-done">${k.done}</span><span style="font-size:16px;color:var(--dim)"> / ${k.total_target}</span></div>
        <div class="kpi-sub">day <b>${k.days_in}</b> of 174 · <b>${k.days_left}</b> days left</div>
      </div>
    </div>

    <div class="card kpi"><div style="flex:1">
      <div class="kpi-label">Pace / day</div>
      <div class="pace-two" style="margin-top:6px">
        <div><div class="kpi-big" id="cu-pace">${k.pace.toFixed(2)}</div><div class="kpi-sub">current</div></div>
        <div class="pace-vs"></div>
        <div><div class="kpi-big" style="color:var(--mut)">${k.required.toFixed(2)}</div><div class="kpi-sub">required</div></div>
      </div>
      <div class="delta-chip ${paceGood ? "good" : "bad"}">
        <svg><use href="#i-trend"/></svg>${paceGood ? "ahead of the line" : `${(k.required - k.pace).toFixed(2)}/day behind the line`}
      </div>
    </div></div>

    <div class="card kpi"><div style="flex:1">
      <div class="kpi-label">${cur.name} — month ${st.months.indexOf(cur) + 1}/6</div>
      <div class="kpi-big" style="margin-top:6px">${cur.done}<span style="font-size:16px;color:var(--dim)"> / ${cur.target}</span></div>
      <div class="bar" style="margin:9px 0 8px"><i class="${cur.pct >= 100 ? "full" : ""}" style="width:${Math.min(100, cur.pct)}%"></i></div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="chip ${cur.status}">${cur.status}</span>
        <span class="kpi-sub"><b>${cur.need_per_day}</b>/day needed</span>
      </div>
    </div></div>

    <div class="card kpi"><div style="flex:1">
      <div class="kpi-label" style="display:flex;justify-content:space-between">LeetCode · live
        <span class="chip ${st.sync.last && st.sync.last.ok ? "live" : "off"}" style="text-transform:none">${st.sync.last && st.sync.last.ok ? "synced" : "sync issue"}</span>
      </div>
      <div style="display:flex;gap:20px;margin-top:8px">
        <div><div class="kpi-big" id="cu-lift">${num(lc.lifetime)}</div><div class="kpi-sub">lifetime</div></div>
        <div><div class="kpi-big" style="color:var(--green)">${sinceB != null && sinceB >= 0 ? "+" + sinceB : "—"}</div><div class="kpi-sub">since Jul 11</div></div>
      </div>
      <div class="kpi-sub" style="margin-top:9px">rank <b>${num(lc.ranking)}</b> · E ${lc.easy ?? "—"} / M ${lc.medium ?? "—"} / H ${lc.hard ?? "—"}</div>
    </div></div>
  </div>

  <div class="grid g-mid mt">
    <div class="card">
      <div class="card-h"><svg><use href="#i-trend"/></svg>Burn-up — plan vs actual<span class="spacer"></span></div>
      <div class="card-b"><div class="chart-box"><canvas id="ch-burn"></canvas></div></div>
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

  <div class="card mt">
    <div class="card-h"><svg><use href="#i-cal"/></svg>Daily activity<span class="spacer"></span>
      <span style="letter-spacing:0;text-transform:none;font-weight:600">best streak · ${k.best_streak}d</span></div>
    <div class="card-b">
      <div id="heatmap"></div>
      <div class="heat-legend">less
        <span class="heat-cell"></span><span class="heat-cell l1"></span><span class="heat-cell l2"></span>
        <span class="heat-cell l3"></span><span class="heat-cell l4"></span> more
      </div>
    </div>
  </div>

  <div class="grid g-months mt">
    ${st.months.map(m => `
      <div class="mcard ${m === cur ? "current" : ""}">
        <div class="mcard-top"><span class="mcard-name">${m.name}</span><span class="chip ${m.status}">${m.status}</span></div>
        <div class="mcard-nums">${m.done}<span> / ${m.target}</span></div>
        <div class="bar thin"><i class="${m.pct >= 100 ? "full" : ""}" style="width:${Math.min(100, m.pct)}%"></i></div>
        <div class="mcard-need">${m.status === "upcoming" ? `${fmtDate(m.start)} → ${fmtDate(m.end)}` : m.status === "complete" ? "done ✓" : m.status === "missed" ? "target missed" : `needs <b>${m.need_per_day}</b>/day`}</div>
      </div>`).join("")}
  </div>

  <div class="grid g-bottom mt">
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
      <div class="card-h"><svg><use href="#i-bolt"/></svg>Recent activity<span class="spacer"></span>
        <span style="letter-spacing:0;text-transform:none;font-weight:600">auto-captured ⚡</span></div>
      <div class="card-b feed">
        ${st.problems.slice(0, 9).map(p => `
          <div class="feed-row">
            <span class="feed-dot ${p.difficulty || "na"}"></span>
            <div class="feed-main">
              <div class="feed-title">${esc(p.title)}</div>
              <div class="feed-meta"><span class="tpill ${p.type}">${p.type}</span><span>${esc(p.topic)}</span>
                ${p.auto ? '<span class="auto-badge"><svg><use href="#i-bolt"/></svg>AUTO</span>' : ""}</div>
            </div>
            <span class="feed-date">${fmtDate(p.date_solved)}</span>
          </div>`).join("") || `<div class="empty"><b>Nothing yet</b>solve something — it shows up here on its own</div>`}
      </div>
    </div>
  </div>`;

  if (!S.countedUp) {
    countUp($("#cu-done", el), k.done);
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
  drawHeatmap($("#heatmap", el));
  drawBurnup();
  drawDonut();
}

/* heatmap */
function drawHeatmap(box) {
  const st = S.state;
  const start = new Date(st.settings.roadmap_start + "T00:00:00");
  const end = new Date(st.settings.roadmap_end + "T00:00:00");
  const today = st.today;
  // pad to Monday
  const first = new Date(start);
  first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  let cells = "", monthLabels = [], week = 0, lastMonth = -1;
  for (let d = new Date(first); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = ymd(d);
    const dow = (d.getDay() + 6) % 7;
    if (dow === 0) {
      week++;
      if (d.getMonth() !== lastMonth && d >= start) { monthLabels.push([week, MONTH_NAMES[d.getMonth()]]); lastMonth = d.getMonth(); }
    }
    if (d < start) { cells += `<span class="heat-cell" style="visibility:hidden"></span>`; continue; }
    const n = st.heatmap[iso] || 0;
    const lvl = n >= 4 ? "l4" : n === 3 ? "l3" : n === 2 ? "l2" : n === 1 ? "l1" : "";
    const fut = iso > today ? "future" : "";
    const tod = iso === today ? "today" : "";
    cells += `<span class="heat-cell ${lvl} ${fut} ${tod}" title="${fmtDate(iso)} — ${n} solved"></span>`;
  }
  const totalWeeks = week + 1;
  box.innerHTML = `
    <div class="heat-months" style="display:grid;grid-template-columns:repeat(${totalWeeks},16.5px)">
      ${(() => { let out = "", prev = 0; for (const [w, name] of monthLabels) { out += `<span style="grid-column:${w + 1}">${name}</span>`; prev = w; } return out; })()}
    </div>
    <div class="heat-grid">${cells}</div>`;
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

function drawBurnup() {
  if (!chartDefaults()) return;
  const st = S.state;
  const labels = [], plan = [], actual = [];
  const start = new Date(st.settings.roadmap_start + "T00:00:00");
  const end = new Date(st.settings.roadmap_end + "T00:00:00");
  const rates = {};
  st.months.forEach(m => rates[m.key] = m.target / m.days);
  const actMap = {};
  st.burnup.forEach(b => actMap[b.date] = b.actual);
  let planCum = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = ymd(d);
    planCum += rates[iso.slice(0, 7)] || 0;
    labels.push(iso);
    plan.push(Math.round(planCum * 10) / 10);
    actual.push(iso <= st.today ? (actMap[iso] ?? (actual.length ? actual[actual.length - 1] : 0)) : null);
  }
  const el = $("#ch-burn");
  if (!el) return;
  S.charts.burn?.destroy();
  const ctx = el.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, "rgba(129,140,248,.34)");
  grad.addColorStop(1, "rgba(129,140,248,0)");
  const todayIdx = labels.indexOf(st.today);
  S.charts.burn = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [
      { label: "plan", data: plan, borderColor: "rgba(148,163,184,.45)", borderDash: [5, 5], borderWidth: 1.4, pointRadius: 0, fill: false },
      { label: "actual", data: actual, borderColor: "#818cf8", borderWidth: 2.6, pointRadius: 0, fill: true, backgroundColor: grad, tension: .25 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#141c31", borderColor: "rgba(148,163,184,.2)", borderWidth: 1,
          titleColor: "#e9edf7", bodyColor: "#98a2b8", padding: 10, displayColors: false,
          callbacks: { title: it => fmtDate(it[0].label), label: it => ` ${it.dataset.label}: ${it.parsed.y}` },
        },
      },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: false, callback: (v, i) => labels[i].endsWith("-01") ? MONTH_NAMES[+labels[i].slice(5, 7) - 1] : null }, grid: { display: false } },
        y: { beginAtZero: true, max: 340, ticks: { stepSize: 80 } },
      },
    },
    plugins: [{
      id: "todayLine",
      afterDraw(c) {
        if (todayIdx < 0) return;
        const x = c.scales.x.getPixelForValue(todayIdx);
        const { top, bottom } = c.chartArea;
        const g = c.ctx; g.save();
        g.strokeStyle = "rgba(232,121,249,.5)"; g.setLineDash([3, 4]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke();
        g.fillStyle = "#e879f9"; g.font = "700 9px 'Segoe UI'";
        g.fillText("today", x + 4, top + 10); g.restore();
      },
    }],
  });
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

/* ------------------------------------------------------------------ roadmap */
function renderRoadmap(el) {
  const st = S.state;
  el.innerHTML = `
  <div class="modes-strip">
    ${st.modes.map(m => `
      <div class="card" style="padding:14px 16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span class="tpill ${m.mode}">${m.mode}</span>
          <span style="font-size:14px;font-weight:800;font-variant-numeric:tabular-nums">${m.done}<span style="color:var(--dim);font-size:11px"> / ${m.target}</span></span>
        </div>
        <div class="bar thin"><i class="${m.done >= m.target ? "full" : ""}" style="width:${Math.min(100, m.done / m.target * 100)}%"></i></div>
        <div style="font-size:10.5px;color:var(--dim);margin-top:8px">${esc(m.note)}</div>
      </div>`).join("")}
  </div>
  ${st.months.map(m => {
    const allocs = st.allocations.filter(a => a.month === m.key);
    return `
    <div class="card month-sec">
      <div class="month-head">
        <div>
          <div class="month-title">${m.name}</div>
          <div class="month-dates">${fmtDate(m.start)} → ${fmtDate(m.end)} · ${m.days} days</div>
        </div>
        <span class="chip ${m.status}">${m.status}</span>
        <div class="bar"><i class="${m.pct >= 100 ? "full" : ""}" style="width:${Math.min(100, m.pct)}%"></i></div>
        <div class="month-bignum">${m.done}<span> / ${m.target}</span></div>
        ${m.need_per_day ? `<div class="month-dates">needs <b style="color:var(--text)">${m.need_per_day}</b>/day</div>` : ""}
      </div>
      <table class="alloc-table"><tbody>
        ${allocs.map(a => `
          <tr>
            <td class="alloc-label">${esc(a.label)}</td>
            <td style="width:90px"><span class="tpill ${a.mode}">${a.mode}</span></td>
            <td class="alloc-prog"><div class="bar thin"><i class="${a.pct >= 100 ? "full" : ""}" style="width:${Math.min(100, a.pct)}%"></i></div></td>
            <td class="alloc-nums"><b>${a.done}</b> / ${a.target}</td>
            <td class="alloc-note">${esc(a.note)}</td>
          </tr>`).join("")}
      </tbody></table>
    </div>`;
  }).join("")}`;
}

/* ------------------------------------------------------------------ topics */
function coldBadge(t) {
  if (t.days_cold == null) return `<span class="cold warm">untouched</span>`;
  if (t.days_cold > 45) return `<span class="cold red">${t.days_cold}d cold</span>`;
  if (t.days_cold > 30) return `<span class="cold amber">${t.days_cold}d cold</span>`;
  if (t.days_cold <= 3) return `<span class="cold fresh">active</span>`;
  return `<span class="cold warm">${t.days_cold}d ago</span>`;
}
function renderTopics(el) {
  const st = S.state;
  el.innerHTML = `<div class="tgrid">
    ${st.topics.map(t => `
      <div class="card tcard" data-topic="${esc(t.name)}">
        <div class="tcard-top">
          <div><div class="tcard-name">${esc(t.name)}</div><div class="tcard-months">${esc(t.months).toUpperCase()}</div></div>
          ${coldBadge(t)}
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
    <select class="select" id="lf-month"><option value="">All months</option>
      ${st.months.map(m => `<option value="${m.key}" ${f.month === m.key ? "selected" : ""}>${m.name}</option>`).join("")}</select>
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
      (!q.month || p.date_solved.slice(0, 7) === q.month) &&
      (!q.topic || p.topic === q.topic) &&
      (!q.type || p.type === q.type) &&
      (!q.diff || p.difficulty === q.diff));
    $("#log-count", el).textContent = `${rows.length} of ${st.problems.length}`;
    const box = $("#log-tbl", el);
    box.innerHTML = `
    <div class="card table-wrap">
      <table class="log">
        <thead><tr>
          <th>Date</th><th>Problem</th><th>Diff</th><th>Topic</th><th>Type</th>
          <th title="minutes">Time</th><th title="solved without editorial">Clean</th>
          <th title="flag for redo">Flag</th><th>Notes</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(p => `
          <tr data-id="${p.id}">
            <td style="color:var(--mut);font-variant-numeric:tabular-nums">${fmtDate(p.date_solved)}</td>
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
      q: $("#lf-q", el).value, month: $("#lf-month", el).value, topic: $("#lf-topic", el).value,
      type: $("#lf-type", el).value, diff: $("#lf-diff", el).value, auto: "",
    };
    paintTable();
  };
  $("#lf-q", el).oninput = () => { clearTimeout(S._qt); S._qt = setTimeout(refilter, 220); };
  ["lf-month", "lf-topic", "lf-type", "lf-diff"].forEach(id => $("#" + id, el).onchange = refilter);
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
      <div class="card redo-item ${r.overdue > 0 ? "overdue" : ""}">
        <div class="redo-due ${r.overdue > 0 ? "late" : ""}">
          <b>${r.overdue > 0 ? `${r.overdue}d overdue` : "due " + fmtDate(r.due)}</b>
          logged ${fmtDate(r.logged)}
        </div>
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
  <p style="font-size:11.5px;color:var(--dim);margin-top:14px">tip — just re-solve it on LeetCode: the next sync files it as a <b>Redo</b> entry and clears the flag on its own.</p>`;
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
  dashboard: renderDashboard, roadmap: renderRoadmap, topics: renderTopics,
  log: renderLog, redo: renderRedo, playbook: renderPlaybook, settings: renderSettings,
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
/* background: re-pull state every 5 min so an auto-sync shows up */
setInterval(async () => { try { S.state = await api("/api/state"); render(S.view); } catch {} }, 300000);

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
