# 🎯 DSA Mission Control

LeetCode roadmap tracker (Jul 11 → Dec 31, 2026 · 320 problems) that captures your
solves **automatically** — every accepted submission is detected, tagged with its
roadmap topic, and counted. Re-solves become Redos. Ambiguous problems (solvable
more than one way) go to a one-click "Needs your call" queue.

Runs two ways from this one repo:

| | Local (desktop) | Cloud (Netlify) |
|---|---|---|
| start | `Start DSA Tracker.bat` | your Netlify URL, any device |
| engine | Python FastAPI + SQLite | Netlify Functions + Blobs |
| sync | on launch + every 30 min while open | **every 15 min, 24/7** |
| data | `data/tracker.db` | Netlify Blobs store |

---

## Deploy to Netlify (one time, ~5 minutes)

1. **GitHub** — create a new repository (private is fine), then from this folder:
   ```
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
   (The repo is already initialized and committed.)

2. **Netlify** — [app.netlify.com](https://app.netlify.com) → *Add new site* →
   *Import an existing project* → GitHub → pick the repo → **Deploy**.
   All build settings come from `netlify.toml` automatically.

3. **Password (recommended)** — Site configuration → *Environment variables* →
   add `APP_PASSWORD` = anything you like → *Deploys* → *Trigger deploy*.
   Without it the tracker is readable/editable by anyone with the URL.

4. **Bring your data over (one time)** — on the **local** app: Settings → *Export JSON*.
   On the **cloud** app: Settings → *Import backup…* → pick that file.
   (Skip this and the cloud version still backfills your recent solves on its own —
   you'd only lose manual notes/flags/topic calls made locally.)

That's it. The scheduled function (`netlify/functions/sync-cron.mjs`) polls LeetCode
every 15 minutes around the clock, so the "last 20 accepted submissions" API window
effectively never overflows.

## Notes

- LeetCode calls are **read-only** and use only public profile data
  (username: set in Settings).
- The 20-submission API window still exists in theory — you'd need 20+ accepted
  solves inside 15 minutes to lose one. If it ever happens, the dashboard says so
  and the log's *Add* button covers it.
- Local version: needs Python 3.11+ with `fastapi`, `uvicorn`, `httpx`.
- Back up cloud data anytime with Settings → Export JSON.
