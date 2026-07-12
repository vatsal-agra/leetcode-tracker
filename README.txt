DSA MISSION CONTROL
===================

Your LeetCode roadmap tracker (Jul 11 → Dec 31, 2026 · 320 problems).

START IT
  Double-click "Start DSA Tracker.bat" (one folder up), or the
  "DSA Mission Control" shortcut on your Desktop.
  The app opens at http://127.0.0.1:5599

WHAT IT DOES ON ITS OWN
  • Watches your LeetCode account (agrawal_vatsal) — every solve is captured
    automatically with its topic and difficulty. Solve a hashmap problem and
    Arrays & Hashing ticks +1 by itself.
  • Detects re-solves and files them as Redos (clearing your redo flags).
  • Tracks pace vs the plan, month status, streaks, days-cold per topic.
  • Syncs on launch and every 30 minutes while the app is open
    (configurable in Settings).

WHAT'S STILL YOURS TO DO
  • Flag problems that needed the editorial (the flag icon in the log).
  • Fill in time-taken and pattern notes — future-you will thank you.
  • Re-type Wildcard/Timed/Contest on entries when the default guess (Block
    inside the current month's topics, Wildcard otherwise) is wrong.

DATA
  Everything lives in dsa-tracker/data/tracker.db (SQLite).
  Back it up by copying that one file. Export JSON from Settings.
  Nothing leaves your machine except read-only calls to LeetCode.

STACK
  Python + FastAPI + SQLite backend · vanilla JS + Chart.js frontend.
  Requires: Python 3.11+ with fastapi, uvicorn, httpx (already installed).
