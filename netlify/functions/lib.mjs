/* DSA Mission Control — shared engine for Netlify Functions.
   Faithful port of server.py: same data shapes, same math, IST throughout. */

export const IST_SHIFT = 19800; // +05:30 in seconds

export const DEFAULT_SETTINGS = {
  username: "agrawal_vatsal",
  baseline_total: 109,
  baseline_date: "2026-07-11",
  roadmap_start: "2026-07-11",
  roadmap_end: "2026-12-31",
  sync_minutes: 15,
  redo_days: 7,
};

export const MONTHS = [
  { key: "2026-07", name: "July",      short: "Jul", start: "2026-07-11", end: "2026-07-31", target: 60, block: 45, wildcard: 15 },
  { key: "2026-08", name: "August",    short: "Aug", start: "2026-08-01", end: "2026-08-31", target: 50, block: 38, wildcard: 12 },
  { key: "2026-09", name: "September", short: "Sep", start: "2026-09-01", end: "2026-09-30", target: 90, block: 66, wildcard: 24 },
  { key: "2026-10", name: "October",   short: "Oct", start: "2026-10-01", end: "2026-10-31", target: 35, block: 27, wildcard: 8 },
  { key: "2026-11", name: "November",  short: "Nov", start: "2026-11-01", end: "2026-11-30", target: 10, block: 0,  wildcard: 10 },
  { key: "2026-12", name: "December",  short: "Dec", start: "2026-12-01", end: "2026-12-31", target: 75, block: 75, wildcard: 0 },
];

export const TOPICS = [
  { name: "Arrays & Hashing",      target: 7,  months: "Jul",           icon: "grid" },
  { name: "Two Pointers",          target: 10, months: "Jul",           icon: "arrows" },
  { name: "Sliding Window",        target: 10, months: "Jul",           icon: "window" },
  { name: "Stack",                 target: 10, months: "Jul",           icon: "stack" },
  { name: "Binary Search",         target: 8,  months: "Jul",           icon: "search" },
  { name: "Linked List",           target: 10, months: "Aug",           icon: "link" },
  { name: "Trees & BST",           target: 24, months: "Aug",           icon: "tree" },
  { name: "Tries",                 target: 4,  months: "Aug",           icon: "trie" },
  { name: "Heap / Priority Queue", target: 8,  months: "Sep",           icon: "heap" },
  { name: "Backtracking",          target: 12, months: "Sep",           icon: "back" },
  { name: "Graphs",                target: 16, months: "Sep + Dec",     icon: "graph" },
  { name: "Advanced Graphs",       target: 5,  months: "Sep",           icon: "network" },
  { name: "Greedy",                target: 10, months: "Sep",           icon: "zap" },
  { name: "Intervals",             target: 5,  months: "Sep",           icon: "bars" },
  { name: "1-D DP",                target: 16, months: "Sep–Oct + Dec", icon: "dp1" },
  { name: "2-D DP",                target: 10, months: "Oct + Dec",     icon: "dp2" },
  { name: "Bit Manipulation",      target: 6,  months: "Oct",           icon: "bit" },
  { name: "Math & Geometry",       target: 5,  months: "Oct",           icon: "sigma" },
];
export const TOPIC_NAMES = TOPICS.map(t => t.name);
export const TYPES = ["Block", "Wildcard", "Redo", "Timed", "Contest"];

export const MONTH_BLOCK_TOPICS = {
  "2026-07": ["Two Pointers", "Sliding Window", "Stack", "Binary Search", "Arrays & Hashing"],
  "2026-08": ["Linked List", "Trees & BST", "Tries"],
  "2026-09": ["Heap / Priority Queue", "Backtracking", "Graphs", "Advanced Graphs", "Greedy", "Intervals", "1-D DP"],
  "2026-10": ["1-D DP", "2-D DP", "Bit Manipulation", "Math & Geometry"],
  "2026-11": [],
  "2026-12": ["Graphs", "1-D DP", "2-D DP"],
};

export const ALLOCATIONS = [
  { month: "2026-07", label: "Two Pointers",          mode: "Block",    topics: ["Two Pointers"],          target: 10, note: "Pair / partition / in-place patterns." },
  { month: "2026-07", label: "Sliding Window",        mode: "Block",    topics: ["Sliding Window"],        target: 10, note: "Must include Sliding Window Maximum (monotonic deque)." },
  { month: "2026-07", label: "Stack",                 mode: "Block",    topics: ["Stack"],                 target: 10, note: "≥4 monotonic stack: Daily Temps, Largest Histogram." },
  { month: "2026-07", label: "Binary Search",         mode: "Block",    topics: ["Binary Search"],         target: 8,  note: "≥3 binary-search-on-answer: Koko, Ship Capacity, Split Array." },
  { month: "2026-07", label: "Arrays & Hashing",      mode: "Block",    topics: ["Arrays & Hashing"],      target: 7,  note: "Top-up only — prefix sums, Kadane, anything your grind missed." },
  { month: "2026-07", label: "Wildcard / Mixed",      mode: "Wildcard", topics: null,                      target: 15, note: "~1/day. Write your pattern guess BEFORE coding, every time." },
  { month: "2026-08", label: "Linked List",           mode: "Block",    topics: ["Linked List"],           target: 10, note: "Fast/slow, reversal, merge-K; include LRU Cache." },
  { month: "2026-08", label: "Trees & BST",           mode: "Block",    topics: ["Trees & BST"],           target: 24, note: "Traversals → BST props → construction → LCA → serialize." },
  { month: "2026-08", label: "Tries",                 mode: "Block",    topics: ["Tries"],                 target: 4,  note: "Implement Trie + Word Search II." },
  { month: "2026-08", label: "Wildcard / Mixed",      mode: "Wildcard", topics: null,                      target: 12, note: "Pool = all covered topics + your old arrays corpus." },
  { month: "2026-09", label: "Heap / Priority Queue", mode: "Block",    topics: ["Heap / Priority Queue"], target: 8,  note: "Include one quickselect (Kth Largest WITHOUT a heap)." },
  { month: "2026-09", label: "Backtracking",          mode: "Block",    topics: ["Backtracking"],          target: 12, note: "Subsets, permutations, combo sum, board problems." },
  { month: "2026-09", label: "Graphs",                mode: "Block",    topics: ["Graphs"],                target: 16, note: "BFS/DFS on grids, topo sort, union-find." },
  { month: "2026-09", label: "Advanced Graphs",       mode: "Block",    topics: ["Advanced Graphs"],       target: 5,  note: "Dijkstra, MST; Cheapest Flights = the Bellman-Ford idea." },
  { month: "2026-09", label: "Greedy",                mode: "Block",    topics: ["Greedy"],                target: 10, note: "Exchange-argument intuition, jump game family." },
  { month: "2026-09", label: "Intervals",             mode: "Block",    topics: ["Intervals"],             target: 5,  note: "Sort-then-sweep; meeting rooms." },
  { month: "2026-09", label: "1-D DP",                mode: "Block",    topics: ["1-D DP"],                target: 10, note: "House Robber family, LIS, Word Break." },
  { month: "2026-09", label: "Wildcard / Mixed",      mode: "Wildcard", topics: null,                      target: 24, note: "Heaviest month — interleaving is load-bearing here." },
  { month: "2026-10", label: "1-D DP (finish)",       mode: "Block",    topics: ["1-D DP"],                target: 6,  note: "Finish the 1-D set (16 total across Sep–Oct)." },
  { month: "2026-10", label: "2-D DP",                mode: "Block",    topics: ["2-D DP"],                target: 10, note: "Grid paths, LCS, edit distance, stock series." },
  { month: "2026-10", label: "Bit Manipulation",      mode: "Block",    topics: ["Bit Manipulation"],      target: 6,  note: "XOR tricks, counting bits, single number." },
  { month: "2026-10", label: "Math & Geometry",       mode: "Block",    topics: ["Math & Geometry"],       target: 5,  note: "Rotate image, spiral, happy number, pow." },
  { month: "2026-10", label: "Wildcard / Mixed",      mode: "Wildcard", topics: null,                      target: 8,  note: "Syllabus closes Oct 31." },
  { month: "2026-11", label: "Streak Preservation",   mode: "Wildcard", topics: null,                      target: 10, note: "2–3/week from weakest tags. ZERO new topics. Exams own this month." },
  { month: "2026-12", label: "Flag Queue Flush",      mode: "Redo",     topics: null,                      target: 25, note: "Weeks 1–2: clear every open flag before anything else." },
  { month: "2026-12", label: "Timed / Company Sets",  mode: "Timed",    topics: null,                      target: 35, note: "2 mediums / 70 min, no IDE autocomplete; company-tagged lists." },
  { month: "2026-12", label: "Hard Reps (Graph/DP)",  mode: "Block",    topics: ["Graphs", "1-D DP", "2-D DP"], target: 7, note: "Hard problems only; log with their real topic." },
  { month: "2026-12", label: "Contests",              mode: "Contest",  topics: null,                      target: 8,  note: "2 Sunday contests × 4 problems each." },
];

export const PRACTICE_MODES = [
  { mode: "Wildcard", target: 69, note: "Jul–Oct 59 + Nov 10. The discrimination reps — never skip these." },
  { mode: "Redo",     target: 25, note: "Rolling all year; December flush target = 25." },
  { mode: "Timed",    target: 35, note: "December interview simulation. 2 mediums / 70 minutes." },
  { mode: "Contest",  target: 10, note: "September onward; each contest logs ~4 rows." },
];

export const PLAYBOOK = [
  { title: "Mix blocks with wildcards", body: "Work a topic in a focused run, but keep sprinkling in wildcards: a redo-queue item if one is open, otherwise a random problem from any covered topic with the tag hidden. Discrimination reps are what interviews actually test." },
  { title: "The 60-second rule", body: "Before coding any wildcard, write down which pattern you think it is and why. That minute of classification practice is the entire point of the slot." },
  { title: "The 35-minute rule", body: "Stuck past 35 minutes → read the editorial, close it, implement from memory, flag it for redo. Grinding hours on one DP problem burns energy you don't have to spare." },
  { title: "Flag → redo", body: "Any problem that needed the editorial gets re-solved later, from scratch. The tracker auto-detects the re-solve on LeetCode and clears the flag. Repetition is the learning." },
  { title: "Busy day? Wildcard first", body: "If you only have time for one problem, make it the wildcard, not the block problem. Block progress can wait; discrimination reps can't be crammed." },
  { title: "Hards come later", body: "Easies and mediums build the pattern library; hards test composition. Don't force hards early in a topic — return for them once the topic feels boring." },
  { title: "Tier-2 (deliberately skipped)", body: "Segment trees / Fenwick, KMP / rolling hash, bitmask & digit DP, Floyd–Warshall. Contest material, ~1–2% of interviews. Reliability on the 95% beats breadth on the last 5%." },
  { title: "One system-design pick at a time", body: "Spin the picker, get one topic, actually learn it — a real article or video plus notes, not a skim. Tick it only when you could explain it in an interview. Then spin again." },
  { title: "Single source of truth", body: "The log drives every number here. Solves sync in automatically; your only jobs are the redo flags, time-taken, honest No-Editorial marks — and ticking system-design topics you truly finished." },
];

export const SD_CONCEPTS = [
  "Requirements gathering & scoping", "Back-of-envelope estimation", "Load balancing", "Caching",
  "SQL vs NoSQL", "Database indexing", "Replication", "Sharding / partitioning", "CAP theorem",
  "Consistent hashing", "Message queues & pub/sub", "CDN", "API design", "Rate limiting",
  "Monolith vs microservices", "Consistency models", "Proxies", "WebSockets / SSE / polling",
  "Blob & object storage", "Idempotency", "Retries, backoff, circuit breakers",
  "Service discovery & API gateway", "Monitoring, logging, tracing", "Authentication & authorization",
  "Bloom filters", "Database schema design", "Query optimization & N+1 problems", "Connection pooling",
  "Transactions, locking & concurrency control", "Background jobs & async processing",
  "Pagination & cursors", "Batch vs stream ingestion", "Time-series & high-write workloads",
];
export const SD_PROBLEMS = [
  "URL shortener", "Rate limiter", "Chat / messaging app", "News feed", "Notification system",
  "Web crawler", "Search autocomplete", "Ride-sharing", "Video streaming", "Payment system",
];
export const SD_ALL = [...SD_CONCEPTS, ...SD_PROBLEMS];

const TAG_RULES = [
  [["Trie"], "Tries"],
  [["Linked List", "Doubly-Linked List"], "Linked List"],
  [["Binary Search Tree", "Binary Tree", "Tree", "Segment Tree", "Binary Indexed Tree"], "Trees & BST"],
  [["Heap (Priority Queue)"], "Heap / Priority Queue"],
  [["Shortest Path", "Minimum Spanning Tree", "Strongly Connected Component", "Eulerian Circuit", "Biconnected Component"], "Advanced Graphs"],
  [["Graph", "Topological Sort", "Union Find"], "Graphs"],
  [["Backtracking"], "Backtracking"],
  [["Dynamic Programming"], "__DP__"],
  [["Monotonic Stack", "Stack"], "Stack"],
  [["Sliding Window", "Monotonic Queue"], "Sliding Window"],
  [["Two Pointers"], "Two Pointers"],
  [["Binary Search"], "Binary Search"],
  [["Breadth-First Search", "Depth-First Search"], "Graphs"],
  [["Greedy"], "Greedy"],
  [["Line Sweep"], "Intervals"],
  [["Bit Manipulation", "Bitmask"], "Bit Manipulation"],
  [["Geometry", "Math", "Number Theory", "Combinatorics", "Probability and Statistics"], "Math & Geometry"],
  [["Hash Table", "Array", "String", "Prefix Sum", "Counting", "Sorting", "Matrix", "Simulation"], "Arrays & Hashing"],
];

export function topicCandidates(tags) {
  const tset = new Set(tags);
  const out = [];
  for (const [group, topicRaw] of TAG_RULES) {
    if (group.some(g => tset.has(g))) {
      const topic = topicRaw === "__DP__" ? (tset.has("Matrix") ? "2-D DP" : "1-D DP") : topicRaw;
      if (!out.includes(topic)) out.push(topic);
    }
  }
  return out.length ? out : ["Arrays & Hashing"];
}

/* ------------------------------------------------------------- date utils */
export const istDateOf = tsSec => new Date((tsSec + IST_SHIFT) * 1000).toISOString().slice(0, 10);
export const istToday = () => istDateOf(Math.floor(Date.now() / 1000));
export const dayNum = iso => Math.floor(Date.parse(iso + "T00:00:00Z") / 86400000);
export function addDays(iso, n) {
  return new Date((dayNum(iso) + n) * 86400000).toISOString().slice(0, 10);
}
export const validISO = d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + "T00:00:00Z"));

export function defaultType(topic, dsolved) {
  // no schedule pressure: auto-captured solves default to Block; other types are manual
  return "Block";
}

/* ------------------------------------------------------------- leetcode */
const GQL = "https://leetcode.com/graphql";
const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSA-Mission-Control/1.0",
  "Referer": "https://leetcode.com",
};

async function gql(query, variables) {
  const r = await fetch(GQL, { method: "POST", headers: HEADERS, body: JSON.stringify({ query, variables }) });
  if (!r.ok) throw new Error(`leetcode http ${r.status}`);
  const out = await r.json();
  if (out.errors && !out.data) throw new Error(String(out.errors[0]?.message || "gql error").slice(0, 150));
  return out.data;
}

export async function fetchProfile(username) {
  try {
    const d = await gql(
      "query($u:String!){matchedUser(username:$u){profile{ranking}submitStatsGlobal{acSubmissionNum{difficulty count}}}}",
      { u: username });
    const nums = Object.fromEntries(d.matchedUser.submitStatsGlobal.acSubmissionNum.map(x => [x.difficulty, x.count]));
    return { lifetime: nums.All ?? null, easy: nums.Easy ?? null, medium: nums.Medium ?? null,
             hard: nums.Hard ?? null, ranking: d.matchedUser.profile.ranking ?? null };
  } catch {
    const r = await fetch(`https://leetcode-api-faisalshohag.vercel.app/${username}`);
    if (!r.ok) throw new Error(`mirror http ${r.status}`);
    const j = await r.json();
    return { lifetime: j.totalSolved ?? null, easy: j.easySolved ?? null, medium: j.mediumSolved ?? null,
             hard: j.hardSolved ?? null, ranking: j.ranking ?? null };
  }
}

export async function fetchRecent(username, limit = 20) {
  const d = await gql(
    "query($u:String!,$n:Int!){recentAcSubmissionList(username:$u,limit:$n){title titleSlug timestamp}}",
    { u: username, n: limit });
  return d.recentAcSubmissionList || [];
}

export async function fetchQuestion(slug) {
  const d = await gql(
    "query($s:String!){question(titleSlug:$s){questionFrontendId title difficulty topicTags{name}}}",
    { s: slug });
  if (!d.question) return null;
  return { lc_id: d.question.questionFrontendId, title: d.question.title,
           difficulty: d.question.difficulty, tags: d.question.topicTags.map(t => t.name) };
}

/* ------------------------------------------------------------- sync engine
   data = { problems:{nextId,items}, qcache:{}, snapshots:[], synclog:[], settings:{} }
   Mutates `data`; caller persists. Returns the sync result. */
export async function runSync(data) {
  const s = { ...DEFAULT_SETTINGS, ...data.settings };
  const now = Math.floor(Date.now() / 1000);
  try {
    const prof = await fetchProfile(s.username);
    const recent = await fetchRecent(s.username);

    const known = new Set(data.problems.items.map(p => `${p.slug}|${p.date_solved}`));
    const prepared = [];
    let skipped = 0;
    for (const sub of [...recent].sort((a, b) => +a.timestamp - +b.timestamp)) {
      const ts = +sub.timestamp;
      const dsolved = istDateOf(ts);
      const slug = sub.titleSlug;
      if (dsolved < s.roadmap_start || known.has(`${slug}|${dsolved}`)) continue;
      known.add(`${slug}|${dsolved}`);
      let meta = data.qcache[slug] || null;
      if (!meta) {
        try {
          meta = await fetchQuestion(slug);
          if (meta) data.qcache[slug] = meta;
        } catch { meta = null; }
      }
      if (!meta) { meta = { lc_id: null, title: sub.title, difficulty: null, tags: [] }; skipped++; }
      prepared.push({ slug, ts, dsolved, meta });
    }

    if (prof.lifetime != null) {
      data.snapshots.push({ ts: now, ...prof });
      if (data.snapshots.length > 2500) data.snapshots = data.snapshots.slice(-2500);
    }

    const added = [], notes = [];
    for (const it of prepared) {
      const cands = it.meta.tags.length ? topicCandidates(it.meta.tags) : [];
      const topic = cands[0] || "Arrays & Hashing";
      const needs_review = (cands.length > 1 || !it.meta.tags.length) ? 1 : 0;
      const earlier = data.problems.items
        .filter(p => p.slug === it.slug && p.date_solved < it.dsolved)
        .sort((a, b) => b.date_solved.localeCompare(a.date_solved))[0];
      let type, redo_of = null;
      if (earlier) {
        type = "Redo"; redo_of = earlier.id;
        if (earlier.flag_redo && !earlier.redo_done) {
          earlier.redo_done = 1;
          notes.push(`redo flag cleared: ${it.meta.title}`);
        }
      } else {
        type = defaultType(topic, it.dsolved);
      }
      data.problems.items.push({
        id: data.problems.nextId++, slug: it.slug, title: it.meta.title, lc_id: it.meta.lc_id,
        date_solved: it.dsolved, ts: it.ts, difficulty: it.meta.difficulty, topic,
        lc_tags: it.meta.tags, candidates: cands, needs_review, type,
        time_min: null, no_editorial: 1, flag_redo: 0, redo_done: 0, redo_of,
        notes: "", auto: 1,
      });
      added.push({ title: it.meta.title, topic, difficulty: it.meta.difficulty,
                   date: it.dsolved, type, needs_review });
    }

    let msg = `+${added.length} new`;
    if (skipped) msg += ` · ${skipped} missing metadata (topic left for you to set)`;
    if (notes.length) msg += " · " + notes.join("; ");
    data.synclog.unshift({ ts: now, ok: 1, added: added.length, message: msg });
    data.synclog = data.synclog.slice(0, 60);
    return { ok: true, added: added.length, problems: added, message: msg };
  } catch (e) {
    data.synclog.unshift({ ts: now, ok: 0, added: 0, message: `${e.name || "Error"}: ${e.message}` });
    data.synclog = data.synclog.slice(0, 60);
    return { ok: false, added: 0, message: `${e.name || "Error"}: ${e.message}` };
  }
}

/* ------------------------------------------------------------- state */
export function computeState(data) {
  const s = { ...DEFAULT_SETTINGS, ...data.settings };
  const today = istToday();

  const probs = data.problems.items
    .filter(p => validISO(p.date_solved))
    .map(p => ({ ...p }))
    .sort((a, b) => b.date_solved.localeCompare(a.date_solved) || (b.ts || 0) - (a.ts || 0));

  for (const p of probs) {
    p.lc_tags = p.lc_tags || [];
    p.candidates = p.candidates || [];
  }

  const totalTarget = MONTHS.reduce((a, m) => a + m.target, 0);
  const done = probs.length;

  const topics = TOPICS.map(t => {
    const tp = probs.filter(p => p.topic === t.name);
    const blockDone = tp.filter(p => p.type === "Block").length;
    return { name: t.name, target: t.target, icon: t.icon,
             block_done: blockDone, touches: tp.length,
             left: Math.max(0, t.target - blockDone),
             pct: t.target ? +(blockDone / t.target * 100).toFixed(1) : 0,
             easy: tp.filter(p => p.difficulty === "Easy").length,
             medium: tp.filter(p => p.difficulty === "Medium").length,
             hard: tp.filter(p => p.difficulty === "Hard").length };
  });

  const redo = probs
    .filter(p => p.flag_redo && !p.redo_done)
    .map(p => ({ id: p.id, title: p.title, slug: p.slug, topic: p.topic,
                 difficulty: p.difficulty, logged: p.date_solved }));

  const sd = data.sd || { done: [], pick: null, scores: {}, history: {} };
  const sdDone = (sd.done || []).filter(n => SD_ALL.includes(n));
  const sdScores = sd.scores || {};
  const sdHistory = sd.history || {};
  let sdPick = sd.pick;
  if (!SD_ALL.includes(sdPick) || sdDone.includes(sdPick)) sdPick = null;
  const sdEntry = n => ({
    name: n, done: sdDone.includes(n), score: sdScores[n] ?? null,
    attempts: (sdHistory[n] || []).length, history: sdHistory[n] || [],
  });
  const sysdesign = {
    concepts: SD_CONCEPTS.map(sdEntry),
    problems: SD_PROBLEMS.map(sdEntry),
    done: sdDone.length, total: SD_ALL.length, pick: sdPick,
    pct: +(sdDone.length / SD_ALL.length * 100).toFixed(1),
    pass_mark: 75,
    exam_history: sdHistory["__overall_exam__"] || [],
  };

  const snap = data.snapshots[data.snapshots.length - 1] || null;
  const baseline = Number.isFinite(+s.baseline_total) ? +s.baseline_total : DEFAULT_SETTINGS.baseline_total;
  const lc = {
    lifetime: snap?.lifetime ?? null, easy: snap?.easy ?? null, medium: snap?.medium ?? null,
    hard: snap?.hard ?? null, ranking: snap?.ranking ?? null,
    since_baseline: snap?.lifetime != null ? snap.lifetime - baseline : null,
    baseline, username: s.username,
  };
  let crossCheck = null;
  if (lc.since_baseline != null && lc.since_baseline > done) {
    const gap = lc.since_baseline - done;
    crossCheck = `LeetCode counts ${gap} more solve${gap > 1 ? "s" : ""} since baseline than the log has. ` +
      `LeetCode only exposes your last 20 accepted submissions, so anything older can't be auto-recovered — ` +
      `add missing solves with the log's Add button (or they may simply predate Jul 11).`;
  }

  const lastSync = data.synclog[0] || null;
  return {
    generated: new Date().toISOString(),
    today, settings: s,
    kpi: {
      total_target: totalTarget, done, pct: +(done / totalTarget * 100).toFixed(1),
      hards: probs.filter(p => p.difficulty === "Hard").length,
      open_flags: redo.length,
      needs_review: probs.filter(p => p.needs_review).length,
    },
    lc, cross_check: crossCheck,
    sync: { last: lastSync, ranking_series: data.snapshots.map(r => ({ ts: r.ts, ranking: r.ranking })) },
    topics, redo, problems: probs,
    sysdesign,
    playbook: PLAYBOOK,
    difficulty_split: Object.fromEntries(["Easy", "Medium", "Hard"].map(k => [k, probs.filter(p => p.difficulty === k).length])),
    type_split: Object.fromEntries(TYPES.map(k => [k, probs.filter(p => p.type === k).length])),
  };
}
