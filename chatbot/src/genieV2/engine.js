// Genie 2.0: deterministic qualification core. No PII or network calls.
// This module is intentionally independent of React, Cloudflare and LLM providers.
// The LLM can suggest facts, but only validated answers should enter the profile.

export const SCENARIOS = Object.freeze({
  sr22: "SR-22 / filing requirement",
  dui: "DUI / DWI",
  lapse: "Coverage lapse or cancellation",
  nonowner: "Non-owner insurance",
  standard: "General auto insurance"
});

export function initialAssessment() {
  return { version: 2, scenario: null, state: null, ownsVehicle: null,
    filingRequired: null, currentlyInsured: null, timing: null, history: [],
    completed: false };
}

export function detectScenario(text = "") {
  const s = String(text).toLowerCase();
  if (/\b(dui|dwi|drunk driving|driving under the influence)\b/.test(s)) return "dui";
  if (/\b(sr[ -]?22|fr[ -]?44|filing requirement)\b/.test(s)) return "sr22";
  if (/\b(non[ -]?owner|don.t own (a |any )?car|no car|without (a |my )?car)\b/.test(s)) return "nonowner";
  if (/\b(lapse|lapsed|cancelled|canceled|expired|uninsured|no insurance)\b/.test(s)) return "lapse";
  return null;
}

const STATES = Object.freeze({
  AL:"Alabama", AK:"Alaska", AZ:"Arizona", AR:"Arkansas", CA:"California",
  CO:"Colorado", CT:"Connecticut", DE:"Delaware", FL:"Florida", GA:"Georgia",
  HI:"Hawaii", ID:"Idaho", IL:"Illinois", IN:"Indiana", IA:"Iowa",
  KS:"Kansas", KY:"Kentucky", LA:"Louisiana", ME:"Maine", MD:"Maryland",
  MA:"Massachusetts", MI:"Michigan", MN:"Minnesota", MS:"Mississippi",
  MO:"Missouri", MT:"Montana", NE:"Nebraska", NV:"Nevada", NH:"New Hampshire",
  NJ:"New Jersey", NM:"New Mexico", NY:"New York", NC:"North Carolina",
  ND:"North Dakota", OH:"Ohio", OK:"Oklahoma", OR:"Oregon", PA:"Pennsylvania",
  RI:"Rhode Island", SC:"South Carolina", SD:"South Dakota", TN:"Tennessee",
  TX:"Texas", UT:"Utah", VT:"Vermont", VA:"Virginia", WA:"Washington",
  WV:"West Virginia", WI:"Wisconsin", WY:"Wyoming", DC:"District of Columbia"
});

export function normalizeState(value) {
  const s = String(value || "").trim().toLowerCase();
  const code = Object.keys(STATES).find(k => k.toLowerCase() === s || STATES[k].toLowerCase() === s);
  return code || null;
}

export function normalizeYesNo(value) {
  const s = String(value || "").trim().toLowerCase();
  if (/^(yes|y|true|i do|i have|currently yes)$/.test(s)) return true;
  if (/^(no|n|false|i don.t|i do not|not currently)$/.test(s)) return false;
  return null;
}

const QUESTIONS = {
  scenario: { id:"scenario", prompt:"What brings you here today? You can describe your situation in your own words.", choices:["DUI or SR-22","My insurance lapsed","I don't own a car","Find auto insurance"] },
  state: { id:"state", prompt:"Which US state do you need insurance in?", choices:[] },
  ownsVehicle: { id:"ownsVehicle", prompt:"Do you own a vehicle that you need to insure?", choices:["Yes","No"] },
  filingRequired: { id:"filingRequired", prompt:"Have a court or your state DMV told you that you need an SR-22 or FR-44 filing?", choices:["Yes","No","Not sure"] },
  currentlyInsured: { id:"currentlyInsured", prompt:"Do you currently have an active auto insurance policy?", choices:["Yes","No","Not sure"] },
  timing: { id:"timing", prompt:"When do you need coverage?", choices:["Today","Within 7 days","Just researching"] }
};

export function nextQuestion(profile) {
  if (!profile.scenario) return QUESTIONS.scenario;
  if (!profile.state) return QUESTIONS.state;
  if (profile.ownsVehicle === null) return QUESTIONS.ownsVehicle;
  if (["dui","sr22"].includes(profile.scenario) && profile.filingRequired === null) return QUESTIONS.filingRequired;
  if (profile.currentlyInsured === null) return QUESTIONS.currentlyInsured;
  if (!profile.timing) return QUESTIONS.timing;
  return null;
}

export function applyAnswer(profile, questionId, answer) {
  const next = { ...profile, history: [...(profile.history || [])] };
  const raw = String(answer || "").trim();
  if (!raw || raw.length > 500) return { profile, error:"Please enter a shorter answer." };
  let value;
  if (questionId === "scenario") value = detectScenario(raw) || (/insurance|quote|coverage|car/i.test(raw) ? "standard" : null);
  else if (questionId === "state") value = normalizeState(raw);
  else if (["ownsVehicle","filingRequired","currentlyInsured"].includes(questionId)) {
    value = normalizeYesNo(raw);
    if (value === null && questionId !== "ownsVehicle" && /^(not sure|unsure|unknown)$/i.test(raw)) value = "unknown";
  } else if (questionId === "timing") {
    value = /today|immediately|asap|now/i.test(raw) ? "today" :
      /week|soon|7 days/i.test(raw) ? "within_7_days" :
      /research|looking|later/i.test(raw) ? "researching" : null;
  } else return { profile, error:"Unknown question." };
  if (value === null) return { profile, error:"I couldn't confidently understand that answer. Please choose an option or clarify." };
  next[questionId] = value;
  next.history.push({ questionId, answer: value });
  next.completed = nextQuestion(next) === null;
  return { profile: next, question: nextQuestion(next), error: null };
}

export function assessmentResult(profile) {
  if (nextQuestion(profile)) return { ready:false, missing:nextQuestion(profile).id };
  return {
    ready:true,
    scenario:profile.scenario,
    state:profile.state,
    needsFilingVerification:["dui","sr22"].includes(profile.scenario) && profile.filingRequired !== false,
    routeStatus:"pending_verified_partner",
    disclaimer:"This is an insurance navigation assessment, not an insurance quote or guarantee of coverage. Confirm filing requirements with the relevant state authority and coverage with a licensed provider."
  };
}
