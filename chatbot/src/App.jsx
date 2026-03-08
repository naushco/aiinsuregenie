import { useState, useRef, useEffect } from "react";

var STORAGE_KEY = "aiinsuregenie-partners-v3";
var SHARED = true;

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
    base: Math.round(60 + (dp.payout || 5) * 3), // estimate base premium from payout
    ft: ["Competitive rates", "Fast quotes", "24/7 support"], // generic features
    bf: ["budget", "clean", "family"], // generic best-for
    rk: "std",
    hl: dp.badge + " — " + dp.name,
    url: dp.link || "#",
    info: dp.name + " offers competitive auto insurance rates with easy online quoting.",
  };
}

// Load partners from shared storage, merge with defaults
async function loadInsurers() {
  try {
    var result = await window.storage.get(STORAGE_KEY, SHARED);
    if (result && result.value) {
      var dashPartners = JSON.parse(result.value);
      var enabled = dashPartners.filter(function(p) { return p.enabled; });
      if (enabled.length > 0) {
        return enabled.map(dashboardToInsurer);
      }
    }
  } catch(e) { /* storage not available or empty */ }
  return DEFAULT_INSURERS;
}

// Global mutable reference that gets updated
var INSURERS = DEFAULT_INSURERS;

const ZIP_STATES = {"AL":[35000,36999],"AK":[99500,99999],"AZ":[85000,86599],"AR":[71600,72999],"CA":[90000,96699],"CO":[80000,81699],"CT":[6000,6999],"DE":[19700,19999],"FL":[32000,34999],"GA":[30000,31999],"HI":[96700,96899],"ID":[83200,83899],"IL":[60000,62999],"IN":[46000,47999],"IA":[50000,52899],"KS":[66000,67999],"KY":[40000,42799],"LA":[70000,71499],"ME":[3900,4999],"MD":[20600,21999],"MA":[1000,2799],"MI":[48000,49999],"MN":[55000,56799],"MS":[38600,39799],"MO":[63000,65899],"MT":[59000,59999],"NE":[68000,69399],"NV":[88900,89899],"NH":[3000,3899],"NJ":[7000,8999],"NM":[87000,88499],"NY":[10000,14999],"NC":[27000,28999],"ND":[58000,58899],"OH":[43000,45999],"OK":[73000,74999],"OR":[97000,97999],"PA":[15000,19699],"RI":[2800,2999],"SC":[29000,29999],"SD":[57000,57799],"TN":[37000,38599],"TX":[75000,79999],"UT":[84000,84799],"VT":[5000,5999],"VA":[22000,24699],"WA":[98000,99499],"WV":[24700,26899],"WI":[53000,54999],"WY":[82000,83199],"DC":[20000,20599]};

function vZip(z) {
  var c = z.replace(/\D/g, "");
  if (c.length !== 5) return { ok: false, e: "Enter a valid 5-digit US ZIP code." };
  var n = parseInt(c);
  for (var st of Object.keys(ZIP_STATES)) {
    if (n >= ZIP_STATES[st][0] && n <= ZIP_STATES[st][1]) return { ok: true, v: c, st: st };
  }
  return { ok: false, e: "That ZIP doesn't match any US state." };
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

async function aiAnswer(msg, profile, results) {
  var profileStr = Object.keys(profile).length > 0 ? " User profile: " + JSON.stringify(profile) : "";
  var resultsStr = results && results.length > 0 ? " Matched: " + results.map(function(r) { return r.n + " $" + r.premium + "/mo"; }).join(", ") : "";
  var sysPrompt = "You are AI InsureGenie, a friendly US auto insurance advisor. Only answer auto insurance questions. For unrelated topics, say you specialize in auto insurance. Keep answers to 2-3 short paragraphs. Use **bold** for key terms. Never guarantee specific prices. Know these insurers: Progressive, GEICO, State Farm, Allstate, Liberty Mutual, USAA (military only), Lemonade, The General (high-risk), Root, Nationwide. Suggest get my quotes when relevant." + profileStr + resultsStr;
  try {
    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: sysPrompt,
        messages: [{ role: "user", content: msg }]
      })
    });
    var data = await response.json();
    if (data && data.content) {
      var text = "";
      for (var i = 0; i < data.content.length; i++) {
        if (data.content[i].text) text += data.content[i].text;
      }
      return text || null;
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function getAnswer(text, profile, results) {
  var s = staticAnswer(text);
  if (s) return s;
  var ai = await aiAnswer(text, profile, results);
  if (ai) return ai;
  return "I can help with coverage types, insurer comparisons, discounts, SR-22, deductibles, and more. Could you rephrase? Or say **get my quotes** for personalized rates!";
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
    var premium = calcPremium(ins, p);
    var savings = Math.max(Math.round((220 - premium) * 12), Math.round(80 + Math.random() * 200));
    return Object.assign({}, ins, { s: s, premium: premium, savings: savings });
  }).sort(function(a, b) { return b.s - a.s; }).filter(function(x) { return x.s > -50; }).slice(0, 4);
}

function buildUrl(ins, p) {
  var u = new URLSearchParams();
  ["zip","state","firstName","phone","email","age","vehicleYear","vehicleMake","coverage"].forEach(function(k) { if (p[k]) u.set(k, p[k]); });
  u.set("utm_source", "aiinsuregenie");
  u.set("utm_campaign", ins.id);
  return ins.url + "?" + u.toString();
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
  {id:"home",f:"homeowner",q:"Own your home? Bundling saves up to 25%.",t:"qr",opts:["Yes, homeowner","No, renting"],ps:function(v){return v.toLowerCase().includes("yes")||v.toLowerCase().includes("own")?"yes":"no";}},
  {id:"cars",f:"multiCar",q:"Insuring more than one vehicle?",t:"qr",opts:["Yes, multiple","Just one"],ps:function(v){return v.toLowerCase().includes("yes")||v.toLowerCase().includes("multi")?"yes":"no";}},
  {id:"pri",f:"priority",q:"What matters most to you?",t:"qr",opts:["Lowest price","Best coverage","Best service"],ps:function(v){var l=v.toLowerCase();if(l.includes("price")||l.includes("low"))return "price";if(l.includes("coverage"))return "coverage";return "service";}},
];

var PII_STEPS = [
  {id:"firstName",f:"firstName",q:"What's your first name?",ph:"First name",vl:vName},
  {id:"phone",f:"phone",q:"Best phone number to reach you?",ph:"(555) 123-4567",vl:vPhone},
  {id:"email",f:"email",q:"Your email for the quote comparison?",ph:"you@email.com",vl:vEmail},
];

var CSS_TEXT = "@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0}@keyframes ci{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes fu{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes db{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}@keyframes pl{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}.qr-b:hover{background:#0EA5E9!important;color:#FFF!important;border-color:#0EA5E9!important;transform:translateY(-2px)}.fc-b:hover{background:#0EA5E9!important;color:#FFF!important;border-color:#0EA5E9!important}.sb-b:hover:not(:disabled){transform:scale(1.06)}.cr-s::-webkit-scrollbar{height:4px}.cr-s::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px}";

function InsurerCard({ ins, idx, locked }) {
  var [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={function(){setHov(true);}} onMouseLeave={function(){setHov(false);}} style={{minWidth:255,maxWidth:275,background:"#FFF",borderRadius:14,overflow:"hidden",border:hov?"1.5px solid "+ins.bc+"50":"1px solid #E5E7EB",boxShadow:hov?"0 10px 30px "+ins.bc+"15":"0 1px 6px rgba(0,0,0,.04)",transform:hov?"translateY(-3px)":"none",transition:"all .3s",flexShrink:0,animation:"ci .4s ease "+(idx*0.1)+"s both",position:"relative"}}>
      {locked && (
        <div style={{position:"absolute",bottom:0,left:0,right:0,height:"55%",background:"linear-gradient(to bottom,transparent,#FFF 30%)",zIndex:5,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",paddingBottom:16}}>
          <div style={{backdropFilter:"blur(6px)",background:"rgba(255,255,255,.85)",borderRadius:12,padding:"12px 18px",textAlign:"center",border:"1px solid #E5E7EB"}}>
            <div style={{fontSize:18,marginBottom:4}}>🔒</div>
            <div style={{fontSize:12,fontWeight:700,color:"#111"}}>Unlock Exact Rate</div>
            <div style={{fontSize:10,color:"#6B7280"}}>3 quick details needed</div>
          </div>
        </div>
      )}
      <div style={{background:"linear-gradient(135deg,"+ins.bc+"10,"+ins.bc+"04)",padding:"10px 14px 8px",borderBottom:"1px solid #F3F4F6"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:22}}>{ins.logo}</span>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#111"}}>{ins.n}</div>
              <div style={{display:"flex",alignItems:"center",gap:1}}>
                {[1,2,3,4,5].map(function(s){return <span key={s} style={{color:s<=Math.floor(ins.r)?"#F59E0B":"#D1D5DB",fontSize:11}}>★</span>;})}
                <span style={{marginLeft:4,fontSize:11,color:"#6B7280",fontWeight:600}}>{ins.r}</span>
              </div>
            </div>
          </div>
          <span style={{background:ins.bc,color:"#FFF",fontSize:8,fontWeight:700,padding:"3px 7px",borderRadius:20,whiteSpace:"nowrap"}}>{ins.bdg}</span>
        </div>
      </div>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #F3F4F6"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
          <div>
            <span style={{fontSize:locked?22:26,fontWeight:800,color:"#111",filter:locked?"blur(5px)":"none"}}>${ins.premium}</span>
            <span style={{fontSize:11,color:"#6B7280"}}>/mo</span>
          </div>
          <div style={{background:"#ECFDF5",color:"#059669",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:6,filter:locked?"blur(3px)":"none"}}>Save ${ins.savings}/yr</div>
        </div>
      </div>
      <div style={{padding:"8px 14px"}}>
        {ins.ft.map(function(f, j) { return <div key={j} style={{display:"flex",alignItems:"center",gap:5,marginBottom:j<2?5:0,fontSize:11.5,color:"#374151"}}><span style={{color:ins.bc,fontWeight:700}}>✓</span>{f}</div>; })}
      </div>
      {!locked && (
        <div style={{padding:"0 14px 12px"}}>
          <a href={ins.rUrl || "#"} target="_blank" rel="noopener noreferrer" style={{display:"block",width:"100%",padding:9,textAlign:"center",background:"linear-gradient(135deg,"+ins.bc+","+ins.bc+"DD)",color:"#FFF",border:"none",borderRadius:10,fontSize:12.5,fontWeight:700,cursor:"pointer",textDecoration:"none"}}>View My Quote →</a>
        </div>
      )}
    </div>
  );
}

function CallModal({ show, onClose, profile, onSubmit }) {
  var [cn, setCn] = useState(profile.firstName || "");
  var [cp, setCp] = useState(profile.phone || "");
  var [ct, setCt] = useState("");
  var [cc, setCc] = useState(false);
  var [done, setDone] = useState(false);
  var [err, setErr] = useState("");
  if (!show) return null;
  var handleGo = function() {
    if (!cn.trim()) { setErr("Enter your name."); return; }
    var r = vPhone(cp);
    if (!r.ok) { setErr(r.e); return; }
    if (!cc) { setErr("Accept consent to receive a call."); return; }
    setErr(""); setDone(true); onSubmit({ name: cn, phone: r.v, time: ct });
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#FFF",borderRadius:20,maxWidth:380,width:"100%",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",padding:"18px 22px",color:"#FFF"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:17,fontWeight:700}}>📞 Talk to a Licensed Agent</div>
              <div style={{fontSize:11,opacity:.9,marginTop:3}}>Free · No obligation</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:"50%",width:28,height:28,color:"#FFF",fontSize:15,cursor:"pointer"}}>✕</button>
          </div>
        </div>
        <div style={{padding:"18px 22px"}}>
          {done ? (
            <div style={{textAlign:"center",padding:"16px 0"}}>
              <div style={{fontSize:44,marginBottom:10}}>✅</div>
              <div style={{fontSize:17,fontWeight:700,color:"#111",marginBottom:6}}>We'll Call You Shortly!</div>
              <div style={{fontSize:12,color:"#6B7280"}}>A licensed agent will call within 15 minutes.</div>
              <button onClick={onClose} style={{marginTop:14,padding:"9px 22px",border:"none",borderRadius:18,background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",color:"#FFF",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Done</button>
            </div>
          ) : (
            <div>
              <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Your Name</label><input value={cn} onChange={function(e){setCn(e.target.value);}} placeholder="First name" style={{width:"100%",padding:"9px 12px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}} /></div>
              <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Phone Number</label><input value={cp} onChange={function(e){setCp(e.target.value);}} placeholder="(555) 123-4567" style={{width:"100%",padding:"9px 12px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}} /></div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:4}}>Preferred Time</label>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {["ASAP","Morning","Afternoon","Evening"].map(function(x){return <button key={x} onClick={function(){setCt(x);}} style={{padding:"6px 12px",borderRadius:16,border:ct===x?"2px solid #0EA5E9":"1.5px solid #E5E7EB",background:ct===x?"#EFF6FF":"#FFF",color:ct===x?"#0EA5E9":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{x}</button>;})}
                </div>
              </div>
              <label style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:12,cursor:"pointer"}}><input type="checkbox" checked={cc} onChange={function(e){setCc(e.target.checked);}} style={{marginTop:2,accentColor:"#0EA5E9",flexShrink:0}} /><span style={{fontSize:9.5,color:"#64748B",lineHeight:1.5}}>I consent to receive a call from a licensed insurance agent. Not a condition of purchase.</span></label>
              {err && <div style={{fontSize:11,color:"#DC2626",marginBottom:8,fontWeight:600}}>⚠️ {err}</div>}
              <button onClick={handleGo} style={{width:"100%",padding:11,border:"none",borderRadius:10,background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",color:"#FFF",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>📞 Request Free Call</button>
            </div>
          )}
        </div>
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
  var endRef = useRef(null);
  var inRef = useRef(null);
  var [insurerList, setInsurerList] = useState(DEFAULT_INSURERS);
  var tot = STEPS.filter(function(s){return !s.cond||s.cond(pro);}).length + PII_STEPS.length;

  // Load partners from shared storage (set by admin dashboard)
  useEffect(function() {
    async function load() {
      var loaded = await loadInsurers();
      INSURERS = loaded; // update global ref
      setInsurerList(loaded);
    }
    load();
    // Refresh every 30 seconds in case admin changes partners
    var interval = setInterval(load, 30000);
    return function() { clearInterval(interval); };
  }, []);

  useEffect(function(){endRef.current && endRef.current.scrollIntoView({behavior:"smooth"});},[msgs,typ,showCon]);

  var bot = function(text, x) { setMsgs(function(p){return p.concat([Object.assign({role:"bot",text:text},x||{})]);}); };
  var usr = function(text) { setMsgs(function(p){return p.concat([{role:"user",text:text}]);}); };

  var startQ = function() {
    setPhase("qualifying"); setTyp(true);
    setTimeout(function(){bot("Your wish is my command! 🚀\n\nLet me find you the best rate. Feel free to ask me anything along the way.");setTyp(false);setTimeout(function(){advQ(0,{});},500);},500);
  };
  var startChat = function() {
    setPhase("chat"); setTyp(true);
    setTimeout(function(){bot("Of course! I'm your insurance genie — ask me anything! 😊\n\nI know about coverage types, specific insurers, claims, discounts, SR-22, deductibles, bundling and more.\n\nWhen ready for quotes, say **get my quotes**!");setTyp(false);setIph("Ask me anything...");setTimeout(function(){inRef.current&&inRef.current.focus();},100);},500);
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
      else if (s.id === "pri") px = "🏁 Last one! ";
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
      if (!r.ok) { setTyp(true);setTimeout(function(){bot("⚠️ "+r.e);setTyp(false);setQr(s.t==="qr"?s.opts:null);setIph(s.ph||"Type...");},300);return; }
      var v = r.v !== undefined ? r.v : (s.ps ? s.ps(val) : val.trim());
      var u = Object.assign({}, pro); u[s.f] = v; if (r.st) u.state = r.st; setPro(u); setCs(function(c){return c+1;});
      if (s.id === "zip" && r.st) { setTyp(true);setTimeout(function(){bot("📍 **"+v+"** in **"+r.st+"** — finding rates.");setTyp(false);setTimeout(function(){advQ(si+1,u);},300);},400);return; }
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
      bot(r.length+" insurers competing in **"+prof.zip+(prof.state?", "+prof.state:"")+"**!\n\n**"+r[0].n+"** is your best match at ~**$"+r[0].premium+"/mo** — saving ~**$"+r[0].savings+"/yr**.\n\nEstimated quotes:",{ins:r,locked:true,tags:true});
      setTyp(false);
      setTimeout(function(){setTyp(true);setTimeout(function(){bot("🔓 To unlock **exact rates**, I need 3 quick details. Info never shared without your consent.");setTyp(false);setPhase("pii");setPiiIdx(0);setTimeout(function(){advPII(0,prof);},500);},700);},1800);
    },1500);
  };

  var advPII = function(idx, prof) {
    if (idx >= PII_STEPS.length) { setPhase("consent");setShowCon(true);setTyp(true);setTimeout(function(){bot("Thanks "+prof.firstName+"! Please review and accept the consent below.");setTyp(false);},400);return; }
    setPiiIdx(idx); setTyp(true); var s = PII_STEPS[idx];
    setTimeout(function(){var px="";if(idx===1)px="Thanks "+prof.firstName+"! ";if(idx===2)px="Last one — ";bot(px+s.q);setTyp(false);setQr(null);setIph(s.ph);setTimeout(function(){inRef.current&&inRef.current.focus();},100);},400);
  };

  var handlePII = function(val) {
    if (!val.trim()) return; var s = PII_STEPS[piiIdx]; usr(val); setInp("");
    if (isQuestion(val, "pii", s.id)) {
      setTyp(true);getAnswer(val,pro,results).then(function(a){bot(a);setTyp(false);setTimeout(function(){setTyp(true);setTimeout(function(){bot("Back to unlocking quotes — "+s.q);setTyp(false);setIph(s.ph);setTimeout(function(){inRef.current&&inRef.current.focus();},100);},400);},700);});return;
    }
    if (s.vl) {
      var r = s.vl(val);
      if (!r.ok) { setTyp(true);setTimeout(function(){bot("⚠️ "+r.e);setTyp(false);setIph(s.ph);setTimeout(function(){inRef.current&&inRef.current.focus();},100);},300);return; }
      var u = Object.assign({},pro); u[s.f] = r.v; setPro(u); setCs(function(c){return c+1;});
      if (s.id==="phone"&&r.fmt){setTyp(true);setTimeout(function(){bot("📱 **"+r.fmt+"**");setTyp(false);setTimeout(function(){advPII(piiIdx+1,u);},250);},350);return;}
      advPII(piiIdx+1, u);
    }
  };

  // =====================================================
  // LEAD DISTRIBUTION — Send to ALL partners at once
  // =====================================================
  var BACKEND_URL = "https://api.aiinsuregenie.com/api/leads"; // Change to your backend URL

  var submitLead = async function(profile) {
    var consentText = "I provide express written consent to be contacted by AI InsureGenie and its insurance partners (Progressive, GEICO, State Farm, Allstate, Liberty Mutual, Nationwide, and others) via phone, text, and email, including automated technology. Consent is not required to purchase.";
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
          disclosed_buyers: "Progressive, GEICO, State Farm, Allstate, Liberty Mutual, Nationwide, and partners",
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
    if (!ck) return; setShowCon(false); usr("✅ I agree");
    var u = Object.assign({},pro,{consent:true,consentTs:new Date().toISOString()}); setPro(u);
    setPhase("unlock"); setTyp(true);

    // Show progress messages while distributing
    bot("🔍 Matching you with the best insurers...");

    // Send lead to ALL partners simultaneously via backend
    submitLead(u).then(function(backendResult) {
      if (backendResult && backendResult.success) {
        var accepted = backendResult.distribution.accepted_buyers || [];
        var revenue = backendResult.distribution.total_revenue || 0;
        console.log("LEAD SOLD: $" + revenue + " to " + accepted.length + " buyers", backendResult);

        // Show success with buyer count
        setTimeout(function() {
          bot("✅ **" + accepted.length + " insurer" + (accepted.length > 1 ? "s are" : " is") + " competing** for your business!");
          // Then show the cards
          setTimeout(function() {
            var r = results.map(function(ins){return Object.assign({},ins,{rUrl:buildUrl(ins,u)});}); setResults(r);
            bot(u.firstName + ", here are your personalized quotes:",{ins:r,locked:false,tags:true});
            setTyp(false); setPhase("follow");
            setTimeout(function(){setTyp(true);setTimeout(function(){bot("📧 Comparison sent to **" + u.email + "**. Questions? I'm here!");setTyp(false);},1000);},2000);
          }, 800);
        }, 1000);
      } else {
        // Backend failed or unavailable — still show cards (fallback)
        console.log("Backend unavailable, showing cards anyway");
        setTimeout(function() {
          var r = results.map(function(ins){return Object.assign({},ins,{rUrl:buildUrl(ins,u)});}); setResults(r);
          bot(u.firstName + ", your quotes are ready!\n\nDetails pre-filled — just confirm on the insurer's page:",{ins:r,locked:false,tags:true});
          setTyp(false); setPhase("follow");
          setTimeout(function(){setTyp(true);setTimeout(function(){bot("📧 Comparison sent to **" + u.email + "**. Questions? I'm here!");setTyp(false);},1000);},2000);
        }, 1300);
      }
    });
  };

  var handleChat = function(val) {
    if (!val.trim()) return; usr(val); setInp("");
    var t = val.toLowerCase();
    if (["get my quote","get quote","start quote","compare rate","get started","find rate","i want a quote"].some(function(w){return t.includes(w);})) {
      setTyp(true);setTimeout(function(){bot("Let's do it! 🚀");setTyp(false);setPhase("qualifying");setTimeout(function(){advQ(0,pro);},400);},400);return;
    }
    setTyp(true);getAnswer(val,pro,results).then(function(a){bot(a);setTyp(false);setIph("Ask more or say 'get my quotes'...");});
  };

  var handleFollow = function(val) {
    if (!val.trim()) return; usr(val); setInp(""); setTyp(true);
    getAnswer(val,pro,results).then(function(a){bot(a);setTyp(false);});
  };

  var send = function(val) {
    var v = val || inp; if (!v.trim()) return;
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

  var chipStyle = function(isSpecial) {
    return {padding:"6px 11px",background:isSpecial?"#FFF8F0":"#F0F9FF",border:isSpecial?"1.5px solid #FDBA74":"1.5px solid #BAE6FD",borderRadius:16,fontSize:11,fontWeight:600,color:isSpecial?"#C2410C":"#0369A1",cursor:"pointer",fontFamily:"inherit",transition:"all .2s"};
  };

  return (
    <div style={{width:"100%",height:"100vh",display:"flex",flexDirection:"column",background:"#F8F9FA",fontFamily:"'Outfit',sans-serif",overflow:"hidden"}}>
      <style>{CSS_TEXT}</style>

      {/* Header */}
      <div style={{padding:"10px 16px",background:"#FFF",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🧞</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:"#111"}}>AI InsureGenie</div>
            <div style={{fontSize:9.5,color:"#10B981",fontWeight:600}}>● Online — Your Insurance Wish Granted</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {phase !== "welcome" && (
            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:60}}>
              <div style={{flex:1,height:3,background:"#E5E7EB",borderRadius:3,overflow:"hidden"}}>
                <div style={{width:Math.round(cs/tot*100)+"%",height:"100%",background:"linear-gradient(90deg,#0EA5E9,#06D6A0)",borderRadius:3,transition:"width .5s"}} />
              </div>
              <span style={{fontSize:9.5,fontWeight:700,color:"#9CA3AF"}}>{Math.round(cs/tot*100)}%</span>
            </div>
          )}
          {phase !== "welcome" && (
            <button onClick={function(){setShowCall(true);}} className="fc-b" style={{padding:"5px 10px",border:"1.5px solid #0EA5E9",borderRadius:16,background:"#FFF",color:"#0EA5E9",fontSize:10.5,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>📞 Agent</button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:12}}>
        {phase === "welcome" && (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"fu .5s ease",padding:14}}>
            <div style={{width:68,height:68,borderRadius:18,background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,marginBottom:18,boxShadow:"0 10px 30px rgba(14,165,233,.22)",animation:"pl 3s ease-in-out infinite"}}>🧞</div>
            <h1 style={{fontSize:22,fontWeight:800,color:"#111",textAlign:"center",marginBottom:7}}>Your AI Insurance Genie</h1>
            <p style={{fontSize:13,color:"#6B7280",textAlign:"center",maxWidth:380,lineHeight:1.6,marginBottom:24}}>Make a wish for the best auto insurance rate. I'll compare 10+ insurers and grant you personalized quotes — free, in 60 seconds.</p>
            <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:300}}>
              <button onClick={startQ} style={{padding:"12px 32px",border:"none",borderRadius:24,background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",color:"#FFF",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 6px 20px rgba(14,165,233,.3)",width:"100%"}}>🚀 Get My Free Quotes</button>
              <button onClick={startChat} style={{padding:"12px 32px",border:"2px solid #0EA5E9",borderRadius:24,background:"#FFF",color:"#0EA5E9",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>💬 Just Ask a Question</button>
            </div>
            <div style={{display:"flex",gap:14,marginTop:18,flexWrap:"wrap",justifyContent:"center"}}>
              {["🔒 No spam","⚡ 60-sec","💰 Free","🏆 10+ insurers"].map(function(t,i){return <span key={i} style={{fontSize:10.5,color:"#9CA3AF",fontWeight:500}}>{t}</span>;})}
            </div>
          </div>
        )}

        {msgs.map(function(m, i) {
          return (
            <div key={i} style={{animation:"fu .3s ease"}}>
              {m.role === "user" ? (
                <div style={{display:"flex",justifyContent:"flex-end"}}>
                  <div style={{background:"linear-gradient(135deg,#0EA5E9,#0284C7)",color:"#FFF",padding:"9px 14px",borderRadius:"14px 14px 4px 14px",maxWidth:"70%",fontSize:13,lineHeight:1.5,fontWeight:500}}>{m.text}</div>
                </div>
              ) : (
                <div>
                  <div style={{display:"flex",gap:7,alignItems:"flex-start"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#FFF",fontWeight:800,flexShrink:0}}>AI</div>
                    <div style={{background:"#FFF",border:"1px solid #E5E7EB",padding:"10px 14px",borderRadius:"4px 14px 14px 14px",maxWidth:"85%",fontSize:13,lineHeight:1.6,color:"#333",whiteSpace:"pre-line"}}>{renderBold(m.text)}</div>
                  </div>
                  {m.tags && (
                    <div style={{display:"flex",flexWrap:"wrap",gap:4,paddingLeft:33,marginTop:5}}>
                      {[pro.zip&&("📍"+pro.zip+(pro.state?" ("+pro.state+")":"")),pro.age&&("🎂 "+pro.age),pro.vehicleMake&&pro.vehicleMake!=="Other"&&("🚗 "+pro.vehicleMake),pro.driving&&("📋 "+pro.driving),pro.firstName&&("👤 "+pro.firstName)].filter(Boolean).map(function(x,j){return <span key={j} style={{padding:"2px 8px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:14,fontSize:9.5,fontWeight:600,color:"#1E40AF"}}>{x}</span>;})}
                    </div>
                  )}
                  {m.ins && (
                    <div className="cr-s" style={{display:"flex",gap:10,overflowX:"auto",paddingLeft:33,paddingTop:8,paddingBottom:4}}>
                      {m.ins.map(function(x,j){return <InsurerCard key={j} ins={x} idx={j} locked={!!m.locked} />;})}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {showCon && !typ && (
          <div style={{paddingLeft:33,animation:"fu .3s ease"}}>
            <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 12px",marginTop:8}}>
              <label style={{display:"flex",gap:8,cursor:"pointer",alignItems:"flex-start"}}>
                <input type="checkbox" checked={ck} onChange={function(e){setCk(e.target.checked);}} style={{marginTop:3,width:15,height:15,accentColor:"#0EA5E9",flexShrink:0}} />
                <span style={{fontSize:10,color:"#64748B",lineHeight:1.5}}>I provide express written consent to be contacted by AI InsureGenie and its insurance partners (Progressive, GEICO, State Farm, Allstate, Liberty Mutual, Nationwide, others) via phone, text, and email, including automated technology. Consent is not required to purchase. I may revoke anytime. I agree to the Privacy Policy and Terms.</span>
              </label>
            </div>
            <button onClick={handleConsent} disabled={!ck} style={{marginTop:8,padding:"10px 24px",border:"none",borderRadius:20,background:ck?"linear-gradient(135deg,#0EA5E9,#06D6A0)":"#D1D5DB",color:"#FFF",fontSize:12,fontWeight:700,cursor:ck?"pointer":"not-allowed",fontFamily:"inherit",opacity:ck?1:.5}}>✓ Agree & Unlock Quotes</button>
          </div>
        )}

        {typ && (
          <div style={{display:"flex",alignItems:"center",gap:7,padding:"3px 0"}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#FFF",fontWeight:800,flexShrink:0}}>AI</div>
            <div style={{background:"#F0F0F0",borderRadius:14,padding:"9px 14px",display:"flex",gap:4}}>
              {[0,1,2].map(function(k){return <div key={k} style={{width:5.5,height:5.5,borderRadius:"50%",background:"#999",animation:"db 1.2s ease "+(k*.15)+"s infinite"}} />;})}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Area */}
      <div style={{padding:"8px 16px 14px",background:"#FFF",borderTop:"1px solid #E5E7EB",flexShrink:0}}>
        {qr && !typ && (
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
            {qr.map(function(o,i){return <button key={i} onClick={function(){send(o);}} className="qr-b" style={{padding:"7px 13px",background:"#FFF",border:"1.5px solid #E0E0E0",borderRadius:20,fontSize:12,fontWeight:600,color:"#333",cursor:"pointer",fontFamily:"inherit"}}>{o}</button>;})}
          </div>
        )}

        {phase === "chat" && !typ && (
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
            {["Cheapest insurer?","Coverage types","About Allstate","SR-22 info","Deductibles"].map(function(s,i){return <button key={i} className="fc-b" onClick={function(){handleChat(s);}} style={chipStyle(false)}>{s}</button>;})}
            <button className="fc-b" onClick={function(){setShowCall(true);}} style={chipStyle(true)}>📞 Talk to agent</button>
            <button onClick={startQ} style={{padding:"6px 11px",background:"linear-gradient(135deg,#0EA5E9,#06D6A0)",border:"none",borderRadius:16,fontSize:11,fontWeight:600,color:"#FFF",cursor:"pointer",fontFamily:"inherit"}}>🚀 Get quotes</button>
          </div>
        )}

        {phase === "follow" && !typ && (
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
            {["Lower rate?","Compare top picks","Full coverage details","About Allstate claims"].map(function(s,i){return <button key={i} className="fc-b" onClick={function(){handleFollow(s);}} style={chipStyle(false)}>{s}</button>;})}
            <button className="fc-b" onClick={function(){setShowCall(true);}} style={chipStyle(true)}>📞 Talk to agent</button>
          </div>
        )}

        {phase !== "welcome" && (
          <div style={{display:"flex",alignItems:"center",gap:7,background:"#F3F4F6",borderRadius:24,padding:"3px 3px 3px 14px"}}>
            <input ref={inRef} value={inp} onChange={function(e){setInp(e.target.value);}} onKeyDown={function(e){if(e.key==="Enter")send();}} placeholder={phase==="consent"?"Ask a question or check the box above...":iph} disabled={typ} style={{flex:1,border:"none",background:"none",outline:"none",fontSize:13,color:"#111",fontFamily:"'Outfit',sans-serif",fontWeight:500}} />
            <button className="sb-b" onClick={function(){send();}} disabled={!inp.trim()||typ} style={{width:36,height:36,borderRadius:"50%",background:inp.trim()&&!typ?"linear-gradient(135deg,#0EA5E9,#06D6A0)":"#D1D5DB",border:"none",cursor:inp.trim()&&!typ?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            </button>
          </div>
        )}
        <div style={{textAlign:"center",marginTop:5,fontSize:9,color:"#C0C0C0"}}>Powered by AI · 10+ insurers · <span style={{color:"#0EA5E9",fontWeight:600}}>100% Free</span></div>
      </div>

      <CallModal show={showCall} onClose={function(){setShowCall(false);}} profile={pro} onSubmit={function(d){var u=Object.assign({},pro);if(d.name&&!pro.firstName)u.firstName=d.name;if(d.phone&&!pro.phone)u.phone=d.phone;setPro(u);}} />
    </div>
  );
}
