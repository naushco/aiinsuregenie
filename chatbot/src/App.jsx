import { useState, useRef, useEffect, Fragment } from "react";
import MINIMUMS from "./minimums.js";

var STORAGE_KEY = "aiinsuregenie-partners-v3";

// Language: Spanish when the visitor arrives from a Spanish page (#...lang=es or ?lang=es), remembered for the visit.
var LANG = (function () {
  if (typeof window === "undefined") return "en";
  var h = (window.location.hash || "") + "&" + (window.location.search || "");
  var l = /[#&?]lang=es\b/.test(h) ? "es" : (/[#&?](lang=en|start=)/.test(h) ? "en" : null);
  try { if (l) sessionStorage.setItem("aig-lang", l); else l = sessionStorage.getItem("aig-lang"); } catch (e) {}
  return l === "es" ? "es" : "en";
})();
var ES = LANG === "es";

// One random ID per chat visit. It goes on every partner link (subid=...) and every event, so a click or
// lead can be tied back to the conversation. It is not linked to a name, phone or email.
var SESSION_ID = (function () {
  var id = null;
  try { id = sessionStorage.getItem("aig-sid"); } catch (e) {}
  if (!id) {
    id = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try { sessionStorage.setItem("aig-sid", id); } catch (e) {}
  }
  return id;
})();
// Visitor has asked not to have their data sold or shared: browser Global Privacy Control signal or our opt-out link.
var DO_NOT_SELL = (function () {
  if (typeof navigator !== "undefined" && navigator.globalPrivacyControl === true) return true;
  try { return localStorage.getItem("aig-dns") === "1"; } catch (e) { return false; }
})();
function T(en, es) { return ES ? es : en; }
if (typeof document !== "undefined" && ES) document.documentElement.lang = "es";
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
    placement: dp.placement === "other" ? "other" : "top",
    weight: dp.weight == null ? 50 : Number(dp.weight) || 0,
    goals: Array.isArray(dp.goals) ? dp.goals : [],
    states: Array.isArray(dp.states) ? dp.states : [],
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

var STATE_ABBR = {"alabama":"AL","alaska":"AK","arizona":"AZ","arkansas":"AR","california":"CA","colorado":"CO","connecticut":"CT","delaware":"DE","district of columbia":"DC","florida":"FL","georgia":"GA","hawaii":"HI","idaho":"ID","illinois":"IL","indiana":"IN","iowa":"IA","kansas":"KS","kentucky":"KY","louisiana":"LA","maine":"ME","maryland":"MD","massachusetts":"MA","michigan":"MI","minnesota":"MN","mississippi":"MS","missouri":"MO","montana":"MT","nebraska":"NE","nevada":"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND","ohio":"OH","oklahoma":"OK","oregon":"OR","pennsylvania":"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD","tennessee":"TN","texas":"TX","utah":"UT","vermont":"VT","virginia":"VA","washington":"WA","west virginia":"WV","wisconsin":"WI","wyoming":"WY"};
var CAR_AGE_YEAR = { "2020 or newer": "2022", "2015 to 2019": "2017", "2014 or older": "2012" };

function vZip(z) {
  var m = String(z).match(/\b\d{5}\b/);
  var c = m ? m[0] : String(z).replace(/\D/g, "");
  if (c.length !== 5) return { ok: false, e: T("Enter a valid 5-digit US ZIP code.", "Escriba un código postal de EE. UU. de 5 dígitos.") };
  var n = parseInt(c);
  for (var st of Object.keys(ZIP_STATES)) {
    if (n >= ZIP_STATES[st][0] && n <= ZIP_STATES[st][1]) return { ok: true, v: c, st: st };
  }
  return { ok: false, e: T("That ZIP doesn't match a US state. Check the 5 digits and try again.", "Ese código postal no corresponde a un estado de EE. UU. Revise los 5 dígitos.") };
}
function vPhone(p) {
  var c = p.replace(/\D/g, "");
  var d = c.length === 11 && c[0] === "1" ? c.slice(1) : c;
  if (d.length !== 10) return { ok: false, e: T("Enter a valid 10-digit US phone number.", "Escriba un número de teléfono de EE. UU. de 10 dígitos.") };
  if ("01".includes(d[0])) return { ok: false, e: T("US numbers can't start with 0 or 1.", "Los números de EE. UU. no empiezan con 0 ni 1.") };
  if (/^(\d)\1{9}$/.test(d)) return { ok: false, e: T("That looks like a test number.", "Ese parece un número de prueba.") };
  if (d.slice(3, 6) === "555") return { ok: false, e: T("555 numbers aren't real.", "Los números 555 no son reales.") };
  return { ok: true, v: d, fmt: "(" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6) };
}
function vEmail(e) {
  var t = e.trim().toLowerCase();
  if (!t || !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(t)) return { ok: false, e: T("Enter a valid email.", "Escriba un correo electrónico válido.") };
  var bad = ["mailinator.com","guerrillamail.com","tempmail.com","yopmail.com","maildrop.cc"];
  if (bad.includes(t.split("@")[1])) return { ok: false, e: T("Use a real email.", "Use un correo electrónico real.") };
  return { ok: true, v: t };
}
function vName(v) {
  var t = v.trim();
  if (t.length < 2) return { ok: false, e: T("Enter at least 2 characters.", "Escriba al menos 2 letras.") };
  if (/\d/.test(t)) return { ok: false, e: T("Names shouldn't have numbers.", "El nombre no debe tener números.") };
  if (["test","asdf","fake","null","none"].includes(t.toLowerCase())) return { ok: false, e: T("Enter your real name.", "Escriba su nombre real.") };
  return { ok: true, v: t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() };
}

function isQuestion(text, phase, stepId) {
  var t = text.trim().toLowerCase();
  if (t.length < 3) return false;
  var hasQM = t.includes("?") || t.includes("¿");
  var qWords = ["what","how","why","tell me","explain","can you","should i","compare","difference","about the","want to know","more about","know more","qué","que es","cómo","como ","por qué","cuánto","cuanto","cuál","puedo","debo","necesito","explique","explícame","diferencia"];
  var startsQ = qWords.some(function(w) { return t.startsWith(w); });
  var hasQ = qWords.some(function(w) { return t.includes(w); });
  var insTerms = ["claim","settlement","coverage","deductible","premium","discount","sr-22","sr22","liability","collision","comprehensive","insurance","policy","rate","reclamo","cobertura","deducible","prima","descuento","responsabilidad","choque","seguro","póliza","poliza","precio","tarifa"].some(function(w) { return t.includes(w); });
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

// Used only when the AI can't be reached. General, number-free answers;
// the AI handles everything else, including questions about partners.
function fmtLimits(code) {
  var v = MINIMUMS.limits[code]; if (!v) return "";
  var a = v.split("/").map(function (x) { return "$" + (parseInt(x, 10) * 1000).toLocaleString("en-US"); });
  if (code === "FL") return T("$10,000 property damage + $10,000 PIP", "$10,000 daños a la propiedad + $10,000 PIP");
  return a[0] + "/" + a[1] + T(" bodily injury and ", " por lesiones y ") + a[2] + T(" property damage", " por daños a la propiedad");
}
function statesIn(text) {
  var t = " " + text.toLowerCase().replace(/[,.;!?¿¡]/g, " ") + " ", out = [];
  Object.keys(STATE_ABBR).sort(function (a, b) { return b.length - a.length; }).forEach(function (n) {
    var i = t.indexOf(" " + n + " ");
    if (i >= 0 && out.indexOf(STATE_ABBR[n]) < 0) { out.push(STATE_ABBR[n]); t = t.slice(0, i) + " " + " ".repeat(n.length) + t.slice(i + n.length + 1); }
  });
  (text.match(/\b[A-Z]{2}\b/g) || []).forEach(function (a) { if (MINIMUMS.limits[a] && ["OR","IN","ME","OK","HI"].indexOf(a) < 0 && out.indexOf(a) < 0) out.push(a); });
  return out;
}
function minimumsAnswer(text, profile) {
  var t = text.toLowerCase();
  if (!/(minimum|required|requirement|at least|least amount|legal limit|by law|mínim|obligatori|requisit|exige)/.test(t)) return null;
  if (!/(insurance|coverage|liability|limit|car|auto|seguro|cobertura|responsabilidad|límite)/.test(t)) return null;
  var st = statesIn(text); if (!st.length && profile && profile.state) st = [profile.state];
  var when = new Date(MINIMUMS.checked + "T12:00:00Z").toLocaleDateString(ES ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!st.length) return T("Minimums are set by each state. Tell me which state (for example \"minimum in Texas\") and I'll give you its required liability limits.", "Cada estado fija sus mínimos. Dígame el estado (por ejemplo \"mínimo en Texas\") y le doy los límites de responsabilidad que exige.");
  var lines = st.slice(0, 3).map(function (c) {
    var note = MINIMUMS.notes[c] ? " " + (ES ? MINIMUMS.notes[c][1] : MINIMUMS.notes[c][0]) : "";
    return "**" + (ABBR_STATE[c] || c) + "**: " + fmtLimits(c) + "." + note;
  });
  var cmp = "";
  if (st.length === 2 && st[0] !== "FL" && st[1] !== "FL") {
    var sum = function (c) { return MINIMUMS.limits[c].split("/").reduce(function (a, x) { return a + parseInt(x, 10); }, 0); };
    var a = sum(st[0]), b = sum(st[1]);
    cmp = a === b ? T(" Both states require the same minimums.", " Ambos estados exigen los mismos mínimos.") : " " + (ABBR_STATE[a > b ? st[0] : st[1]]) + T(" requires higher minimums.", " exige mínimos más altos.");
  }
  return T("State minimum liability limits:\n", "Límites mínimos de responsabilidad por estado:\n") + lines.join("\n") + cmp +
    T("\nThese are legal minimums only; most drivers choose more. Last checked " + when + ". Confirm with your state DMV or insurance department.", "\nSon solo los mínimos legales; la mayoría elige más. Verificado el " + when + ". Confirme con el DMV o el departamento de seguros de su estado.");
}

function staticAnswer(text) {
  var t = text.toLowerCase();
  if (ES) {
    if (t.includes("deducible")) return "El **deducible** es lo que usted paga de su bolsillo en un reclamo antes de que el seguro pague el resto. Un deducible más alto suele bajar la prima, pero paga más si ocurre algo, así que elija uno que pueda cubrir.";
    if (t.includes("sr-22") || t.includes("sr22")) return "La **SR-22** es un formulario que su aseguradora presenta ante el estado para demostrar que tiene el seguro obligatorio, a menudo después de un DUI o de manejar sin seguro. No todas las aseguradoras lo presentan, así que pregunte antes de comprar.";
    if (t.includes("cobertura")) return "La **responsabilidad civil** paga los daños o lesiones que usted cause a otros. El **choque** (collision) repara su auto después de un accidente, y la **cobertura amplia** (comprehensive) cubre robo, clima y otros daños. \"Cobertura total\" suele significar las tres.";
    if (t.includes("barat") || t.includes("ahorr") || t.includes("descuento") || t.includes("bajar")) return "Formas comunes de pagar menos: compare cotizaciones con la misma cobertura, suba el deducible si puede pagarlo, junte seguro de casa y auto, y pregunte por descuentos de buen conductor o pago completo. Los descuentos cambian según la aseguradora y el estado.";
    return null;
  }
  if (t.includes("deductible")) return "A **deductible** is the amount you pay yourself on a claim before insurance pays the rest. A higher deductible usually lowers your premium, but you pay more if something happens, so pick one you could comfortably cover.";
  if (t.includes("sr-22") || t.includes("sr22")) return "An **SR-22** is a form your insurer files with your state to show you carry the required insurance, often after a DUI or driving without insurance. Not every insurer files them, so it's worth asking before you buy.";
  if (t.includes("coverage") && (t.includes("type") || t.includes("what") || t.includes("include") || t.includes("full"))) return "**Liability** pays for damage or injuries you cause to others. **Collision** repairs your car after an accident, and **comprehensive** covers theft, weather, and other damage. \"Full coverage\" usually means all three, and lenders often require it on financed cars.";
  if (t.includes("cheap") || t.includes("save") || t.includes("discount") || t.includes("lower")) return "Common ways to lower your rate: compare quotes with the same coverage, raise your deductible if you can afford it, bundle home and auto, and ask about safe-driver or paid-in-full discounts. Discounts vary by insurer and state.";
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
    results: (results || []).map(function (r) { return { n: r.n }; }),
    lang: LANG
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
    var sys = "You are AI InsureGenie, a friendly US auto insurance advisor. Only answer auto insurance questions. Keep answers to 2-3 short paragraphs. Use **bold** for key terms. Never guarantee prices. Not a licensed agent." + (ES ? " Always reply in Spanish (neutral, use usted)." : "");
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
  var mins = minimumsAnswer(text, profile); if (mins) return mins;
  var answer = await aiAnswer(text, profile, results) || staticAnswer(text);
  if (!answer) {
    return T("Sorry, I couldn't answer that just now. Try asking another way, tap **Get instant quote** to find your match, or talk to a licensed agent.", "Perdón, no pude responder eso ahora. Pruebe a preguntarlo de otra forma, toque **Obtener cotización** para ver su opción, o hable con un agente con licencia.");
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

function matchInsurers(p, pool) {
  return (pool || INSURERS).map(function(ins) {
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

// Chooses who to show, following the dashboard's chat placement settings:
// goals and states narrow the list; a pinned partner always wins; otherwise
// top-pick partners rotate by their traffic share; the rest become "other options".
function fits(ins, p) {
  var g = ins.goals || [], st = ins.states || [];
  return (!g.length || !p.priority || g.indexOf(p.priority) >= 0) && (!st.length || !p.state || st.indexOf(p.state) >= 0);
}
function pickPartners(p) {
  var pool = INSURERS.filter(function (ins) { return fits(ins, p); });
  // A partner set to other goals still beats "no partner" when it quotes in the visitor's state.
  if (!pool.length) pool = INSURERS.filter(function (ins) { return fits(ins, Object.assign({}, p, { priority: null })); });
  if (!pool.length) return [];
  var scored = matchInsurers(p, pool);
  if (!scored.length) return [];
  var top = scored.filter(function (x) { return x.pinned; })[0];
  if (!top) {
    var tops = scored.filter(function (x) { return x.placement !== "other" && x.weight > 0; });
    var total = tops.reduce(function (a, x) { return a + x.weight; }, 0);
    if (total > 0) {
      var r = Math.random() * total;
      for (var i = 0; i < tops.length; i++) { r -= tops[i].weight; if (r < 0) { top = tops[i]; break; } }
      if (!top) top = tops[tops.length - 1];
    }
  }
  if (!top) top = scored[0];
  return [top].concat(scored.filter(function (x) { return x.id !== top.id; }));
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
  u.searchParams.set("subid", SESSION_ID);
  return u.toString();
}

var STEPS = [
  {id:"pri",f:"priority",q:T("What matters most to you?","¿Qué es lo más importante para usted?"),t:"qr",opts:T(["Lowest price","Best coverage","Best service"],["Precio más bajo","Mejor cobertura","Mejor servicio"]),cond:function(p){return !p.priority;},ps:function(v){var l=v.toLowerCase();if(l.includes("price")||l.includes("low")||l.includes("cheap")||l.includes("precio")||l.includes("barat"))return "price";if(l.includes("cover")||l.includes("cobertura"))return "coverage";return "service";}},
  {id:"zip",f:"zip",q:T("What's your ZIP code?","¿Cuál es su código postal (ZIP)?"),t:"text",ph:T("5-digit US ZIP","Código postal de 5 dígitos"),vl:vZip,cond:function(p){return !p.zip && !p.state;}},
  {id:"vyear",f:"vehicleYear",q:T("What year is your car?","¿De qué año es su auto?"),t:"qr",cond:function(p){return !p.vehicleYear;},opts:["2024-2025","2020-2023","2015-2019","2010-2014",T("Before 2010","Antes de 2010")],ps:function(v){var y=v.match(/\b(19|20)\d{2}\b/);if(y&&v.indexOf("-")<0)return y[0];if(v.includes("2024"))return "2024";if(v.includes("2020"))return "2022";if(v.includes("2015"))return "2017";if(v.includes("2010"))return "2012";if(v.includes("Before")||v.includes("Antes"))return "2008";return v;}},
  {id:"vmake",f:"vehicleMake",q:T("And what make is it?","¿Y de qué marca es?"),t:"qr",cond:function(p){return !p.vehicleMake;},opts:["Toyota","Honda","Ford","Chevrolet","Nissan",T("Other","Otra")],ps:function(v){return (v==="Otra")?"Other":v;}},
  {id:"vmake2",f:"vehicleMake",q:T("What brand is your car?","¿Qué marca es su auto?"),t:"text",ph:T("e.g. Hyundai, Kia, Subaru...","p. ej. Hyundai, Kia, Subaru..."),cond:function(p){return p.vehicleMake==="Other";},ps:function(v){var t=v.trim();return t.charAt(0).toUpperCase()+t.slice(1);}},
  {id:"drv",f:"driving",cond:function(p){return !p.driving;},q:T("Last one: how's your driving record over the past 3 years?","Última pregunta: ¿cómo ha sido su historial de manejo en los últimos 3 años?"),t:"qr",opts:T(["Clean, no issues","1-2 tickets","An accident","DUI / SR-22"],["Limpio, sin problemas","1-2 multas","Un accidente","DUI / SR-22"]),ps:function(v){var l=v.toLowerCase();if(l.includes("clean")||l.includes("limpio"))return "clean";if(l.includes("ticket")||l.includes("multa"))return "minor";if(l.includes("accident"))return "major";return "dui";}},
];
var MAIN_STEPS = 5;

// "Just tell me": pull several answers out of one typed line (no AI call, instant).
var MAKES = ["Toyota","Honda","Ford","Chevrolet","Chevy","Nissan","Hyundai","Kia","Subaru","Jeep","Dodge","Ram","GMC","Tesla","BMW","Mercedes","Audi","Volkswagen","VW","Mazda","Lexus","Acura","Infiniti","Buick","Cadillac","Chrysler","Lincoln","Mitsubishi","Volvo","Porsche","Mini","Genesis"];
var MODELS = {camry:"Toyota",corolla:"Toyota",rav4:"Toyota",tacoma:"Toyota",tundra:"Toyota",highlander:"Toyota",prius:"Toyota",civic:"Honda",accord:"Honda","cr-v":"Honda",crv:"Honda",pilot:"Honda","f-150":"Ford",f150:"Ford",mustang:"Ford",explorer:"Ford",escape:"Ford",silverado:"Chevrolet",malibu:"Chevrolet",equinox:"Chevrolet",tahoe:"Chevrolet",altima:"Nissan",sentra:"Nissan",rogue:"Nissan",elantra:"Hyundai",sonata:"Hyundai",tucson:"Hyundai",optima:"Kia",sorento:"Kia",soul:"Kia",outback:"Subaru",forester:"Subaru",wrangler:"Jeep",cherokee:"Jeep",charger:"Dodge",model3:"Tesla","model 3":"Tesla","model y":"Tesla"};
var ABBR_STATE = {}; Object.keys(STATE_ABBR).forEach(function(k){ ABBR_STATE[STATE_ABBR[k]] = k.replace(/\b\w/g, function(c){ return c.toUpperCase(); }); });
function parseFree(text, step) {
  var t = " " + text.toLowerCase().replace(/[,.;!?]/g, " ") + " ", o = {};
  // A 5-digit number only counts as a ZIP when we are asking for one (or before the quote starts); at the car-year step "22025" is a typo for 2025.
  var z = (!step || step === "zip") ? text.match(/\b\d{5}\b/) : null; if (z) { var zr = vZip(z[0]); if (zr.ok) { o.zip = zr.v; o.state = zr.st; } }
  if (!o.state) {
    Object.keys(STATE_ABBR).sort(function(a,b){return b.length-a.length;}).some(function(n){ if (t.indexOf(" " + n + " ") >= 0) { o.state = STATE_ABBR[n]; return true; } return false; });
    if (!o.state) { var ab = text.match(/\b([A-Z]{2})\b/g); if (ab) ab.some(function(a){ if (ABBR_STATE[a] && a !== "OR" && a !== "IN" && a !== "ME") { o.state = a; return true; } return false; }); }
  }
  var y = text.match(/\b(19[89]\d|20[0-2]\d)\b/); if (y && !(z && z[0].indexOf(y[0]) >= 0)) o.vehicleYear = y[1];
  if (!o.vehicleYear && step === "vyear") { var y2 = text.match(/\d{5,6}/); if (y2) { var tail = y2[0].slice(-4); if (/^(19[89]\d|20[0-2]\d)$/.test(tail)) o.vehicleYear = tail; } }
  MAKES.some(function(m){ if (t.indexOf(" " + m.toLowerCase() + " ") >= 0) { o.vehicleMake = m === "Chevy" ? "Chevrolet" : (m === "VW" ? "Volkswagen" : m); return true; } return false; });
  if (!o.vehicleMake) Object.keys(MODELS).some(function(k){ if (t.indexOf(" " + k + " ") >= 0) { o.vehicleMake = MODELS[k]; return true; } return false; });
  if (/\b(dui|dwi|sr-?22|fr-?44)\b/.test(t)) o.driving = "dui";
  else if (/(accident|crash|wreck|choque)/.test(t)) o.driving = "major";
  else if (/(ticket|speeding|violation|multa)/.test(t)) o.driving = /(no|zero|0|sin) (tickets|multas)/.test(t) ? "clean" : "minor";
  else if (/(clean|no issues|perfect record|limpio)/.test(t)) o.driving = "clean";
  if (/(cheap|lowest|save|saving|price|barat|precio|ahorr)/.test(t)) o.priority = "price";
  else if (/(full coverage|best coverage|more coverage|cobertura total|mejor cobertura)/.test(t)) o.priority = "coverage";
  return o;
}
// Answer cards (icon + short explainer), "why we ask" notes and short reactions.
var CARDS = {
  pri: { items: T([["tag","Pay less for the cover you need"],["shield","Be properly protected"],["headset","Easy claims and helpful support"]], [["tag","Pague menos por la cobertura que necesita"],["shield","Esté bien protegido"],["headset","Reclamos fáciles y buen soporte"]]) },
  vyear: { compact: true, items: [[],[],[],[],[]] },
  vmake: { compact: true, items: [[],[],[],[],[],[]] },
  drv: { items: T([["shield","No tickets or accidents"],["file","Speeding or similar"],["alert","In the last 3 years"],["scale","Need a state filing"]], [["shield","Sin multas ni accidentes"],["file","Exceso de velocidad u otra"],["alert","En los últimos 3 años"],["scale","Necesito un formulario estatal"]]) }
};
var WHY = {
  zip: T("Prices and partners depend on where you live.", "Los precios y los socios dependen de dónde vive."),
  vyear: T("Car age changes what coverage makes sense.", "La edad del auto cambia qué cobertura conviene."),
  drv: T("Be honest: insurers check this anyway, and it helps me match you right.", "Sea sincero: las aseguradoras lo revisan de todos modos, y me ayuda a darle la opción correcta.")
};
function reaction(id, v) {
  if (id === "vyear") { var y = parseInt(v, 10); if (y >= 2020) return T("Nice. Newer cars often qualify for safety-feature discounts, so ask about them.", "Bien. Los autos más nuevos suelen tener descuentos por equipo de seguridad; pregunte por ellos."); if (y && y < 2012) return T("Good to know. On an older car, some drivers skip collision coverage to save; a partner can tell you if that makes sense for you.", "Bueno saberlo. En un auto más viejo, algunos conductores quitan la cobertura de choque para ahorrar; un socio le puede decir si le conviene."); }
  if (id === "drv") { if (v === "minor") return T("That's common. Some insurers are much more forgiving of a ticket than others.", "Es algo común. Algunas aseguradoras son mucho más flexibles con una multa que otras."); if (v === "major") return T("Thanks for being upfront. After an accident, comparing makes the biggest difference.", "Gracias por su sinceridad. Después de un accidente, comparar es lo que más ayuda."); if (v === "dui") return T("No judgment. Lots of drivers are in the same spot, and comparing really pays off here.", "Aquí nadie le juzga. Muchos conductores están en lo mismo, y comparar vale mucho la pena."); }
  return "";
}
function filledCount(p) { return (p.priority ? 1 : 0) + ((p.zip || p.state) ? 1 : 0) + (p.vehicleYear ? 1 : 0) + ((p.vehicleMake && p.vehicleMake !== "Other") ? 1 : 0) + (p.driving ? 1 : 0); }
var REC_SHORT = T({ clean: "Clean record", minor: "1-2 tickets", major: "Accident", dui: "DUI / SR-22" }, { clean: "Historial limpio", minor: "1-2 multas", major: "Accidente", dui: "DUI / SR-22" });
var GOAL_SHORT = T({ price: "Lowest price", coverage: "Best coverage", service: "Best service" }, { price: "Precio más bajo", coverage: "Mejor cobertura", service: "Mejor servicio" });
function profileItems(p) {
  var a = [];
  if (p.state || p.zip) a.push({ k: "loc", ic: "📍", v: (ABBR_STATE[p.state] || p.state || "") + (p.zip ? " " + p.zip : "") });
  if (p.vehicleYear || (p.vehicleMake && p.vehicleMake !== "Other")) a.push({ k: "car", ic: "🚗", v: [p.vehicleYear, p.vehicleMake !== "Other" ? p.vehicleMake : ""].filter(Boolean).join(" ") });
  if (p.driving) a.push({ k: "drv", ic: p.driving === "clean" ? "✅" : "🧾", v: REC_SHORT[p.driving] });
  if (p.priority) a.push({ k: "pri", ic: "🎯", v: GOAL_SHORT[p.priority] });
  return a;
}
function gotLine(o) {
  return profileItems(o).map(function(x){ return x.v; }).join(" · ");
}

var PII_STEPS = [
  {id:"firstName",f:"firstName",q:T("What's your first name?","¿Cuál es su nombre?"),ph:T("First name","Nombre"),vl:vName},
  {id:"phone",f:"phone",q:T("Best phone number to reach you?","¿A qué número le podemos llamar?"),ph:"(555) 123-4567",vl:vPhone},
  {id:"email",f:"email",q:T("What's your email address?","¿Cuál es su correo electrónico?"),ph:T("you@email.com","usted@correo.com"),vl:vEmail},
];

// ---------------------------------------------------------------
// API base: ONE place to change when your backend is live.
// Use your *.vercel.app backend URL until aiinsuregenie.com is connected.
// ---------------------------------------------------------------
var API_BASE = (typeof window !== "undefined" && window.AIG_CONFIG && window.AIG_CONFIG.apiBase) || "https://api.aiinsuregenie.com";

// Privacy-friendly event log: no cookies, no names, phones or emails. Only the event, the session ID,
// and non-personal context (state, partner, campaign). Sent with sendBeacon so it never slows the chat.
var UTM = (function () {
  var q = {};
  try { var u = new URLSearchParams(window.location.search); ["utm_source","utm_medium","utm_campaign","utm_content","pub"].forEach(function (k) { if (u.get(k)) q[k] = u.get(k).slice(0, 80); }); } catch (e) {}
  return q;
})();
var sentOnce = {};
function track(type, extra, once) {
  if (once) { if (sentOnce[type]) return; sentOnce[type] = 1; }
  try {
    var body = JSON.stringify(Object.assign({ type: type, session_id: SESSION_ID, lang: LANG, dns: DO_NOT_SELL }, UTM, extra || {}));
    var url = API_BASE + "/api/event";
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "text/plain" }))) return;
    fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: body, keepalive: true }).catch(function () {});
  } catch (e) {}
}

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
  var shown = names.slice(0, 6).join(", ") + (names.length > 6 ? T(", and others", ", y otros") : "");
  var list = names.length ? " (" + shown + ")" : "";
  if (ES) return "Acepto que AI InsureGenie y sus socios de seguros" + list + " me contacten por teléfono, mensaje de texto y correo electrónico sobre cotizaciones de seguros, incluso con tecnología automatizada. No es necesario dar este consentimiento para comprar nada, y puedo retirarlo en cualquier momento.";
  return "I agree that AI InsureGenie and its insurance partners" + list + " may contact me by phone, text message, and email about insurance quotes, including with automated technology. Consent is not required to buy anything, and I can withdraw it at any time.";
}
var CONSENT_LINKS = T(" I have read the Privacy Policy and Terms of Use.", " He leído la Política de privacidad y los Términos de uso.");
var CALL_CONSENT = T("I agree that a licensed insurance agent may call me at this number about insurance quotes. Consent is not required to buy anything.", "Acepto que un agente de seguros con licencia me llame a este número sobre cotizaciones de seguros. No es necesario dar este consentimiento para comprar nada.");

function basisLine(p) {
  var rec = T({ clean: "clean record", minor: "minor violations", major: "at-fault accident", dui: "DUI/SR-22" }, { clean: "historial limpio", minor: "infracciones menores", major: "accidente con culpa", dui: "DUI/SR-22" });
  var parts = [];
  if (p.zip) parts.push("ZIP " + p.zip + (p.state ? " (" + p.state + ")" : ""));
  if (p.vehicleMake && p.vehicleMake !== "Other") parts.push(p.vehicleMake);
  if (p.driving && rec[p.driving]) parts.push(rec[p.driving]);
  return parts.length ? T("Based on: ", "Según: ") + parts.join(", ") : "";
}

// ---------------------------------------------------------------
// Styles
// ---------------------------------------------------------------
var CSS_TEXT = [
  "html,body{margin:0;background:#ffffff}",
  ".ig{--navy:#0b2a5b;--gold:#ffb51e;--gold-d:#f0a500;--blue:#1f5fd6;--ink:#0e1b33;--ink2:#33415c;--mute:#6b7588;--mute2:#8a94a6;--line:#eef1f5;--line2:#e3e8ef;--soft:#f1f4f8;--soft2:#f6f8fb;--ubub:#eef3fb;--brand:#0b2a5b;--ring:rgba(11,42,91,.12);color-scheme:light}",
  ".ig,.ig *{box-sizing:border-box}",
  ".ig p,.ig h1,.ig h2{margin:0}",
  ".ig{min-height:100vh;min-height:100dvh;background:#fff;color:var(--ink);font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16px;display:flex;justify-content:center;-webkit-font-smoothing:antialiased}",
  ".ig button,.ig input,.ig select{font-family:inherit}",
  ".pj{font-family:'Plus Jakarta Sans',Inter,system-ui,sans-serif}",
  ".ig-card{width:100%;height:100vh;height:100dvh;display:flex;flex-direction:column;background:#fff;position:relative}",
  ".ig button:focus-visible,.ig a:focus-visible,.ig input:focus-visible,.ig select:focus-visible{outline:2px solid var(--blue);outline-offset:2px}",
  /* Header */
  ".hd{position:relative;display:flex;align-items:center;gap:10px;padding:12px 10px 12px 16px;border-bottom:1px solid var(--line);flex:none}",
  ".hd-in{width:100%;max-width:760px;margin:0 auto;display:flex;align-items:center;gap:10px}",
  ".hd-logo{width:32px;height:32px;border-radius:9px;display:block;flex:none}",
  ".hd-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}",
  ".hd-name{font-size:16px;font-weight:700;letter-spacing:-.01em}",
  ".hd-sub{font-size:12.5px;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".hd-step{font-size:12.5px;font-weight:600;color:var(--navy);flex:none}",
  ".ib{width:40px;height:40px;border:0;border-radius:50%;background:transparent;display:grid;place-items:center;color:var(--mute);cursor:pointer;flex:none;text-decoration:none}",
  ".ib:hover{background:var(--soft)}",
  ".ib.call{background:var(--soft);color:var(--navy);margin-left:4px}",
  ".prog{position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--line)}.prog>i{display:block;height:2px;background:var(--navy);transition:width .35s ease}",
  ".det{display:flex;align-items:center;gap:8px;width:100%;margin:0;padding:10px 16px;border:0;border-bottom:1px solid var(--line);background:#fafbfd;text-align:left;font-size:13px;color:var(--mute);cursor:pointer;flex:none}",
  ".det-in{width:100%;max-width:760px;margin:0 auto;display:flex;align-items:center;gap:8px}",
  ".det b{color:var(--ink);font-weight:600}",
  ".det span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  /* Conversation */
  ".g.past .gt{color:var(--mute);font-size:14.5px}",
  ".log{position:relative;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column}",
  ".log-in{margin-top:auto;width:100%;max-width:760px;margin-left:auto;margin-right:auto;padding:20px 20px 16px;display:flex;flex-direction:column;gap:18px}",
  ".g{display:flex;gap:10px;align-items:flex-start;animation:in .28s cubic-bezier(.2,.8,.2,1)}",
  ".ga{width:26px;height:26px;flex:none;border-radius:8px;display:block;margin-top:1px}",
  ".gt{flex:1;min-width:0;font-size:15.5px;line-height:1.55;color:var(--ink);white-space:pre-line;overflow-wrap:anywhere}",
  ".gt b{font-weight:600}",
  ".gh{display:flex;gap:6px;align-items:flex-start;margin-top:4px;font-size:13.5px;line-height:1.5;color:var(--mute);white-space:normal}",
  ".gh svg{flex:none;margin-top:2px}",
  ".u{align-self:flex-end;max-width:78%;padding:10px 14px;border-radius:20px 20px 6px 20px;background:var(--ubub);color:var(--navy);font-size:15px;line-height:1.45;overflow-wrap:anywhere;animation:in .28s cubic-bezier(.2,.8,.2,1)}",
  ".err{color:#b42318}",
  ".dots{display:flex;gap:5px;padding:10px 0}.dots i{width:6px;height:6px;border-radius:50%;background:var(--mute2);animation:blink 1s infinite}.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}",
  /* Answer buttons */
  ".ans{display:flex;flex-wrap:wrap;gap:8px;padding-left:36px;animation:in .28s cubic-bezier(.2,.8,.2,1)}",
  ".ans.row{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -20px;padding:2px 20px 4px 56px}.ans.row::-webkit-scrollbar{display:none}",
  ".c{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border:0;border-radius:999px;background:var(--soft);color:var(--ink);font-size:15px;font-weight:500;white-space:nowrap;cursor:pointer;transition:background .15s}",
  ".c:hover{background:var(--line2)}",
  ".c.on{background:var(--navy);color:#fff}",
  ".c.act{background:transparent;color:var(--blue);padding:0 6px}",
  ".c.soft{background:transparent;color:var(--mute);box-shadow:inset 0 0 0 1px var(--line2)}",
  ".lk{border:0;background:none;padding:0;color:var(--blue);font-size:14px;font-weight:600;cursor:pointer;text-decoration:none}",
  ".back{align-self:flex-start;margin-left:36px;color:var(--mute2);font-weight:500;font-size:13.5px}",
  ".p1{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 22px;border:0;border-radius:14px;background:var(--gold);color:var(--navy);font-size:16px;font-weight:700;text-decoration:none;cursor:pointer}",
  ".p1:hover{background:var(--gold-d)}",
  ".p1[aria-disabled='true']{background:var(--soft);color:var(--mute2);cursor:not-allowed}",
  ".p2{display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 18px;border:0;border-radius:14px;background:#fff;color:var(--navy);box-shadow:inset 0 0 0 1px #d5deeb;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer}",
  ".p2:hover{background:var(--soft2)}",
  ".selwrap{display:flex;flex-direction:column;gap:6px;padding-left:36px;font-size:13px;color:var(--mute)}",
  ".selwrap select{min-height:46px;padding:0 12px;border:1px solid var(--line2);border-radius:12px;background:#fff;font-size:15px;color:var(--ink);max-width:320px}",
  ".txt{display:flex;gap:8px;padding-left:36px}.txt input{flex:1;min-width:0;max-width:280px;min-height:46px;padding:0 14px;border:1px solid var(--line2);border-radius:12px;font-size:16px;color:var(--ink)}",
  /* Start screen */
  ".hello{display:flex;flex-direction:column;gap:8px;padding-bottom:4px;animation:in .28s cubic-bezier(.2,.8,.2,1)}",
  ".hello img{width:44px;height:44px;border-radius:12px;display:block}",
  ".hello h1{font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1.15}",
  ".hello p{font-size:15px;line-height:1.5;color:var(--mute)}",
  ".starts{display:flex;flex-direction:column;border-top:1px solid var(--line)}",
  ".st{display:flex;align-items:center;gap:14px;min-height:58px;padding:0 2px;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;color:var(--ink);cursor:pointer;font-size:15.5px;font-weight:500}",
  ".st:hover{background:var(--soft2)}",
  ".st-ic{width:36px;height:36px;flex:none;border-radius:10px;background:var(--soft);display:grid;place-items:center;color:var(--navy)}",
  ".st .st-l{flex:1}.st .chev{flex:none;color:#a3acbb}",
  /* Car card */
  ".car{display:flex;align-items:center;gap:14px;padding:12px;border-radius:16px;background:var(--soft2);animation:in .28s cubic-bezier(.2,.8,.2,1)}",
  ".car-pic{width:84px;height:52px;flex:none;border-radius:12px;background:#fff;display:grid;place-items:center}",
  ".car-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.car-tx b{font-size:16px;font-weight:700}.car-tx small{font-size:13px;color:var(--mute)}",
  /* Match cards */
  ".mcard{border-radius:20px;border:1px solid #e9edf3;box-shadow:0 12px 32px rgba(11,42,91,.08);padding:18px;display:flex;flex-direction:column;gap:14px;background:#fff;animation:in .3s cubic-bezier(.2,.8,.2,1)}",
  ".m-top{display:flex;justify-content:space-between;align-items:center;gap:8px}",
  ".tag{padding:4px 10px;border-radius:999px;background:#fff6e0;color:#8a5a00;font-size:12px;font-weight:600}",
  ".tag.g{background:var(--soft);color:var(--ink2)}",
  ".m-lbl{font-size:11.5px;color:var(--mute2)}",
  ".m-id{display:flex;gap:12px;align-items:center}",
  ".m-logo{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;color:#fff;font-size:18px;font-weight:800;overflow:hidden}",
  ".m-logo.img{background:#fff;box-shadow:inset 0 0 0 1px var(--line2);padding:6px}.m-logo img{max-width:100%;max-height:100%;object-fit:contain;display:block}",
  ".m-name{font-size:18px;font-weight:700;letter-spacing:-.01em;line-height:1.25}",
  ".m-why{font-size:15px;line-height:1.5;color:var(--ink2)}",
  ".m-facts{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;color:var(--mute)}.m-facts span{display:flex;align-items:center;gap:5px}.m-facts svg{color:#12a150}",
  ".m-btns{display:flex;flex-direction:column;gap:8px}",
  ".m-note{font-size:12px;line-height:1.45;color:var(--mute2);text-align:center}",
  ".m-links{display:flex;justify-content:space-between;gap:12px;font-size:13.5px}",
  ".fine{font-size:12px;line-height:1.5;color:var(--mute2);text-align:center}",
  ".fine a{color:var(--mute)}",
  /* Composer */
  ".foot{flex:none;padding:10px 16px calc(12px + env(safe-area-inset-bottom));background:#fff}",
  ".foot-in{width:100%;max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:8px}",
  ".comp{display:flex;align-items:center;gap:8px;padding:5px 5px 5px 16px;border-radius:26px;border:1px solid var(--line2);background:#fff;box-shadow:0 4px 16px rgba(11,42,91,.06)}",
  ".comp:focus-within{border-color:var(--navy);box-shadow:0 0 0 3px var(--ring)}",
  ".comp input{flex:1;min-width:0;min-height:42px;border:0;background:transparent;font-size:16px;color:var(--ink);outline:none}",
  ".ig .comp input:focus-visible{outline:none}",
  ".ig input::placeholder{color:var(--mute2);opacity:1}",
  ".send{width:42px;height:42px;flex:none;border:0;border-radius:50%;background:var(--navy);display:grid;place-items:center;color:#fff;cursor:pointer}",
  ".send:disabled{background:var(--line2);cursor:default}",
  ".disc{margin:0;text-align:center;font-size:11px;color:#a3acbb}.disc a{color:#a3acbb}",
  /* Leave sheet + dialogs */
  ".ov{position:fixed;inset:0;background:rgba(14,27,51,.45);z-index:50;display:flex;align-items:flex-end;justify-content:center}",
  ".sheet,.dlg{background:#fff;color:var(--ink);width:100%;max-width:480px;max-height:92vh;max-height:92dvh;overflow:auto;border-radius:24px 24px 0 0;padding:12px 20px 22px;animation:up .3s cubic-bezier(.2,.8,.2,1)}",
  "@media (min-width:640px){.ov{align-items:center}.sheet,.dlg{border-radius:20px;padding:20px 24px 24px}}",
  ".grab{width:40px;height:4px;border-radius:999px;background:#dce3ec;margin:0 auto 14px}",
  "@media (min-width:640px){.grab{display:none}}",
  ".sheet h2,.dlg h2{font-family:'Plus Jakarta Sans',Inter,sans-serif;font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.25}",
  ".sheet p{font-size:15px;line-height:1.5;color:var(--mute);margin:8px 0 16px}",
  ".sheet .p1,.sheet .p2{width:100%;margin-bottom:8px}",
  ".dlg .sub{font-size:14px;line-height:1.5;color:var(--mute);margin-top:4px}",
  ".dlg-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}",
  ".x{width:40px;height:40px;border:0;border-radius:50%;background:var(--soft);color:var(--ink);display:grid;place-items:center;cursor:pointer;flex:none}",
  ".fld{margin-bottom:16px}",
  ".fld label,.fld .lbl{display:block;font-size:13px;font-weight:600;color:var(--ink2);margin-bottom:6px}",
  ".fld input{width:100%;height:50px;padding:0 14px;border:1px solid #dfe5ee;border-radius:12px;font-size:16px;color:var(--ink);background:#fff}",
  ".fld input:focus{outline:none;border-color:var(--navy);box-shadow:0 0 0 3px var(--ring)}",
  ".seg{display:flex;flex-wrap:wrap;gap:8px}",
  ".seg button{min-height:44px;padding:0 16px;border:0;border-radius:999px;background:var(--soft);color:var(--ink);font-size:14px;font-weight:500;cursor:pointer}",
  ".seg button[aria-pressed='true']{background:var(--navy);color:#fff}",
  ".agree{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:14px;background:var(--soft2);font-size:12.5px;line-height:1.55;color:var(--ink2);cursor:pointer;margin-bottom:12px}",
  ".agree input{width:20px;height:20px;margin:1px 0 0;accent-color:var(--navy);flex:none}",
  ".errmsg{font-size:13px;line-height:1.4;color:#b42318;margin-bottom:12px}",
  ".btn{display:flex;align-items:center;justify-content:center;min-height:52px;width:100%;padding:0 16px;border:0;border-radius:14px;font-size:16px;font-weight:600;text-decoration:none;cursor:pointer;margin-top:8px}",
  ".btn-p{background:var(--gold);color:var(--navy);font-weight:700}.btn-p:hover{background:var(--gold-d)}",
  ".btn:disabled{background:var(--soft);color:var(--mute2);cursor:not-allowed}",
  ".done{text-align:center;padding:8px 0}.done p{font-size:15px;line-height:1.5;color:var(--ink2)}",
  ".tick{width:52px;height:52px;border-radius:50%;background:#e9f7ef;color:#12a150;display:grid;place-items:center;margin:0 auto 12px}",
  /* Email card */
  ".ecard{margin-left:36px;padding:14px;border-radius:16px;background:var(--soft2);display:grid;grid-template-columns:minmax(0,1fr);gap:10px;max-width:460px;animation:in .3s ease-out both}",
  ".ecard.done{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--navy);font-weight:600}",
  ".e-lbl{font-size:13px;font-weight:600;color:var(--ink2)}",
  ".e-row{display:flex;gap:8px;min-width:0}.e-row input{flex:1 1 auto;width:100%;min-width:0;min-height:46px;padding:0 12px;border:1px solid #dfe5ee;border-radius:12px;font-size:16px;color:var(--ink);background:#fff}.e-row input:focus{outline:none;border-color:var(--navy);box-shadow:0 0 0 3px var(--ring)}",
  ".e-row .btn{flex:none;width:auto;min-height:46px;margin-top:0;white-space:nowrap;padding:0 16px}",
  ".e-ck{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.45;color:var(--ink2);min-width:0}.e-ck span{min-width:0}.e-ck input{margin-top:2px;width:18px;height:18px;flex:none;accent-color:var(--navy)}.e-ck a{color:var(--blue)}",
  ".e-err{margin:0;font-size:13px;color:#b42318}",
  "@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}",
  "@keyframes up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}",
  "@keyframes blink{0%,80%,100%{opacity:.25}40%{opacity:1}}",
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
  tag: "M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z M7.5 7.5h.01",
  headset: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  alert: "M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 17h.01",
  scale: "M16 16l3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1z M2 16l3-8 3 8c-.9.7-1.9 1-3 1s-2.1-.3-3-1z M7 21h10 M12 3v18 M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  unlock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 9.9-1",
  lock: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
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
// Optional email sign-up (our own emails only; never shared or sold)
// ---------------------------------------------------------------
var EMAIL_CONSENT = T("Email me my answers, tips and updates from AI InsureGenie, including when new partners cover my state. I can unsubscribe at any time. AI InsureGenie won't sell or share my email.", "Envíenme por correo mis respuestas, consejos y novedades de AI InsureGenie, incluso cuando haya nuevos socios en mi estado. Puedo darme de baja en cualquier momento. AI InsureGenie no venderá ni compartirá mi correo.");
function EmailCard({ profile, source, onDone }) {
  var [email, setEmail] = useState("");
  var [agree, setAgree] = useState(false);
  var [err, setErr] = useState("");
  var [state, setState] = useState("idle");
  var submit = async function () {
    var r = vEmail(email);
    if (!r.ok) { setErr(r.e); return; }
    if (!agree) { setErr(T("Check the box so we can email you.", "Marque la casilla para que podamos escribirle.")); return; }
    setErr(""); setState("sending");
    try {
      var res = await fetch(API_BASE + "/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        email: r.v, consent_text: EMAIL_CONSENT, consent_timestamp: new Date().toISOString(), source: source, lang: LANG,
        state: profile.state || null, zip: profile.zip || null, vehicle_year: profile.vehicleYear || null, vehicle_make: profile.vehicleMake || null,
        driving_record: profile.driving || null, priority: profile.priority || null, session_id: SESSION_ID, landing_page: window.location.href
      }) });
      if (!res.ok) throw new Error("bad");
      setState("done"); track("email_signup", { source: source, state: profile.state || null }); if (onDone) onDone();
    } catch (e) { setState("idle"); setErr(T("We couldn't save your email. Please try again.", "No pudimos guardar su correo. Intente de nuevo.")); }
  };
  if (state === "done") return <div className="ecard done"><Icon n="check" size={16} /> {T("You're on the list. Check your inbox soon.", "Ya está en la lista. Revise su correo pronto.")}</div>;
  return (
    <div className="ecard">
      <label className="e-lbl" htmlFor={"em-" + source}>{T("Your email", "Su correo electrónico")}</label>
      <div className="e-row">
        <input id={"em-" + source} type="email" inputMode="email" autoComplete="email" placeholder={T("you@email.com", "usted@correo.com")} value={email} onChange={function (e) { setEmail(e.target.value); setErr(""); }} />
        <button type="button" className="btn btn-p" disabled={state === "sending"} onClick={submit}>{state === "sending" ? T("Saving...", "Guardando...") : T("Email me", "Enviarme")}</button>
      </div>
      <label className="e-ck"><input type="checkbox" checked={agree} onChange={function (e) { setAgree(e.target.checked); setErr(""); }} /><span>{EMAIL_CONSENT} <a href="https://aiinsuregenie.com/privacy/" target="_blank" rel="noopener noreferrer">{T("Privacy policy", "Política de privacidad")}</a></span></label>
      {err ? <p className="e-err" role="alert">{err}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------
// Talk-to-an-agent dialog (mounts fresh each time it opens)
// ---------------------------------------------------------------
function CallModal({ profile, onClose, onSent }) {
  var [name, setName] = useState(profile.firstName || "");
  var [phone, setPhone] = useState(profile.phone ? fmtPhone(profile.phone) : "");
  var WHEN = T(["As soon as possible", "Morning", "Afternoon", "Evening"], ["Lo antes posible", "En la mañana", "En la tarde", "En la noche"]);
  var [when, setWhen] = useState(WHEN[0]);
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
    if (name.trim().length < 2) { setErr(T("Enter your first name.", "Escriba su nombre.")); return; }
    var r = vPhone(phone);
    if (!r.ok) { setErr(r.e); return; }
    if (!agree) { setErr(T("Check the box to let an agent call you.", "Marque la casilla para que un agente le llame.")); return; }
    setErr(""); setSending(true);
    try {
      var res = await fetch(API_BASE + "/api/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), phone: r.v, preferred_time: when,
          zip: profile.zip || null, state: profile.state || null,
          consent_text: CALL_CONSENT, consent_timestamp: new Date().toISOString(),
          landing_page: window.location.href, session_id: SESSION_ID, do_not_sell: DO_NOT_SELL
        })
      });
      if (!res.ok) throw new Error("bad status");
      setDone(true);
      track("call_request", { state: profile.state || null });
      if (onSent) onSent({ name: name.trim(), phone: r.v });
    } catch (e) {
      setErr(T("We couldn't send your request. Please try again in a moment.", "No pudimos enviar su solicitud. Intente de nuevo en un momento."));
    }
    setSending(false);
  };

  return (
    <div className="ov" onClick={function (e) { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-modal="true" aria-labelledby="call-h">
        <div className="dlg-hd">
          <div>
            <h2 id="call-h">{done ? T("Request received", "Solicitud recibida") : T("Talk to a licensed agent", "Hable con un agente con licencia")}</h2>
            {!done ? <p className="sub">{T("Leave your number and an agent will call you. It's free and there's no obligation.", "Deje su número y un agente le llamará. Es gratis y sin compromiso.")}</p> : null}
          </div>
          <button type="button" className="x" aria-label={T("Close", "Cerrar")} onClick={onClose}><Icon n="close" size={18} /></button>
        </div>
        {done ? (
          <div className="done">
            <div className="tick"><Icon n="check" size={24} /></div>
            <p>{T("An agent will call ", "Un agente llamará al ") + phone + " (" + when.toLowerCase() + ")."}</p>
            <button type="button" className="btn btn-p" onClick={onClose}>{T("Done", "Listo")}</button>
          </div>
        ) : (
          <div>
            <div className="fld">
              <label htmlFor="c-name">{T("First name", "Nombre")}</label>
              <input id="c-name" value={name} onChange={function (e) { setName(e.target.value); }} autoComplete="given-name" autoCapitalize="words" />
            </div>
            <div className="fld">
              <label htmlFor="c-phone">{T("Phone number", "Número de teléfono")}</label>
              <input id="c-phone" value={phone} onChange={function (e) { setPhone(fmtPhone(e.target.value)); }} inputMode="tel" autoComplete="tel" placeholder="(555) 123-4567" />
            </div>
            <div className="fld">
              <span className="lbl" id="c-when">{T("Best time to call", "Mejor hora para llamar")}</span>
              <div className="seg" role="group" aria-labelledby="c-when">
                {WHEN.map(function (x) {
                  return <button type="button" key={x} aria-pressed={when === x} onClick={function () { setWhen(x); }}>{x}</button>;
                })}
              </div>
            </div>
            <label className="agree">
              <input type="checkbox" checked={agree} onChange={function (e) { setAgree(e.target.checked); }} />
              <span>{CALL_CONSENT}</span>
            </label>
            {err ? <p className="errmsg" role="alert">{err}</p> : null}
            <button type="button" className="btn btn-p" onClick={submit} disabled={sending}>{sending ? T("Sending...", "Enviando...") : T("Request a call", "Pedir una llamada")}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Calm chat: 4 tap steps, questions answered anytime, one top match.
// ---------------------------------------------------------------
var LOGO = "/logo-mark.png";
var SITE = ES ? "https://aiinsuregenie.com/es/" : "https://aiinsuregenie.com/";
var POP_STATES = ["TX", "FL", "CA", "GA", "AZ", "IL"];
var MODEL_LIST = {
  Toyota: [["Camry", "sedan"], ["Corolla", "sedan"], ["RAV4", "suv"], ["Tacoma", "truck"]],
  Honda: [["Civic", "sedan"], ["Accord", "sedan"], ["CR-V", "suv"], ["Pilot", "suv"]],
  Ford: [["F-150", "truck"], ["Escape", "suv"], ["Explorer", "suv"], ["Mustang", "sedan"]],
  Chevrolet: [["Silverado", "truck"], ["Equinox", "suv"], ["Malibu", "sedan"], ["Tahoe", "suv"]],
  Nissan: [["Altima", "sedan"], ["Rogue", "suv"], ["Sentra", "sedan"], ["Frontier", "truck"]],
  Hyundai: [["Elantra", "sedan"], ["Tucson", "suv"], ["Santa Fe", "suv"], ["Sonata", "sedan"]],
  Kia: [["Forte", "sedan"], ["Sportage", "suv"], ["Sorento", "suv"], ["K5", "sedan"]],
  Jeep: [["Grand Cherokee", "suv"], ["Wrangler", "suv"], ["Cherokee", "suv"], ["Gladiator", "truck"]]
};
var YEARS = ["2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2016"];
var SIT = [
  { k: "sr22", l: T("Need an SR-22", "Necesito SR-22"), s: "SR-22" },
  { k: "dui", l: T("DUI or DWI", "DUI o DWI"), s: "DUI" },
  { k: "record", l: T("Tickets or an accident", "Multas o un accidente"), s: T("Tickets/accident", "Multas/accidente") },
  { k: "lapse", l: T("Gap in coverage", "Estuve sin seguro"), s: T("Lapse", "Sin seguro") },
  { k: "new", l: T("New or young driver", "Conductor nuevo o joven"), s: T("New driver", "Conductor nuevo") },
  { k: "ride", l: T("Rideshare or delivery", "Uber, Lyft o entregas"), s: T("Rideshare", "Plataformas") },
  { k: "none", l: T("None of these", "Nada de esto"), s: T("Standard", "Estándar") }
];
var COVS = { min: T("State minimum", "Mínimo del estado"), full: T("Full coverage", "Cobertura total"), unsure: T("Not sure yet", "Todavía no sé") };
var WHENS = { today: T("Today", "Hoy"), week: T("This week", "Esta semana"), compare: T("Just comparing", "Solo comparando") };
var ORDER = ["start", "state", "sit", "make", "model", "year", "cov", "when", "done"];
var SAVE_KEY = "aig-chat-v2";

function stName(ab) { return ABBR_STATE[ab] || ab || ""; }
function stepOf(stage) { return { start: 0, state: 1, sit: 2, make: 3, model: 3, year: 3, cov: 4, when: 4, done: 5 }[stage] || 0; }
function bodyOf(make, model) { var m = (MODEL_LIST[make] || []).find(function (x) { return x[0] === model; }); return m ? m[1] : "sedan"; }
function carName(s) { if (s.carAge && !s.make) return s.carAge; return [s.year && s.year !== "unsure" ? (s.year === "old" ? T("2015 or older", "2015 o antes") : s.year) : "", s.make, s.model && s.model !== "unsure" ? s.model : ""].filter(Boolean).join(" "); }
var QH = { state: T("Which state do you live in?", "¿En qué estado vive?"), sit: T("Anything special about your situation?", "¿Algo especial en su situación?"), make: T("What car do you drive?", "¿Qué auto maneja?"), model: T("Which model?", "¿Qué modelo?"), year: T("And the year?", "¿Y el año?"), cov: T("What coverage do you need?", "¿Qué cobertura necesita?"), when: T("When do you need it to start?", "¿Cuándo la necesita?") };
function questionsLeft(s) {
  var FILL = { state: { st: "X" }, sit: { sitDone: true }, make: { make: "X" }, model: { model: "X" }, year: { year: "X" }, cov: { cov: "X" }, when: { when: "X" } };
  var x = Object.assign({}, s), n = 0, st;
  while ((st = nextStage(x)) !== "done" && n < 9) { if (!(st === "model" || st === "year")) n++; Object.assign(x, FILL[st]); }
  return n;
}
function nextStage(s) {
  if (!s.st) return "state";
  if (!s.sitDone) return "sit";
  if (!s.make && !s.carAge) return "make";
  if (!s.model && MODEL_LIST[s.make]) return "model";
  if (!s.year) return "year";
  if (!s.cov && s.pri !== "price") return "cov";
  if (!s.when) return "when";
  return "done";
}
function toProfile(s) {
  var sits = s.sits || [];
  var p = { state: s.st || undefined };
  p.driving = (sits.indexOf("sr22") >= 0 || sits.indexOf("dui") >= 0) ? "dui" : (sits.indexOf("record") >= 0 ? "major" : (s.sitDone ? "clean" : undefined));
  if (sits.indexOf("lapse") >= 0) p.insured = "no";
  if (sits.indexOf("new") >= 0) p.age = 22;
  if (s.make && s.make !== "Other") p.vehicleMake = s.make;
  if (s.year && /^\d{4}$/.test(s.year)) p.vehicleYear = s.year; else if (s.year === "old") p.vehicleYear = "2012";
  p.coverage = s.cov === "min" ? "minimum" : (s.cov === "full" ? "full" : "standard");
  p.priority = s.pri || (s.cov === "full" ? "coverage" : "price");
  return p;
}
function setResumeCookie(s) {
  try {
    if (!/aiinsuregenie\.com$/.test(location.hostname)) return;
    var step = stepOf(s.stage);
    if (step < 2) { document.cookie = "aig_resume=; domain=.aiinsuregenie.com; path=/; max-age=0"; return; }
    document.cookie = "aig_resume=" + (s.stage === "done" ? "done" : step) + "|" + LANG + "; domain=.aiinsuregenie.com; path=/; max-age=604800; SameSite=Lax";
  } catch (e) {}
}
function Bold({ text }) {
  var parts = String(text || "").split("**");
  return <>{parts.map(function (t, i) { return i % 2 ? <b key={i}>{t}</b> : <span key={i}>{t}</span>; })}</>;
}
function Svg({ d, size, sw }) {
  return <svg width={size || 18} height={size || 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw || 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}
var I_PHONE = <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />;
var I_INFO = <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>;
var I_CHECK = <path d="M20 6L9 17l-5-5" />;
var I_EDIT = <path d="M4 20h4L19 9l-4-4L4 16z" />;
var I_CHEV = <path d="M9 6l6 6-6 6" />;
var START_ICONS = {
  doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  tag: <><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  car: <><path d="M5 17h14M3 13l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5v4a1 1 0 0 1-1 1h-1M4 18a1 1 0 0 1-1-1v-4h18" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="16.5" cy="17" r="1.6" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>
};
function CarPic({ body }) {
  if (body === "suv") return <svg width="70" height="29" viewBox="0 0 260 108" aria-hidden="true"><path d="M16 78 L16 60 C16 54 20 50 27 49 L60 46 L80 24 C83 21 87 19 92 19 L196 19 C204 19 210 23 214 30 L228 50 C238 52 246 58 246 68 L246 80 C246 83 244 85 241 85 L21 85 C18 85 16 83 16 80 Z" fill="#0b2a5b" /><path d="M88 27 L128 27 L128 48 L70 48 Z" fill="#dbe7ff" /><path d="M134 27 L176 27 L176 48 L134 48 Z" fill="#dbe7ff" /><circle cx="70" cy="85" r="17" fill="#1f2a3d" /><circle cx="198" cy="85" r="17" fill="#1f2a3d" /></svg>;
  if (body === "truck") return <svg width="72" height="29" viewBox="0 0 270 108" aria-hidden="true"><path d="M14 80 L14 54 L130 54 L130 80 Z" fill="#0b2a5b" /><path d="M128 80 L128 24 C128 20 131 18 135 18 L186 18 C192 18 197 21 200 26 L214 48 L244 52 C251 53 256 58 256 66 L256 82 C256 84 254 86 252 86 L18 86 C16 86 14 84 14 82 Z" fill="#0b2a5b" /><path d="M138 26 L184 26 C188 26 191 28 193 31 L204 48 L138 48 Z" fill="#dbe7ff" /><circle cx="62" cy="86" r="17" fill="#1f2a3d" /><circle cx="208" cy="86" r="17" fill="#1f2a3d" /></svg>;
  return <svg width="70" height="27" viewBox="0 0 260 100" aria-hidden="true"><path d="M14 70 C14 61 21 57 33 55 L70 50 C85 37 105 27 132 27 L160 27 C181 27 197 37 211 49 L234 53 C244 55 248 61 248 68 L248 72 C248 75 246 77 243 77 L20 77 C16 77 14 75 14 70 Z" fill="#0b2a5b" /><path d="M82 50 C93 39 108 33 128 33 L136 33 L136 50 Z" fill="#dbe7ff" /><path d="M142 33 L158 33 C174 33 186 40 196 50 L142 50 Z" fill="#dbe7ff" /><circle cx="70" cy="77" r="16" fill="#1f2a3d" /><circle cx="70" cy="77" r="6" fill="#ffffff" /><circle cx="200" cy="77" r="16" fill="#1f2a3d" /><circle cx="200" cy="77" r="6" fill="#ffffff" /></svg>;
}

function whyLine(s) {
  var where = T(" in ", " en ") + stName(s.st);
  var sits = s.sits || [];
  if (sits.indexOf("sr22") >= 0 || sits.indexOf("dui") >= 0) return T("A quoting partner that compares quotes from insurers", "Un socio de cotización que compara cotizaciones de aseguradoras") + where + T(". Mention you need an SR-22 so they can show insurers that file it.", ". Mencione que necesita una SR-22 para que le muestren aseguradoras que la presentan.");
  if (sits.indexOf("ride") >= 0) return T("A quoting partner that compares quotes from insurers", "Un socio de cotización que compara cotizaciones de aseguradoras") + where + T(". Ask about coverage for when the rideshare app is on.", ". Pregunte por cobertura para cuando la app está encendida.");
  if (sits.indexOf("lapse") >= 0 || sits.indexOf("record") >= 0) return T("A quoting partner that compares quotes from insurers", "Un socio de cotización que compara cotizaciones de aseguradoras") + where + T(". Share your history so your quotes are accurate.", ". Comparta su historial para que sus cotizaciones sean precisas.");
  return T("A quoting partner that compares quotes from insurers", "Un socio de cotización que compara cotizaciones de aseguradoras") + where + T(" in one form.", " en un solo formulario.");
}

function MatchCard({ ins, s, top, onCall }) {
  var [broken, setBroken] = useState(false);
  var logo = ins.logoUrl && !broken;
  var sponsored = !!(ins.pinned || ins.featured);
  return (
    <article className="mcard" aria-label={ins.n}>
      <div className="m-top"><span className={"tag" + (top ? "" : " g")}>{top ? T("Matches your answers", "Coincide con sus respuestas") : T("Also fits", "También encaja")}</span><span className="m-lbl">{sponsored ? T("Sponsored partner", "Socio patrocinado") : T("Partner", "Socio")}</span></div>
      <div className="m-id">
        <span className={"m-logo pj" + (logo ? " img" : "")} style={logo ? undefined : { background: ins.bc || "#0f766e" }} aria-hidden="true">{logo ? <img src={ins.logoUrl} alt="" onError={function () { setBroken(true); }} /> : (ins.n || "?").charAt(0)}</span>
        <span className="m-name pj">{ins.n}</span>
      </div>
      <p className="m-why">{whyLine(s)}</p>
      <div className="m-facts">{[T("Free to compare", "Comparar es gratis"), T("No obligation", "Sin compromiso"), T("Their short form", "Su formulario corto")].map(function (f) { return <span key={f}><Svg d={I_CHECK} size={14} sw={2.4} />{f}</span>; })}</div>
      <div className="m-btns">
        <a className="p1" href={ins.rUrl || "#"} target="_blank" rel="noopener noreferrer sponsored" onClick={function () { track("partner_click", { partner_id: ins.id, placement: top ? "top" : "other", state: s.st || null }); }}>{T("Get my quote", "Obtener mi cotización")}</a>
        {top ? <button type="button" className="p2" onClick={onCall}><Svg d={I_PHONE} size={17} />{T("Talk to a licensed agent", "Hablar con un agente con licencia")}</button> : null}
      </div>
      <p className="m-note">{T("Opens " + ins.n + "'s site in a new tab. Fill in their short form to see your quotes.", "Abre el sitio de " + ins.n + " en otra pestaña. Llene su formulario corto para ver sus cotizaciones.")}</p>
    </article>
  );
}

function fresh() {
  return { stage: "start", st: "", changing: false, sits: [], sitDone: false, make: "", model: "", year: "", cov: "", when: "", pri: "", carAge: "", hist: [], said: "", note: "", otherMake: false, qa: null, askMore: false, results: null, showAll: false, showEmail: "" };
}

export default function AIInsureGenie() {
  var [s, setS] = useState(fresh);
  var [typing, setTyping] = useState(false);
  var [draft, setDraft] = useState("");
  var [geo, setGeo] = useState("");
  var [showCall, setShowCall] = useState(false);
  var [leave, setLeave] = useState(false);
  var [list, setList] = useState(IS_PREVIEW ? DEFAULT_INSURERS : []);
  var logRef = useRef(null), inRef = useRef(null), tRef = useRef(null), sRef = useRef(s);
  sRef.current = s;

  // Partners from the dashboard (refreshed every 30 seconds).
  useEffect(function () {
    async function load() { var l = await loadInsurers(); if (l) { INSURERS = l; setList(l); } }
    load(); var iv = setInterval(load, 30000);
    return function () { clearInterval(iv); };
  }, []);
  // Best guess of the visitor's state, from the API (Cloudflare location). Never stored.
  useEffect(function () {
    fetch(API_BASE + "/api/geo").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.state && ABBR_STATE[j.state]) setGeo(j.state); }).catch(function () {});
  }, []);
  useEffect(function () {
    var el = logRef.current; if (!el) return;
    setTimeout(function () {
      var a = el.querySelector("[data-anchor]");
      var top = a ? Math.min(a.offsetTop - 12, el.scrollHeight) : el.scrollHeight;
      el.scrollTo({ top: top, behavior: "smooth" });
    }, 60);
  }, [s.stage, s.qa, s.askMore, s.showAll, s.showEmail, s.note, typing, Array.isArray(s.results) ? s.results.length : s.results, (s.hist || []).length]);
  // Save progress for 7 days, so a visitor who leaves can pick up where they were.
  useEffect(function () {
    if (s.stage === "start") return; // never overwrite saved progress with the empty welcome screen
    try { var keep = Object.assign({}, s, { qa: null, askMore: false, results: null, showAll: false, showEmail: "" }); localStorage.setItem(SAVE_KEY, JSON.stringify({ t: Date.now(), s: keep })); } catch (e) {}
    setResumeCookie(s);
  }, [s]);

  // Every answer goes through go(): short "typing" pause, then the next question.
  var go = function (o, quiet) {
    var next = Object.assign({}, sRef.current, o);
    if (!quiet) { setTyping(true); clearTimeout(tRef.current); tRef.current = setTimeout(function () { setTyping(false); }, 500); }
    var cur0 = sRef.current;
    if (next.stage !== cur0.stage) track("step_answered", { step: cur0.stage, state: next.st || null });
    if (next.stage !== cur0.stage && o.said) next.hist = (cur0.hist || []).concat([{ q: QH[cur0.stage] || null, a: o.said }]).slice(-12);
    if (next.stage === "done" && !next.results) next = Object.assign(next, { results: "loading" });
    setS(next);
    if (next.results === "loading") showMatch(next);
  };
  var answer = function (said, o) { var n = Object.assign({}, sRef.current, o); go(Object.assign({ said: said, note: "", otherMake: false }, o, { stage: nextStage(n) })); };

  var showMatch = async function (n) {
    if (!INSURERS.length) { var l = await loadInsurers(); if (l) { INSURERS = l; setList(l); } }
    var p = toProfile(n);
    var r = pickPartners(p).map(function (ins) { return Object.assign({}, ins, { rUrl: buildUrl(ins, p) }); });
    if (r.length) track("match_shown", { partner_id: r[0].id, state: p.state || null, goal: p.priority || null, options: r.length });
    else track("no_match", { state: p.state || null, goal: p.priority || null });
    setTimeout(function () { setS(function (cur) { return Object.assign({}, cur, { results: r }); }); }, 700);
  };

  // A question typed or tapped at any point: answer it, keep the match where it is.
  var ask = function (text) {
    var o = parseFree(text, null), cur = sRef.current, merge = {}, noted = [];
    if (o.state && !cur.st) { merge.st = o.state; noted.push(stName(o.state)); }
    if (o.driving === "dui" || o.driving === "major") {
      var k = o.driving === "dui" ? "dui" : "record";
      if (cur.sits.indexOf(k) < 0) { merge.sits = cur.sits.filter(function (x) { return x !== "none"; }).concat([k]); noted.push(k === "dui" ? "DUI" : T("an accident or ticket", "un accidente o multa")); }
    }
    var qa = { q: text, a: null, noted: noted.join(T(" and ", " y ")), agent: /(dui|dwi|sr-?22|accident|ticket|rate|price|cost|raise|multa|accidente|precio)/i.test(text) };
    setS(Object.assign({}, cur, merge, { qa: qa, askMore: false }));
    track("question_asked", { stage: cur.stage }, false);
    getAnswer(text, toProfile(Object.assign({}, cur, merge)), Array.isArray(cur.results) ? cur.results : []).then(function (a) {
      setS(function (c) { return c.qa && c.qa.q === text ? Object.assign({}, c, { qa: Object.assign({}, c.qa, { a: a }) }) : c; });
    });
  };
  var keepGoing = function () {
    var cur = sRef.current;
    go({ qa: null, askMore: false, stage: cur.stage === "start" ? nextStage(cur) : cur.stage, said: cur.stage === "start" ? "" : cur.said });
  };

  // Typed text: a question gets an answer; "Texas, 2019 Camry, SR-22" fills the answers it contains.
  var send = function () {
    var text = draft.trim(); if (!text || typing) return; setDraft("");
    var cur = sRef.current;
    if (cur.stage === "make" && cur.otherMake && !isQuestion(text, "qualifying", "vmake")) { var mk = text.charAt(0).toUpperCase() + text.slice(1); answer(mk, { make: mk.slice(0, 30), model: "unsure" }); return; }
    if (isQuestion(text, "qualifying", null)) { ask(text); return; }
    var o = parseFree(text, null), lower = " " + text.toLowerCase() + " ", got = {}, said = [];
    if (o.state) { got.st = o.state; said.push(stName(o.state)); }
    var sits = cur.sits.slice();
    if (/\bsr-?22\b/.test(lower)) sits.push("sr22");
    if (/\b(dui|dwi)\b/.test(lower)) sits.push("dui");
    if (/(uber|lyft|rideshare|doordash|delivery)/.test(lower)) sits.push("ride");
    if (/(lapse|gap in|no insurance|uninsured)/.test(lower)) sits.push("lapse");
    if (/(accident|ticket|crash)/.test(lower)) sits.push("record");
    sits = sits.filter(function (x, i, a) { return x !== "none" && a.indexOf(x) === i; });
    if (sits.length > cur.sits.length) { got.sits = sits; got.sitDone = true; said.push(SIT.filter(function (x) { return sits.indexOf(x.k) >= 0; }).map(function (x) { return x.s; }).join(" + ")); }
    if (o.vehicleMake) { got.make = o.vehicleMake; }
    Object.keys(MODEL_LIST).forEach(function (mk) { MODEL_LIST[mk].forEach(function (md) { if (lower.indexOf(" " + md[0].toLowerCase() + " ") >= 0) { got.make = mk; got.model = md[0]; } }); });
    if (o.vehicleYear) got.year = parseInt(o.vehicleYear, 10) <= 2015 ? "old" : o.vehicleYear;
    if (got.make) said.push(carName(Object.assign({}, cur, got)));
    if (o.priority === "price") got.pri = "price";
    if (!Object.keys(got).length) { ask(text); return; }
    var n = Object.assign({}, cur, got);
    go(Object.assign(got, { said: text, qa: null, note: T("Got it: ", "Perfecto: ") + said.filter(Boolean).join(", ") + T(". I just need the rest.", ". Solo me falta lo demás."), stage: nextStage(n) }));
  };

  // Open the right flow when arriving from the website (#start=quote&situation=sr22&state=Texas...).
  useEffect(function () {
    var h = (window.location.hash || "").replace(/^#/, "");
    if (!h) {
      try {
        var saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
        if (saved && saved.s && Date.now() - saved.t < 7 * 864e5 && stepOf(saved.s.stage) >= 2) {
          setS(Object.assign(fresh(), saved.s, { said: "", note: saved.s.stage === "done" ? T("Welcome back! Your match is still here.", "¡Bienvenido de nuevo! Su opción sigue aquí.") : T("Welcome back! Let's pick up where you left off.", "¡Bienvenido de nuevo! Sigamos donde lo dejó.") }));
          if (saved.s.stage === "done") showMatch(saved.s);
          track("chat_resumed", { stage: saved.s.stage }, true);
        }
      } catch (e) {}
      return;
    }
    var p = new URLSearchParams(h);
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) {}
    var start = p.get("start"), q = (p.get("q") || "").trim().slice(0, 200);
    var t = setTimeout(function () {
      var o = Object.assign(fresh(), { stage: "start" }), said = [];
      var stN = (p.get("state") || "").trim(), ab = STATE_ABBR[stN.toLowerCase()];
      if (ab) { o.st = ab; said.push(stName(ab)); }
      var goal = p.get("goal");
      if (goal === "price") { o.pri = "price"; said.push(T("Lowest price", "Precio más bajo")); }
      if (goal === "coverage") { o.pri = "coverage"; o.cov = "full"; said.push(T("Be properly protected", "Buena protección")); }
      var car = p.get("car") || "", yr = CAR_AGE_YEAR[car];
      if (yr) { o.year = yr; o.carAge = ({ "2020 or newer": T("2020 or newer", "2020 o más nuevo"), "2015 to 2019": T("2015 to 2019", "2015 a 2019"), "2014 or older": T("2014 or older", "2014 o más antiguo") })[car] || car; said.push(o.carAge); }
      var SITMAP = { sr22: "sr22", lapse: "lapse", record: "record", "new-driver": "new", rideshare: "ride" };
      var sk = SITMAP[p.get("situation") || ""];
      if (sk) { o.sits = [sk]; o.sitDone = true; said.unshift(SIT.filter(function (x) { return x.k === sk; })[0].l); }
      var RS = { year: T("it's been over a year since I compared", "hace más de un año que no comparo"), renewal: T("my renewal price went up", "mi renovación subió de precio"), changed: T("I moved, changed cars, or added a driver", "me mudé, cambié de auto o agregué un conductor"), cleared: T("a ticket or claim has dropped off my record", "una multa o reclamo ya salió de mi historial") };
      var rs = (p.get("reasons") || "").split(",").map(function (k) { return RS[k.trim()]; }).filter(Boolean);
      if (q) { track("chat_started", { mode: "question" }, true); setS(o); setTimeout(function () { ask(q); }, 50); return; }
      if (start === "agent") { track("chat_started", { mode: "agent" }, true); setS(o); setShowCall(true); return; }
      if (start === "ask") { track("chat_started", { mode: "question" }, true); setS(Object.assign(o, { askMore: true })); setTimeout(function () { inRef.current && inRef.current.focus(); }, 300); return; }
      if (start === "quote") {
        track("chat_started", { mode: "quote" }, true);
        if (rs.length) { o.said = T("I want to compare: ", "Quiero comparar: ") + rs.join(", "); o.note = rs.length > 1 ? T("Good call. With a few things changed, your current rate may be out of date, so comparing now makes sense.", "Buena idea. Con varios cambios, su tarifa actual puede estar desactualizada, así que conviene comparar ahora.") : T("Good call. That's a common reason rates change, so it's worth comparing now.", "Buena idea. Es un motivo común de cambio de tarifa, así que vale la pena comparar ahora."); }
        else if (said.length) o.said = said.join(" · ");
        o.stage = nextStage(o);
        if (o.said) { o.hist = [{ q: null, a: o.said }]; var left = questionsLeft(o);
          if (!rs.length && said.length > 1) o.note = T("Thanks, I've got your answers from the homepage.", "Gracias, ya tengo sus respuestas de la página principal.") + (left ? T(" Just " + left + " more " + (left === 1 ? "question" : "questions") + ".", " Solo " + left + (left === 1 ? " pregunta más." : " preguntas más.")) : ""); }
        setS(o);
      }
    }, 200);
    return function () { clearTimeout(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- What to show for the current step ----------
  var stage = s.stage, at = ORDER.indexOf(stage), step = stepOf(stage);
  var guess = s.st || geo;
  var Q = null, chips = [], extra = [], rowMode = false, multi = false;
  var ch = function (label, fn, cls, on) { return { label: label, fn: fn, cls: "c" + (cls ? " " + cls : "") + (on ? " on" : ""), on: !!on }; };
  if (stage === "state") {
    if (guess && !s.changing) { Q = [T("First, are you in ", "Primero, ¿está en ") + stName(guess) + "?", T("Prices and partners depend on your state.", "Los precios y los socios dependen de su estado.")]; chips = [ch(T("Yes, ", "Sí, ") + stName(guess), function () { answer(stName(guess), { st: guess }); }), ch(T("Change state", "Cambiar estado"), function () { go({ changing: true }, true); }, "soft")]; }
    else { Q = [T("Which state do you live in?", "¿En qué estado vive?"), T("Prices and partners depend on your state.", "Los precios y los socios dependen de su estado.")]; chips = POP_STATES.map(function (ab) { return ch(stName(ab), function () { answer(stName(ab), { st: ab }); }); }); }
  } else if (stage === "sit") {
    multi = true;
    Q = [T("Anything special about your situation?", "¿Algo especial en su situación?"), T("Pick all that apply. Not every insurer handles SR-22s or rideshare.", "Elija todo lo que aplique. No todas las aseguradoras manejan SR-22 o plataformas.")];
    chips = SIT.map(function (x) { var on = s.sits.indexOf(x.k) >= 0; return ch(x.l, function () { var n = s.sits.slice(); if (x.k === "none") n = on ? [] : ["none"]; else { n = n.filter(function (y) { return y !== "none"; }); n = on ? n.filter(function (y) { return y !== x.k; }) : n.concat([x.k]); } go({ sits: n }, true); }, "", on); });
    if (s.sits.some(function (k) { return k === "sr22" || k === "dui"; })) chips.push(ch(T("How fast can an SR-22 be filed?", "¿Qué tan rápido se presenta una SR-22?"), function () { ask(T("How fast can an SR-22 be filed?", "¿Qué tan rápido se presenta una SR-22?")); }, "act"));
  } else if (stage === "make") {
    Q = s.otherMake ? [T("Type your car's make below.", "Escriba abajo la marca de su auto."), ""] : [T("What car do you drive?", "¿Qué auto maneja?"), T("Swipe for more makes, or type it below.", "Deslice para ver más marcas, o escríbala abajo.")];
    if (!s.otherMake) { rowMode = true; chips = Object.keys(MODEL_LIST).map(function (m) { return ch(m, function () { answer(m, { make: m }); }); }); extra = [ch(T("Other make", "Otra marca"), function () { go({ otherMake: true }, true); setTimeout(function () { inRef.current && inRef.current.focus(); }, 100); }, "soft")]; }
  } else if (stage === "model") {
    Q = [T("Which ", "¿Qué ") + s.make + "?", ""];
    chips = (MODEL_LIST[s.make] || []).map(function (m) { return ch(m[0], function () { answer(m[0], { model: m[0] }); }); }).concat([ch(T("I'm not sure", "No estoy seguro"), function () { answer(T("I'm not sure", "No estoy seguro"), { model: "unsure" }); }, "soft")]);
  } else if (stage === "year") {
    Q = [T("And the year?", "¿Y el año?"), T("It's on your registration or insurance card.", "Está en su registro o tarjeta del seguro.")];
    rowMode = true; chips = YEARS.map(function (y) { return ch(y, function () { answer(y, { year: y }); }); }).concat([ch(T("2015 or older", "2015 o antes"), function () { answer(T("2015 or older", "2015 o antes"), { year: "old" }); })]);
    extra = [ch(T("I'm not sure", "No estoy seguro"), function () { answer(T("I'm not sure", "No estoy seguro"), { year: "unsure" }); }, "soft")];
  } else if (stage === "cov") {
    Q = [T("What coverage do you need?", "¿Qué cobertura necesita?"), T("State minimum is the cheapest legal option. Full coverage also pays to fix your own car.", "El mínimo del estado es la opción legal más barata. La cobertura total también paga la reparación de su auto.")];
    chips = [ch(COVS.min, function () { answer(COVS.min, { cov: "min" }); }), ch(COVS.full, function () { answer(COVS.full, { cov: "full" }); }), ch(T("I don't know", "No sé"), function () { answer(T("I don't know", "No sé"), { cov: "unsure" }); }, "soft"), ch(T("What's full coverage?", "¿Qué es cobertura total?"), function () { ask(T("What does full coverage include?", "¿Qué incluye la cobertura total?")); }, "act")];
  } else if (stage === "when") {
    Q = [T("When do you need it to start?", "¿Cuándo la necesita?"), T("This helps us sort your matches.", "Esto nos ayuda a ordenar sus opciones.")];
    chips = Object.keys(WHENS).map(function (k) { return ch(WHENS[k], function () { answer(WHENS[k], { when: k }); }); });
  }
  var showFlow = !s.qa && !typing;
  var partnersHere = list.filter(function (ins) { return fits(ins, { state: s.st || null }); }).length;
  var sub = stage === "done" && Array.isArray(s.results) ? (s.results.length ? s.results.length + T(s.results.length === 1 ? " partner fits you" : " partners fit you", s.results.length === 1 ? " socio encaja" : " socios encajan") : T("AI insurance assistant", "Asistente de seguros con IA"))
    : (s.st && partnersHere ? partnersHere + T(partnersHere === 1 ? " partner quotes in " : " partners quote in ", partnersHere === 1 ? " socio cotiza en " : " socios cotizan en ") + stName(s.st) : T("AI insurance assistant", "Asistente de seguros con IA"));
  var details = [s.st ? stName(s.st) : "", s.sitDone ? SIT.filter(function (x) { return s.sits.indexOf(x.k) >= 0; }).map(function (x) { return x.s; }).join(" + ") : "", at > ORDER.indexOf("year") ? carName(s) : "", s.cov ? COVS[s.cov] : (s.pri === "price" ? T("Lowest price", "Precio más bajo") : "")].filter(Boolean);
  var pct = [0, 0, 25, 50, 50, 50, 75, 90, 100][at] + "%";
  var prev = { sit: { stage: "state", st: "", changing: false }, make: { stage: "sit", sitDone: false }, model: { stage: "make", make: "" }, year: { stage: MODEL_LIST[s.make] ? "model" : "make", model: "", make: MODEL_LIST[s.make] ? s.make : "" }, cov: { stage: "year", year: "" }, when: { stage: "cov", cov: "" } };
  var canBack = at > 1 && stage !== "done" && showFlow;
  var goHome = function () { track("chat_left", { stage: stage }); window.location.href = SITE; };
  var askClose = function () { if (step >= 2 && stage !== "done") setLeave(true); else goHome(); };
  var startOver = function () { setS(Object.assign(fresh(), { stage: "state" })); };

  var results = Array.isArray(s.results) ? s.results : null;
  var starters = [
    { ic: "doc", l: T("I need an SR-22", "Necesito una SR-22"), fn: function () { track("chat_started", { mode: "starter_sr22" }, true); answer(T("I need an SR-22", "Necesito una SR-22"), { sits: ["sr22"], sitDone: true }); } },
    { ic: "tag", l: T("Cheapest price for my car", "El precio más bajo para mi auto"), fn: function () { track("chat_started", { mode: "starter_price" }, true); answer(T("Cheapest price for my car", "El precio más bajo para mi auto"), { pri: "price" }); } },
    { ic: "car", l: T("I'm a rideshare driver", "Manejo para Uber o Lyft"), fn: function () { track("chat_started", { mode: "starter_rideshare" }, true); answer(T("I'm a rideshare driver", "Manejo para Uber o Lyft"), { sits: ["ride"], sitDone: true }); } },
    { ic: "clock", l: T("I need coverage today", "Necesito seguro hoy"), fn: function () { track("chat_started", { mode: "starter_today" }, true); answer(T("I need coverage today", "Necesito seguro hoy"), { when: "today" }); } }
  ];

  return (
    <div className="ig">
      <style>{CSS_TEXT}</style>
      <div className="ig-card">
        <header className="hd">
          <div className="hd-in">
            <img className="hd-logo" src={LOGO} alt="" />
            <div className="hd-txt"><span className="hd-name pj">Genie</span><span className="hd-sub">{sub}</span></div>
            {step >= 1 ? <span className="hd-step">{stage === "done" ? T("Done", "Listo") : step + " / 4"}</span> : null}
            <button type="button" className="ib call" aria-label={T("Talk to a licensed agent", "Hablar con un agente con licencia")} onClick={function () { setShowCall(true); }}><Svg d={I_PHONE} /></button>
            <button type="button" className="ib" aria-label={T("Minimise chat", "Minimizar el chat")} onClick={goHome}><Svg d={<path d="M6 9l6 6 6-6" />} size={22} sw={2} /></button>
            <button type="button" className="ib" aria-label={T("Close chat", "Cerrar el chat")} onClick={askClose}><Svg d={<path d="M6 6l12 12M18 6L6 18" />} size={20} sw={2} /></button>
          </div>
          {step >= 1 ? <div className="prog" aria-hidden="true"><i style={{ width: pct }} /></div> : null}
        </header>
        {details.length ? (
          <button type="button" className="det" onClick={startOver} aria-label={T("Edit your details", "Editar sus datos")}>
            <span className="det-in"><span><b>{T("Your details", "Sus datos")}</b> · {details.join(" · ")}</span><Svg d={I_EDIT} size={14} /></span>
          </button>
        ) : null}

        <main className="log" ref={logRef} aria-live="polite">
          <div className="log-in">
            {stage === "start" && !s.qa && !s.askMore ? (
              <>
                <div className="hello">
                  <img src={LOGO} alt="" />
                  <h1 className="pj">{T("What can I help", "¿En qué le puedo")}<br />{T("you with today?", "ayudar hoy?")}</h1>
                  <p>{T("I'll match you with the licensed quoting partner that fits, in 4 quick steps. No phone number needed to see your match.", "Le conecto con el socio de cotización con licencia que le conviene, en 4 pasos rápidos. No necesita dar su teléfono para ver su opción.")}</p>
                </div>
                <div className="starts">
                  {starters.map(function (x) { return <button type="button" key={x.ic} className="st" onClick={x.fn}><span className="st-ic"><Svg d={START_ICONS[x.ic]} /></span><span className="st-l">{x.l}</span><span className="chev"><Svg d={I_CHEV} size={16} /></span></button>; })}
                </div>
              </>
            ) : null}

            {(s.hist || []).length ? s.hist.map(function (h, i) { return (
              <Fragment key={i}>
                {h.q ? <div className="g past"><img className="ga" src={LOGO} alt="" /><div className="gt">{h.q}</div></div> : null}
                <div className="u">{h.a}</div>
              </Fragment>
            ); }) : (stage !== "start" && s.said ? <div className="u">{s.said}</div> : null)}
            {s.note ? <div className="g"><img className="ga" src={LOGO} alt="" /><div className="gt">{s.note}</div></div> : null}

            {at >= ORDER.indexOf("cov") && s.make ? (
              <div className="car">
                <span className="car-pic"><CarPic body={bodyOf(s.make, s.model)} /></span>
                <span className="car-tx"><b className="pj">{carName(s) || T("Your car", "Su auto")}</b><small>{({ sedan: T("Sedan", "Sedán"), suv: "SUV", truck: T("Pickup", "Camioneta") })[bodyOf(s.make, s.model)]}</small></span>
                <button type="button" className="lk" style={{ fontSize: 13 }} onClick={function () { go({ stage: "make", make: "", model: "", year: "", said: "", note: "" }); }}>{T("Change", "Cambiar")}</button>
              </div>
            ) : null}

            {Q && !typing ? <div className="g" data-anchor=""><img className="ga" src={LOGO} alt="" /><div className="gt">{Q[0]}{Q[1] ? <span className="gh"><Svg d={I_INFO} size={14} /><span>{Q[1]}</span></span> : null}</div></div> : null}

            {s.qa ? (
              <>
                <div className="u">{s.qa.q}</div>
                {s.qa.a == null ? <div className="g"><img className="ga" src={LOGO} alt="" /><div className="dots" aria-label={T("Genie is typing", "Genie está escribiendo")}><i /><i /><i /></div></div> : (
                  <>
                    <div className="g"><img className="ga" src={LOGO} alt="" /><div className="gt"><Bold text={s.qa.a} />
                      {s.qa.agent ? <div style={{ marginTop: 10 }}><button type="button" className="c" onClick={function () { setShowCall(true); }}><Svg d={I_PHONE} size={15} />{T("Ask a licensed agent, free", "Pregunte a un agente con licencia, gratis")}</button></div> : null}
                    </div></div>
                    {stage !== "done" ? <div className="g"><img className="ga" src={LOGO} alt="" /><div className="gt" style={{ color: "#33415c" }}>{(s.sits.indexOf("dui") >= 0 || s.sits.indexOf("sr22") >= 0) ? T("Want me to find a partner for drivers like you", "¿Quiere que le busque un socio para conductores como usted") + (s.st ? T(" in ", " en ") + stName(s.st) : "") + "?" : T("Want me to find the partner that fits you", "¿Quiere que le busque el socio que le conviene") + (s.st ? T(" in ", " en ") + stName(s.st) : "") + "?"}
                      {s.qa.noted ? <span className="gh"><Svg d={I_CHECK} size={14} sw={2.2} /><span>{T("I noted ", "Anoté ") + s.qa.noted + T(" from your question, so your match is shorter now.", " de su pregunta, así su búsqueda es más corta.")}</span></span> : null}
                    </div></div> : null}
                    <div className="ans"><button type="button" className="c on" onClick={keepGoing}>{stage === "done" ? T("Back to my match", "Volver a mi opción") : T("Continue my match", "Seguir con mi búsqueda")}</button><button type="button" className="c" onClick={function () { go({ qa: null, askMore: true }, true); setTimeout(function () { inRef.current && inRef.current.focus(); }, 100); }}>{T("Ask another question", "Hacer otra pregunta")}</button></div>
                  </>
                )}
              </>
            ) : null}
            {s.askMore && !s.qa ? (
              <>
                <div className="g"><img className="ga" src={LOGO} alt="" /><div className="gt">{T("Sure, ask me anything about car insurance below. I'll keep your match where you left it.", "Claro, pregúnteme lo que quiera sobre seguro de auto abajo. Guardo su búsqueda donde la dejó.")}</div></div>
                <div className="ans"><button type="button" className="c" onClick={keepGoing}>{stage === "start" ? T("Find my match instead", "Mejor buscar mi opción") : T("Back to my match", "Volver a mi opción")}</button></div>
              </>
            ) : null}

            {typing ? <div className="g"><img className="ga" src={LOGO} alt="" /><div className="dots" aria-label={T("Genie is typing", "Genie está escribiendo")}><i /><i /><i /></div></div> : null}

            {showFlow && chips.length ? (
              <div className={"ans" + (rowMode ? " row" : "")} role={multi ? "group" : undefined}>
                {chips.map(function (c) { return <button type="button" key={c.label} className={c.cls} aria-pressed={multi ? c.on : undefined} onClick={c.fn}>{c.label}</button>; })}
              </div>
            ) : null}
            {showFlow && extra.length ? <div className="ans">{extra.map(function (c) { return <button type="button" key={c.label} className={c.cls} onClick={c.fn}>{c.label}</button>; })}</div> : null}
            {showFlow && stage === "state" && (s.changing || !guess) ? (
              <label className="selwrap">{T("Or choose from all states", "O elija entre todos los estados")}
                <select value="" onChange={function (e) { if (e.target.value) answer(stName(e.target.value), { st: e.target.value }); }}>
                  <option value="">{T("Choose your state", "Elija su estado")}</option>
                  {Object.keys(ABBR_STATE).sort(function (a, b) { return stName(a).localeCompare(stName(b)); }).map(function (ab) { return <option key={ab} value={ab}>{stName(ab)}</option>; })}
                </select>
              </label>
            ) : null}
            {showFlow && multi ? <button type="button" className="p1" style={{ marginLeft: 36 }} aria-disabled={s.sits.length ? "false" : "true"} onClick={function () { if (s.sits.length) answer(SIT.filter(function (x) { return s.sits.indexOf(x.k) >= 0; }).map(function (x) { return x.l; }).join(", "), { sitDone: true }); }}>{s.sits.length ? T("Continue", "Continuar") : T("Pick at least one", "Elija al menos una")}</button> : null}
            {canBack ? <button type="button" className="lk back" onClick={function () { go(Object.assign({ said: "", note: "", hist: (s.hist || []).slice(0, -1) }, prev[stage] || {}), true); }}>{T("Change my last answer", "Cambiar mi última respuesta")}</button> : null}

            {stage === "done" && !typing && !s.qa ? (
              !results ? <div className="g"><img className="ga" src={LOGO} alt="" /><div className="gt">{T("Checking partners in ", "Buscando socios en ") + stName(s.st) + "…"}<div className="dots"><i /><i /><i /></div></div></div>
              : results.length ? (
                <>
                  <div className="g" data-anchor=""><img className="ga" src={LOGO} alt="" /><div className="gt">{T("Done! Here's the partner that matches your answers.", "¡Listo! Este es el socio que coincide con sus respuestas.")}</div></div>
                  <MatchCard ins={results[0]} s={s} top onCall={function () { setShowCall(true); }} />
                  <div className="m-links">
                    {results.length > 1 ? <button type="button" className="lk" onClick={function () { go({ showAll: !s.showAll }, true); }}>{s.showAll ? T("Hide other matches", "Ocultar otras opciones") : T("See all " + results.length + " matches", "Ver las " + results.length + " opciones")}</button> : <span />}
                    <button type="button" className="lk" style={{ color: "#6b7588", fontWeight: 500 }} onClick={function () { go({ showEmail: s.showEmail ? "" : "after_match" }, true); }}>{T("Email me my match", "Enviarme mi opción por correo")}</button>
                  </div>
                  {s.showEmail ? <EmailCard profile={toProfile(s)} source={s.showEmail} /> : null}
                  {s.showAll ? results.slice(1, 3).map(function (ins) { return <MatchCard key={ins.id} ins={ins} s={s} onCall={function () { setShowCall(true); }} />; }) : null}
                  <p className="fine">{T("We connect you with licensed quoting partners; quotes and policies come from the insurers they work with. Confirm coverage and price before you buy. Partners may pay us when you connect; it doesn't change your price. ", "Le conectamos con socios de cotización con licencia; las cotizaciones y pólizas vienen de las aseguradoras con las que trabajan. Confirme la cobertura y el precio antes de comprar. Los socios pueden pagarnos cuando usted se conecta; eso no cambia su precio. ")}<a href={SITE + "how-we-make-money/"} target="_blank" rel="noopener noreferrer">{T("How we make money", "Cómo ganamos dinero")}</a></p>
                </>
              ) : (
                <>
                  <div className="g" data-anchor=""><img className="ga" src={LOGO} alt="" /><div className="gt">{T("I don't have a quoting partner for ", "Todavía no tengo un socio de cotización para ") + stName(s.st) + T(" yet. I can email you as soon as one covers your state, or a licensed agent can call you.", ". Puedo avisarle por correo en cuanto uno cubra su estado, o un agente con licencia puede llamarle.")}</div></div>
                  <EmailCard profile={toProfile(s)} source="no_match" />
                  <button type="button" className="p2" style={{ marginLeft: 36 }} onClick={function () { setShowCall(true); }}><Svg d={I_PHONE} size={17} />{T("Talk to a licensed agent", "Hablar con un agente con licencia")}</button>
                </>
              )
            ) : null}
            {s.showEmail === "exit" && stage !== "done" ? <EmailCard profile={toProfile(s)} source="exit" /> : null}
          </div>
        </main>

        <footer className="foot">
          <div className="foot-in">
            <div className="comp">
              <label htmlFor="msg" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{T("Message Genie", "Mensaje para Genie")}</label>
              <input id="msg" ref={inRef} value={draft} maxLength={300} autoComplete="off" onChange={function (e) { setDraft(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") { e.preventDefault(); send(); } }} placeholder={stage === "make" && s.otherMake ? T("e.g. Subaru", "p. ej. Subaru") : T("Ask anything about car insurance", "Pregunte lo que quiera sobre seguro de auto")} />
              <button type="button" className="send" aria-label={T("Send", "Enviar")} disabled={!draft.trim()} onClick={send}><Svg d={<path d="M12 19V5M5 12l7-7 7 7" />} sw={2.2} /></button>
            </div>
            <p className="disc">{T("AI assistant, not a licensed agent · We only call when you ask · ", "Asistente con IA, no es agente con licencia · Solo llamamos si usted lo pide · ")}<a href={SITE + "privacy/"} target="_blank" rel="noopener noreferrer">{T("Privacy", "Privacidad")}</a></p>
          </div>
        </footer>

        {leave ? (
          <div className="ov" onClick={function (e) { if (e.target === e.currentTarget) setLeave(false); }}>
            <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="lv-h">
              <div className="grab" />
              <h2 id="lv-h">{T("Leave your match?", "¿Dejar su búsqueda?")}</h2>
              <p>{T("You're on step " + step + " of 4. We'll save your answers on this device for 7 days, so you can pick up where you left off.", "Va en el paso " + step + " de 4. Guardamos sus respuestas en este dispositivo por 7 días, para que siga donde lo dejó.")}</p>
              <button type="button" className="p1" onClick={function () { setLeave(false); }}>{T("Keep going", "Seguir")}</button>
              <button type="button" className="p2" onClick={function () { setLeave(false); go({ showEmail: "exit" }, true); }}>{T("Email me my answers", "Enviarme mis respuestas")}</button>
              <button type="button" className="lk" style={{ display: "block", margin: "6px auto 0", color: "#6b7588", fontWeight: 500, padding: 8 }} onClick={goHome}>{T("Leave for now", "Salir por ahora")}</button>
            </section>
          </div>
        ) : null}
        {showCall ? <CallModal profile={toProfile(s)} onClose={function () { setShowCall(false); }} /> : null}
      </div>
    </div>
  );
}
