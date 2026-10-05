import { useState, useRef, useEffect } from "react";

var STORAGE_KEY = "aiinsuregenie-partners-v3";
var SHARED = true;
var IS_PREVIEW = typeof window !== "undefined" && !!window.storage; // true only inside Claude's preview

// Fallback defaults if storage is empty
var DEFAULT_INSURERS = [
  {id:"progressive",n:"Progressive",logo:"🧞",bdg:"BEST VALUE",bc:"#0074D4",r:4.5,base:89,ft:["Snapshot® discount","Name Your Price®","Multi-car discount"],bf:["budget","multi-car","tech","young"],rk:"std",hl:"Most popular for savings",url:"https://progressive.com/auto/",info:"Streamlined online claims in 7-10 days. Fair settlements within 30 days."},
  {id:"geico",n:"GEICO",logo:"🦎",bdg:"LOWEST RATE",bc:"#00875A",r:4.4,base:78,ft:["15-min quotes","Military discount","Good driver discount"],bf:["budget","clean","military","simple"],rk:"std",hl:"Best for clean records",url:"https://geico.com/auto/",info:"24/7 claims, 5-14 day processing. Large repair network."},
  {id:"statefarm",n:"State Farm",logo:"🏠",bdg:"TOP RATED",bc:"#E32636",r:4.7,base:95,ft:["Drive Safe & Save™","Bundle & save 25%","24/7 claims"],bf:["family","bundle","service","homeowner"],rk:"std",hl:"Best service & bundling",url:"https://statefarm.com/auto",info:"#1 claims satisfaction. Agents advocate for you. Generous settlements."},
  {id:"allstate",n:"Allstate",logo:"🤝",bdg:"FORGIVENESS",bc:"#5B2C8E",r:4.3,base:102,ft:["Drivewise® app","Accident forgiveness","New car replacement"],bf:["accidents","family","new-car","comprehensive"],rk:"mod",hl:"Best accident forgiveness",url:"https://allstate.com/auto",info:"Auto-detect accidents via Drivewise. New car replacement if totaled in year 1."},
  {id:"liberty",n:"Liberty Mutual",logo:"🗽",bdg:"CUSTOM",bc:"#BB8C00",r:4.2,base:92,ft:["Custom coverage","Better car replacement","Lifetime repair"],bf:["comprehensive","custom","new-car"],rk:"std",hl:"Most flexible coverage",url:"https://libertymutual.com/auto",info:"Lifetime repair guarantee. Better Car Replacement gives newer model."},
  {id:"usaa",n:"USAA",logo:"⭐",bdg:"MILITARY #1",bc:"#003B6F",r:4.9,base:65,ft:["Military exclusive rates","SafePilot™","Deployment discount"],bf:["military","budget","family"],rk:"std",hl:"Military — lowest rates",url:"https://usaa.com/auto",info:"Highest claims satisfaction. Most generous settlements. Rarely disputes."},
  {id:"lemonade",n:"Lemonade",logo:"🍋",bdg:"DIGITAL",bc:"#FF1493",r:4.1,base:68,ft:["AI claims in 3 min","90-sec signup","Giveback program"],bf:["digital","young","simple","budget"],rk:"std",hl:"Fastest — fully digital",url:"https://lemonade.com/car",info:"AI processes some claims in 3 seconds. Giveback donates unclaimed premiums."},
  {id:"thegeneral",n:"The General",logo:"🎖️",bdg:"HIGH RISK",bc:"#D4380D",r:3.8,base:145,ft:["No credit check","SR-22 included","Instant coverage"],bf:["high-risk","dui","sr22","bad-credit"],rk:"high",hl:"Best for DUI/SR-22",url:"https://thegeneral.com/",info:"Experienced with SR-22 and DUI. 10-21 day processing."},
  {id:"root",n:"Root",logo:"📱",bdg:"USAGE",bc:"#00C48C",r:4.0,base:72,ft:["Save up to 50%","App-based pricing","No hidden fees"],bf:["good-driver","low-mile","digital","young"],rk:"std",hl:"Pay how you drive",url:"https://joinroot.com/",info:"App-based claims. Good drivers get best experience."},
  {id:"nationwide",n:"Nationwide",logo:"🏛️",bdg:"RELIABLE",bc:"#1B365D",r:4.3,base:98,ft:["Vanishing deductible","On Your Side®","SmartRide®"],bf:["family","comprehensive","loyalty"],rk:"std",hl:"Rewards loyalty",url:"https://nationwide.com/auto",info:"Vanishing deductible decreases yearly. Fair and consistent settlements."},
];

// Convert dashboard partner format → chatbot insurer format
function dashboardToInsurer(dp) {
  return {
    id: dp.id,
    n: dp.name,
    logo: dp.logo,
    bdg: dp.badge,
    bc: dp.bc,
    r: dp.rating || 4.0,
    base: dp.base !== undefined ? dp.base : Math.round(60 + (dp.payout || 5) * 3), // on-screen estimate only
    ft: dp.features ? dp.features.split(",").map(function(f){return f.trim();}).filter(Boolean) : ["Competitive rates", "Fast quotes", "24/7 support"],
    bf: [dp.bestFor || "budget", "clean", "family"],
    rk: "std",
    hl: dp.badge + " — " + dp.name,
    url: dp.link || "#",
    info: dp.name + " offers competitive auto insurance rates with easy online quoting.",
    supportsPrefill: dp.supportsPrefill === true, // defaults to false/unverified unless explicitly confirmed in dashboard
    logoUrl: dp.logoUrl || "",
    tag: dp.customTag || "",
    featured: dp.featured === true,
    pinned: dp.pinned === true,
    priority: dp.priority || 3,
    boost: dp.boost || 0,
  };
}

// Where do the partners come from?
//  - Claude preview: the shared storage the dashboard writes to (demo placeholders if empty)
//  - Your live site: your backend (/api/partners). Placeholder brands are NEVER shown to real visitors.
async function loadInsurers() {
  if (IS_PREVIEW) {
    try {
      var result = await window.storage.get(STORAGE_KEY, SHARED);
      if (result && result.value) {
        var enabled = JSON.parse(result.value).filter(function(p) { return p.enabled; });
        if (enabled.length > 0) return enabled.map(dashboardToInsurer);
      }
    } catch(e) { /* nothing saved yet */ }
    return DEFAULT_INSURERS;
  }
  try {
    var res = await fetch(API_BASE + "/api/partners");
    if (res.ok) {
      var data = await res.json();
      if (data && Array.isArray(data.partners)) return data.partners.map(dashboardToInsurer);
    }
  } catch(e) { /* backend unreachable */ }
  return null; // keep whatever we already had
}

// Global mutable reference that gets updated
var INSURERS = IS_PREVIEW ? DEFAULT_INSURERS : [];

const ZIP_STATES = {"AL":[35000,36999],"AK":[99500,99999],"AZ":[85000,86599],"AR":[71600,72999],"CA":[90000,96699],"CO":[80000,81699],"CT":[6000,6999],"DE":[19700,19999],"FL":[32000,34999],"GA":[30000,31999],"HI":[96700,96899],"ID":[83200,83899],"IL":[60000,62999],"IN":[46000,47999],"IA":[50000,52899],"KS":[66000,67999],"KY":[40000,42799],"LA":[70000,71499],"ME":[3900,4999],"MD":[20600,21999],"MA":[1000,2799],"MI":[48000,49999],"MN":[55000,56799],"MS":[38600,39799],"MO":[63000,65899],"MT":[59000,59999],"NE":[68000,69399],"NV":[88900,89899],"NH":[3000,3899],"NJ":[7000,8999],"NM":[87000,88499],"NY":[10000,14999],"NC":[27000,28999],"ND":[58000,58899],"OH":[43000,45999],"OK":[73000,74999],"OR":[97000,97999],"PA":[15000,19699],"RI":[2800,2999],"SC":[29000,29999],"SD":[57000,57799],"TN":[37000,38599],"TX":[75000,79999],"UT":[84000,84799],"VT":[5000,5999],"VA":[22000,24699],"WA":[98000,99499],"WV":[24700,26899],"WI":[53000,54999],"WY":[82000,83199],"DC":[20000,20599]};

function vZip(z) {
  var c = z.replace(/\D/g, "");
  if (c.length !== 5) return { ok: false, e: "Enter a valid 5-digit US ZIP code." };
  var n = parseInt(c);
  for (var st of Object.keys(ZIP_STATES)) {
    if (n >= ZIP_STATES[st][0] && n <= ZIP_STATES[st][1]) return { ok: true, v: c, st: st };
  }
  return { ok: false, e: "That ZIP doesn't match a US state. Check the 5 digits and try again." };
}
function vPhone(p) {
  var c = p.replace(/\D/g, "");
  var d = c.length === 11 && c[0] === "1" ? c.slice(1) : c;
  if (d.length !== 10) return { ok: false, e: "Enter a valid 10-digit US phone number." };
  if ("01".includes(d[0])) return { ok: false, e: "US numbers can't start with 0 or 1." };
  if (/^(\d)\1{9}$/.test(d)) return { ok: false, e: "That looks like a test number." };
  if (d.slice(3, 6) === "555") return { ok: false, e: "555 numbers aren't real." };
  return { ok: true, v: d, fmt: "(" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6) };
}
function vEmail(e) {
  var t = e.trim().toLowerCase();
  if (!t || !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(t)) return { ok: false, e: "Enter a valid email." };
  var bad = ["mailinator.com","guerrillamail.com","tempmail.com","yopmail.com","maildrop.cc"];
  if (bad.includes(t.split("@")[1])) return { ok: false, e: "Use a real email." };
  return { ok: true, v: t };
}
function vName(v) {
  var t = v.trim();
  if (t.length < 2) return { ok: false, e: "Enter at least 2 characters." };
  if (/\d/.test(t)) return { ok: false, e: "Names shouldn't have numbers." };
  if (["test","asdf","fake","null","none"].includes(t.toLowerCase())) return { ok: false, e: "Enter your real name." };
  return { ok: true, v: t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() };
}

function isQuestion(text, phase, stepId) {
  var t = text.trim().toLowerCase();
  if (t.length < 3) return false;
  var hasQM = t.includes("?");
  var qWords = ["what","how","why","tell me","explain","can you","should i","compare","difference","about the","want to know","more about","know more"];
  var startsQ = qWords.some(function(w) { return t.startsWith(w); });
  var hasQ = qWords.some(function(w) { return t.includes(w); });
  var insTerms = ["claim","settlement","coverage","deductible","premium","discount","sr-22","sr22","liability","collision","comprehensive","insurance","policy","rate"].some(function(w) { return t.includes(w); });
  var mentionsIns = INSURERS.some(function(ins) { return t.includes(ins.n.toLowerCase()); });
  if (hasQM && t.split(" ").length >= 3) return true;
  if (startsQ && t.split(" ").length >= 3) return true;
  if (hasQ && (insTerms || mentionsIns)) return true;
  if (hasQ && t.split(" ").length >= 5) return true;
  if (phase === "pii" && stepId === "firstName" && (t.split(" ").length > 3 || insTerms || mentionsIns)) return true;
  if (phase === "pii" && stepId === "phone" && t.replace(/\D/g, "").length < 7 && t.split(" ").length > 3) return true;
  if (phase === "pii" && stepId === "email" && !t.includes("@") && t.split(" ").length > 2) return true;
  return false;
}

function staticAnswer(text) {
  var t = text.toLowerCase();
  for (var i = 0; i < INSURERS.length; i++) {
    var ins = INSURERS[i];
    if (t.includes(ins.n.toLowerCase()) || t.includes(ins.id)) {
      return "Here's what I know about **" + ins.n + "** (" + ins.r + "/5 stars):\n\n" + ins.info + "\n\n**Key features:** " + ins.ft.join(", ") + "\n\n" + ins.hl + ". Anything else?";
    }
  }
  if (t.includes("deductible")) return "A **deductible** is what you pay before insurance kicks in.\n\n$250 = higher premium, less out-of-pocket per claim\n$500 = most popular balanced option\n$1,000 = lowest premium, saves $200-400/yr\n\nSafe drivers with savings benefit from higher deductibles.";
  if (t.includes("coverage") && (t.includes("type") || t.includes("what") || t.includes("include"))) return "**Minimum** — Liability only (state required). Covers others.\n**Standard** — Adds collision + uninsured motorist.\n**Full/Comprehensive** — Everything + theft, weather, rental, roadside.\n\nWant me to adjust your coverage level?";
  if (t.includes("sr-22") || t.includes("sr22")) return "**SR-22** is a certificate required after DUI or serious violations. The General, Progressive, and some State Farm offices handle SR-22. Adds ~$20-50/month for 3 years.";
  if (t.includes("cheap") || t.includes("save") || t.includes("discount") || t.includes("lower")) return "Best ways to lower your rate:\n\nRaise deductible to $1,000+ (saves 15-25%)\nBundle home + auto (saves up to 25%)\nLow-mileage discount if you drive under 10k mi/yr\nDefensive driving course (5-10% off)\nGood student discount (10-25% off)\n\nReady for personalized quotes? Say **get my quotes**!";
  if (t.includes("bundle") || t.includes("home and auto")) return "**Bundling** home/renters + auto saves **15-25%**. Best for bundling: State Farm (up to 25% off), Allstate (multi-policy + Drivewise), Nationwide (vanishing deductible), Liberty Mutual (flexible bundles).";
  if (t.includes("gap")) return "**Gap insurance** covers the difference between what you owe and your car's value if totaled. Important if you owe more than the car is worth. Progressive, Liberty Mutual, and Allstate offer it.";
  if (t.includes("new driver") || t.includes("teen") || t.includes("first time")) return "Young/new drivers pay more, but can save with:\n\nGood student discount (3.0+ GPA saves 10-25%)\nDefensive driving course (5-10% off)\nUsage-based programs (Root, Progressive)\nBeing on a parent's policy\n\nGEICO, Progressive, and Lemonade usually have the best young driver rates.";
  return null;
}

// ---------------------------------------------------------------
// AI BRAIN: calls YOUR backend proxy (/api/chat), which holds the Claude API key.
// Set CHAT_URL to your deployed backend, e.g. https://api.aiinsuregenie.com/api/chat
// (or your *.vercel.app URL until the custom domain is connected).
// ---------------------------------------------------------------

// Conversation memory: last turns of Q&A, sent with each question.
var convoHistory = [];

// Only non-personal fields ever leave the browser for the AI. Never name/phone/email.
function safeProfile(p) {
  var keys = ["state", "age", "vehicleYear", "vehicleMake", "driving", "coverage", "insured", "homeowner", "military", "multiCar", "priority"];
  var out = {};
  keys.forEach(function (k) { if (p && p[k] !== undefined && p[k] !== null) out[k] = p[k]; });
  return out;
}

async function aiAnswer(msg, profile, results) {
  var payload = {
    message: msg,
    history: convoHistory.slice(-8),
    profile: safeProfile(profile),
    results: (results || []).map(function (r) { return { n: r.n }; })
  };

  // 1) Production path: your secure backend proxy
  try {
    var res = await fetch(API_BASE + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      var data = await res.json();
      if (data && data.answer) return data.answer;
    }
  } catch (e) { /* fall through */ }

  // 2) Claude.ai preview path: direct call works only inside Claude artifacts.
  //    On your real website this fails harmlessly and the friendly fallback is shown.
  try {
    var sys = "You are AI InsureGenie, a friendly US auto insurance advisor. Only answer auto insurance questions. Keep answers to 2-3 short paragraphs. Use **bold** for key terms. Never guarantee prices. Not a licensed agent.";
    var msgs = convoHistory.slice(-8).concat([{ role: "user", content: msg }]);
    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 600, system: sys, messages: msgs })
    });
    var d2 = await response.json();
    if (d2 && d2.content) {
      var text = "";
      for (var i = 0; i < d2.content.length; i++) { if (d2.content[i].text) text += d2.content[i].text; }
      return text || null;
    }
  } catch (err) { /* fall through */ }
  return null;
}

async function getAnswer(text, profile, results) {
  var s = staticAnswer(text);
  var answer = s || await aiAnswer(text, profile, results);
  if (!answer) {
    return "I can help with coverage types, insurer comparisons, discounts, SR-22, deductibles, and more. Could you rephrase? Or say **get my quotes** for personalized rates!";
  }
  // Remember this exchange so follow-up questions make sense
  convoHistory.push({ role: "user", content: text });
  convoHistory.push({ role: "assistant", content: answer });
  if (convoHistory.length > 16) convoHistory = convoHistory.slice(-16);
  return answer;
}

function calcPremium(ins, p) {
  var b = ins.base;
  if (p.age) { if (p.age < 25) b *= 1.45; else if (p.age > 60) b *= 1.12; }
  if (p.driving === "minor") b *= 1.25; else if (p.driving === "major") b *= 1.55; else if (p.driving === "dui") b *= 2;
  if (p.coverage === "minimum") b *= 0.55; else if (p.coverage === "full") b *= 1.3;
  if (p.insured === "no") b *= 1.18;
  if (p.multiCar === "yes") b *= 0.85;
  if (p.homeowner === "yes" && ["statefarm","allstate","nationwide"].includes(ins.id)) b *= 0.87;
  if (p.military === "yes" && ins.id === "usaa") b *= 0.68;
  return Math.round(b);
}

function matchInsurers(p) {
  return INSURERS.map(function(ins) {
    var s = 0;
    if (p.driving === "dui" || p.driving === "major") s += ins.rk === "high" ? 50 : ins.rk === "mod" ? 20 : -5;
    if (p.military === "yes") { s += ins.bf.includes("military") ? 45 : 0; } else { if (ins.id === "usaa") s -= 100; }
    if (p.priority === "price" && ins.bf.includes("budget")) s += 30;
    if (p.priority === "coverage" && ins.bf.includes("comprehensive")) s += 30;
    if (p.priority === "service" && ins.bf.includes("service")) s += 30;
    if (p.homeowner === "yes" && ins.bf.includes("bundle")) s += 20;
    if (p.multiCar === "yes" && ins.bf.includes("multi-car")) s += 20;
    if (p.age && p.age < 25 && ins.bf.includes("young")) s += 15;
    // Dashboard promotion controls: priority (1 = first), boost, and pin
    s += (6 - (ins.priority || 3)) * 5 + (ins.boost || 0);
    if (ins.pinned) s += 1000;
    var premium = calcPremium(ins, p);
    var savings = Math.max(Math.round((220 - premium) * 12), Math.round(80 + Math.random() * 200));
    return Object.assign({}, ins, { s: s, premium: premium, savings: savings });
  }).sort(function(a, b) { return b.s - a.s; }).filter(function(x) { return x.s > -50; }).slice(0, 4);
}

// Builds the button link. Anything already in the partner's link (like ?aid=123) is kept.
// Personal details are added ONLY for partners marked "pre-fill verified". Everyone else gets tracking tags only.
function buildUrl(ins, p) {
  var base = ins.url || "";
  var u;
  try { u = new URL(base); } catch (e) { return base || "#"; }
  if (ins.supportsPrefill) {
    ["zip","state","firstName","phone","email","age","vehicleYear","vehicleMake","coverage"].forEach(function(k) { if (p[k]) u.searchParams.set(k, p[k]); });
  }
  u.searchParams.set("utm_source", "aiinsuregenie");
  u.searchParams.set("utm_campaign", ins.id);
  return u.toString();
}

var STEPS = [
  {id:"zip",f:"zip",q:"What's your ZIP code?",t:"text",ph:"5-digit US ZIP",vl:vZip},
  {id:"age",f:"age",q:"How old are you?",t:"qr",opts:["18-24","25-34","35-44","45-54","55-64","65+"],vl:function(v){var m={"18-24":21,"25-34":30,"35-44":40,"45-54":50,"55-64":60,"65+":68};if(m[v])return{ok:true,v:m[v]};var n=parseInt(v);return n>=16&&n<=99?{ok:true,v:n}:{ok:false,e:"Enter age 16-99."};}},
  {id:"vyear",f:"vehicleYear",q:"What year is your vehicle?",t:"qr",opts:["2024-2025","2020-2023","2015-2019","2010-2014","Before 2010"],ps:function(v){if(v.includes("2024"))return "2024";if(v.includes("2020"))return "2022";if(v.includes("2015"))return "2017";if(v.includes("2010"))return "2012";if(v.includes("Before"))return "2008";return v;}},
  {id:"vmake",f:"vehicleMake",q:"What make is your car?",t:"qr",opts:["Toyota","Honda","Ford","Chevrolet","BMW","Tesla","Other"]},
  {id:"vmake2",f:"vehicleMake",q:"What brand is your vehicle?",t:"text",ph:"e.g. Hyundai, Kia, Subaru...",cond:function(p){return p.vehicleMake==="Other";}},
  {id:"ins",f:"insured",q:"Are you currently insured?",t:"qr",opts:["Yes, I'm insured","No, not right now"],ps:function(v){return v.toLowerCase().includes("yes")?"yes":"no";}},
  {id:"curins",f:"currentInsurer",q:"Who's your current insurer?",t:"qr",opts:["GEICO","State Farm","Progressive","Allstate","Liberty Mutual","Other"],cond:function(p){return p.insured==="yes";}},
  {id:"curins2",f:"currentInsurer",q:"What's the name of your current insurer?",t:"text",ph:"e.g. Farmers, Travelers, Erie...",cond:function(p){return p.insured==="yes"&&p.currentInsurer==="Other";}},
  {id:"drv",f:"driving",q:"Driving record in the past 3 years?",t:"qr",opts:["Clean — no issues","Minor (1-2 tickets)","Major (accident)","DUI / SR-22"],ps:function(v){var l=v.toLowerCase();if(l.includes("clean"))return "clean";if(l.includes("minor"))return "minor";if(l.includes("major"))return "major";return "dui";}},
  {id:"cov",f:"coverage",q:"What coverage level?",t:"qr",opts:["Minimum (state required)","Standard (liability + collision)","Full (comprehensive)"],ps:function(v){var l=v.toLowerCase();if(l.includes("min"))return "minimum";if(l.includes("full")||l.includes("comp"))return "full";return "standard";}},
  {id:"mil",f:"military",q:"Active military or veteran?",t:"qr",opts:["Yes","No"],ps:function(v){return v.toLowerCase().includes("yes")?"yes":"no";}},
  {id:"home",f:"homeowner",q:"Do you own your home? Some insurers discount for bundling home and auto.",t:"qr",opts:["Yes, homeowner","No, renting"],ps:function(v){return v.toLowerCase().includes("yes")||v.toLowerCase().includes("own")?"yes":"no";}},
  {id:"cars",f:"multiCar",q:"Insuring more than one vehicle?",t:"qr",opts:["Yes, multiple","Just one"],ps:function(v){return v.toLowerCase().includes("yes")||v.toLowerCase().includes("multi")?"yes":"no";}},
  {id:"pri",f:"priority",q:"What matters most to you?",t:"qr",opts:["Lowest price","Best coverage","Best service"],ps:function(v){var l=v.toLowerCase();if(l.includes("price")||l.includes("low"))return "price";if(l.includes("coverage"))return "coverage";return "service";}},
];

var PII_STEPS = [
  {id:"firstName",f:"firstName",q:"What's your first name?",ph:"First name",vl:vName},
  {id:"phone",f:"phone",q:"Best phone number to reach you?",ph:"(555) 123-4567",vl:vPhone},
  {id:"email",f:"email",q:"What's your email address?",ph:"you@email.com",vl:vEmail},
];

// ---------------------------------------------------------------
// API base: ONE place to change when your backend is live.
// Use your *.vercel.app backend URL until aiinsuregenie.com is connected.
// ---------------------------------------------------------------
var API_BASE = (typeof window !== "undefined" && window.AIG_CONFIG && window.AIG_CONFIG.apiBase) || "https://api.aiinsuregenie.com";

function nowTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Formats digits as (555) 123-4567 while typing. Leaves typed questions alone.
function fmtPhone(raw) {
  if (!/^[\d\s()\-+.]*$/.test(raw)) return raw;
  var d = raw.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return "(" + d.slice(0, 3) + ") " + d.slice(3);
  return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
}

// The consent text the user SEES is the exact text we store with the lead.
function buildConsent(names) {
  var shown = names.slice(0, 6).join(", ") + (names.length > 6 ? ", and others" : "");
  var list = names.length ? " (" + shown + ")" : "";
  return "I agree that AI InsureGenie and its insurance partners" + list + " may contact me by phone, text message, and email about insurance quotes, including with automated technology. Consent is not required to buy anything, and I can withdraw it at any time.";
}
var CONSENT_LINKS = " I have read the Privacy Policy and Terms of Service.";
var CALL_CONSENT = "I agree that a licensed insurance agent may call me at this number about insurance quotes. Consent is not required to buy anything.";

function basisLine(p) {
  var rec = { clean: "clean record", minor: "minor violations", major: "at-fault accident", dui: "DUI/SR-22" };
  var parts = [];
  if (p.zip) parts.push("ZIP " + p.zip + (p.state ? " (" + p.state + ")" : ""));
  if (p.vehicleMake && p.vehicleMake !== "Other") parts.push(p.vehicleMake);
  if (p.driving && rec[p.driving]) parts.push(rec[p.driving]);
  return parts.length ? "Based on: " + parts.join(", ") : "";
}

// ---------------------------------------------------------------
// Styles
// ---------------------------------------------------------------
var CSS_TEXT = [
  "@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap');",
  "html,body{margin:0}",
  ".ig{--bg:#EEF2F6;--ink:#16202E;--ink2:#4B5B6E;--mute:#5F6E80;--line:#DDE3EA;--edge:#C5CEDA;--brand:#0F766E;--brand-d:#0B5F59;--brand-t:#E6F4F2;--bot:#EEF2F6;--warn:#B42318;--warn-t:#FDECEA}",
  ".ig,.ig *{box-sizing:border-box}",
  ".ig p,.ig h2{margin:0}",
  ".ig{min-height:100vh;min-height:100dvh;background:var(--bg);color:var(--ink);font-family:'Figtree',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;justify-content:center;-webkit-font-smoothing:antialiased}",
  ".ig button,.ig input{font-family:inherit}",
  ".ig-card{width:100%;max-width:520px;height:100vh;height:100dvh;display:flex;flex-direction:column;background:#fff;position:relative}",
  "@media (min-width:640px){.ig{padding:24px;align-items:center}.ig-card{height:min(780px,calc(100dvh - 48px));border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(22,32,46,.06),0 14px 36px rgba(22,32,46,.09)}}",
  ".ig button:focus-visible,.ig a:focus-visible,.ig input:focus-visible{outline:2px solid #1D4ED8;outline-offset:2px}",
  ".hd{display:flex;align-items:center;gap:12px;padding:12px 16px;flex:none}",
  ".av{width:40px;height:40px;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center;flex:none}",
  ".hd-txt{min-width:0;flex:1}",
  ".hd-name{font-weight:700;font-size:16px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".hd-sub{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ink2)}",
  ".dot{width:8px;height:8px;border-radius:50%;background:#16A34A;flex:none}",
  ".hd-btn{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border:1px solid var(--edge);border-radius:20px;background:#fff;color:var(--ink);font-size:14px;font-weight:600;cursor:pointer;flex:none}",
  ".hd-btn:hover{background:#F5F7FA}",
  ".hd-btn .lbl-s{display:none}",
  "@media (max-width:440px){.hd-btn .lbl-l{display:none}.hd-btn .lbl-s{display:inline}}",
  ".prog{height:3px;background:#E6EBF0;flex:none}.prog>div{height:100%;background:var(--brand);transition:width .4s ease}",
  ".log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:8px 16px 16px;display:flex;flex-direction:column}",
  ".row{display:flex;flex-direction:column;margin-top:4px;animation:in .18s ease-out}",
  ".row.first{margin-top:16px}.row.after{margin-top:14px}",
  ".row.user{align-items:flex-end}.row.bot{align-items:flex-start}",
  ".who{font-size:13px;color:var(--mute);margin:0 0 4px 2px}",
  ".bub{max-width:86%;padding:10px 14px;border-radius:18px;font-size:15px;line-height:1.5;white-space:pre-line;overflow-wrap:anywhere}",
  ".bot .bub{background:var(--bot);border-bottom-left-radius:6px}",
  ".user .bub{background:var(--brand);color:#fff;border-bottom-right-radius:6px;max-width:80%}",
  ".bub.err{background:var(--warn-t);color:#7A1A12}",
  ".time{font-size:12px;color:var(--mute);margin:4px 4px 0}",
  ".basis{font-size:13px;color:var(--mute);margin:8px 2px 0}",
  ".typing{align-self:flex-start;display:flex;gap:5px;margin-top:8px;padding:15px 16px;background:var(--bot);border-radius:18px 18px 18px 6px}",
  ".typing i{width:7px;height:7px;border-radius:50%;background:#7C8A9A;animation:blink 1.2s infinite}",
  ".typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}",
  ".quotes{width:100%;display:flex;flex-direction:column;gap:10px;margin-top:8px}",
  ".quote{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fff}",
  ".q-top{display:flex;align-items:center;gap:12px}",
  ".q-logo{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;font-weight:700;color:var(--ink);flex:none}",
  ".q-logo.img{width:auto;min-width:48px;max-width:120px;height:48px;padding:6px;background:#fff;border:1px solid var(--line)}",
  ".q-logo img{display:block;width:auto;height:auto;max-width:108px;max-height:36px;object-fit:contain}",
  ".q-id{min-width:0;flex:1}",
  ".q-name{font-weight:700;font-size:16px;line-height:1.25;overflow-wrap:anywhere}",
  ".q-meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:13px;color:var(--ink2);margin-top:2px}",
  ".q-rate{display:inline-flex;align-items:center;gap:4px}.q-rate svg{color:#D97706}",
  ".q-tag{font-size:12px;font-weight:600;padding:2px 8px;border-radius:10px;background:var(--brand-t);color:var(--brand-d)}",
  ".q-tag.sp{background:#EEF1F5;color:var(--ink2)}",
  ".q-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px;margin-top:12px}",
  ".amt{display:inline-block;font-size:26px;line-height:1.1;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.01em}",
  ".amt.blur{filter:blur(6px);user-select:none}",
  ".per{font-size:13px;line-height:1.3;color:var(--mute)}",
  ".q-feat{font-size:14px;line-height:1.45;color:var(--ink2);margin-top:8px}",
  ".btn{display:flex;align-items:center;justify-content:center;min-height:46px;width:100%;padding:0 16px;border:0;border-radius:12px;font-size:15px;font-weight:600;text-decoration:none;cursor:pointer;margin-top:12px}",
  ".btn-p{background:var(--brand);color:#fff}.btn-p:hover{background:var(--brand-d)}",
  ".btn:disabled{background:#D5DCE4;color:#5F6E80;cursor:not-allowed}",
  ".q-note{font-size:12px;line-height:1.4;color:var(--mute);text-align:center;margin-top:6px}",
  ".consent{margin-top:12px;border:1px solid var(--line);border-radius:14px;padding:14px}",
  ".consent label{display:flex;gap:12px;align-items:flex-start;cursor:pointer}",
  ".consent input{width:22px;height:22px;margin:1px 0 0;accent-color:var(--brand);flex:none}",
  ".consent span{font-size:13px;line-height:1.5;color:var(--ink2)}",
  ".consent a{color:var(--brand-d);text-decoration:underline}",
  ".foot{flex:none;border-top:1px solid var(--line);padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:#fff}",
  ".chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}",
  ".chip{min-height:40px;padding:0 14px;border:1px solid var(--edge);border-radius:20px;background:#fff;color:var(--ink);font-size:14px;font-weight:600;cursor:pointer;text-align:left}",
  ".chip:hover{border-color:var(--brand);background:var(--brand-t)}",
  ".chip.pri{background:var(--brand);border-color:var(--brand);color:#fff}.chip.pri:hover{background:var(--brand-d)}",
  ".comp{display:flex;align-items:center;gap:8px;border:1px solid var(--edge);border-radius:24px;padding:4px 4px 4px 16px;background:#fff}",
  ".comp:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px rgba(15,118,110,.18)}",
  ".comp input{flex:1;min-width:0;height:40px;border:0;background:transparent;font-size:16px;color:var(--ink)}",
  ".ig .comp input:focus-visible{outline:none}",
  ".send{width:40px;height:40px;border:0;border-radius:50%;background:var(--brand);color:#fff;display:grid;place-items:center;cursor:pointer;flex:none}",
  ".send:disabled{background:#C9D2DC;cursor:default}",
  ".linkbtn{display:block;margin:6px auto 0;padding:6px 8px;border:0;background:none;color:var(--brand-d);font-size:13px;text-decoration:underline;cursor:pointer}",
  ".disc{font-size:12px;line-height:1.45;color:var(--mute);text-align:center;margin-top:8px}",
  ".ov{position:fixed;inset:0;background:rgba(22,32,46,.5);z-index:50;display:flex;align-items:flex-end;justify-content:center}",
  ".dlg{background:#fff;width:100%;max-width:440px;max-height:92vh;max-height:92dvh;overflow:auto;border-radius:18px 18px 0 0;padding:20px}",
  "@media (min-width:640px){.ov{align-items:center}.dlg{border-radius:18px}}",
  ".dlg-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}",
  ".dlg h2{font-size:20px;line-height:1.25}",
  ".dlg .sub{font-size:14px;line-height:1.45;color:var(--ink2);margin-top:4px}",
  ".x{width:40px;height:40px;border:0;border-radius:50%;background:#F1F4F7;color:var(--ink);display:grid;place-items:center;cursor:pointer;flex:none}",
  ".fld{margin-bottom:14px}",
  ".fld label,.fld .lbl{display:block;font-size:14px;font-weight:600;margin-bottom:6px}",
  ".fld input{width:100%;height:46px;padding:0 14px;border:1px solid var(--edge);border-radius:12px;font-size:16px;color:var(--ink)}",
  ".fld input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px rgba(15,118,110,.18)}",
  ".seg{display:flex;flex-wrap:wrap;gap:8px}",
  ".seg button{min-height:40px;padding:0 14px;border:1px solid var(--edge);border-radius:20px;background:#fff;color:var(--ink);font-size:14px;font-weight:600;cursor:pointer}",
  ".seg button[aria-pressed='true']{background:var(--brand-t);border-color:var(--brand);color:var(--brand-d)}",
  ".agree{display:flex;gap:12px;align-items:flex-start;font-size:13px;line-height:1.5;color:var(--ink2);cursor:pointer;margin-bottom:12px}",
  ".agree input{width:22px;height:22px;margin:1px 0 0;accent-color:var(--brand);flex:none}",
  ".errmsg{font-size:14px;line-height:1.4;color:var(--warn);margin-bottom:10px}",
  ".done{text-align:center;padding:8px 0}",
  ".tick{width:48px;height:48px;border-radius:50%;background:var(--brand-t);color:var(--brand-d);display:grid;place-items:center;margin:0 auto 12px}",
  "@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
  "@keyframes blink{0%,60%,100%{opacity:.35}30%{opacity:1}}",
  "@media (prefers-reduced-motion:reduce){.ig *{animation:none!important;transition:none!important}}"
].join("\n");

// ---------------------------------------------------------------
// Icons (inline SVG so they look identical on every device)
// ---------------------------------------------------------------
var ICONS = {
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
  send: "M12 19V5M5 12l7-7 7 7",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  shield: "M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6l7-3z M9 12l2 2 4-4",
  close: "M18 6L6 18M6 6l12 12",
  check: "M20 6L9 17l-5-5"
};
function Icon(props) {
  var size = props.size || 18;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={props.fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[props.n]} />
    </svg>
  );
}

// ---------------------------------------------------------------
// One insurer quote row
// ---------------------------------------------------------------
function QuoteCard({ ins, locked }) {
  var [logoBroken, setLogoBroken] = useState(false);
  var showLogo = !!ins.logoUrl && !logoBroken;
  var feats = (ins.ft || []).slice(0, 3).join(", ");
  var sponsored = !!(ins.pinned || ins.featured);
  var tag = sponsored ? "Sponsored" : (ins.tag || "");
  return (
    <article className="quote" aria-label={ins.n + " estimate"}>
      <div className="q-top">
        <div className={"q-logo" + (showLogo ? " img" : "")} style={showLogo ? undefined : { background: ins.bc + "26" }} aria-hidden="true">
          {showLogo ? <img src={ins.logoUrl} alt="" onError={function () { setLogoBroken(true); }} /> : (ins.n || "?").charAt(0)}
        </div>
        <div className="q-id">
          <div className="q-name">{ins.n}</div>
          <div className="q-meta">
            <span className="q-rate"><Icon n="star" fill size={13} />{ins.r}</span>
            {tag ? <span className={"q-tag" + (sponsored ? " sp" : "")}>{tag}</span> : null}
          </div>
        </div>
      </div>
      <div className="q-price">
        <span className={"amt" + (locked ? " blur" : "")}>{"$" + ins.premium}</span>
        <span className="per">{locked ? "shown after you connect" : "per month, estimate"}</span>
      </div>
      {feats ? <p className="q-feat">{feats}</p> : null}
      {!locked ? (
        <div>
          <a className="btn btn-p" href={ins.rUrl || "#"} target="_blank" rel="noopener noreferrer sponsored">
            {ins.supportsPrefill ? "Continue to " + ins.n : "Get my quote from " + ins.n}
          </a>
          <p className="q-note">
            {ins.supportsPrefill ? "Your details carry over to their form." : "Opens in a new tab. You may need to re-enter some details."}
          </p>
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------
// Talk-to-an-agent dialog (mounts fresh each time it opens)
// ---------------------------------------------------------------
function CallModal({ profile, onClose, onSent }) {
  var [name, setName] = useState(profile.firstName || "");
  var [phone, setPhone] = useState(profile.phone ? fmtPhone(profile.phone) : "");
  var [when, setWhen] = useState("As soon as possible");
  var [agree, setAgree] = useState(false);
  var [err, setErr] = useState("");
  var [sending, setSending] = useState(false);
  var [done, setDone] = useState(false);

  useEffect(function () {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return function () { document.removeEventListener("keydown", onKey); };
  }, []);

  var submit = async function () {
    if (name.trim().length < 2) { setErr("Enter your first name."); return; }
    var r = vPhone(phone);
    if (!r.ok) { setErr(r.e); return; }
    if (!agree) { setErr("Check the box to let an agent call you."); return; }
    setErr(""); setSending(true);
    try {
      var res = await fetch(API_BASE + "/api/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), phone: r.v, preferred_time: when,
          zip: profile.zip || null, state: profile.state || null,
          consent_text: CALL_CONSENT, consent_timestamp: new Date().toISOString(),
          landing_page: window.location.href
        })
      });
      if (!res.ok) throw new Error("bad status");
      setDone(true);
      if (onSent) onSent({ name: name.trim(), phone: r.v });
    } catch (e) {
      setErr("We couldn't send your request. Please try again in a moment.");
    }
    setSending(false);
  };

  return (
    <div className="ov" onClick={function (e) { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="call-h">
        <div className="dlg-hd">
          <div>
            <h2 id="call-h">{done ? "Request received" : "Talk to a licensed agent"}</h2>
            {!done ? <p className="sub">Leave your number and an agent will call you. It's free and there's no obligation.</p> : null}
          </div>
          <button type="button" className="x" aria-label="Close" onClick={onClose}><Icon n="close" size={18} /></button>
        </div>
        {done ? (
          <div className="done">
            <div className="tick"><Icon n="check" size={24} /></div>
            <p>{"An agent will call " + phone + " (" + when.toLowerCase() + ")."}</p>
            <button type="button" className="btn btn-p" onClick={onClose}>Done</button>
          </div>
        ) : (
          <div>
            <div className="fld">
              <label htmlFor="c-name">First name</label>
              <input id="c-name" value={name} onChange={function (e) { setName(e.target.value); }} autoComplete="given-name" autoCapitalize="words" />
            </div>
            <div className="fld">
              <label htmlFor="c-phone">Phone number</label>
              <input id="c-phone" value={phone} onChange={function (e) { setPhone(fmtPhone(e.target.value)); }} inputMode="tel" autoComplete="tel" placeholder="(555) 123-4567" />
            </div>
            <div className="fld">
              <span className="lbl" id="c-when">Best time to call</span>
              <div className="seg" role="group" aria-labelledby="c-when">
                {["As soon as possible", "Morning", "Afternoon", "Evening"].map(function (x) {
                  return <button type="button" key={x} aria-pressed={when === x} onClick={function () { setWhen(x); }}>{x}</button>;
                })}
              </div>
            </div>
            <label className="agree">
              <input type="checkbox" checked={agree} onChange={function (e) { setAgree(e.target.checked); }} />
              <span>{CALL_CONSENT}</span>
            </label>
            {err ? <p className="errmsg" role="alert">{err}</p> : null}
            <button type="button" className="btn btn-p" onClick={submit} disabled={sending}>{sending ? "Sending..." : "Request a call"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIInsureGenie() {
  var [msgs, setMsgs] = useState([]);
  var [pro, setPro] = useState({});
  var [inp, setInp] = useState("");
  var [typ, setTyp] = useState(false);
  var [si, setSi] = useState(-1);
  var [phase, setPhase] = useState("welcome");
  var [piiIdx, setPiiIdx] = useState(0);
  var [qr, setQr] = useState(null);
  var [iph, setIph] = useState("Type here...");
  var [results, setResults] = useState([]);
  var [cs, setCs] = useState(0);
  var [ck, setCk] = useState(false);
  var [showCon, setShowCon] = useState(false);
  var [showCall, setShowCall] = useState(false);
  var [fullKb, setFullKb] = useState(false);
  var [startTime] = useState(function(){ return nowTime(); });
  var logRef = useRef(null);
  var endRef = useRef(null);
  var inRef = useRef(null);
  var [insurerList, setInsurerList] = useState(IS_PREVIEW ? DEFAULT_INSURERS : []);
  var partnerNames = insurerList.map(function(x){ return x.n; });
  var consentMain = buildConsent(partnerNames);
  var tot = STEPS.filter(function(s){return !s.cond||s.cond(pro);}).length + PII_STEPS.length;

  // Load partners from shared storage (set by admin dashboard)
  useEffect(function() {
    async function load() {
      var loaded = await loadInsurers();
      if (loaded) { INSURERS = loaded; setInsurerList(loaded); }
    }
    load();
    // Refresh every 30 seconds in case admin changes partners
    var interval = setInterval(load, 30000);
    return function() { clearInterval(interval); };
  }, []);

  useEffect(function(){
    var el = logRef.current;
    if (el) setTimeout(function(){ el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }, 30);
  }, [msgs, typ, showCon]);
  useEffect(function(){ setFullKb(false); }, [si, piiIdx, phase]);

  var bot = function(text, x) { setMsgs(function(p){return p.concat([Object.assign({role:"bot",text:text,time:nowTime()},x||{})]);}); };
  var usr = function(text) { setMsgs(function(p){return p.concat([{role:"user",text:text,time:nowTime()}]);}); };

  var startQ = function() {
    setPhase("qualifying"); setTyp(true);
    setTimeout(function(){bot("Great, let's find your best rate. It takes about a minute, and you can ask me a question at any point.");setTyp(false);setTimeout(function(){advQ(0,{});},500);},500);
  };
  var startChat = function() {
    setPhase("chat"); setTyp(true);
    setTimeout(function(){bot("Sure, ask me anything about auto insurance: coverage types, claims, discounts, SR-22, deductibles, or how to compare insurers. When you're ready for personalized options, tap Get free quotes.");setTyp(false);setIph("Ask me anything...");setTimeout(function(){inRef.current&&inRef.current.focus();},100);},500);
  };

  var advQ = function(idx, prof) {
    var i = idx;
    while (i < STEPS.length) { if (STEPS[i].cond && !STEPS[i].cond(prof)) { i++; continue; } break; }
    if (i >= STEPS.length) { showLocked(prof); return; }
    setSi(i); setTyp(true);
    var s = STEPS[i];
    setTimeout(function(){
      var px = "";
      if (s.id === "drv") px = "Now about your history — ";
      else if (s.id === "cov") px = "Almost there! ";
      else if (s.id === "pri") px = "Last question: ";
      else if (s.id === "vmake2" || s.id === "curins2") px = "No problem! ";
      bot(px + s.q); setTyp(false);
      setQr(s.t === "qr" ? s.opts : null); setIph(s.ph || "Type...");
      if (s.t === "text") setTimeout(function(){inRef.current&&inRef.current.focus();},100);
    }, 500 + Math.random()*300);
  };

  var handleQ = function(val) {
    if (!val.trim()) return;
    var s = STEPS[si]; usr(val); setInp(""); setQr(null);
    if (isQuestion(val, "qualifying", s.id)) {
      setTyp(true);
      getAnswer(val, pro, results).then(function(a){bot(a);setTyp(false);setTimeout(function(){setTyp(true);setTimeout(function(){bot("Back to your quote — " + s.q);setTyp(false);setQr(s.t==="qr"?s.opts:null);setIph(s.ph||"Type...");if(s.t==="text")setTimeout(function(){inRef.current&&inRef.current.focus();},100);},400);},700);});
      return;
    }
    if (s.vl) {
      var r = s.vl(val);
      if (!r.ok) { setTyp(true);setTimeout(function(){bot(r.e,{err:true});setTyp(false);setQr(s.t==="qr"?s.opts:null);setIph(s.ph||"Type...");},300);return; }
      var v = r.v !== undefined ? r.v : (s.ps ? s.ps(val) : val.trim());
      var u = Object.assign({}, pro); u[s.f] = v; if (r.st) u.state = r.st; setPro(u); setCs(function(c){return c+1;});
      if (s.id === "zip" && r.st) { setTyp(true);setTimeout(function(){bot("Got it: **"+v+"** in **"+r.st+"**.");setTyp(false);setTimeout(function(){advQ(si+1,u);},300);},400);return; }
      advQ(si+1, u);
    } else {
      var v2 = s.ps ? s.ps(val) : val.trim();
      var u2 = Object.assign({}, pro); u2[s.f] = v2; setPro(u2); setCs(function(c){return c+1;}); advQ(si+1, u2);
    }
  };

  var showLocked = function(prof) {
    setPhase("locked"); setQr(null); setTyp(true);
    setTimeout(function(){
      var r = matchInsurers(prof); setResults(r);
      if (!r.length) {
        bot("I couldn't load insurer options just now. You can talk to a licensed agent, or try again in a minute.");
        setTyp(false); setPhase("follow");
        return;
      }
      bot("I found **"+r.length+(r.length===1?" insurer":" insurers")+"** that fit your answers in **"+prof.zip+(prof.state?", "+prof.state:"")+"**. The prices below are estimates, not final quotes.",{ins:r,locked:true,tags:true});
      setTyp(false);
      setTimeout(function(){setTyp(true);setTimeout(function(){bot("To see each insurer's real price, I can connect you with them. I just need three details, and nothing is shared without your consent.");setTyp(false);setPhase("pii");setPiiIdx(0);setTimeout(function(){advPII(0,prof);},500);},700);},1800);
    },1500);
  };

  var advPII = function(idx, prof) {
    if (idx >= PII_STEPS.length) { setPhase("consent");setShowCon(true);setTyp(true);setTimeout(function(){bot("Thanks "+prof.firstName+"! Please review and accept the consent below.");setTyp(false);},400);return; }
    setPiiIdx(idx); setTyp(true); var s = PII_STEPS[idx];
    setTimeout(function(){var px="";if(idx===1)px="Thanks "+prof.firstName+"! ";if(idx===2)px="Last step: ";bot(px+s.q);setTyp(false);setQr(null);setIph(s.ph);setTimeout(function(){inRef.current&&inRef.current.focus();},100);},400);
  };

  var handlePII = function(val) {
    if (!val.trim()) return; var s = PII_STEPS[piiIdx]; usr(val); setInp("");
    if (isQuestion(val, "pii", s.id)) {
      setTyp(true);getAnswer(val,pro,results).then(function(a){bot(a);setTyp(false);setTimeout(function(){setTyp(true);setTimeout(function(){bot("Back to your quote — "+s.q);setTyp(false);setIph(s.ph);setTimeout(function(){inRef.current&&inRef.current.focus();},100);},400);},700);});return;
    }
    if (s.vl) {
      var r = s.vl(val);
      if (!r.ok) { setTyp(true);setTimeout(function(){bot(r.e,{err:true});setTyp(false);setIph(s.ph);setTimeout(function(){inRef.current&&inRef.current.focus();},100);},300);return; }
      var u = Object.assign({},pro); u[s.f] = r.v; setPro(u); setCs(function(c){return c+1;});
      if (s.id==="phone"&&r.fmt){setTyp(true);setTimeout(function(){bot("Got it: **"+r.fmt+"**.");setTyp(false);setTimeout(function(){advPII(piiIdx+1,u);},250);},350);return;}
      advPII(piiIdx+1, u);
    }
  };

  // =====================================================
  // LEAD DISTRIBUTION — Send to ALL partners at once
  // =====================================================
  var BACKEND_URL = API_BASE + "/api/leads";

  var submitLead = async function(profile) {
    var consentText = consentMain + CONSENT_LINKS; // exactly what the user saw
    var urlParams = new URLSearchParams(window.location.search);
    try {
      var response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: profile.firstName,
          phone: profile.phone,
          email: profile.email,
          zip: profile.zip,
          state: profile.state,
          age: profile.age,
          vehicle_year: profile.vehicleYear,
          vehicle_make: profile.vehicleMake,
          coverage: profile.coverage,
          driving_record: profile.driving,
          currently_insured: profile.insured,
          current_insurer: profile.currentInsurer,
          homeowner: profile.homeowner,
          military: profile.military,
          multi_car: profile.multiCar,
          priority: profile.priority,
          consent_text: consentText,
          consent_timestamp: profile.consentTs,
          consent_checked: true,
          disclosed_buyers: partnerNames.join(", "),
          publisher_id: urlParams.get("pub") || urlParams.get("utm_source") || "direct",
          sub_id: urlParams.get("sub_id") || urlParams.get("click_id") || null,
          utm_source: urlParams.get("utm_source") || "aiinsuregenie",
          utm_medium: urlParams.get("utm_medium") || "chatbot",
          utm_campaign: urlParams.get("utm_campaign") || null,
          landing_page: window.location.href,
          call_requested: profile.callRequested || false,
          preferred_call_time: profile.callTime || null,
        })
      });
      var data = await response.json();
      return data;
    } catch (err) {
      console.error("Backend error:", err);
      return null;
    }
  };

  var handleConsent = function() {
    if (!ck) return; setShowCon(false); usr("I agree");
    var u = Object.assign({},pro,{consent:true,consentTs:new Date().toISOString()}); setPro(u);
    setPhase("unlock"); setTyp(true);
    bot("Connecting you with insurers...");

    // Send the lead to the backend. Matches are shown whether or not this succeeds,
    // so a backend outage never leaves the user stuck.
    submitLead(u).then(function(backendResult) {
      if (backendResult && backendResult.success) {
        console.log("Lead submitted:", backendResult.lead_id);
      } else {
        console.log("Backend unavailable or lead rejected; showing matches anyway.");
      }
      setTimeout(function() {
        var r = results.map(function(ins){ return Object.assign({}, ins, { rUrl: buildUrl(ins, u) }); });
        setResults(r);
        bot(u.firstName + ", here are your matches. Open any insurer to get your real price.", { ins: r, locked: false, tags: true });
        setTyp(false); setPhase("follow");
        setTimeout(function(){
          setTyp(true);
          setTimeout(function(){ bot("If you have questions about any of these, ask me here. You can also talk to a licensed agent."); setTyp(false); }, 900);
        }, 1500);
      }, 600);
    });
  };

  var handleChat = function(val) {
    if (!val.trim()) return; usr(val); setInp("");
    var t = val.toLowerCase();
    if (["get my quote","get quote","start quote","compare rate","get started","find rate","i want a quote"].some(function(w){return t.includes(w);})) {
      setTyp(true);setTimeout(function(){bot("Great, let's get your quotes.");setTyp(false);setPhase("qualifying");setTimeout(function(){advQ(0,pro);},400);},400);return;
    }
    setTyp(true);getAnswer(val,pro,results).then(function(a){bot(a);setTyp(false);setIph("Ask more or say 'get my quotes'...");});
  };

  var handleFollow = function(val) {
    if (!val.trim()) return; usr(val); setInp(""); setTyp(true);
    getAnswer(val,pro,results).then(function(a){bot(a);setTyp(false);});
  };

  var send = function(val) {
    var v = val || inp; if (!v.trim() || typ) return;
    if (phase==="chat") handleChat(v);
    else if (phase==="qualifying") handleQ(v);
    else if (phase==="pii") handlePII(v);
    else if (phase==="follow"||phase==="consent") handleFollow(v);
  };

  var renderBold = function(text) {
    if (!text) return null;
    return text.split("**").map(function(part, i) {
      return i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>;
    });
  };

  // Progress through the quote flow
  var pct = (phase === "welcome" || phase === "chat") ? 0 : (phase === "follow" ? 100 : Math.min(100, Math.round(cs / tot * 100)));

  // Which answer is the user being asked for right now? Used to pick the right mobile keyboard.
  var cur = null;
  if (phase === "qualifying" && si >= 0 && STEPS[si] && STEPS[si].t === "text") cur = STEPS[si].id;
  if (phase === "pii" && PII_STEPS[piiIdx]) cur = PII_STEPS[piiIdx].id;
  var kb = { inputMode: "text", autoComplete: "off", autoCapitalize: "sentences" };
  if (!fullKb) {
    if (cur === "zip") kb = { inputMode: "numeric", autoComplete: "postal-code", autoCapitalize: "off" };
    else if (cur === "phone") kb = { inputMode: "tel", autoComplete: "tel", autoCapitalize: "off" };
    else if (cur === "email") kb = { inputMode: "email", autoComplete: "email", autoCapitalize: "off" };
    else if (cur === "firstName") kb = { inputMode: "text", autoComplete: "given-name", autoCapitalize: "words" };
  }

  var onType = function(e) {
    var v = e.target.value;
    if (cur === "phone") v = fmtPhone(v);
    setInp(v);
  };

  var openFullKeyboard = function() {
    setFullKb(true);
    if (inRef.current) inRef.current.blur();
    setTimeout(function(){ inRef.current && inRef.current.focus(); }, 60);
  };

  var chatChips = ["Cheapest way to insure a car", "Coverage types explained", "What is SR-22?", "How deductibles work"];
  var composerPh = (phase === "locked" || phase === "unlock" || phase === "consent" || phase === "follow") ? "Ask a question" : iph;
  var followChips = ["Lower my rate", "Compare these insurers", "What full coverage includes"];

  return (
    <div className="ig">
      <style>{CSS_TEXT}</style>
      <div className="ig-card">

        <header className="hd">
          <div className="av"><Icon n="shield" size={22} /></div>
          <div className="hd-txt">
            <div className="hd-name">AI InsureGenie</div>
            <div className="hd-sub"><span className="dot" />AI assistant</div>
          </div>
          <button type="button" className="hd-btn" aria-label="Talk to an agent" onClick={function(){ setShowCall(true); }}>
            <Icon n="phone" size={16} /><span className="lbl-l">Talk to an agent</span><span className="lbl-s">Agent</span>
          </button>
        </header>
        <div className="prog" role="progressbar" aria-label="Quote progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div style={{ width: pct + "%" }} />
        </div>

        <div className="log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation">
          <div className="row bot first">
            <div className="who">AI InsureGenie</div>
            <div className="bub">Hi, I'm the AI InsureGenie assistant. I can compare auto insurance options from {insurerList.length > 0 ? insurerList.length + (insurerList.length === 1 ? " insurer" : " insurers") : "several insurers"} in about a minute, or answer your questions about coverage and claims.</div>
            <div className="bub" style={{ marginTop: 4 }}>It's free, and your details are only shared if you agree to it.</div>
            {(msgs.length === 0 || msgs[0].role === "user") ? <div className="time">{startTime}</div> : null}
          </div>

          {msgs.map(function(m, i) {
            var prev = i === 0 ? { role: "bot" } : msgs[i - 1];
            var next = msgs[i + 1];
            var first = prev.role !== m.role;
            var last = !next || next.role !== m.role;
            var basis = m.tags ? basisLine(pro) : "";
            return (
              <div key={i} className={"row " + m.role + (first ? " first" : "") + (prev.ins ? " after" : "")}>
                {m.role === "bot" && first ? <div className="who">AI InsureGenie</div> : null}
                <div className={"bub" + (m.err ? " err" : "")}>{m.role === "bot" ? renderBold(m.text) : m.text}</div>
                {basis ? <p className="basis">{basis}</p> : null}
                {m.ins ? (
                  <div className="quotes">
                    {m.ins.map(function(x, j) { return <QuoteCard key={x.id || j} ins={x} locked={!!m.locked} />; })}
                  </div>
                ) : null}
                {last && m.time ? <div className="time">{m.time}</div> : null}
              </div>
            );
          })}

          {showCon && !typ ? (
            <div className="consent">
              <label>
                <input type="checkbox" checked={ck} onChange={function(e){ setCk(e.target.checked); }} />
                <span>
                  {consentMain} I have read the <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.
                </span>
              </label>
              <button type="button" className="btn btn-p" disabled={!ck} onClick={handleConsent}>Agree and see my matches</button>
            </div>
          ) : null}

          {typ ? (
            <div className="typing" role="status" aria-label="AI InsureGenie is typing"><i /><i /><i /></div>
          ) : null}
        </div>

        <footer className="foot">
          {phase === "welcome" ? (
            <div className="chips">
              <button type="button" className="chip pri" onClick={function(){ usr("Get free quotes"); startQ(); }}>Get free quotes</button>
              <button type="button" className="chip" onClick={function(){ usr("I have a question"); startChat(); }}>Ask a question</button>
              <button type="button" className="chip" onClick={function(){ setShowCall(true); }}>Talk to an agent</button>
            </div>
          ) : (
            <div>
              {qr && !typ ? (
                <div className="chips" role="group" aria-label="Quick replies">
                  {qr.map(function(o, i) { return <button type="button" key={i} className="chip" onClick={function(){ send(o); }}>{o}</button>; })}
                </div>
              ) : null}

              {phase === "chat" && !typ ? (
                <div className="chips">
                  <button type="button" className="chip pri" onClick={function(){ usr("Get free quotes"); startQ(); }}>Get free quotes</button>
                  {chatChips.map(function(s, i) { return <button type="button" key={i} className="chip" onClick={function(){ handleChat(s); }}>{s}</button>; })}
                </div>
              ) : null}

              {phase === "follow" && !typ ? (
                <div className="chips">
                  {followChips.map(function(s, i) { return <button type="button" key={i} className="chip" onClick={function(){ handleFollow(s); }}>{s}</button>; })}
                </div>
              ) : null}

              <div className="comp">
                <input
                  ref={inRef}
                  value={inp}
                  onChange={onType}
                  onKeyDown={function(e){ if (e.key === "Enter") { e.preventDefault(); send(); } }}
                  placeholder={composerPh}
                  aria-label="Type your message"
                  inputMode={kb.inputMode}
                  autoComplete={kb.autoComplete}
                  autoCapitalize={kb.autoCapitalize}
                  enterKeyHint="send"
                />
                <button type="button" className="send" aria-label="Send message" onClick={function(){ send(); }} disabled={!inp.trim() || typ}>
                  <Icon n="send" size={18} />
                </button>
              </div>
              {(cur === "zip" || cur === "phone") && !fullKb ? (
                <button type="button" className="linkbtn" onClick={openFullKeyboard}>Have a question instead? Show the full keyboard</button>
              ) : null}
            </div>
          )}
          <p className="disc">AI InsureGenie is an AI assistant, not an insurance company or licensed agent. Prices shown are estimates, and your final rate comes from the insurer.</p>
        </footer>

        {showCall ? (
          <CallModal
            profile={pro}
            onClose={function(){ setShowCall(false); }}
            onSent={function(d){
              var u = Object.assign({}, pro);
              if (d.name && !pro.firstName) u.firstName = d.name;
              if (d.phone && !pro.phone) u.phone = d.phone;
              setPro(u);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
