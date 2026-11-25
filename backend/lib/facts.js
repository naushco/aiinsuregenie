// Checked facts for Genie's AI answers. Every line comes from an AI InsureGenie guide
// (site/content/guides/*.md), which cites the official source. Keep this file in sync
// when a guide changes. The model must answer from these facts and never contradict them.
"use strict";

const FACTS = [
  "SR-22 BASICS: An SR-22 is a form your insurer files with the state to prove you carry at least the state's minimum liability insurance. It is not a policy by itself and does not restore a license on its own; reinstatement fees and other steps may still apply.",
  "SR-22 FILING FEE: typically about $15 to $50, paid through the insurer. It is NOT free. Some insurers also ask for part of the premium up front. The bigger cost is the higher premium (one analysis: about +$322 a year on average, 12%).",
  "NOT EVERY INSURER FILES SR-22s. Drivers may need an insurer that files them; mention this when relevant.",
  "SR-22 DURATION BY STATE: Texas 2 years from the conviction date or crash-related judgment (Texas DPS; $100 DPS reinstatement fee). California usually 3 years, up to 5 after more than one DUI. Illinois usually 3 years (SR-22 policies also need $25,000/$50,000 uninsured motorist coverage; processing can take up to 30 days). Ohio 1 year for non-compliance suspensions added on or after April 9, 2025; older offenses 3 years (first) or 5 years (repeat). Arizona usually 3 years. Georgia 3 years of continuous coverage from the conviction date. Most other states: usually 3 years, but rules vary, so tell the visitor to confirm with their state.",
  "Any gap or cancellation during the SR-22/FR-44 period is reported to the state and can re-suspend the license. Coverage must stay active the whole time.",
  "FLORIDA FR-44 (after DUI): liability of at least $100,000/$300,000/$50,000, kept for 3 years from the date the driving privilege is reinstated (FLHSMV).",
  "VIRGINIA FR-44 (DUI-related conviction): double the state minimum liability (for policies starting 2025 or later: $100,000/$200,000/$50,000), kept for 3 years from the end of the suspension or revocation (Virginia DMV).",
  "NON-OWNER SR-22: for drivers who don't own a car. Covers liability only (no full coverage). About $33 to $40 a month for minimum coverage at the cheapest insurers in 2026 ($28 at USAA, military families only), plus the $15 to $50 filing fee. Texas DPS accepts an SR-22 on a non-owner policy; it must meet Texas 30/60/25 limits.",
  "COVERAGE LAPSE: insurers report cancellations to the state, which can mean fines, a suspended license or registration, or an SR-22 requirement. The next policy usually costs more: about 8% more after a gap of up to 30 days, about 35% more after a longer gap. Florida: insurers must report a cancellation within 10 days; reinstatement costs $150 the first time, $250 the second, $500 for later ones within three years. Getting continuous coverage again as soon as possible helps.",
  "SR-22 AVERAGE MONTHLY PRICES (2026 analysis, liability / full coverage): California about $112 / $234; Illinois about $100 / $196; Arizona about $120 / $214; Georgia about $194 / $319. These are averages, not quotes."
];

// How to handle high-impact questions safely (AI InsureGenie 3.1).
const RULES = [
  "OHIO SR-22: the filing period depends on which suspension applies (1 year for non-compliance suspensions added on or after April 9, 2025; 3 years for an older first offense; 5 years for an older repeat offense). If the visitor hasn't said which applies, ASK which suspension and when it was added before giving a duration.",
  "HOUSEHOLD OR SHARED VEHICLE: policies often exclude regular use of a car owned by someone in the household, or require household drivers to be listed. Never say a policy will cover it; tell the visitor to confirm the policy's household and regular-use terms with the insurer before relying on coverage.",
  "RENTAL CARS: separate (1) liability for injuring others or damaging their property from (2) damage to the rental car itself. A personal auto policy may extend liability, and sometimes physical damage if the policy has it, but terms vary. Ask where they are renting (US state or another country), and tell them to check the rental agreement and their policy's territory. Personal US policies usually do not cover rentals outside the US and Canada.",
  "STATE LEGAL MINIMUMS: when you give a state's legal minimum, name the state agency to confirm with, using this list where it applies: Texas Department of Insurance (tdi.texas.gov) and Texas DPS (dps.texas.gov); California DMV (dmv.ca.gov); Florida FLHSMV (flhsmv.gov); Virginia DMV (dmv.virginia.gov); Illinois Secretary of State (ilsos.gov); Ohio BMV (bmv.ohio.gov); Georgia DDS (dds.georgia.gov); Arizona ADOT MVD (azdot.gov/mvd); Kentucky Department of Insurance (insurance.ky.gov). For other states, say 'your state's insurance department or DMV'.",
  "USE THE VISITOR'S LATEST DETAILS: if they correct a fact (state, car, ownership, timing), use the corrected value everywhere in your answer and ignore the old one."
];

function factsBlock() {
  return "\n\nCHECKED FACTS (from AI InsureGenie's sourced guides). Use these instead of your memory. Never contradict them. " +
    "If a question needs a state rule that is not listed, say it varies by state and suggest confirming with the state's motor vehicle agency, without guessing numbers.\n- " +
    FACTS.join("\n- ") + "\n\nRULES FOR HIGH-IMPACT QUESTIONS:\n- " + RULES.join("\n- ");
}

module.exports = { FACTS, RULES, factsBlock };
