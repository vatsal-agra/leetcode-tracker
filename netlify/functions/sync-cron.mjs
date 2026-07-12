/* DSA Mission Control — scheduled auto-sync. Runs every 15 minutes, 24/7,
   so solves are captured even when your machine is off. */
import { getStore } from "@netlify/blobs";
import { DEFAULT_SETTINGS, runSync } from "./lib.mjs";

export const config = { schedule: "*/15 * * * *" };

export default async () => {
  const store = getStore("tracker");
  const [problems, qcache, snapshots, synclog, settings] = await Promise.all([
    store.get("problems", { type: "json" }),
    store.get("qcache", { type: "json" }),
    store.get("snapshots", { type: "json" }),
    store.get("synclog", { type: "json" }),
    store.get("settings", { type: "json" }),
  ]);
  const data = {
    problems: problems || { nextId: 1, items: [] },
    qcache: qcache || {},
    snapshots: snapshots || [],
    synclog: synclog || [],
    settings: { ...DEFAULT_SETTINGS, ...(settings || {}) },
  };
  const result = await runSync(data);
  await Promise.all([
    store.setJSON("problems", data.problems),
    store.setJSON("qcache", data.qcache),
    store.setJSON("snapshots", data.snapshots),
    store.setJSON("synclog", data.synclog),
  ]);
  console.log("scheduled sync:", result.message);
  return new Response(JSON.stringify(result));
};
