// lib/insights.js: anonymous, structured conversation insights (AI InsureGenie 3.2).
//
// What is stored: per chat session, the structured answers the visitor gave or confirmed
// (state, situations, vehicle status, start timing, coverage), language, traffic source,
// journey, matched partner and whether they clicked. Per question: a topic label only.
// What is NOT stored: names, phone numbers, emails, IP addresses, or the visitor's own words.
// Visitors who used "Do Not Sell or Share" are never recorded.
"use strict";

function db() { return globalThis.__AIG_D1 || null; }

var ready = null;
function ensure(d) {
  if (!ready) {
    ready = d.batch([
      d.prepare("CREATE TABLE IF NOT EXISTS session_insights (session_id TEXT PRIMARY KEY, day TEXT NOT NULL, state TEXT, situations TEXT, vehicle_status TEXT, start_when TEXT, coverage TEXT, lang TEXT, source TEXT, journey TEXT, matched_partner TEXT, matched INTEGER DEFAULT 0, no_match INTEGER DEFAULT 0, clicked INTEGER DEFAULT 0, call_request INTEGER DEFAULT 0, questions INTEGER DEFAULT 0, updated_at TEXT)"),
      d.prepare("CREATE INDEX IF NOT EXISTS session_insights_day ON session_insights (day)"),
      d.prepare("CREATE TABLE IF NOT EXISTS question_topics (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, session_id TEXT, state TEXT, topic TEXT NOT NULL, answered INTEGER NOT NULL, lang TEXT)"),
      d.prepare("CREATE INDEX IF NOT EXISTS question_topics_day ON question_topics (day)")
    ]).catch(function (e) { ready = null; throw e; });
  }
  return ready;
}

var SITS = ["sr22", "dui", "lapse", "ride", "record", "new", "none"];
var VEH = ["owned", "financed", "leased", "buying", "no_vehicle"];
var WHEN = ["today", "tomorrow", "week", "compare"];
var COV = ["min", "full", "unsure"];

function pick(v, list) { return list.indexOf(v) >= 0 ? v : null; }
function state(v) { return typeof v === "string" && /^[A-Z]{2}$/.test(v) ? v : null; }
function short(v, n) { return typeof v === "string" ? v.replace(/[^\w\-\.]/g, "").slice(0, n) || null : null; }
function sid(v) { return typeof v === "string" && /^[a-z0-9]{6,40}$/i.test(v) ? v : null; }
function today() { return new Date().toISOString().slice(0, 10); }

// Turn a client "insight" object into safe, structured fields. Unknown values are dropped.
function clean(p) {
  p = p && typeof p === "object" ? p : {};
  var sits = Array.isArray(p.sits) ? p.sits.filter(function (k) { return SITS.indexOf(k) >= 0; }) : [];
  return {
    state: state(p.st),
    situations: sits.length ? sits.slice().sort().join(",") : null,
    vehicle_status: pick(p.vs, VEH),
    start_when: pick(p.when, WHEN),
    coverage: pick(p.cov, COV)
  };
}

// Topic labels for a visitor's question. Only the label is stored, never the question.
var TOPICS = [
  ["sr22_duration", /\b(sr-?22|fr-?44)\b.*\b(how long|years?|duration|period|when can i drop)\b|\b(how long|years?)\b.*\b(sr-?22|fr-?44)\b/],
  ["sr22_cost", /\b(sr-?22|fr-?44)\b.*\b(cost|price|fee|how much|cheap)|\b(cost|price|fee|how much|cheap).*\b(sr-?22|fr-?44)\b/],
  ["fr44", /\bfr-?44\b/],
  ["sr22_basics", /\bsr-?22\b/],
  ["non_owner", /\b(non-?owner|don'?t (own|have) a car|without a car|no car)\b/],
  ["lapse", /\b(lapse|gap in|uninsured|no insurance|cancel+ed|cancellation)\b/],
  ["dui", /\b(dui|dwi|owi)\b/],
  ["rideshare", /\b(uber|lyft|rideshare|doordash|delivery|instacart)\b/],
  ["rental", /\b(rent(al|ing)?|hertz|enterprise|avis)\b/],
  ["household_vehicle", /\b(household|parent'?s car|family car|someone else'?s car|borrow(ed|ing)?|shared car)\b/],
  ["financed_leased", /\b(financ|lease|leasing|loan|lender|gap insurance)\b/],
  ["full_coverage", /\b(full coverage|collision|comprehensive)\b/],
  ["state_minimums", /\b(minimum|required by law|legal(ly)? required|state requirement|liability limits?)\b/],
  ["deductible", /\bdeductible\b/],
  ["ticket_accident", /\b(ticket|accident|crash|points|speeding|at fault)\b/],
  ["new_driver", /\b(new driver|teen|first car|first policy|learner|permit|student|young driver)\b/],
  ["rate_increase", /\b(went up|increase|renewal|raised|higher premium)\b/],
  ["save_money", /\b(cheap|cheapest|lower|save|discount|afford)\b/],
  ["compare_quotes", /\b(quote|compare|shop around|which insurer|best insurer)\b/],
  ["claims", /\b(claim|file a claim|adjuster)\b/],
  ["spanish", /\b(seguro|licencia|aseguranza|póliza|poliza)\b/]
];
function topicOf(text) {
  var t = " " + String(text || "").toLowerCase() + " ";
  for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i][1].test(t)) return TOPICS[i][0];
  return "other";
}
// Heuristic: did Genie give a direct answer, or defer? Feeds the weekly "content gaps" list.
function answeredOf(answer) {
  var a = String(answer || "").toLowerCase();
  if (!a) return 0;
  return /(i'?m not (sure|certain)|i don'?t (know|have)|can'?t answer|check with your state'?s|contact your (state|dmv)|varies by state, so|no puedo|no estoy seguro)/.test(a) ? 0 : 1;
}

async function recordSession(sessionId, insight, meta) {
  var d = db(); var id = sid(sessionId);
  if (!d || !id) return false;
  await ensure(d);
  var c = clean(insight); meta = meta || {};
  var flags = { matched: meta.type === "match_shown" ? 1 : 0, no_match: meta.type === "no_match" ? 1 : 0,
    clicked: meta.type === "partner_click" ? 1 : 0, call_request: meta.type === "call_request" ? 1 : 0 };
  await d.prepare(
    "INSERT INTO session_insights (session_id, day, state, situations, vehicle_status, start_when, coverage, lang, source, journey, matched_partner, matched, no_match, clicked, call_request, updated_at) " +
    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16) " +
    "ON CONFLICT(session_id) DO UPDATE SET " +
    "state = COALESCE(excluded.state, state), situations = COALESCE(excluded.situations, situations), " +
    "vehicle_status = COALESCE(excluded.vehicle_status, vehicle_status), start_when = COALESCE(excluded.start_when, start_when), " +
    "coverage = COALESCE(excluded.coverage, coverage), lang = COALESCE(excluded.lang, lang), source = COALESCE(source, excluded.source), " +
    "journey = COALESCE(excluded.journey, journey), matched_partner = COALESCE(excluded.matched_partner, matched_partner), " +
    "matched = MAX(matched, excluded.matched), no_match = MAX(no_match, excluded.no_match), clicked = MAX(clicked, excluded.clicked), " +
    "call_request = MAX(call_request, excluded.call_request), updated_at = excluded.updated_at"
  ).bind(id, today(), c.state, c.situations, c.vehicle_status, c.start_when, c.coverage,
    meta.lang === "es" ? "es" : (meta.lang ? "en" : null), short(meta.source, 40), short(meta.journey, 12),
    short(meta.partner_id, 40), flags.matched, flags.no_match, flags.clicked, flags.call_request, new Date().toISOString()).run();
  return true;
}

async function recordQuestion(sessionId, question, answer, ctx) {
  var d = db(); if (!d) return false;
  await ensure(d);
  ctx = ctx || {};
  var id = sid(sessionId), topic = topicOf(question), ans = answeredOf(answer);
  await d.prepare("INSERT INTO question_topics (day, session_id, state, topic, answered, lang) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(today(), id, state(ctx.state), topic, ans, ctx.lang === "es" ? "es" : "en").run();
  if (id) {
    await d.prepare("INSERT INTO session_insights (session_id, day, questions, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(session_id) DO UPDATE SET questions = questions + 1, updated_at = excluded.updated_at")
      .bind(id, today(), new Date().toISOString()).run();
  }
  return true;
}

// Aggregates for the dashboard and partner/SEO reports. minCount hides small groups.
async function report(days, minCount) {
  var d = db(); if (!d) return null;
  await ensure(d);
  var since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  minCount = minCount || 0;
  async function all(sql, binds) { var r = await d.prepare(sql).bind(...binds).all(); return r.results || []; }
  var totals = (await all("SELECT COUNT(*) AS sessions, SUM(matched) AS matched, SUM(no_match) AS no_match, SUM(clicked) AS clicked, SUM(call_request) AS calls, SUM(questions) AS questions FROM session_insights WHERE day >= ?", [since]))[0] || {};
  var byState = await all("SELECT state, COUNT(*) AS sessions, SUM(clicked) AS clicked FROM session_insights WHERE day >= ? AND state IS NOT NULL GROUP BY state ORDER BY sessions DESC LIMIT 15", [since]);
  var sitRows = await all("SELECT state, situations, vehicle_status, start_when, clicked FROM session_insights WHERE day >= ? AND situations IS NOT NULL", [since]);
  var situations = {}, vehicles = {}, timing = {}, stateSituation = {};
  sitRows.forEach(function (r) {
    r.situations.split(",").forEach(function (k) {
      situations[k] = situations[k] || { sessions: 0, clicked: 0 };
      situations[k].sessions++; situations[k].clicked += r.clicked ? 1 : 0;
      if (r.state) { var key = r.state + ":" + k; stateSituation[key] = (stateSituation[key] || 0) + 1; }
    });
  });
  (await all("SELECT vehicle_status AS k, COUNT(*) AS n FROM session_insights WHERE day >= ? AND vehicle_status IS NOT NULL GROUP BY vehicle_status", [since])).forEach(function (r) { vehicles[r.k] = r.n; });
  (await all("SELECT start_when AS k, COUNT(*) AS n FROM session_insights WHERE day >= ? AND start_when IS NOT NULL GROUP BY start_when", [since])).forEach(function (r) { timing[r.k] = r.n; });
  var bySource = await all("SELECT COALESCE(source, '(none)') AS source, COUNT(*) AS sessions, SUM(clicked) AS clicked FROM session_insights WHERE day >= ? GROUP BY source ORDER BY sessions DESC LIMIT 12", [since]);
  var topics = await all("SELECT topic, COUNT(*) AS asked, SUM(answered) AS answered FROM question_topics WHERE day >= ? GROUP BY topic ORDER BY asked DESC LIMIT 20", [since]);
  var gaps = topics.filter(function (t) { return t.asked - t.answered > 0; })
    .map(function (t) { return { topic: t.topic, unanswered: t.asked - t.answered, asked: t.asked }; })
    .sort(function (a, b) { return b.unanswered - a.unanswered; }).slice(0, 10);
  var hide = function (n) { return n >= minCount; };
  return {
    period_days: days, since: since, min_count: minCount,
    totals: totals,
    by_state: byState.filter(function (r) { return hide(r.sessions); }),
    situations: Object.keys(situations).filter(function (k) { return hide(situations[k].sessions); }).map(function (k) { return { situation: k, sessions: situations[k].sessions, clicked: situations[k].clicked }; }).sort(function (a, b) { return b.sessions - a.sessions; }),
    state_situation: Object.keys(stateSituation).filter(function (k) { return hide(stateSituation[k]); }).map(function (k) { var p = k.split(":"); return { state: p[0], situation: p[1], sessions: stateSituation[k] }; }).sort(function (a, b) { return b.sessions - a.sessions; }).slice(0, 20),
    vehicle_status: vehicles, timing: timing,
    by_source: bySource.filter(function (r) { return hide(r.sessions); }),
    question_topics: topics.filter(function (t) { return hide(t.asked); }),
    content_gaps: minCount ? [] : gaps
  };
}

module.exports = { recordSession, recordQuestion, report, topicOf, answeredOf, clean };
