/* DSA Mission Control — API (Netlify Functions v2, backed by Netlify Blobs). */
import { getStore } from "@netlify/blobs";
import {
  DEFAULT_SETTINGS, TOPIC_NAMES, TYPES, SD_ALL, computeState, runSync, validISO,
} from "./lib.mjs";

export const config = { path: "/api/*" };

async function loadData(store) {
  const [problems, qcache, snapshots, synclog, settings, sd] = await Promise.all([
    store.get("problems", { type: "json" }),
    store.get("qcache", { type: "json" }),
    store.get("snapshots", { type: "json" }),
    store.get("synclog", { type: "json" }),
    store.get("settings", { type: "json" }),
    store.get("sd", { type: "json" }),
  ]);
  return {
    problems: problems || { nextId: 1, items: [] },
    qcache: qcache || {},
    snapshots: snapshots || [],
    synclog: synclog || [],
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
    sd: sd || { done: [], pick: null },
  };
}

async function saveData(store, data, keys = ["problems", "qcache", "snapshots", "synclog", "settings", "sd"]) {
  await Promise.all(keys.map(k => store.setJSON(k, data[k])));
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  // ---- auth ----------------------------------------------------------
  const pw = process.env.APP_PASSWORD || "";
  if (pw) {
    const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (got !== pw) return json({ error: "auth required" }, 401);
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const method = req.method.toUpperCase();
  const store = getStore("tracker");

  try {
    if (path === "/api/state" && method === "GET") {
      const data = await loadData(store);
      return json(computeState(data));
    }

    if (path === "/api/sync" && method === "POST") {
      const data = await loadData(store);
      const result = await runSync(data);
      await saveData(store, data);
      return json(result);
    }

    if (path === "/api/problem" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const title = String(body.title || "").trim();
      if (!title) return json({ error: "title is required" }, 400);
      if (!validISO(body.date_solved)) return json({ error: "date_solved must be YYYY-MM-DD" }, 400);
      if (!TOPIC_NAMES.includes(body.topic)) return json({ error: "unknown topic" }, 400);
      if (!TYPES.includes(body.type)) return json({ error: "unknown type" }, 400);
      const data = await loadData(store);
      const slug = body.slug || title.toLowerCase().replace(/\s+/g, "-");
      if (data.problems.items.some(p => p.slug === slug && p.date_solved === body.date_solved))
        return json({ error: "that problem is already logged for that date" }, 409);
      const id = data.problems.nextId++;
      data.problems.items.push({
        id, slug, title, lc_id: body.lc_id || null, date_solved: body.date_solved,
        ts: null, difficulty: body.difficulty || null, topic: body.topic,
        lc_tags: [], candidates: [], needs_review: 0, type: body.type,
        time_min: body.time_min ?? null, no_editorial: body.no_editorial === false ? 0 : 1,
        flag_redo: body.flag_redo ? 1 : 0, redo_done: 0, redo_of: null,
        notes: body.notes || "", auto: 0,
      });
      await saveData(store, data, ["problems"]);
      return json({ ok: true, id });
    }

    const mProblem = path.match(/^\/api\/problem\/(\d+)$/);
    if (mProblem && (method === "PATCH" || method === "DELETE")) {
      const pid = +mProblem[1];
      const data = await loadData(store);
      const p = data.problems.items.find(x => x.id === pid);
      if (!p) return json({ error: "not found" }, 404);
      if (method === "DELETE") {
        data.problems.items = data.problems.items.filter(x => x.id !== pid);
      } else {
        const body = await req.json().catch(() => ({}));
        const allowed = ["type", "topic", "time_min", "no_editorial", "flag_redo", "redo_done",
                         "notes", "difficulty", "date_solved", "needs_review"];
        const sets = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
        if (!Object.keys(sets).length) return json({ error: "nothing to update" }, 400);
        if ("date_solved" in sets && !validISO(sets.date_solved))
          return json({ error: "date_solved must be YYYY-MM-DD" }, 400);
        if ("topic" in sets) {
          if (!TOPIC_NAMES.includes(sets.topic)) return json({ error: "unknown topic" }, 400);
          if (!("needs_review" in sets)) sets.needs_review = 0;
        }
        Object.assign(p, sets);
      }
      await saveData(store, data, ["problems"]);
      return json({ ok: true });
    }

    if (path === "/api/settings" && method === "PATCH") {
      const body = await req.json().catch(() => ({}));
      const data = await loadData(store);
      for (const [k, vRaw] of Object.entries(body)) {
        if (!(k in DEFAULT_SETTINGS)) continue;
        let v = vRaw;
        if (["baseline_total", "sync_minutes", "redo_days"].includes(k)) {
          v = parseInt(v, 10);
          if (!Number.isFinite(v)) return json({ error: `${k} must be a number` }, 400);
          if (k === "sync_minutes") v = Math.max(5, v);
          if (k === "redo_days") v = Math.max(1, v);
        } else if (["baseline_date", "roadmap_start", "roadmap_end"].includes(k)) {
          if (!validISO(v)) return json({ error: `${k} must be YYYY-MM-DD` }, 400);
        } else if (k === "username") {
          v = String(v).trim();
          if (!v) return json({ error: "username can't be empty" }, 400);
        }
        data.settings[k] = v;
      }
      await saveData(store, data, ["settings"]);
      return json({ ok: true, settings: data.settings });
    }

    if (path === "/api/sd" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const data = await loadData(store);
      if (body.action === "toggle") {
        if (!SD_ALL.includes(body.name)) return json({ error: "unknown system-design topic" }, 400);
        const i = data.sd.done.indexOf(body.name);
        if (i >= 0) data.sd.done.splice(i, 1);
        else {
          data.sd.done.push(body.name);
          if (data.sd.pick === body.name) data.sd.pick = null;
        }
      } else if (body.action === "pick") {
        if (!SD_ALL.includes(body.name)) return json({ error: "unknown system-design topic" }, 400);
        data.sd.pick = body.name;
      } else if (body.action === "clear_pick") {
        data.sd.pick = null;
      } else {
        return json({ error: "action must be toggle | pick | clear_pick" }, 400);
      }
      await saveData(store, data, ["sd"]);
      return json({ ok: true, done: data.sd.done, pick: data.sd.pick });
    }

    if (path === "/api/export" && method === "GET") {
      const data = await loadData(store);
      return new Response(JSON.stringify(computeState(data)), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=dsa-tracker-export.json",
        },
      });
    }

    if (path === "/api/import" && method === "POST") {
      // one-time migration from the local desktop version's /api/export JSON
      const body = await req.json().catch(() => null);
      if (!body || !Array.isArray(body.problems)) return json({ error: "not an export file" }, 400);
      const data = await loadData(store);
      let imported = 0;
      for (const p of body.problems) {
        if (!p.slug || !validISO(p.date_solved)) continue;
        const existing = data.problems.items.find(x => x.slug === p.slug && x.date_solved === p.date_solved);
        const row = {
          slug: p.slug, title: p.title, lc_id: p.lc_id ?? null, date_solved: p.date_solved,
          ts: p.ts ?? null, difficulty: p.difficulty ?? null, topic: p.topic,
          lc_tags: p.lc_tags || [], candidates: p.candidates || [],
          needs_review: p.needs_review ? 1 : 0, type: p.type || "Block",
          time_min: p.time_min ?? null, no_editorial: p.no_editorial ? 1 : 0,
          flag_redo: p.flag_redo ? 1 : 0, redo_done: p.redo_done ? 1 : 0,
          redo_of: null, notes: p.notes || "", auto: p.auto ? 1 : 0,
        };
        if (existing) Object.assign(existing, row);
        else data.problems.items.push({ id: data.problems.nextId++, ...row });
        imported++;
      }
      if (body.settings) {
        for (const k of ["username", "baseline_total", "baseline_date"]) {
          if (body.settings[k] != null) data.settings[k] = body.settings[k];
        }
      }
      await saveData(store, data, ["problems", "settings"]);
      return json({ ok: true, imported });
    }

    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: `${e.name || "Error"}: ${e.message}` }, 500);
  }
};
