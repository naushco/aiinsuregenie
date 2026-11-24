// Genie 2.2: independent, deterministic journey decisions and consent-safe
// review summaries. No raw messages, contact fields, model prompts or buyer calls.
export const QUOTE_FIELDS = ["st","sitDone","vehicleStatus","make","model","year","cov","when"];
const RISK_LABELS = {sr22:"SR-22 filing",dui:"DUI / DWI",lapse:"Coverage lapse",ride:"Rideshare / delivery",record:"Tickets or accidents",new:"New driver",none:"No special driving issue"};
const STATUS_LABELS = {owned:"Own a vehicle",financed:"Financing a vehicle",leased:"Leasing a vehicle",no_vehicle:"Non-owner coverage"};
const WHEN_LABELS = {today:"Today",week:"Within a week",compare:"Comparing options"};
const COVERAGE_LABELS = {min:"State minimum",full:"Broader coverage",unsure:"Not sure yet"};

export function quoteIntent(message) {
  const text = String(message || "").trim().toLowerCase();
  if (!text || /^(what|why|how|if|suppose|hypothetically|can someone|does|is there)\b/.test(text)) return false;
  return /\b(get (a |my |an )?(insurance )?quote|show (me )?(my |some )?quotes|find (me )?(insurance )?quotes|quote me|compare (insurance )?quotes|start (my |a )?quote|ready (to|for) (buy|purchase|quote)|i (want|need|would like) (a |an |my )?(insurance |auto insurance |car insurance )?(quote|quotes)|i need (car|auto) insurance (now|today|asap|immediately|right away|as soon as possible)|i want to (buy|shop for) (car |auto )?insurance)\b/.test(text);
}

export function hasConfirmedDetails(s) {
  return !!(s && (s.st || s.sitDone || s.vehicleStatus || s.cov || s.when || s.make || s.pri));
}

export function reviewProfile(s, nameState=x=>x) {
  const v=s||{};
  const sits=Array.isArray(v.sits) ? v.sits : [];
  const vehicle= v.vehicleStatus==="no_vehicle" ? "Not applicable" : [v.year && v.year!=="unsure" ? v.year==="old"?"2015 or older":v.year : "",v.make,v.model && v.model!=="unsure"?v.model:""].filter(Boolean).join(" ");
  return [
    {key:"st",label:"State",value:v.st?nameState(v.st):null,ready:!!v.st},
    {key:"sits",label:"Insurance situation",value:v.sitDone?(sits.length?sits.map(k=>RISK_LABELS[k]).filter(Boolean).join(", "):"Not specified"):null,ready:v.sitDone===true},
    {key:"vehicleStatus",label:"Vehicle status",value:STATUS_LABELS[v.vehicleStatus]||null,ready:!!STATUS_LABELS[v.vehicleStatus]},
    {key:"car",label:"Vehicle",value:vehicle||null,ready:v.vehicleStatus==="no_vehicle"||!!((v.make||v.carAge)&&v.year)},
    {key:"cov",label:"Coverage",value:COVERAGE_LABELS[v.cov]||null,ready:!!COVERAGE_LABELS[v.cov]},
    {key:"when",label:"When coverage is needed",value:WHEN_LABELS[v.when]||null,ready:!!WHEN_LABELS[v.when]},
    {key:"pri",label:"Main priority",value:v.pri==="price"?"Lower cost":v.pri==="coverage"?"Coverage":v.pri==="service"?"Service":null,ready:true}
  ];
}
export function profileReady(s, hasModels=()=>false) {
  const v=s||{};
  if (!v.st||!v.sitDone||!STATUS_LABELS[v.vehicleStatus]||!COVERAGE_LABELS[v.cov]||!WHEN_LABELS[v.when]) return false;
  if(v.vehicleStatus==="no_vehicle")return true;
  return !!((v.make||v.carAge)&&v.year&&(!hasModels(v.make)||v.model));
}

// This measures structured *completeness*, not conversion probability, quote
// price, underwriting eligibility or consumer value. No PII or raw text.
export function qualificationSummary(s,hasModels=()=>false) {
  const v=s||{};
  const required=["st","sits","vehicleStatus","cov","when"];
  if(v.vehicleStatus && v.vehicleStatus!=="no_vehicle") required.push("car");
  const rows=reviewProfile(v);
  const completeFields=required.filter(key=>rows.some(row=>row.key===key && row.ready && (key!=="car" || (!!v.year && (!hasModels(v.make)||!!v.model)))));
  const unconfirmed=required.filter(key=>!completeFields.includes(key));
  return {
    ready: profileReady(v,hasModels),
    confirmed_count: completeFields.length,
    required_count: required.length,
    missing_fields: unconfirmed,
    situation: v.sitDone && Array.isArray(v.sits) ? v.sits.filter(key=>key!=="none" && Object.prototype.hasOwnProperty.call(RISK_LABELS,key)) : [],
    urgency: WHEN_LABELS[v.when] || null,
    buyer_routing:"not_configured"
  };
}

// Attribution is *session-scoped* and only used for campaign reconciliation;
// never store contact fields or raw conversation as metadata.
// Click IDs remain first-party session attribution; do not automatically pass
// them through to an external partner without a separately approved mapping.
const ATTR_KEYS=["utm_source","utm_medium","utm_campaign","utm_content","utm_term","pub","source_id","subid","gclid","fbclid","msclkid","ttclid"];
export function safeAttribution(search,previous={},optOut=false) {
  if(optOut)return {};
  const out={};
  const values=new URLSearchParams(search||"");
  for(const k of ATTR_KEYS){
    const value=values.get(k) || (previous && previous[k]) || "";
    // Prevent accidental contact data or injection in analytics metadata.
    if(value && typeof value==="string" && value.length<=120 && !/@|\+|%40|\s|[<>]/i.test(value) && /^[a-zA-Z0-9_.:\-]{1,120}$/.test(value))out[k]=value;
  }
  return out;
}
export function safeJourney(existing,mode) {
  if(mode==="quote"||mode==="advisor")return mode;
  return existing==="quote"?"quote":"advisor";
}
