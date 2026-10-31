// lib/migrate.js: one-time copy of existing data from Upstash Redis (Vercel) into Cloudflare D1.
// Runs automatically on Cloudflare when the old Upstash variables are set and the copy hasn't
// happened yet. Copies the partner list and all leads, keeping their order. Uses a few bulk
// statements so it stays within the Workers free plan's per-request limits.
// Safe to run again: it records when it finished and only then stops.
const { upstash, upstashConfigured, ensureSchema } = require("./kv");

var DONE_KEY = "_migrated_from_upstash";
var running = null;
var MAX_CHUNK_BYTES = 900000; // stay under D1's per-value size limit

function chunkByBytes(items) {
  var out = [], cur = [], size = 2;
  items.forEach(function (it) {
    var n = JSON.stringify(it).length + 1;
    if (cur.length && size + n > MAX_CHUNK_BYTES) { out.push(cur); cur = []; size = 2; }
    cur.push(it); size += n;
  });
  if (cur.length) out.push(cur);
  return out;
}

async function copy(db) {
  await ensureSchema();
  var done = await db.prepare("SELECT v FROM kv WHERE k = ?").bind(DONE_KEY).first();
  if (done) return { already: true, copied_at: done.v };

  // 1. Read everything from Upstash (a few requests).
  var partners = await upstash(["GET", "aig:partners"]);
  var ids = (await upstash(["LRANGE", "leads", "0", "-1"])) || []; // newest first
  var leads = [];
  for (var i = 0; i < ids.length; i += 500) {
    var chunk = ids.slice(i, i + 500);
    var vals = await upstash(["MGET"].concat(chunk.map(function (id) { return "lead:" + id; })));
    chunk.forEach(function (id, j) { if (vals && vals[j]) leads.push({ k: "lead:" + id, v: vals[j] }); });
  }

  // 2. Leads that already arrived on Cloudflare before the copy stay the newest.
  var cfRows = await db.prepare("SELECT v FROM list_items WHERE name = 'leads' ORDER BY seq ASC").all();
  var copied = {};
  ids.forEach(function (id) { copied[id] = true; });
  var cfIds = (cfRows.results || []).map(function (r) { return r.v; }).filter(function (id) { return !copied[id]; });
  var listOldestFirst = ids.slice().reverse().concat(cfIds);

  // 3. Write it all in one atomic batch of bulk statements.
  var upsertJson =
    "INSERT INTO kv (k, v, exp) SELECT json_extract(value, '$.k'), json_extract(value, '$.v'), NULL FROM json_each(?) WHERE true " +
    "ON CONFLICT(k) DO UPDATE SET v = excluded.v, exp = NULL";
  var stmts = [];
  if (partners) stmts.push(db.prepare("INSERT INTO kv (k, v, exp) VALUES ('aig:partners', ?, NULL) ON CONFLICT(k) DO UPDATE SET v = excluded.v, exp = NULL").bind(partners));
  chunkByBytes(leads).forEach(function (c) { stmts.push(db.prepare(upsertJson).bind(JSON.stringify(c))); });
  stmts.push(db.prepare("DELETE FROM list_items WHERE name = 'leads'"));
  chunkByBytes(listOldestFirst).forEach(function (c) {
    stmts.push(db.prepare("INSERT INTO list_items (name, v) SELECT 'leads', value FROM json_each(?) ORDER BY key").bind(JSON.stringify(c)));
  });
  var at = new Date().toISOString();
  stmts.push(db.prepare("INSERT INTO kv (k, v, exp) VALUES (?, ?, NULL) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(DONE_KEY, at));
  await db.batch(stmts);

  var summary = { copied_at: at, partners: partners ? JSON.parse(partners).length : 0, leads: leads.length, cloudflare_leads_kept: cfIds.length };
  console.log(JSON.stringify(Object.assign({ event: "upstash_migration" }, summary)));
  return summary;
}

// Copy once per database. Concurrent requests in the same isolate share one run.
exports.migrateIfNeeded = function (db) {
  if (!db || !upstashConfigured()) return Promise.resolve(null);
  if (!running) {
    running = copy(db).catch(function (e) {
      running = null;
      console.error("migration failed:", e && e.message);
      return { error: e && e.message };
    });
  }
  return running;
};

exports.migrationStatus = async function (db) {
  if (!db) return null;
  await ensureSchema();
  var row = await db.prepare("SELECT v FROM kv WHERE k = ?").bind(DONE_KEY).first();
  return row ? row.v : null;
};
