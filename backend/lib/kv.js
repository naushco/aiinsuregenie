// lib/kv.js: storage for leads and partners, behind one small Redis-style interface:
//   kv(["GET", key]), kv(["SET", key, value]), kv(["SET", key, value, "NX", "EX", seconds]),
//   kv(["MGET", k1, k2, ...]), kv(["LPUSH", list, value]), kv(["LRANGE", list, start, stop]),
//   kv(["LTRIM", list, start, stop])
//
// Two backends, chosen automatically:
//   - Cloudflare D1 (when running on Cloudflare Workers; worker.js sets globalThis.__AIG_D1)
//   - Upstash Redis REST API (when running on Vercel with the Storage tab's variables)
// No npm packages needed.

function upstashConf() {
  var url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  var token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token: token } : null;
}
function d1() { return globalThis.__AIG_D1 || null; }

exports.upstashConfigured = function () { return !!upstashConf(); };
exports.kvConfigured = function () { return !!(d1() || upstashConf()); };

// Run one command against Upstash directly (also used to copy old data into D1).
async function upstash(cmd) {
  var c = upstashConf();
  if (!c) throw new Error("Storage is not configured");
  var r = await fetch(c.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  var j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "Storage error " + r.status);
  return j.result;
}
exports.upstash = upstash;

// ---------- Cloudflare D1 backend ----------
var schemaReady = null;
function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, exp INTEGER)"),
      db.prepare("CREATE TABLE IF NOT EXISTS list_items (seq INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, v TEXT NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS list_items_name ON list_items (name, seq)")
    ]).catch(function (e) { schemaReady = null; throw e; });
  }
  return schemaReady;
}
exports.ensureSchema = function () { return d1() ? ensureSchema(d1()) : Promise.resolve(); };

function now() { return Math.floor(Date.now() / 1000); }

async function d1kv(db, cmd) {
  await ensureSchema(db);
  var op = String(cmd[0]).toUpperCase();
  var t = now();

  if (op === "GET") {
    var row = await db.prepare("SELECT v FROM kv WHERE k = ? AND (exp IS NULL OR exp > ?)").bind(cmd[1], t).first();
    return row ? row.v : null;
  }

  if (op === "SET") {
    var key = cmd[1], val = String(cmd[2]);
    var opts = cmd.slice(3).map(String);
    var nx = opts.some(function (o) { return o.toUpperCase() === "NX"; });
    var exIdx = opts.findIndex(function (o) { return o.toUpperCase() === "EX"; });
    var exp = exIdx >= 0 ? t + parseInt(opts[exIdx + 1], 10) : null;
    if (nx) {
      // Only set if missing or expired; return null (like Redis) when the key already exists.
      var r = await db.prepare(
        "INSERT INTO kv (k, v, exp) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, exp = excluded.exp WHERE kv.exp IS NOT NULL AND kv.exp <= ?"
      ).bind(key, val, exp, t).run();
      return r.meta && r.meta.changes > 0 ? "OK" : null;
    }
    await db.prepare("INSERT INTO kv (k, v, exp) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, exp = excluded.exp")
      .bind(key, val, exp).run();
    return "OK";
  }

  if (op === "MGET") {
    var keys = cmd.slice(1), found = {};
    for (var i = 0; i < keys.length; i += 90) {
      var chunk = keys.slice(i, i + 90);
      var q = "SELECT k, v FROM kv WHERE k IN (" + chunk.map(function () { return "?"; }).join(",") + ") AND (exp IS NULL OR exp > ?)";
      var res = await db.prepare(q).bind(...chunk, t).all();
      (res.results || []).forEach(function (row) { found[row.k] = row.v; });
    }
    return keys.map(function (k) { return k in found ? found[k] : null; });
  }

  if (op === "LPUSH") {
    var stmts = cmd.slice(2).map(function (v) {
      return db.prepare("INSERT INTO list_items (name, v) VALUES (?, ?)").bind(cmd[1], String(v));
    });
    await db.batch(stmts);
    var c = await db.prepare("SELECT COUNT(*) AS n FROM list_items WHERE name = ?").bind(cmd[1]).first();
    return c ? c.n : 0;
  }

  if (op === "LRANGE") {
    var start = parseInt(cmd[2], 10), stop = parseInt(cmd[3], 10);
    var limit = stop < 0 ? -1 : stop - start + 1;
    var rows = await db.prepare("SELECT v FROM list_items WHERE name = ? ORDER BY seq DESC LIMIT ? OFFSET ?")
      .bind(cmd[1], limit, start).all();
    return (rows.results || []).map(function (row) { return row.v; });
  }

  if (op === "LTRIM") {
    var keep = parseInt(cmd[3], 10) + 1; // supports the "LTRIM list 0 N" form used here
    await db.prepare(
      "DELETE FROM list_items WHERE name = ? AND seq NOT IN (SELECT seq FROM list_items WHERE name = ? ORDER BY seq DESC LIMIT ?)"
    ).bind(cmd[1], cmd[1], keep).run();
    return "OK";
  }

  throw new Error("Unsupported storage command: " + op);
}

// Run one Redis-style command on whichever storage is connected.
exports.kv = async function (cmd) {
  var db = d1();
  if (db) return d1kv(db, cmd);
  return upstash(cmd);
};
