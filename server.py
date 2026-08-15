"""
DSA Mission Control — local tracker server.
FastAPI + SQLite. Auto-syncs solves from LeetCode (official GraphQL, server-side),
maps each problem to a roadmap topic via its tags, and serves the SPA in /static.

Run:  python server.py   → http://127.0.0.1:5599
"""
import json
import os
import sqlite3
import threading
import time
import webbrowser
from contextlib import closing
from datetime import date, datetime, timedelta, timezone

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# ----------------------------------------------------------------------------- paths / const
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")
DB_PATH = os.path.join(DATA_DIR, "tracker.db")
STATIC = os.path.join(ROOT, "public")
PORT = 5599
IST = timezone(timedelta(hours=5, minutes=30))

LEETCODE_GQL = "https://leetcode.com/graphql"
MIRROR = "https://leetcode-api-faisalshohag.vercel.app/{u}"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSA-Mission-Control/1.0",
      "Content-Type": "application/json", "Referer": "https://leetcode.com"}

DEFAULT_SETTINGS = {
    "username": "agrawal_vatsal",
    "baseline_total": 109,
    "baseline_date": "2026-07-11",
    "roadmap_start": "2026-07-11",
    "roadmap_end": "2026-12-31",
    "sync_minutes": 30,
    "redo_days": 7,
}

MONTHS = [
    {"key": "2026-07", "name": "July",      "short": "Jul", "start": "2026-07-11", "end": "2026-07-31", "target": 60, "block": 45, "wildcard": 15},
    {"key": "2026-08", "name": "August",    "short": "Aug", "start": "2026-08-01", "end": "2026-08-31", "target": 50, "block": 38, "wildcard": 12},
    {"key": "2026-09", "name": "September", "short": "Sep", "start": "2026-09-01", "end": "2026-09-30", "target": 90, "block": 66, "wildcard": 24},
    {"key": "2026-10", "name": "October",   "short": "Oct", "start": "2026-10-01", "end": "2026-10-31", "target": 35, "block": 27, "wildcard": 8},
    {"key": "2026-11", "name": "November",  "short": "Nov", "start": "2026-11-01", "end": "2026-11-30", "target": 10, "block": 0,  "wildcard": 10},
    {"key": "2026-12", "name": "December",  "short": "Dec", "start": "2026-12-01", "end": "2026-12-31", "target": 75, "block": 75, "wildcard": 0},
]

TOPICS = [
    {"name": "Arrays & Hashing",      "target": 7,  "months": "Jul",           "icon": "grid"},
    {"name": "Two Pointers",          "target": 10, "months": "Jul",           "icon": "arrows"},
    {"name": "Sliding Window",        "target": 10, "months": "Jul",           "icon": "window"},
    {"name": "Stack",                 "target": 10, "months": "Jul",           "icon": "stack"},
    {"name": "Binary Search",         "target": 8,  "months": "Jul",           "icon": "search"},
    {"name": "Linked List",           "target": 10, "months": "Aug",           "icon": "link"},
    {"name": "Trees & BST",           "target": 24, "months": "Aug",           "icon": "tree"},
    {"name": "Tries",                 "target": 4,  "months": "Aug",           "icon": "trie"},
    {"name": "Heap / Priority Queue", "target": 8,  "months": "Sep",           "icon": "heap"},
    {"name": "Backtracking",          "target": 12, "months": "Sep",           "icon": "back"},
    {"name": "Graphs",                "target": 16, "months": "Sep + Dec",     "icon": "graph"},
    {"name": "Advanced Graphs",       "target": 5,  "months": "Sep",           "icon": "network"},
    {"name": "Greedy",                "target": 10, "months": "Sep",           "icon": "zap"},
    {"name": "Intervals",             "target": 5,  "months": "Sep",           "icon": "bars"},
    {"name": "1-D DP",                "target": 16, "months": "Sep–Oct + Dec", "icon": "dp1"},
    {"name": "2-D DP",                "target": 10, "months": "Oct + Dec",     "icon": "dp2"},
    {"name": "Bit Manipulation",      "target": 6,  "months": "Oct",           "icon": "bit"},
    {"name": "Math & Geometry",       "target": 5,  "months": "Oct",           "icon": "sigma"},
]
TOPIC_NAMES = [t["name"] for t in TOPICS]

# month -> block topics active that month (drives the auto Block/Wildcard default)
MONTH_BLOCK_TOPICS = {
    "2026-07": ["Two Pointers", "Sliding Window", "Stack", "Binary Search", "Arrays & Hashing"],
    "2026-08": ["Linked List", "Trees & BST", "Tries"],
    "2026-09": ["Heap / Priority Queue", "Backtracking", "Graphs", "Advanced Graphs", "Greedy", "Intervals", "1-D DP"],
    "2026-10": ["1-D DP", "2-D DP", "Bit Manipulation", "Math & Geometry"],
    "2026-11": [],
    "2026-12": ["Graphs", "1-D DP", "2-D DP"],
}

ALLOCATIONS = [
    {"month": "2026-07", "label": "Two Pointers",          "mode": "Block",    "topics": ["Two Pointers"],          "target": 10, "note": "Pair / partition / in-place patterns."},
    {"month": "2026-07", "label": "Sliding Window",        "mode": "Block",    "topics": ["Sliding Window"],        "target": 10, "note": "Must include Sliding Window Maximum (monotonic deque)."},
    {"month": "2026-07", "label": "Stack",                 "mode": "Block",    "topics": ["Stack"],                 "target": 10, "note": "≥4 monotonic stack: Daily Temps, Largest Histogram."},
    {"month": "2026-07", "label": "Binary Search",         "mode": "Block",    "topics": ["Binary Search"],         "target": 8,  "note": "≥3 binary-search-on-answer: Koko, Ship Capacity, Split Array."},
    {"month": "2026-07", "label": "Arrays & Hashing",      "mode": "Block",    "topics": ["Arrays & Hashing"],      "target": 7,  "note": "Top-up only — prefix sums, Kadane, anything your grind missed."},
    {"month": "2026-07", "label": "Wildcard / Mixed",      "mode": "Wildcard", "topics": None,                      "target": 15, "note": "~1/day. Write your pattern guess BEFORE coding, every time."},
    {"month": "2026-08", "label": "Linked List",           "mode": "Block",    "topics": ["Linked List"],           "target": 10, "note": "Fast/slow, reversal, merge-K; include LRU Cache."},
    {"month": "2026-08", "label": "Trees & BST",           "mode": "Block",    "topics": ["Trees & BST"],           "target": 24, "note": "Traversals → BST props → construction → LCA → serialize."},
    {"month": "2026-08", "label": "Tries",                 "mode": "Block",    "topics": ["Tries"],                 "target": 4,  "note": "Implement Trie + Word Search II."},
    {"month": "2026-08", "label": "Wildcard / Mixed",      "mode": "Wildcard", "topics": None,                      "target": 12, "note": "Pool = all covered topics + your old arrays corpus."},
    {"month": "2026-09", "label": "Heap / Priority Queue", "mode": "Block",    "topics": ["Heap / Priority Queue"], "target": 8,  "note": "Include one quickselect (Kth Largest WITHOUT a heap)."},
    {"month": "2026-09", "label": "Backtracking",          "mode": "Block",    "topics": ["Backtracking"],          "target": 12, "note": "Subsets, permutations, combo sum, board problems."},
    {"month": "2026-09", "label": "Graphs",                "mode": "Block",    "topics": ["Graphs"],                "target": 16, "note": "BFS/DFS on grids, topo sort, union-find."},
    {"month": "2026-09", "label": "Advanced Graphs",       "mode": "Block",    "topics": ["Advanced Graphs"],       "target": 5,  "note": "Dijkstra, MST; Cheapest Flights = the Bellman-Ford idea."},
    {"month": "2026-09", "label": "Greedy",                "mode": "Block",    "topics": ["Greedy"],                "target": 10, "note": "Exchange-argument intuition, jump game family."},
    {"month": "2026-09", "label": "Intervals",             "mode": "Block",    "topics": ["Intervals"],             "target": 5,  "note": "Sort-then-sweep; meeting rooms."},
    {"month": "2026-09", "label": "1-D DP",                "mode": "Block",    "topics": ["1-D DP"],                "target": 10, "note": "House Robber family, LIS, Word Break."},
    {"month": "2026-09", "label": "Wildcard / Mixed",      "mode": "Wildcard", "topics": None,                      "target": 24, "note": "Heaviest month — interleaving is load-bearing here."},
    {"month": "2026-10", "label": "1-D DP (finish)",       "mode": "Block",    "topics": ["1-D DP"],                "target": 6,  "note": "Finish the 1-D set (16 total across Sep–Oct)."},
    {"month": "2026-10", "label": "2-D DP",                "mode": "Block",    "topics": ["2-D DP"],                "target": 10, "note": "Grid paths, LCS, edit distance, stock series."},
    {"month": "2026-10", "label": "Bit Manipulation",      "mode": "Block",    "topics": ["Bit Manipulation"],      "target": 6,  "note": "XOR tricks, counting bits, single number."},
    {"month": "2026-10", "label": "Math & Geometry",       "mode": "Block",    "topics": ["Math & Geometry"],       "target": 5,  "note": "Rotate image, spiral, happy number, pow."},
    {"month": "2026-10", "label": "Wildcard / Mixed",      "mode": "Wildcard", "topics": None,                      "target": 8,  "note": "Syllabus closes Oct 31."},
    {"month": "2026-11", "label": "Streak Preservation",   "mode": "Wildcard", "topics": None,                      "target": 10, "note": "2–3/week from weakest tags. ZERO new topics. Exams own this month."},
    {"month": "2026-12", "label": "Flag Queue Flush",      "mode": "Redo",     "topics": None,                      "target": 25, "note": "Weeks 1–2: clear every open flag before anything else."},
    {"month": "2026-12", "label": "Timed / Company Sets",  "mode": "Timed",    "topics": None,                      "target": 35, "note": "2 mediums / 70 min, no IDE autocomplete; company-tagged lists."},
    {"month": "2026-12", "label": "Hard Reps (Graph/DP)",  "mode": "Block",    "topics": ["Graphs", "1-D DP", "2-D DP"], "target": 7, "note": "Hard problems only; log with their real topic."},
    {"month": "2026-12", "label": "Contests",              "mode": "Contest",  "topics": None,                      "target": 8,  "note": "2 Sunday contests × 4 problems each."},
]

PRACTICE_MODES = [
    {"mode": "Wildcard", "target": 69, "note": "Jul–Oct 59 + Nov 10. The discrimination reps — never skip these."},
    {"mode": "Redo",     "target": 25, "note": "Rolling all year; December flush target = 25."},
    {"mode": "Timed",    "target": 35, "note": "December interview simulation. 2 mediums / 70 minutes."},
    {"mode": "Contest",  "target": 10, "note": "September onward; each contest logs ~4 rows."},
]

PLAYBOOK = [
    {"title": "Mix blocks with wildcards", "body": "Work a topic in a focused run, but keep sprinkling in wildcards: a redo-queue item if one is open, otherwise a random problem from any covered topic with the tag hidden. Discrimination reps are what interviews actually test."},
    {"title": "The 60-second rule", "body": "Before coding any wildcard, write down which pattern you think it is and why. That minute of classification practice is the entire point of the slot."},
    {"title": "The 35-minute rule", "body": "Stuck past 35 minutes → read the editorial, close it, implement from memory, flag it for redo. Grinding hours on one DP problem burns energy you don't have to spare."},
    {"title": "Flag → redo", "body": "Any problem that needed the editorial gets re-solved later, from scratch. The tracker auto-detects the re-solve on LeetCode and clears the flag. Repetition is the learning."},
    {"title": "Busy day? Wildcard first", "body": "If you only have time for one problem, make it the wildcard, not the block problem. Block progress can wait; discrimination reps can't be crammed."},
    {"title": "Hards come later", "body": "Easies and mediums build the pattern library; hards test composition. Don't force hards early in a topic — return for them once the topic feels boring."},
    {"title": "Tier-2 (deliberately skipped)", "body": "Segment trees / Fenwick, KMP / rolling hash, bitmask & digit DP, Floyd–Warshall. Contest material, ~1–2% of interviews. Reliability on the 95% beats breadth on the last 5%."},
    {"title": "One system-design pick at a time", "body": "Spin the picker, get one topic, actually learn it — a real article or video plus notes, not a skim. Tick it only when you could explain it in an interview. Then spin again."},
    {"title": "Single source of truth", "body": "The log drives every number here. Solves sync in automatically; your only jobs are the redo flags, time-taken, honest No-Editorial marks — and ticking system-design topics you truly finished."},
]

SD_CONCEPTS = [
    "Requirements gathering & scoping", "Back-of-envelope estimation", "Load balancing", "Caching",
    "SQL vs NoSQL", "Database indexing", "Replication", "Sharding / partitioning", "CAP theorem",
    "Consistent hashing", "Message queues & pub/sub", "CDN", "API design", "Rate limiting",
    "Monolith vs microservices", "Consistency models", "Proxies", "WebSockets / SSE / polling",
    "Blob & object storage", "Idempotency", "Retries, backoff, circuit breakers",
    "Service discovery & API gateway", "Monitoring, logging, tracing", "Authentication & authorization",
    "Bloom filters", "Database schema design", "Query optimization & N+1 problems", "Connection pooling",
    "Transactions, locking & concurrency control", "Background jobs & async processing",
    "Pagination & cursors", "Batch vs stream ingestion", "Time-series & high-write workloads",
]
SD_PROBLEMS = [
    "URL shortener", "Rate limiter", "Chat / messaging app", "News feed", "Notification system",
    "Web crawler", "Search autocomplete", "Ride-sharing", "Video streaming", "Payment system",
]
SD_ALL = SD_CONCEPTS + SD_PROBLEMS

# Ordered (tag-group → roadmap-topic) rules: structures before algorithms,
# specific before general, Arrays & Hashing as the fallback bucket.
# map_topic returns the best guess; topic_candidates returns every plausible
# roadmap topic so ambiguous solves can ask the user which approach they used.
TAG_RULES = [
    ({"Trie"}, "Tries"),
    ({"Linked List", "Doubly-Linked List"}, "Linked List"),
    ({"Binary Search Tree", "Binary Tree", "Tree", "Segment Tree", "Binary Indexed Tree"}, "Trees & BST"),
    ({"Heap (Priority Queue)"}, "Heap / Priority Queue"),
    ({"Shortest Path", "Minimum Spanning Tree", "Strongly Connected Component",
      "Eulerian Circuit", "Biconnected Component"}, "Advanced Graphs"),
    ({"Graph", "Topological Sort", "Union Find"}, "Graphs"),
    ({"Backtracking"}, "Backtracking"),
    ({"Dynamic Programming"}, "__DP__"),
    ({"Monotonic Stack", "Stack"}, "Stack"),
    ({"Sliding Window", "Monotonic Queue"}, "Sliding Window"),
    ({"Two Pointers"}, "Two Pointers"),
    ({"Binary Search"}, "Binary Search"),
    ({"Breadth-First Search", "Depth-First Search"}, "Graphs"),
    ({"Greedy"}, "Greedy"),
    ({"Line Sweep"}, "Intervals"),
    ({"Bit Manipulation", "Bitmask"}, "Bit Manipulation"),
    ({"Geometry", "Math", "Number Theory", "Combinatorics", "Probability and Statistics"}, "Math & Geometry"),
    ({"Hash Table", "Array", "String", "Prefix Sum", "Counting", "Sorting", "Matrix", "Simulation"},
     "Arrays & Hashing"),
]


def topic_candidates(tags):
    """All plausible roadmap topics for this tag set, in priority order."""
    tset = set(tags)
    out = []
    for group, topic in TAG_RULES:
        if tset & group:
            if topic == "__DP__":
                topic = "2-D DP" if "Matrix" in tset else "1-D DP"
            if topic not in out:
                out.append(topic)
    return out or ["Arrays & Hashing"]


def map_topic(tags):
    return topic_candidates(tags)[0]


# ----------------------------------------------------------------------------- db
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with closing(db()) as c, c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS problems(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL,
            title TEXT NOT NULL,
            lc_id TEXT,
            date_solved TEXT NOT NULL,          -- IST date, YYYY-MM-DD
            ts INTEGER,                          -- unix ts of the AC submission
            difficulty TEXT,                     -- Easy / Medium / Hard
            topic TEXT,                          -- roadmap topic
            lc_tags TEXT,                        -- json list of LC tags
            type TEXT NOT NULL DEFAULT 'Block',  -- Block/Wildcard/Redo/Timed/Contest
            time_min INTEGER,
            no_editorial INTEGER DEFAULT 1,      -- 1 = solved clean
            flag_redo INTEGER DEFAULT 0,
            redo_done INTEGER DEFAULT 0,
            redo_of INTEGER,                     -- id of original entry when type=Redo
            notes TEXT DEFAULT '',
            auto INTEGER DEFAULT 0,              -- 1 = added by sync
            UNIQUE(slug, date_solved)
        );
        CREATE TABLE IF NOT EXISTS question_cache(
            slug TEXT PRIMARY KEY, lc_id TEXT, title TEXT, difficulty TEXT, tags TEXT
        );
        CREATE TABLE IF NOT EXISTS snapshots(
            ts INTEGER PRIMARY KEY, lifetime INTEGER, easy INTEGER, medium INTEGER,
            hard INTEGER, ranking INTEGER
        );
        CREATE TABLE IF NOT EXISTS sync_log(
            ts INTEGER PRIMARY KEY, ok INTEGER, added INTEGER, message TEXT
        );
        CREATE TABLE IF NOT EXISTS settings(k TEXT PRIMARY KEY, v TEXT);
        """)
        for k, v in DEFAULT_SETTINGS.items():
            c.execute("INSERT OR IGNORE INTO settings(k, v) VALUES(?, ?)", (k, json.dumps(v)))
        # ---- migrations -------------------------------------------------
        cols = {r["name"] for r in c.execute("PRAGMA table_info(problems)")}
        if "candidates" not in cols:
            c.execute("ALTER TABLE problems ADD COLUMN candidates TEXT DEFAULT '[]'")
        if "needs_review" not in cols:
            c.execute("ALTER TABLE problems ADD COLUMN needs_review INTEGER DEFAULT 0")
        ver = c.execute("SELECT v FROM settings WHERE k='schema_v'").fetchone()
        if not ver or json.loads(ver["v"]) < 2:
            for r in c.execute("SELECT id, lc_tags, auto FROM problems").fetchall():
                tags = json.loads(r["lc_tags"] or "[]")
                cands = topic_candidates(tags) if tags else []
                c.execute("UPDATE problems SET candidates=?, needs_review=? WHERE id=?",
                          (json.dumps(cands), 1 if (r["auto"] and len(cands) > 1) else 0, r["id"]))
            c.execute("INSERT OR REPLACE INTO settings VALUES('schema_v', '2')")


def get_settings():
    with closing(db()) as c:
        rows = c.execute("SELECT k, v FROM settings").fetchall()
    s = dict(DEFAULT_SETTINGS)
    s.update({r["k"]: json.loads(r["v"]) for r in rows if r["k"] in DEFAULT_SETTINGS})
    return s


def get_kv(key, default):
    with closing(db()) as c:
        row = c.execute("SELECT v FROM settings WHERE k=?", (key,)).fetchone()
    return json.loads(row["v"]) if row else default


def set_kv(key, value):
    with closing(db()) as c, c:
        c.execute("INSERT OR REPLACE INTO settings VALUES(?,?)", (key, json.dumps(value)))


# ----------------------------------------------------------------------------- leetcode client
def gql(client, query, variables):
    r = client.post(LEETCODE_GQL, headers=UA, json={"query": query, "variables": variables}, timeout=25)
    r.raise_for_status()
    out = r.json()
    if "errors" in out and not out.get("data"):
        raise RuntimeError(str(out["errors"])[:200])
    return out["data"]


def fetch_profile(client, username):
    q = ("query($u:String!){matchedUser(username:$u){profile{ranking}"
         "submitStatsGlobal{acSubmissionNum{difficulty count}}}}")
    try:
        d = gql(client, q, {"u": username})["matchedUser"]
        nums = {x["difficulty"]: x["count"] for x in d["submitStatsGlobal"]["acSubmissionNum"]}
        return {"lifetime": nums.get("All"), "easy": nums.get("Easy"), "medium": nums.get("Medium"),
                "hard": nums.get("Hard"), "ranking": d["profile"]["ranking"]}
    except Exception:
        r = client.get(MIRROR.format(u=username), timeout=25)
        r.raise_for_status()
        j = r.json()
        return {"lifetime": j.get("totalSolved"), "easy": j.get("easySolved"), "medium": j.get("mediumSolved"),
                "hard": j.get("hardSolved"), "ranking": j.get("ranking")}


def fetch_recent(client, username, limit=20):
    q = "query($u:String!,$n:Int!){recentAcSubmissionList(username:$u,limit:$n){title titleSlug timestamp}}"
    return gql(client, q, {"u": username, "n": limit})["recentAcSubmissionList"] or []


def fetch_question(client, slug):
    q = ("query($s:String!){question(titleSlug:$s){questionFrontendId title difficulty "
         "topicTags{name}}}")
    d = gql(client, q, {"s": slug})["question"]
    if not d:
        return None
    return {"lc_id": d["questionFrontendId"], "title": d["title"], "difficulty": d["difficulty"],
            "tags": [t["name"] for t in d["topicTags"]]}


def question_meta(client, c, slug):
    row = c.execute("SELECT * FROM question_cache WHERE slug=?", (slug,)).fetchone()
    if row:
        return {"lc_id": row["lc_id"], "title": row["title"], "difficulty": row["difficulty"],
                "tags": json.loads(row["tags"])}
    meta = fetch_question(client, slug)
    if meta:
        c.execute("INSERT OR REPLACE INTO question_cache VALUES(?,?,?,?,?)",
                  (slug, meta["lc_id"], meta["title"], meta["difficulty"], json.dumps(meta["tags"])))
    return meta


# ----------------------------------------------------------------------------- sync engine
_sync_lock = threading.Lock()


def month_key_of(d: str) -> str:
    return d[:7]


def default_type(topic, dsolved):
    # no schedule pressure: every auto-captured solve defaults to Block work on
    # its topic; Wildcard/Timed/Contest are deliberate manual re-labels
    return "Block"


def run_sync():
    """Pull profile + recent ACs, auto-log anything new inside the roadmap window.

    Two phases so the DB transaction never spans network I/O and one bad
    question fetch can't roll back (or wedge) the whole sync:
      A) network: profile, recent list, per-slug metadata (cache-first)
      B) db:      snapshot + inserts + redo housekeeping, one short transaction
    """
    if not _sync_lock.acquire(blocking=False):
        return {"ok": False, "added": 0, "message": "sync already running"}
    try:
        s = get_settings()
        start = s["roadmap_start"]
        now = int(time.time())

        # ---- phase A: network --------------------------------------------
        prof, recent, skipped = None, [], 0
        with httpx.Client(follow_redirects=True) as client:
            prof = fetch_profile(client, s["username"])
            recent = fetch_recent(client, s["username"])

            with closing(db()) as c:
                known = {(r["slug"], r["date_solved"]) for r in
                         c.execute("SELECT slug, date_solved FROM problems")}
                cached = {r["slug"]: {"lc_id": r["lc_id"], "title": r["title"],
                                      "difficulty": r["difficulty"], "tags": json.loads(r["tags"])}
                          for r in c.execute("SELECT * FROM question_cache")}

            prepared, fresh_meta = [], {}
            for sub in sorted(recent, key=lambda x: int(x["timestamp"])):
                ts = int(sub["timestamp"])
                dsolved = datetime.fromtimestamp(ts, IST).date().isoformat()
                slug = sub["titleSlug"]
                if dsolved < start or (slug, dsolved) in known:
                    continue
                known.add((slug, dsolved))
                meta = cached.get(slug) or fresh_meta.get(slug)
                if meta is None:
                    try:
                        meta = fetch_question(client, slug)
                        if meta:
                            fresh_meta[slug] = meta
                    except Exception:
                        meta = None  # metadata failed — still log the solve
                if meta is None:
                    meta = {"lc_id": None, "title": sub["title"], "difficulty": None, "tags": []}
                    skipped += 1
                prepared.append({"slug": slug, "ts": ts, "date": dsolved, "meta": meta})

        # ---- phase B: one short write transaction ------------------------
        added, notes = [], []
        with closing(db()) as c, c:
            if prof and prof["lifetime"] is not None:
                c.execute("INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?,?)",
                          (now, prof["lifetime"], prof["easy"], prof["medium"], prof["hard"], prof["ranking"]))
            for slug, meta in fresh_meta.items():
                c.execute("INSERT OR REPLACE INTO question_cache VALUES(?,?,?,?,?)",
                          (slug, meta["lc_id"], meta["title"], meta["difficulty"], json.dumps(meta["tags"])))
            for item in prepared:
                meta, dsolved = item["meta"], item["date"]
                cands = topic_candidates(meta["tags"]) if meta["tags"] else []
                topic = cands[0] if cands else "Arrays & Hashing"
                needs_review = 1 if (len(cands) > 1 or not meta["tags"]) else 0
                earlier = c.execute(
                    "SELECT id, flag_redo, redo_done FROM problems WHERE slug=? AND date_solved<? "
                    "ORDER BY date_solved DESC LIMIT 1", (item["slug"], dsolved)).fetchone()
                if earlier:
                    ptype, redo_of = "Redo", earlier["id"]
                    if earlier["flag_redo"] and not earlier["redo_done"]:
                        c.execute("UPDATE problems SET redo_done=1 WHERE id=?", (earlier["id"],))
                        notes.append(f"redo flag cleared: {meta['title']}")
                else:
                    ptype, redo_of = default_type(topic, dsolved), None
                c.execute(
                    """INSERT OR IGNORE INTO problems(slug,title,lc_id,date_solved,ts,difficulty,topic,
                       lc_tags,candidates,needs_review,type,no_editorial,auto,redo_of)
                       VALUES(?,?,?,?,?,?,?,?,?,?,?,1,1,?)""",
                    (item["slug"], meta["title"], meta["lc_id"], dsolved, item["ts"], meta["difficulty"],
                     topic, json.dumps(meta["tags"]), json.dumps(cands), needs_review, ptype, redo_of))
                added.append({"title": meta["title"], "topic": topic, "difficulty": meta["difficulty"],
                              "date": dsolved, "type": ptype, "needs_review": needs_review})
            msg = f"+{len(added)} new"
            if skipped:
                msg += f" · {skipped} missing metadata (topic left for you to set)"
            if notes:
                msg += " · " + "; ".join(notes)
            c.execute("INSERT OR REPLACE INTO sync_log VALUES(?,?,?,?)", (now, 1, len(added), msg))
        return {"ok": True, "added": len(added), "problems": added, "message": msg}
    except Exception as e:
        with closing(db()) as c, c:
            c.execute("INSERT OR REPLACE INTO sync_log VALUES(?,?,?,?)",
                      (int(time.time()), 0, 0, f"{type(e).__name__}: {e}"))
        return {"ok": False, "added": 0, "message": f"{type(e).__name__}: {e}"}
    finally:
        _sync_lock.release()


def scheduler():
    while True:
        try:
            mins = max(5, int(get_settings().get("sync_minutes", 30)))
        except Exception:
            mins = 30
        time.sleep(mins * 60)
        run_sync()


# ----------------------------------------------------------------------------- state assembly
def compute_state():
    s = get_settings()
    today = datetime.now(IST).date()
    start = date.fromisoformat(s["roadmap_start"])
    end = date.fromisoformat(s["roadmap_end"])

    with closing(db()) as c:
        probs = [dict(r) for r in c.execute("SELECT * FROM problems ORDER BY date_solved DESC, ts DESC")]
        snap = c.execute("SELECT * FROM snapshots ORDER BY ts DESC LIMIT 1").fetchone()
        snaps = [dict(r) for r in c.execute("SELECT * FROM snapshots ORDER BY ts")]
        last_sync = c.execute("SELECT * FROM sync_log ORDER BY ts DESC LIMIT 1").fetchone()

    def valid(p):
        try:
            date.fromisoformat(p["date_solved"])
            return True
        except (ValueError, TypeError):
            return False
    probs = [p for p in probs if valid(p)]

    for p in probs:
        p["lc_tags"] = json.loads(p["lc_tags"] or "[]")
        p["candidates"] = json.loads(p.get("candidates") or "[]")

    total_target = sum(m["target"] for m in MONTHS)
    done = len(probs)

    # topics — quantity goals only, no calendar
    topics_out = []
    for t in TOPICS:
        tp = [p for p in probs if p["topic"] == t["name"]]
        block_done = sum(1 for p in tp if p["type"] == "Block")
        topics_out.append({"name": t["name"], "target": t["target"], "icon": t["icon"],
                           "block_done": block_done, "touches": len(tp),
                           "left": max(0, t["target"] - block_done),
                           "pct": round(block_done / t["target"] * 100, 1) if t["target"] else 0,
                           "easy": sum(1 for p in tp if p["difficulty"] == "Easy"),
                           "medium": sum(1 for p in tp if p["difficulty"] == "Medium"),
                           "hard": sum(1 for p in tp if p["difficulty"] == "Hard")})

    # redo queue — open flags, no due dates, newest first
    redo = [{"id": p["id"], "title": p["title"], "slug": p["slug"], "topic": p["topic"],
             "difficulty": p["difficulty"], "logged": p["date_solved"]}
            for p in probs if p["flag_redo"] and not p["redo_done"]]

    # system design — a topic is done ONLY by passing its test (>= 75%)
    sd_done = [n for n in get_kv("sd_done", []) if n in SD_ALL]
    sd_scores = {k: v for k, v in get_kv("sd_scores", {}).items() if k in SD_ALL}
    sd_history = get_kv("sd_history", {})
    sd_pick = get_kv("sd_pick", None)
    if sd_pick not in SD_ALL or sd_pick in sd_done:
        sd_pick = None

    def sd_entry(n):
        hist = sd_history.get(n, [])
        return {"name": n, "done": n in sd_done, "score": sd_scores.get(n),
                "attempts": len(hist), "history": hist}
    sysdesign = {
        "concepts": [sd_entry(n) for n in SD_CONCEPTS],
        "problems": [sd_entry(n) for n in SD_PROBLEMS],
        "done": len(sd_done), "total": len(SD_ALL), "pick": sd_pick,
        "pct": round(len(sd_done) / len(SD_ALL) * 100, 1),
        "pass_mark": 75,
        "exam_history": sd_history.get(EXAM_KEY, []),
    }

    try:
        baseline = int(s["baseline_total"])
    except (TypeError, ValueError):
        baseline = DEFAULT_SETTINGS["baseline_total"]
    lc = {"lifetime": snap["lifetime"] if snap else None,
          "easy": snap["easy"] if snap else None, "medium": snap["medium"] if snap else None,
          "hard": snap["hard"] if snap else None, "ranking": snap["ranking"] if snap else None,
          "since_baseline": (snap["lifetime"] - baseline) if snap and snap["lifetime"] is not None else None,
          "baseline": baseline, "username": s["username"]}
    cross_check = None
    if lc["since_baseline"] is not None and lc["since_baseline"] > done:
        gap = lc["since_baseline"] - done
        cross_check = (f"LeetCode counts {gap} more solve{'s' if gap > 1 else ''} since baseline than the log has. "
                       f"LeetCode only exposes your last 20 accepted submissions, so anything older can't be auto-recovered — "
                       f"add missing solves with the log's Add button (or they may simply predate Jul 11).")

    return {
        "generated": datetime.now(IST).isoformat(),
        "today": today.isoformat(),
        "settings": s,
        "kpi": {"total_target": total_target, "done": done, "pct": round(done / total_target * 100, 1),
                "hards": sum(1 for p in probs if p["difficulty"] == "Hard"),
                "open_flags": len(redo),
                "needs_review": sum(1 for p in probs if p["needs_review"])},
        "lc": lc, "cross_check": cross_check,
        "sync": {"last": dict(last_sync) if last_sync else None,
                 "ranking_series": [{"ts": r["ts"], "ranking": r["ranking"]} for r in snaps]},
        "topics": topics_out, "redo": redo, "problems": probs,
        "sysdesign": sysdesign,
        "playbook": PLAYBOOK,
        "difficulty_split": {k: sum(1 for p in probs if p["difficulty"] == k) for k in ("Easy", "Medium", "Hard")},
        "type_split": {k: sum(1 for p in probs if p["type"] == k) for k in ("Block", "Wildcard", "Redo", "Timed", "Contest")},
    }


# ----------------------------------------------------------------------------- api
app = FastAPI(title="DSA Mission Control")


@app.get("/api/state")
def api_state():
    return compute_state()


@app.post("/api/sync")
def api_sync():
    return run_sync()


def _valid_iso(d):
    try:
        date.fromisoformat(d)
        return True
    except (ValueError, TypeError):
        return False


@app.post("/api/problem")
def api_add(body: dict):
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "title is required")
    if not _valid_iso(body.get("date_solved")):
        raise HTTPException(400, "date_solved must be YYYY-MM-DD")
    if body.get("topic") not in TOPIC_NAMES:
        raise HTTPException(400, "unknown topic")
    if body.get("type") not in ("Block", "Wildcard", "Redo", "Timed", "Contest"):
        raise HTTPException(400, "unknown type")
    try:
        with closing(db()) as c, c:
            cur = c.execute(
                """INSERT INTO problems(slug,title,lc_id,date_solved,difficulty,topic,lc_tags,
                   candidates,needs_review,type,time_min,no_editorial,flag_redo,notes,auto)
                   VALUES(?,?,?,?,?,?,'[]','[]',0,?,?,?,?,?,0)""",
                (body.get("slug") or title.lower().replace(" ", "-"), title,
                 body.get("lc_id"), body["date_solved"], body.get("difficulty"), body["topic"],
                 body["type"], body.get("time_min"), 1 if body.get("no_editorial", True) else 0,
                 1 if body.get("flag_redo") else 0, body.get("notes", "")))
            return {"ok": True, "id": cur.lastrowid}
    except sqlite3.IntegrityError:
        raise HTTPException(409, "that problem is already logged for that date")


@app.patch("/api/problem/{pid}")
def api_edit(pid: int, body: dict):
    allowed = {"type", "topic", "time_min", "no_editorial", "flag_redo", "redo_done", "notes",
               "difficulty", "date_solved", "needs_review"}
    sets = {k: v for k, v in body.items() if k in allowed}
    if not sets:
        raise HTTPException(400, "nothing to update")
    if "date_solved" in sets and not _valid_iso(sets["date_solved"]):
        raise HTTPException(400, "date_solved must be YYYY-MM-DD")
    if "topic" in sets:
        if sets["topic"] not in TOPIC_NAMES:
            raise HTTPException(400, "unknown topic")
        sets.setdefault("needs_review", 0)  # picking a topic answers the question
    q = ", ".join(f"{k}=?" for k in sets)
    try:
        with closing(db()) as c, c:
            c.execute(f"UPDATE problems SET {q} WHERE id=?", (*sets.values(), pid))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "that change collides with an existing entry")
    return {"ok": True}


@app.delete("/api/problem/{pid}")
def api_delete(pid: int):
    with closing(db()) as c, c:
        c.execute("DELETE FROM problems WHERE id=?", (pid,))
    return {"ok": True}


@app.patch("/api/settings")
def api_settings(body: dict):
    clean = {}
    for k, v in body.items():
        if k not in DEFAULT_SETTINGS:
            continue
        if k in ("baseline_total", "sync_minutes", "redo_days"):
            try:
                v = int(v)
            except (TypeError, ValueError):
                raise HTTPException(400, f"{k} must be a number")
            if k == "sync_minutes":
                v = max(5, v)
            if k == "redo_days":
                v = max(1, v)
        elif k in ("baseline_date", "roadmap_start", "roadmap_end"):
            if not _valid_iso(v):
                raise HTTPException(400, f"{k} must be YYYY-MM-DD")
        elif k == "username":
            v = str(v).strip()
            if not v:
                raise HTTPException(400, "username can't be empty")
        clean[k] = v
    with closing(db()) as c, c:
        for k, v in clean.items():
            c.execute("INSERT OR REPLACE INTO settings VALUES(?,?)", (k, json.dumps(v)))
    return {"ok": True, "settings": get_settings()}


PASS_MARK = 75
MAX_HISTORY = 8
EXAM_KEY = "__overall_exam__"


@app.post("/api/sd")
def api_sd(body: dict):
    action = body.get("action")
    name = body.get("name")
    if action == "score":
        # the ONLY path to ticking a topic: submit a test score; >= PASS_MARK marks it done
        is_exam = name == EXAM_KEY
        if not is_exam and name not in SD_ALL:
            raise HTTPException(400, "unknown system-design topic")
        try:
            pct = int(body.get("pct"))
        except (TypeError, ValueError):
            raise HTTPException(400, "pct must be a number")
        pct = max(0, min(100, pct))
        passed = pct >= PASS_MARK

        history = get_kv("sd_history", {})
        entry = {
            "ts": int(time.time()), "pct": pct, "passed": passed,
            "correct": int(body.get("correct") or 0), "total": int(body.get("total") or 0),
            "answers": (body.get("answers") or [])[:120],
        }
        history.setdefault(name, []).insert(0, entry)
        history[name] = history[name][:MAX_HISTORY]
        set_kv("sd_history", history)

        if is_exam:
            return {"ok": True, "passed": passed, "exam": True}

        scores = get_kv("sd_scores", {})
        scores[name] = max(int(scores.get(name, 0)), pct)
        set_kv("sd_scores", scores)
        done = [n for n in get_kv("sd_done", []) if n in SD_ALL]
        if passed and name not in done:
            done.append(name)
            set_kv("sd_done", done)
            if get_kv("sd_pick", None) == name:
                set_kv("sd_pick", None)
        return {"ok": True, "passed": passed, "best": scores[name], "done_count": len(done)}
    if action == "pick":
        if name not in SD_ALL:
            raise HTTPException(400, "unknown system-design topic")
        set_kv("sd_pick", name)
        return {"ok": True, "pick": name}
    if action == "clear_pick":
        set_kv("sd_pick", None)
        return {"ok": True, "pick": None}
    raise HTTPException(400, "action must be score | pick | clear_pick")


@app.get("/api/export")
def api_export():
    return JSONResponse(compute_state(),
                        headers={"Content-Disposition": "attachment; filename=dsa-tracker-export.json"})


@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC, "index.html"))


app.mount("/", StaticFiles(directory=STATIC, html=True), name="static")


# ----------------------------------------------------------------------------- main
def main():
    init_db()
    threading.Thread(target=scheduler, daemon=True).start()
    threading.Timer(1.2, lambda: webbrowser.open(f"http://127.0.0.1:{PORT}")).start()
    threading.Thread(target=run_sync, daemon=True).start()
    try:
        uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
    except SystemExit:
        raise
    except OSError:
        # already running — just show it
        webbrowser.open(f"http://127.0.0.1:{PORT}")


if __name__ == "__main__":
    main()
