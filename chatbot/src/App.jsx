import { useState, useRef, useEffect } from "react";

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
  return u.toString();
}

var STEPS = [
  {id:"pri",f:"priority",q:T("What matters most to you?","¿Qué es lo más importante para usted?"),t:"qr",opts:T(["Lowest price","Best coverage","Best service"],["Precio más bajo","Mejor cobertura","Mejor servicio"]),cond:function(p){return !p.priority;},ps:function(v){var l=v.toLowerCase();if(l.includes("price")||l.includes("low")||l.includes("cheap")||l.includes("precio")||l.includes("barat"))return "price";if(l.includes("cover")||l.includes("cobertura"))return "coverage";return "service";}},
  {id:"zip",f:"zip",q:T("What's your ZIP code?","¿Cuál es su código postal (ZIP)?"),t:"text",ph:T("5-digit US ZIP","Código postal de 5 dígitos"),vl:vZip,cond:function(p){return !p.zip && !p.state;}},
  {id:"vyear",f:"vehicleYear",q:T("What year is your car?","¿De qué año es su auto?"),t:"qr",cond:function(p){return !p.vehicleYear;},opts:["2024-2025","2020-2023","2015-2019","2010-2014",T("Before 2010","Antes de 2010")],ps:function(v){var y=v.match(/\b(19|20)\d{2}\b/);if(y&&v.indexOf("-")<0)return y[0];if(v.includes("2024"))return "2024";if(v.includes("2020"))return "2022";if(v.includes("2015"))return "2017";if(v.includes("2010"))return "2012";if(v.includes("Before")||v.includes("Antes"))return "2008";return v;}},
  {id:"vmake",f:"vehicleMake",q:T("And what make is it?","¿Y de qué marca es?"),t:"qr",opts:["Toyota","Honda","Ford","Chevrolet","Nissan",T("Other","Otra")],ps:function(v){return (v==="Otra")?"Other":v;}},
  {id:"vmake2",f:"vehicleMake",q:T("What brand is your car?","¿Qué marca es su auto?"),t:"text",ph:T("e.g. Hyundai, Kia, Subaru...","p. ej. Hyundai, Kia, Subaru..."),cond:function(p){return p.vehicleMake==="Other";}},
  {id:"drv",f:"driving",q:T("Last one: how's your driving record over the past 3 years?","Última pregunta: ¿cómo ha sido su historial de manejo en los últimos 3 años?"),t:"qr",opts:T(["Clean, no issues","1-2 tickets","An accident","DUI / SR-22"],["Limpio, sin problemas","1-2 multas","Un accidente","DUI / SR-22"]),ps:function(v){var l=v.toLowerCase();if(l.includes("clean")||l.includes("limpio"))return "clean";if(l.includes("ticket")||l.includes("multa"))return "minor";if(l.includes("accident"))return "major";return "dui";}},
];
var MAIN_STEPS = 5;

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
  "html,body{margin:0}",
  ".ig{--bg:#faf8f3;--surface:#ffffff;--ink:#0f1b2d;--ink2:#4a5a70;--mute:#4a5a70;--line:rgba(15,27,45,.12);--edge:rgba(15,27,45,.28);--edge-strong:rgba(15,27,45,.5);--brand:#1e3a5f;--brand-d:#16304f;--brand-t:#e8eef6;--brand-ink:#ffffff;--ring:rgba(30,58,95,.22);--sun:#ffc247;--sun-d:#ffb020;--sun-ink:#3d2600;--ok:#1e3a5f;--warn:#b42318;--warn-t:#fdecea;--warn-ink:#7a1a12;--star:#b45309;--shadow:0 1px 3px rgba(15,27,45,.06);--card:var(--surface);--bot:#f2f5f9;--pop:#ffb020;--pop-shade:#d98a00;--pop-t:#fff3d6;--pop-ink:#6b4200;--scene:#e8eef6;--road:#d5deea;--glass:#cfe0ee;--tire:#0f1b2d;--hub:#c5cfdb;--hero:#0f1b2d;--hero-ink:#eef2f7;--hero-mute:#a9b6c8;--hero-line:rgba(238,242,247,.16);--hero-acc:#ffc247;color-scheme:light}",
  ".ig,.ig *{box-sizing:border-box}",
  ".ig p,.ig h2{margin:0}",
  ".ig{min-height:100vh;min-height:100dvh;background:var(--bg);color:var(--ink);font-family:'Instrument Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16px;display:flex;justify-content:center;-webkit-font-smoothing:antialiased}",
  ".ig button,.ig input{font-family:inherit}",
  ".ig-card{width:100%;max-width:520px;height:100vh;height:100dvh;display:flex;flex-direction:column;background:var(--card);position:relative}",
  "@media (min-width:640px) and (max-width:767.98px){.ig{padding:24px;align-items:center}.ig-card{height:min(780px,calc(100dvh - 48px));border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:var(--shadow)}}",
  ".ig button:focus-visible,.ig a:focus-visible,.ig input:focus-visible{outline:3px solid var(--brand);outline-offset:3px}",
  ".hd{display:flex;align-items:center;gap:12px;padding:12px 16px;flex:none;background:var(--card)}",
  ".av{width:40px;height:40px;border-radius:8px;background:var(--sun);color:var(--ink);display:grid;place-items:center;flex:none}",
  ".hd-txt{min-width:0;flex:1}",
  ".hd-name{font-weight:600;font-size:16px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".hd-sub{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--ink2)}",
  ".dot{width:8px;height:8px;border-radius:50%;background:var(--ok);flex:none}",
  ".hd-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border:1px solid var(--edge);border-radius:8px;background:var(--surface);color:var(--ink);font-size:14px;font-weight:500;cursor:pointer;flex:none}",
  ".hd-btn:hover{border-color:var(--brand);background:var(--brand-t)}",
  ".hd-btn .lbl-s{display:none}",
  "@media (max-width:440px){.hd-btn .lbl-l{display:none}.hd-btn .lbl-s{display:inline}}",
  ".prog{height:3px;background:var(--line);flex:none}.prog>div{height:100%;background:var(--brand);transition:width .4s ease}",
  ".log{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:8px 16px 16px;display:flex;flex-direction:column}",
  ".row{display:flex;flex-direction:column;margin-top:4px;animation:in .18s ease-out}",
  ".row.first{margin-top:16px}.row.after{margin-top:16px}",
  ".row.user{align-items:flex-end}.row.bot{align-items:flex-start}",
  ".who{font-size:14px;color:var(--mute);margin:0 0 4px 2px}",
  ".bub{max-width:86%;padding:12px 16px;border-radius:12px;font-size:16px;line-height:1.5;white-space:pre-line;overflow-wrap:anywhere}",
  ".bot .bub{background:var(--bot);border:1px solid var(--line);border-bottom-left-radius:4px}",
  ".user .bub{background:var(--brand);color:var(--brand-ink);border-bottom-right-radius:4px;max-width:80%}",
  ".bub.err{background:var(--warn-t);color:var(--warn-ink);border-color:transparent}",
  ".time{font-size:12px;color:var(--mute);margin:4px 4px 0}",
  ".basis{font-size:14px;color:var(--mute);margin:8px 2px 0}",
  ".typing{align-self:flex-start;display:flex;gap:4px;margin-top:8px;padding:16px;background:var(--bot);border:1px solid var(--line);border-radius:12px 12px 12px 4px}",
  ".typing i{width:8px;height:8px;border-radius:50%;background:var(--mute);animation:blink 1.2s infinite}",
  ".typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}",
  ".quotes{width:100%;display:flex;flex-direction:column;gap:12px;margin-top:8px}",
  ".quote{border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--surface);box-shadow:var(--shadow)}",
  ".q-top{display:flex;align-items:center;gap:12px}",
  ".q-logo{width:44px;height:44px;border-radius:8px;display:grid;place-items:center;font-size:20px;font-weight:600;color:var(--ink);flex:none}",
  ".q-logo.img{width:auto;min-width:48px;max-width:120px;height:48px;padding:8px;background:#fff;border:1px solid var(--line)}",
  ".q-logo img{display:block;width:auto;height:auto;max-width:104px;max-height:32px;object-fit:contain}",
  ".q-id{min-width:0;flex:1}",
  ".q-name{font-weight:600;font-size:16px;line-height:1.25;overflow-wrap:anywhere}",
  ".q-meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:14px;color:var(--ink2);margin-top:4px}",
  ".q-rate{display:inline-flex;align-items:center;gap:4px}.q-rate svg{color:var(--pop-shade)}",
  ".q-tag{font-size:12px;font-weight:500;line-height:1.4;padding:0 8px;border:1px solid var(--line);border-radius:4px;color:var(--ink2)}",
  ".q-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;margin-top:12px}",
  ".amt{display:inline-block;font-size:28px;line-height:1.1;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}",
  ".amt.blur{filter:blur(6px);user-select:none}",
  ".per{font-size:14px;line-height:1.4;color:var(--mute)}",
  ".q-feat{font-size:14px;line-height:1.5;color:var(--ink2);margin-top:8px}",
  ".btn{display:flex;align-items:center;justify-content:center;min-height:48px;width:100%;padding:0 16px;border:0;border-radius:8px;font-size:16px;font-weight:500;text-decoration:none;cursor:pointer;margin-top:12px}",
  ".btn-p{background:var(--sun);color:var(--sun-ink);font-weight:600}.btn-p:hover{background:var(--sun-d)}",
  ".btn:disabled{background:var(--line);color:var(--mute);cursor:not-allowed}",
  ".q-note{font-size:12px;line-height:1.4;color:var(--mute);text-align:center;margin-top:8px}",
  ".consent{margin-top:16px;border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--surface)}",
  ".consent label{display:flex;gap:12px;align-items:flex-start;cursor:pointer}",
  ".consent input{width:24px;height:24px;margin:0;accent-color:var(--brand);flex:none}",
  ".consent span{font-size:14px;line-height:1.5;color:var(--ink2)}",
  ".consent a{color:var(--brand);text-decoration:underline}",
  ".foot{flex:none;border-top:1px solid var(--line);padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:var(--card)}",
  ".chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}",
  ".chip{min-height:44px;padding:0 16px;border:1px solid var(--edge);border-radius:8px;background:var(--surface);color:var(--ink);font-size:14px;font-weight:500;cursor:pointer;text-align:left}",
  ".chip:hover{border-color:var(--brand);background:var(--brand-t)}",
  ".chip.pri{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}.chip.pri:hover{background:var(--brand-d);border-color:var(--brand-d)}",
  ".comp{display:flex;align-items:center;gap:8px;border:1px solid var(--edge-strong);border-radius:12px;padding:4px 4px 4px 16px;background:var(--surface)}",
  ".comp:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px var(--ring)}",
  ".comp input{flex:1;min-width:0;height:44px;border:0;background:transparent;font-size:16px;color:var(--ink)}",
  ".ig .comp input:focus-visible{outline:none}",
  ".ig input::placeholder{color:var(--mute);opacity:1}",
  ".send{width:44px;height:44px;border:0;border-radius:8px;background:var(--brand);color:var(--brand-ink);display:grid;place-items:center;cursor:pointer;flex:none}",
  ".send:disabled{background:var(--line);color:var(--mute);cursor:default}",
  ".linkbtn{display:flex;align-items:center;justify-content:center;min-height:44px;margin:4px auto 0;padding:0 8px;border:0;background:none;color:var(--brand);font-size:14px;text-decoration:underline;cursor:pointer}",
  ".disc{font-size:12px;line-height:1.4;color:var(--mute);text-align:center;margin-top:8px}",
  ".disc-btn{position:relative;padding:0;border:0;background:none;color:var(--brand);font-size:12px;line-height:1.4;text-decoration:underline;cursor:pointer}",
  ".disc-btn::before{content:'';position:absolute;inset:-14px -12px}",
  ".disc-full{margin-top:4px}.disc-full a{color:var(--brand);text-decoration:underline}",
  ".ov{position:fixed;inset:0;background:rgba(8,16,13,.55);z-index:50;display:flex;align-items:flex-end;justify-content:center}",
  ".dlg{background:var(--surface);color:var(--ink);border:1px solid var(--line);width:100%;max-width:440px;max-height:92vh;max-height:92dvh;overflow:auto;border-radius:12px 12px 0 0;padding:24px}",
  "@media (min-width:640px){.ov{align-items:center}.dlg{border-radius:12px}}",
  ".dlg-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}",
  ".dlg h2{font-size:20px;line-height:1.25;font-weight:600}",
  ".dlg .sub{font-size:14px;line-height:1.5;color:var(--ink2);margin-top:4px}",
  ".x{width:44px;height:44px;border:0;border-radius:8px;background:var(--bg);color:var(--ink);display:grid;place-items:center;cursor:pointer;flex:none}",
  ".fld{margin-bottom:16px}",
  ".fld label,.fld .lbl{display:block;font-size:14px;font-weight:500;margin-bottom:8px}",
  ".fld input{width:100%;height:48px;padding:0 16px;border:1px solid var(--edge-strong);border-radius:8px;font-size:16px;color:var(--ink);background:var(--surface)}",
  ".fld input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--ring)}",
  ".seg{display:flex;flex-wrap:wrap;gap:8px}",
  ".seg button{min-height:44px;padding:0 16px;border:1px solid var(--edge);border-radius:8px;background:var(--surface);color:var(--ink);font-size:14px;font-weight:500;cursor:pointer}",
  ".seg button[aria-pressed='true']{background:var(--brand-t);border-color:var(--brand);color:var(--brand-d)}",
  ".agree{display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.5;color:var(--ink2);cursor:pointer;margin-bottom:12px}",
  ".agree input{width:24px;height:24px;margin:0;accent-color:var(--brand);flex:none}",
  ".errmsg{font-size:14px;line-height:1.4;color:var(--warn);margin-bottom:12px}",
  ".done{text-align:center;padding:8px 0}",
  ".tick{width:48px;height:48px;border-radius:50%;background:var(--brand-t);color:var(--brand-d);display:grid;place-items:center;margin:0 auto 12px}",
  ".hd{background:var(--hero);color:var(--hero-ink);border-bottom:1px solid var(--hero-line)}",
  ".hd .av{background:var(--hero-acc);color:var(--hero)}",
  ".hd .hd-name em{font-style:normal;color:var(--hero-acc)}",
  ".hd .hd-sub{color:var(--hero-mute)}.hd .dot{background:var(--hero-acc)}",
  ".hd .hd-btn{background:transparent;color:var(--hero-ink);border-color:rgba(238,246,242,.34)}.hd .hd-btn:hover{background:transparent;border-color:var(--hero-acc);color:var(--hero-acc)}",
  ".prog{background:var(--hero-line)}",
  "@media (max-width:767.98px){.foot .chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-left:-16px;margin-right:-16px;padding:0 16px}.foot .chips::-webkit-scrollbar{display:none}.foot .chip{flex:none;white-space:nowrap}}",
  ".offer{width:min(100%,460px);margin-top:8px;border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--surface);box-shadow:var(--shadow)}",
  ".offer.is-top{border-color:var(--brand)}",
  ".offers{display:flex;flex-direction:column;gap:12px;width:100%}",
  ".o-feat{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:4px;font-size:14px;color:var(--ink2)}",
  ".o-feat li{display:flex;align-items:center;gap:8px}.o-feat svg{color:var(--brand);flex:none}",
  ".o-tip{margin-top:12px;padding:8px 12px;border-radius:8px;background:var(--pop-t);color:var(--pop-ink);font-size:14px;line-height:1.4}",
  ".hd-sub b{font-weight:500;color:var(--hero-ink)}",
  ".top-pick{display:inline-flex;align-items:center;gap:4px;margin-bottom:12px;padding:2px 8px;border-radius:4px;background:var(--pop-t);color:var(--pop-ink);font-size:12px;font-weight:500;line-height:1.4}",
  ".top-pick svg{color:var(--pop-shade)}",
  ".quote.is-top{border-color:var(--brand)}",
  "@media (min-width:768px){.ig{--card:var(--bg);--bot:var(--surface);padding:0;align-items:stretch}.ig-card{max-width:none;height:100vh;height:100dvh;border:0;border-radius:0;box-shadow:none;overflow:visible}.hd{padding:12px 24px}.log{padding:24px max(24px,calc((100% - 880px)/2))}.foot{padding:16px max(24px,calc((100% - 880px)/2)) calc(16px + env(safe-area-inset-bottom))}.bub{max-width:72%}.user .bub{max-width:66%}.quotes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}}",
  "@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}",
  "@keyframes blink{0%,60%,100%{opacity:.35}30%{opacity:1}}",
  "@media (prefers-reduced-motion:reduce){.ig *{animation:none!important;transition:none!important}}",
  /* Conversational look: Genie writes as plain text, the visitor gets a soft bubble */
  ".who{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;color:var(--ink);margin:0 0 6px}",
  ".who::before{content:'';width:26px;height:26px;border-radius:50%;flex:none;background:var(--sun) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M11 4l6 2.6v4.3c0 4-2.5 7.2-6 8.8-3.5-1.6-6-4.8-6-8.8V6.6z' fill='%230f1b2d'/%3E%3Cpath d='M8.6 11.6l1.8 1.8 3.4-3.5' fill='none' stroke='%23ffc247' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") center/18px no-repeat}",
  ".bot .bub{background:none;border:0;border-radius:0;padding:2px 0 2px 34px;font-size:17px;line-height:1.6;color:var(--ink);max-width:92%}",
  ".bot .bub + .bub{margin-top:2px}",
  ".bub.err{padding:12px 16px!important;border-radius:12px!important;background:var(--warn-t)!important}",
  ".user .bub{background:#e9eef5;color:var(--ink);border-radius:20px;border-bottom-right-radius:20px;padding:10px 16px;font-size:16px}",
  ".typing{background:none;border:0;padding:10px 0 10px 34px;margin-top:8px}",
  ".row.bot .time{margin-left:34px}",
  "@media (min-width:768px){.bot .bub{max-width:80%}}"
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
function QuoteCard({ ins, locked, top }) {
  var [logoBroken, setLogoBroken] = useState(false);
  var showLogo = !!ins.logoUrl && !logoBroken;
  var feats = (ins.ft || []).slice(0, 3).join(", ");
  var sponsored = !!(ins.pinned || ins.featured);
  var tag = sponsored ? T("Sponsored", "Patrocinado") : (ins.tag || "");
  return (
    <article className={"quote" + (top ? " is-top" : "")} aria-label={ins.n + T(" estimate", " estimado")}>
      {top ? <span className="top-pick"><Icon n="star" fill size={12} />{T("Top pick for you", "Mejor opción para usted")}</span> : null}
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
        <span className="per">{locked ? T("shown after you connect", "se muestra al conectarse") : T("per month, estimate", "al mes, estimado")}</span>
      </div>
      {feats ? <p className="q-feat">{feats}</p> : null}
      {!locked ? (
        <div>
          <a className="btn btn-p" href={ins.rUrl || "#"} target="_blank" rel="noopener noreferrer sponsored">
            {ins.supportsPrefill ? T("Continue to ", "Continuar a ") + ins.n : T("Get my quote from ", "Obtener mi cotización de ") + ins.n}
          </a>
          <p className="q-note">
            {ins.supportsPrefill ? T("Your details carry over to their form.", "Sus datos pasan a su formulario.") : T("Opens in a new tab. You may need to re-enter some details.", "Se abre en otra pestaña. Puede que tenga que volver a escribir algunos datos.")}
          </p>
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------
// Partner offer: one recommended quoting partner, opened on their own site
// ---------------------------------------------------------------
function OfferCard({ ins, top, tip }) {
  var [logoBroken, setLogoBroken] = useState(false);
  var showLogo = !!ins.logoUrl && !logoBroken;
  var feats = (ins.ft || []).slice(0, 3);
  return (
    <article className={"offer" + (top ? " is-top" : "")} aria-label={ins.n}>
      {top ? <span className="top-pick"><Icon n="star" fill size={12} />{T("Top pick for you", "Mejor opción para usted")}</span> : null}
      <div className="q-top">
        <div className={"q-logo" + (showLogo ? " img" : "")} style={showLogo ? undefined : { background: (ins.bc || "#1e3a5f") + "26" }} aria-hidden="true">
          {showLogo ? <img src={ins.logoUrl} alt="" onError={function () { setLogoBroken(true); }} /> : (ins.n || "?").charAt(0)}
        </div>
        <div className="q-id">
          <div className="q-name">{ins.n}</div>
          <div className="q-meta"><span className="q-rate"><Icon n="star" fill size={13} />{ins.r}</span>{ins.pinned || ins.featured ? <span className="q-tag">{T("Sponsored", "Patrocinado")}</span> : null}</div>
        </div>
      </div>
      {feats.length ? <ul className="o-feat">{feats.map(function (f, i) { return <li key={i}><Icon n="check" size={14} />{f}</li>; })}</ul> : null}
      {tip ? <p className="o-tip">{tip}</p> : null}
      <a className="btn btn-p" href={ins.rUrl || "#"} target="_blank" rel="noopener noreferrer sponsored">{T("Get my quote from ", "Obtener mi cotización de ")}{ins.n}</a>
      <p className="q-note">{T("Opens " + ins.n + "'s site in a new tab. Fill in their short form to see your quotes.", "Abre el sitio de " + ins.n + " en otra pestaña. Llene su formulario corto para ver sus cotizaciones.")}</p>
    </article>
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
          landing_page: window.location.href
        })
      });
      if (!res.ok) throw new Error("bad status");
      setDone(true);
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

export default function AIInsureGenie() {
  var [msgs, setMsgs] = useState([]);
  var [pro, setPro] = useState({});
  var [inp, setInp] = useState("");
  var [typ, setTyp] = useState(false);
  var [si, setSi] = useState(-1);
  var [phase, setPhase] = useState("welcome");
  var [piiIdx, setPiiIdx] = useState(0);
  var [qr, setQr] = useState(null);
  var [iph, setIph] = useState(T("Type here...", "Escriba aquí..."));
  var [results, setResults] = useState([]);
  var [cs, setCs] = useState(0);
  var [ck, setCk] = useState(false);
  var [showCon, setShowCon] = useState(false);
  var [showCall, setShowCall] = useState(false);
  var [showDisc, setShowDisc] = useState(false);
  var [fullKb, setFullKb] = useState(false);
  var [startTime] = useState(function(){ return nowTime(); });
  var logRef = useRef(null);
  var endRef = useRef(null);
  var inRef = useRef(null);
  var [insurerList, setInsurerList] = useState(IS_PREVIEW ? DEFAULT_INSURERS : []);
  var partnerNames = insurerList.map(function(x){ return x.n; });
  var consentMain = buildConsent(partnerNames);
  var tot = MAIN_STEPS;

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

  var startQ = function(extra) {
    var sit = extra && extra._sit; if (extra) { extra = Object.assign({}, extra); delete extra._sit; if (!Object.keys(extra).length) extra = null; }
    var start = Object.assign({}, pro, extra || {});
    if (extra) setPro(start);
    setPhase("qualifying"); setTyp(true);
    var got = [];
    if (extra && extra.priority) got.push(T("your goal", "su prioridad"));
    if (extra && extra.state) got.push(T("your state", "su estado"));
    if (extra && extra.vehicleYear) got.push(T("your car's age", "el año de su auto"));
    if (got.length) setCs(got.length);
    var intro = got.length
      ? T("Thanks! I've got ", "¡Gracias! Ya tengo ") + (got.length > 1 ? got.slice(0, -1).join(", ") + T(" and ", " y ") + got[got.length - 1] : got[0]) + T(" from the website, so I won't ask again. Just a few more quick questions.", " del sitio web, así que no se lo vuelvo a preguntar. Solo unas preguntas rápidas más.")
      : T("Great! A few quick questions and I'll point you to the partner that fits you best. Ask me anything along the way.", "¡Perfecto! Unas preguntas rápidas y le indicaré el socio que mejor le conviene. Pregúnteme lo que quiera en cualquier momento.");
    setTimeout(function(){if(sit)bot(sit);bot(intro);setTyp(false);setTimeout(function(){advQ(0,start);},500);},sit?900:500);
  };
  var startChat = function() {
    setPhase("chat"); setTyp(true);
    setTimeout(function(){bot(T("Sure, ask me anything about auto insurance: coverage types, claims, discounts, SR-22, deductibles, or how to compare insurers. When you're ready for personalized options, tap Get instant quote.", "Claro, pregúnteme lo que quiera sobre seguro de auto: tipos de cobertura, reclamos, descuentos, SR-22, deducibles o cómo comparar aseguradoras. Cuando quiera opciones para usted, toque Obtener cotización."));setTyp(false);setIph(T("Ask me anything...", "Pregunte lo que quiera..."));setTimeout(function(){inRef.current&&inRef.current.focus();},100);},500);
  };

  var advQ = function(idx, prof) {
    var i = idx;
    while (i < STEPS.length) { if (STEPS[i].cond && !STEPS[i].cond(prof)) { i++; continue; } break; }
    if (i >= STEPS.length) { showMatch(prof); return; }
    setSi(i); setTyp(true);
    var s = STEPS[i];
    setTimeout(function(){
      var px = "";
      if (s.id === "vmake2") px = T("No problem! ", "¡No hay problema! ");
      bot(px + s.q); setTyp(false);
      setQr(s.t === "qr" ? s.opts : null); setIph(s.ph || T("Type...", "Escriba..."));
      if (s.t === "text") setTimeout(function(){inRef.current&&inRef.current.focus();},100);
    }, 500 + Math.random()*300);
  };

  var handleQ = function(val) {
    if (!val.trim()) return;
    var s = STEPS[si]; usr(val); setInp(""); setQr(null);
    if (isQuestion(val, "qualifying", s.id)) {
      setTyp(true);
      getAnswer(val, pro, results).then(function(a){bot(a);setTyp(false);setTimeout(function(){setTyp(true);setTimeout(function(){bot(T("Back to your quote — ", "Volvamos a su cotización: ") + s.q);setTyp(false);setQr(s.t==="qr"?s.opts:null);setIph(s.ph||T("Type...", "Escriba..."));if(s.t==="text")setTimeout(function(){inRef.current&&inRef.current.focus();},100);},400);},700);});
      return;
    }
    if (s.vl) {
      var r = s.vl(val);
      if (!r.ok) { setTyp(true);setTimeout(function(){bot(r.e,{err:true});setTyp(false);setQr(s.t==="qr"?s.opts:null);setIph(s.ph||T("Type...", "Escriba..."));},300);return; }
      var v = r.v !== undefined ? r.v : (s.ps ? s.ps(val) : val.trim());
      var u = Object.assign({}, pro); u[s.f] = v; if (r.st) u.state = r.st; setPro(u); setCs(function(c){return c+1;});
      if (s.id === "zip" && r.st) { setTyp(true);setTimeout(function(){bot(T("Got it: **", "Perfecto: **")+v+"**, **"+r.st+"**.");setTyp(false);setTimeout(function(){advQ(si+1,u);},300);},400);return; }
      advQ(si+1, u);
    } else {
      var v2 = s.ps ? s.ps(val) : val.trim();
      var u2 = Object.assign({}, pro); u2[s.f] = v2; setPro(u2); setCs(function(c){return c+1;}); advQ(si+1, u2);
    }
  };

  // After the questions: recommend one quoting partner and send the user to their own form.
  var GOAL = T({ price: "the lowest price", coverage: "strong coverage", service: "great service" }, { price: "el precio más bajo", coverage: "una buena cobertura", service: "un buen servicio" });
  var REC = T({ clean: "a clean record", minor: "a couple of tickets", major: "a recent accident", dui: "a DUI or SR-22" }, { clean: "un historial limpio", minor: "un par de multas", major: "un accidente reciente", dui: "un DUI o SR-22" });
  var TIPS = T({
    price: "Tip: ask about safe-driver and paid-in-full discounts.",
    coverage: "Tip: compare the same limits and deductible on every quote.",
    service: "Tip: ask how claims are handled and how to reach support."
  }, {
    price: "Consejo: pregunte por descuentos de buen conductor y de pago completo.",
    coverage: "Consejo: compare los mismos límites y deducible en cada cotización.",
    service: "Consejo: pregunte cómo manejan los reclamos y cómo contactar a soporte."
  });
  var showMatch = function(prof) {
    var p = Object.assign({}, prof, { coverage: prof.priority === "coverage" ? "full" : (prof.coverage || "standard") });
    setPro(p); setPhase("locked"); setQr(null); setTyp(true);
    setTimeout(function(){
      var r = pickPartners(p).map(function(ins){ return Object.assign({}, ins, { rUrl: buildUrl(ins, p) }); });
      setResults(r);
      if (!r.length) {
        bot(INSURERS.length ? T("I don't have a partner for ", "Todavía no tengo un socio para ") + (p.state || T("your area", "su zona")) + T(" that fits just yet. A licensed agent can help you instead: tap **Talk to an agent**.", " que le convenga. Un agente con licencia le puede ayudar: toque **Hablar con un agente**.") : T("I couldn't load partner options just now. You can talk to a licensed agent, or try again in a minute.", "No pude cargar las opciones ahora. Puede hablar con un agente con licencia o intentarlo en un minuto."));
        setTyp(false); setPhase("follow");
        return;
      }
      bot(T("Thanks! For ", "¡Gracias! Para ") + (REC[p.driving] || T("your record", "su historial")) + T(" and ", " y ") + (GOAL[p.priority] || T("a good fit", "una buena opción")) + T(" in ", " en ") + (p.state || T("your state", "su estado")) + T(", this partner is my top pick:", ", este socio es mi mejor opción:"), { offer: r[0], tip: TIPS[p.priority] });
      setTyp(false);
      setTimeout(function(){ setTyp(true); setTimeout(function(){ bot(T("Anything else I can help with?", "¿Le ayudo con algo más?")); setTyp(false); setPhase("follow"); }, 700); }, 1200);
    }, 1200);
  };

  var showMore = function() {
    var more = results.slice(1, 3);
    usr(T("See other options", "Ver otras opciones"));
    setTyp(true);
    setTimeout(function(){
      if (!more.length) bot(T("That's the best fit I have for you right now. You can also talk to a licensed agent.", "Esa es la mejor opción que tengo para usted ahora. También puede hablar con un agente con licencia."));
      else bot(T("Here " + (more.length === 1 ? "is another option" : "are other options") + " that fit your answers:", (more.length === 1 ? "Aquí tiene otra opción" : "Aquí tiene otras opciones") + " según sus respuestas:"), { offers: more });
      setTyp(false);
    }, 600);
  };

  var advPII = function(idx, prof) {
    if (idx >= PII_STEPS.length) { setPhase("consent");setShowCon(true);setTyp(true);setTimeout(function(){bot(T("Thanks ", "¡Gracias, ")+prof.firstName+T("! Please review and accept the consent below.", "! Revise y acepte el consentimiento de abajo."));setTyp(false);},400);return; }
    setPiiIdx(idx); setTyp(true); var s = PII_STEPS[idx];
    setTimeout(function(){var px="";if(idx===1)px=T("Thanks ", "¡Gracias, ")+prof.firstName+"! ";if(idx===2)px=T("Last step: ", "Último paso: ");bot(px+s.q);setTyp(false);setQr(null);setIph(s.ph);setTimeout(function(){inRef.current&&inRef.current.focus();},100);},400);
  };

  var handlePII = function(val) {
    if (!val.trim()) return; var s = PII_STEPS[piiIdx]; usr(val); setInp("");
    if (isQuestion(val, "pii", s.id)) {
      setTyp(true);getAnswer(val,pro,results).then(function(a){bot(a);setTyp(false);setTimeout(function(){setTyp(true);setTimeout(function(){bot(T("Back to your quote — ", "Volvamos a su cotización: ")+s.q);setTyp(false);setIph(s.ph);setTimeout(function(){inRef.current&&inRef.current.focus();},100);},400);},700);});return;
    }
    if (s.vl) {
      var r = s.vl(val);
      if (!r.ok) { setTyp(true);setTimeout(function(){bot(r.e,{err:true});setTyp(false);setIph(s.ph);setTimeout(function(){inRef.current&&inRef.current.focus();},100);},300);return; }
      var u = Object.assign({},pro); u[s.f] = r.v; setPro(u); setCs(function(c){return c+1;});
      if (s.id==="phone"&&r.fmt){setTyp(true);setTimeout(function(){bot(T("Got it: **", "Perfecto: **")+r.fmt+"**.");setTyp(false);setTimeout(function(){advPII(piiIdx+1,u);},250);},350);return;}
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
    if (!ck) return; setShowCon(false); usr(T("I agree", "Acepto"));
    var u = Object.assign({},pro,{consent:true,consentTs:new Date().toISOString()}); setPro(u);
    setPhase("unlock"); setTyp(true);
    bot(T("Connecting you with insurers...", "Conectándole con aseguradoras..."));

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
        bot(u.firstName + T(", here are your matches. Open any insurer to get your real price.", ", aquí tiene sus opciones. Abra cualquier aseguradora para ver su precio real."), { ins: r, locked: false, tags: true });
        setTyp(false); setPhase("follow");
        setTimeout(function(){
          setTyp(true);
          setTimeout(function(){ bot(T("If you have questions about any of these, ask me here. You can also talk to a licensed agent.", "Si tiene preguntas sobre alguna, pregúnteme aquí. También puede hablar con un agente con licencia.")); setTyp(false); }, 900);
        }, 1500);
      }, 600);
    });
  };

  var handleChat = function(val) {
    if (!val.trim()) return; usr(val); setInp("");
    var t = val.toLowerCase();
    var zm = val.match(/\b\d{5}\b/), zr = zm ? vZip(zm[0]) : null;
    if (zr && zr.ok) {
      var pz = Object.assign({}, pro, { zip: zr.v, state: zr.st }); setPro(pz); setCs(function(c){return c+1;});
      var sad = /(went up|increase|higher|too (much|high|expensive)|renewal|subi|aument|caro|renovaci)/.test(t);
      setTyp(true);
      setTimeout(function(){ bot((sad ? T("Sorry to hear that. ", "Lamento oír eso. ") : "") + T("Got it: **", "Perfecto: **") + zr.v + "**, **" + zr.st + T("**. Let's find you a better fit.", "**. Vamos a buscarle una mejor opción.")); setTyp(false); setPhase("qualifying"); setTimeout(function(){ advQ(0, pz); }, 400); }, 500);
      return;
    }
    if (["get my quote","get quote","start quote","compare rate","get started","find rate","i want a quote","cotiza","cotización","quiero un seguro","empezar"].some(function(w){return t.includes(w);})) {
      setTyp(true);setTimeout(function(){bot(T("Great, let's get your quotes.", "Perfecto, vamos por sus cotizaciones."));setTyp(false);setPhase("qualifying");setTimeout(function(){advQ(0,pro);},400);},400);return;
    }
    setTyp(true);getAnswer(val,pro,results).then(function(a){bot(a);setTyp(false);setIph(T("Ask another question...", "Haga otra pregunta..."));});
  };

  var handleFollow = function(val) {
    if (!val.trim()) return; usr(val); setInp(""); setTyp(true);
    getAnswer(val,pro,results).then(function(a){bot(a);setTyp(false);});
  };


  // Topics the website can open the chat with (#start=quote&situation=...&lang=es).
  var SITUATIONS = {
    sr22: { en: ["SR-22 / DUI", "No judgment here. Lots of drivers need an SR-22. I'll point you to partners that file SR-22s in your state."], es: ["SR-22 / DUI", "Aquí nadie le juzga. Muchos conductores necesitan una SR-22. Le indicaré socios que la presentan en su estado."] },
    lapse: { en: ["Gap in coverage", "A lapse happens to lots of drivers. The sooner you're covered again, the better the price usually is."], es: ["Estuve sin seguro", "Le pasa a muchos conductores. Mientras antes vuelva a tener seguro, mejor suele ser el precio."] },
    record: { en: ["Tickets or an accident", "A ticket or accident can raise your price, but some insurers are much more forgiving than others. Comparing makes a real difference."], es: ["Multas o un accidente", "Una multa o un accidente puede subir el precio, pero algunas aseguradoras son mucho más flexibles que otras. Comparar ayuda mucho."] },
    "new-driver": { en: ["New or young driver", "First policy or adding a teen? Discounts like good grades and driver's ed can help a lot. I'll point you to the right partner."], es: ["Conductor nuevo o joven", "¿Primera póliza o agregar a un hijo? Descuentos por buenas notas o curso de manejo pueden ayudar mucho."] },
    rideshare: { en: ["Rideshare or delivery", "Driving for Uber, Lyft or DoorDash? A personal policy often doesn't cover you while the app is on, so it's worth asking about rideshare coverage."], es: ["Uber, Lyft o entregas", "¿Maneja para Uber, Lyft o DoorDash? Una póliza personal a menudo no le cubre con la app encendida. Vale la pena preguntar por cobertura para rideshare."] }
  };

  // Open the right flow when arriving from the website (values live in the URL fragment).
  useEffect(function() {
    var h = (window.location.hash || "").replace(/^#/, "");
    if (!h) return;
    var p = new URLSearchParams(h);
    var start = p.get("start"), q = (p.get("q") || "").trim().slice(0, 200);
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch (e) {}
    var t = setTimeout(function() {
      var goal = p.get("goal");
      var stName = (p.get("state") || "").trim(), st = STATE_ABBR[stName.toLowerCase()];
      var car = (p.get("car") || "").trim(), yr = CAR_AGE_YEAR[car];
      var extra = {}, said = [];
      if (goal === "price" || goal === "coverage") { extra.priority = goal; said.push(goal === "price" ? T("Lowest price", "Precio más bajo") : T("Best coverage", "Mejor cobertura")); }
      if (st) { extra.state = st; said.push(stName); }
      if (yr) { extra.vehicleYear = yr; said.push(T("car ", "auto ") + car); }
      var S = SITUATIONS[p.get("situation") || ""], es = ES;
      if (q) { setPhase("chat"); handleChat(q); }
      else if (start === "quote" && S) { var L = es ? S.es : S.en; usr(said.length ? L[0] + ", " + said.join(", ") : L[0]); startQ(Object.assign({}, extra, { _sit: L[1] })); }
      else if (start === "quote") { usr(said.length ? said.join(", ") : T("Get instant quote", "Obtener cotización")); startQ(said.length ? extra : null); }
      else if (start === "ask") { usr(T("I have a question", "Tengo una pregunta")); startChat(); }
      else if (start === "agent") { setShowCall(true); }
    }, 350);
    return function() { clearTimeout(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  var send = function(val) {
    var v = val || inp; if (!v.trim() || typ) return;
    if (phase==="welcome") { setPhase("chat"); handleChat(v); }
    else if (phase==="chat") handleChat(v);
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

  var chatChips = T(["Cheapest way to insure a car", "Coverage types explained", "What is SR-22?", "How deductibles work"], ["¿Cómo pagar menos?", "Tipos de cobertura", "¿Qué es la SR-22?", "¿Cómo funciona el deducible?"]);
  var composerPh = (phase === "locked" || phase === "unlock" || phase === "consent" || phase === "follow") ? T("Ask a question", "Haga una pregunta") : iph;
  var followChips = T(["See other options", "How do deductibles work?", "Talk to an agent"], ["Ver otras opciones", "¿Cómo funciona el deducible?", "Hablar con un agente"]);

  return (
    <div className="ig">
      <style>{CSS_TEXT}</style>
      <div className="ig-card">

        <header className="hd">
          <div className="av"><Icon n="shield" size={22} /></div>
          <div className="hd-txt">
            <div className="hd-name">AI Insure<em>Genie</em></div>
            <div className="hd-sub"><span className="dot" />{phase === "qualifying" ? <span>{T("Getting your quote", "Su cotización")} <b>· {Math.min(cs + 1, tot)} {T("of", "de")} {tot}</b></span> : T("AI insurance assistant", "Asistente de seguros con IA")}</div>
          </div>
          <button type="button" className="hd-btn" aria-label={T("Talk to an agent", "Hablar con un agente")} onClick={function(){ setShowCall(true); }}>
            <Icon n="phone" size={16} /><span className="lbl-l">{T("Talk to an agent", "Hablar con un agente")}</span><span className="lbl-s">{T("Agent", "Agente")}</span>
          </button>
        </header>
        <div className="prog" role="progressbar" aria-label={T("Quote progress", "Progreso de la cotización")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div style={{ width: pct + "%" }} />
        </div>

        <div className="log" ref={logRef} role="log" aria-live="polite" aria-label={T("Conversation", "Conversación")}>
          <div className="row bot first">
            <div className="who">Genie</div>
            <div className="bub">{T("Hi! I help drivers get the best quote for their needs.", "¡Hola! Soy Genie y le ayudo a encontrar la mejor cotización de seguro de auto para usted.")}</div>
            <div className="bub" style={{ marginTop: 4 }}>{T("Tell me a bit about you and your car, and I'll point you to the quoting partner that fits you best. I can also answer questions or set up a call.", "Cuénteme un poco sobre usted y su auto, y le indicaré el socio de cotización que mejor le conviene. También puedo responder preguntas o pedir que un agente le llame.")}</div>
            <div className="bub" style={{ marginTop: 4 }}>{T("Or just tell me what's going on, for example \"my renewal went up $40\".", "O cuénteme qué pasa, por ejemplo: \"mi renovación subió $40\".")}</div>
          </div>
          {(msgs.length === 0 || msgs[0].role === "user") ? <div className="time" style={{ alignSelf: "flex-start" }}>{startTime}</div> : null}

          {msgs.map(function(m, i) {
            var prev = i === 0 ? { role: "bot" } : msgs[i - 1];
            var next = msgs[i + 1];
            var first = prev.role !== m.role;
            var last = !next || next.role !== m.role;
            var basis = m.tags ? basisLine(pro) : "";
            return (
              <div key={i} className={"row " + m.role + (first ? " first" : "") + (prev.ins ? " after" : "")}>
                {m.role === "bot" && first ? <div className="who">Genie</div> : null}
                <div className={"bub" + (m.err ? " err" : "")}>{m.role === "bot" ? renderBold(m.text) : m.text}</div>
                {basis ? <p className="basis">{basis}</p> : null}
                {m.offer ? <OfferCard ins={m.offer} top={true} tip={m.tip} /> : null}
                {m.offers ? <div className="offers">{m.offers.map(function(x, j){ return <OfferCard key={x.id || j} ins={x} top={false} />; })}</div> : null}
                {m.ins ? (
                  <div className="quotes">
                    {m.ins.map(function(x, j) { return <QuoteCard key={x.id || j} ins={x} locked={!!m.locked} top={j === 0} />; })}
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
                  {consentMain} {T("I have read the ", "He leído la ")}<a href="https://aiinsuregenie.com/privacy/" target="_blank" rel="noopener noreferrer">{T("Privacy Policy", "Política de privacidad")}</a>{T(" and ", " y los ")}<a href="https://aiinsuregenie.com/terms/" target="_blank" rel="noopener noreferrer">{T("Terms of Use", "Términos de uso")}</a>.
                </span>
              </label>
              <button type="button" className="btn btn-p" disabled={!ck} onClick={handleConsent}>{T("Agree and see my matches", "Aceptar y ver mis opciones")}</button>
            </div>
          ) : null}

          {typ ? (
            <div className="typing" role="status" aria-label={T("Genie is typing", "Genie está escribiendo")}><i /><i /><i /></div>
          ) : null}
        </div>

        <footer className="foot">
          {phase === "welcome" ? (
            <div className="chips">
              <button type="button" className="chip pri" onClick={function(){ usr(T("Get instant quote", "Obtener cotización")); startQ(); }}>{T("Get instant quote", "Obtener cotización")}</button>
              <button type="button" className="chip" onClick={function(){ usr(T("I have a question", "Tengo una pregunta")); startChat(); }}>{T("Ask a question", "Hacer una pregunta")}</button>
              <button type="button" className="chip" onClick={function(){ setShowCall(true); }}>{T("Talk to an agent", "Hablar con un agente")}</button>
            </div>
          ) : null}

          {phase !== "welcome" && qr && !typ ? (
            <div className="chips" role="group" aria-label={T("Quick replies", "Respuestas rápidas")}>
              {qr.map(function(o, i) { return <button type="button" key={i} className="chip" onClick={function(){ send(o); }}>{o}</button>; })}
            </div>
          ) : null}

          {phase === "chat" && !typ ? (
            <div className="chips">
              <button type="button" className="chip pri" onClick={function(){ usr(T("Get instant quote", "Obtener cotización")); startQ(); }}>{T("Get instant quote", "Obtener cotización")}</button>
              {chatChips.map(function(s, i) { return <button type="button" key={i} className="chip" onClick={function(){ handleChat(s); }}>{s}</button>; })}
            </div>
          ) : null}

          {phase === "follow" && !typ ? (
            <div className="chips">
              {followChips.map(function(s, i) { return <button type="button" key={i} className="chip" onClick={function(){ if (i === 0) showMore(); else if (i === 2) setShowCall(true); else handleFollow(s); }}>{s}</button>; })}
            </div>
          ) : null}

          <div className="comp">
            <input
              ref={inRef}
              value={inp}
              onChange={onType}
              onKeyDown={function(e){ if (e.key === "Enter") { e.preventDefault(); send(); } }}
              placeholder={phase === "welcome" ? T("Type a message...", "Escriba un mensaje...") : composerPh}
              aria-label={T("Type your message", "Escriba su mensaje")}
              inputMode={kb.inputMode}
              autoComplete={kb.autoComplete}
              autoCapitalize={kb.autoCapitalize}
              enterKeyHint="send"
            />
            <button type="button" className="send" aria-label={T("Send message", "Enviar mensaje")} onClick={function(){ send(); }} disabled={!inp.trim() || typ}>
              <Icon n="send" size={18} />
            </button>
          </div>
          {(cur === "zip" || cur === "phone") && !fullKb ? (
            <button type="button" className="linkbtn" onClick={openFullKeyboard}>{T("Have a question instead? Show the full keyboard", "¿Tiene una pregunta? Mostrar el teclado completo")}</button>
          ) : null}
          <div className="disc">
            <span>{T("AI assistant, not a licensed agent.", "Asistente de IA, no un agente con licencia.")}</span>{" "}
            <button type="button" className="disc-btn" aria-expanded={showDisc} aria-controls="disc-full" onClick={function(){ setShowDisc(!showDisc); }}>{showDisc ? T("Hide details", "Ocultar detalles") : T("Details", "Detalles")}</button>
            {showDisc ? <p id="disc-full" className="disc-full">{T("AI InsureGenie is an AI assistant, not an insurance company or licensed agent. We recommend quoting partners, who may pay us a fee. Your quotes and final rate come from the partner or insurer. ", "AI InsureGenie es un asistente de IA, no una compañía de seguros ni un agente con licencia. Recomendamos socios de cotización, que pueden pagarnos una comisión. Sus cotizaciones y su tarifa final las da el socio o la aseguradora. ")}<a href="https://aiinsuregenie.com/privacy/" target="_blank" rel="noopener noreferrer">{T("Privacy policy", "Política de privacidad")}</a> · <a href="https://aiinsuregenie.com/terms/" target="_blank" rel="noopener noreferrer">{T("Terms of use", "Términos de uso")}</a></p> : null}
          </div>
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
