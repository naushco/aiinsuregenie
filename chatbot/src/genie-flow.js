// Genie 2.1 browser-side translations between the approved quote wizard and
// the deterministic API plan. These are PII-free; never persist raw conversation.
export function confirmedFacts(s) {
  const situationMap={sr22:"sr22",dui:"dui",lapse:"coverage_lapse",ride:"rideshare",new:"new_driver",record:"accident"};
  const situation=(s.sitDone && Array.isArray(s.sits)) ? [...new Set(s.sits.map(x=>situationMap[x]).filter(Boolean))] : [];
  return {
    state: typeof s.st==="string" && /^[A-Z]{2}$/.test(s.st) ? s.st : null,
    situation,
    situation_confirmed: s.sitDone===true,
    goal: s.pri==="price" ? ["lower_price"] : [],
    urgency: {today:"today",tomorrow:"within_week",week:"within_week",compare:"later"}[s.when] || "unknown",
    vehicle_status: ["owned","financed","leased","buying","no_vehicle"].includes(s.vehicleStatus) ? s.vehicleStatus : "unknown",
    coverage_goal: {min:"minimum",full:"full"}[s.cov] || "unsure",
    coverage_goal_confirmed: ["min","full","unsure"].includes(s.cov)
  };
}

function carDetails(s, hasModels) {
  if (!s.vehicleStatus || s.vehicleStatus==="no_vehicle") return null;
  if (!s.make && !s.carAge) return "make";
  if (s.make && hasModels(s.make) && !s.model) return "model";
  if (!s.year) return "year";
  return null;
}

export function localStage(s, hasModels=()=>false) {
  if (!s.st) return "state";
  if (!s.sitDone) return "sit";
  if (!s.vehicleStatus) return "vehicle";
  // AI InsureGenie 3.0: these three answers decide the partner. Car, coverage and
  // timing don't change the match today, so they are asked only if the visitor
  // chooses "Improve my match" (s.refine).
  if (!s.refine) return "done";
  const car=carDetails(s,hasModels);
  if (car) return car;
  if (!s.cov) return "cov";
  if (!s.when) return "when";
  return "done";
}

// Map *server-selected* missing facts to existing UI stages. Car make/model/year
// remain extra optional matching detail in our existing UI, not an inference
// that the user owns a vehicle. The local planner is a fail-safe if API fails.
export function stageFromPlan(s,next,hasModels=()=>false) {
  const local=localStage(s,hasModels);
  if (!next || typeof next!=="object") return local;
  if (next.field==="state") return "state";
  if (next.field==="situation") return "sit";
  if (next.field==="vehicle_status") return "vehicle";
  const car=carDetails(s,hasModels);
  if (car) return car;
  if (next.field==="coverage_goal") return "cov";
  if (next.field==="urgency") return !s.cov ? "cov" : "when";
  if (next.complete===true && local==="done") return "done";
  return local;
}

// AI-extracted candidate values are NEVER authoritative. Show them to the
// visitor for explicit confirmation before promoting them to saved facts.
export function candidateToWizard(candidate,s) {
  if (!candidate || typeof candidate!=="object") return {};
  const got={};
  if (typeof candidate.state==="string" && /^[A-Z]{2}$/.test(candidate.state) && candidate.state!==s.st) got.st=candidate.state;
  const situations={sr22:"sr22",dui:"dui",coverage_lapse:"lapse",rideshare:"ride",new_driver:"new",accident:"record",ticket:"record"};
  const newSits=Array.isArray(candidate.situation) ? candidate.situation.map(x=>situations[x]).filter(Boolean) : [];
  if (newSits.length) {
    const old=Array.isArray(s.sits) ? s.sits.filter(x=>x!=="none") : [];
    const merged=[...new Set([...old,...newSits])];
    if (merged.length!==old.length || s.sitDone!==true) {
      got.sits=merged;
      got.sitDone=true;
    }
  }
  const when={today:"today",within_week:"week",later:"compare"}[candidate.urgency];
  if (when && !s.when) got.when=when;
  if (Array.isArray(candidate.goal) && candidate.goal.includes("lower_price") && !s.pri) got.pri="price";
  return got;
}

export function candidateDescription(got, stateNames={}) {
  const fields=[];
  if(got.st) fields.push(stateNames[got.st]||got.st);
  if(got.sits) fields.push(got.sits.join(", ").replace(/_/g," "));
  if(got.when) fields.push({today:"today",week:"this week",compare:"comparing"}[got.when]);
  if(got.pri) fields.push("lower price");
  return fields.join(" · ");
}
