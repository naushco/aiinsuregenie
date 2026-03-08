// src/services/distributor.js — Ping-Post Lead Distribution Engine
// This is the CORE money-making logic. It decides who gets each lead and at what price.

const axios = require("axios");
const { queries } = require("../database");
const buyerConfig = require("../../config/buyers.json");

const PING_TIMEOUT = parseInt(process.env.PING_TIMEOUT_MS) || 3000;
const POST_TIMEOUT = parseInt(process.env.POST_TIMEOUT_MS) || 5000;
const EXCLUSIVE_MIN_BID = parseFloat(process.env.EXCLUSIVE_MIN_BID) || 15.0;
const MAX_SHARED = parseInt(process.env.MAX_SHARED_BUYERS) || 3;
const MODE = process.env.DISTRIBUTION_MODE || "hybrid";

// ============================================================
// BUYER FILTERING — Which buyers are eligible for this lead?
// ============================================================
function getEligibleBuyers(lead) {
  return buyerConfig.buyers.filter(function (buyer) {
    if (!buyer.enabled) return false;

    // State filter
    if (buyer.accepted_states !== "all" && !buyer.accepted_states.includes(lead.state)) return false;

    // Age filter
    if (lead.age && buyer.min_age && lead.age < buyer.min_age) return false;
    if (lead.age && buyer.max_age && lead.age > buyer.max_age) return false;

    // Driving record filter
    if (lead.driving_record && buyer.accepted_driving_records) {
      if (!buyer.accepted_driving_records.includes(lead.driving_record)) return false;
    }

    return true;
  });
}

// ============================================================
// FIELD MAPPING — Transform lead data to buyer's expected format
// ============================================================
function mapLeadToBuyer(lead, buyer, includePII) {
  var mapping = buyer.field_mapping || {};
  var result = {};

  // Profile fields (always sent in ping + post)
  var profileFields = {
    zip: lead.zip,
    state: lead.state,
    age: lead.age,
    vehicle_year: lead.vehicle_year,
    vehicle_make: lead.vehicle_make,
    coverage: lead.coverage,
    driving_record: lead.driving_record,
    currently_insured: lead.currently_insured,
    current_insurer: lead.current_insurer,
    homeowner: lead.homeowner,
    military: lead.military,
    multi_car: lead.multi_car,
  };

  // PII fields (only sent in post, NOT in ping)
  var piiFields = {
    first_name: lead.first_name,
    phone: lead.phone,
    email: lead.email,
  };

  // Consent fields (only in post)
  var consentFields = {
    consent_text: lead.consent_text,
    consent_timestamp: lead.consent_timestamp,
    source: lead.utm_source || "aiinsuregenie",
    sub_id: lead.sub_id || "direct",
  };

  // Map profile fields
  for (var key in profileFields) {
    var mapped = mapping[key] || key;
    if (profileFields[key] !== undefined && profileFields[key] !== null) {
      result[mapped] = profileFields[key];
    }
  }

  // Map PII fields (only for POST, not PING)
  if (includePII) {
    for (var pKey in piiFields) {
      var pMapped = mapping[pKey] || pKey;
      if (piiFields[pKey] !== undefined) result[pMapped] = piiFields[pKey];
    }
    for (var cKey in consentFields) {
      var cMapped = mapping[cKey] || cKey;
      if (consentFields[cKey] !== undefined) result[cMapped] = consentFields[cKey];
    }
  }

  return result;
}

// ============================================================
// BUILD AUTH HEADERS for each buyer
// ============================================================
function getAuthHeaders(buyer) {
  var headers = { "Content-Type": "application/json" };
  if (!buyer.auth) return headers;

  if (buyer.auth.type === "api_key") {
    headers[buyer.auth.header || "X-API-Key"] = buyer.auth.key;
  } else if (buyer.auth.type === "bearer") {
    headers["Authorization"] = "Bearer " + buyer.auth.token;
  }
  return headers;
}

// ============================================================
// PING PHASE — Send anonymous profile to get bids
// ============================================================
async function pingBuyer(lead, buyer) {
  // If buyer doesn't support ping, use default payout as bid
  if (!buyer.supports_ping || !buyer.ping_url) {
    return {
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      accepted: true,
      bid: buyer.default_payout,
      duration_ms: 0,
      response: "no_ping_support",
    };
  }

  var startTime = Date.now();
  try {
    var payload = mapLeadToBuyer(lead, buyer, false); // NO PII in ping
    var response = await axios.post(buyer.ping_url, payload, {
      headers: getAuthHeaders(buyer),
      timeout: PING_TIMEOUT,
    });

    var duration = Date.now() - startTime;
    var data = response.data;

    // Parse response — each buyer formats differently
    // Most use: { accepted: true/false, bid: 12.50 }
    // Some use: { status: "accepted", price: 12.50 }
    var accepted = data.accepted === true || data.status === "accepted" || data.match === true;
    var bid = data.bid || data.price || data.payout || buyer.default_payout;

    return {
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      accepted: accepted,
      bid: parseFloat(bid) || 0,
      duration_ms: duration,
      response: JSON.stringify(data).substring(0, 500),
    };
  } catch (err) {
    return {
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      accepted: false,
      bid: 0,
      duration_ms: Date.now() - startTime,
      response: "ERROR: " + (err.message || "timeout"),
    };
  }
}

// ============================================================
// POST PHASE — Send full lead (with PII) to winning buyer(s)
// ============================================================
async function postToBuyer(lead, buyer) {
  var startTime = Date.now();
  try {
    var payload = mapLeadToBuyer(lead, buyer, true); // Full PII included
    var response = await axios.post(buyer.post_url, payload, {
      headers: getAuthHeaders(buyer),
      timeout: POST_TIMEOUT,
    });

    var duration = Date.now() - startTime;
    var data = response.data;

    var accepted =
      data.accepted === true ||
      data.status === "accepted" ||
      data.status === "success" ||
      response.status === 200 ||
      response.status === 201;

    var payout = data.payout || data.price || data.bid || buyer.default_payout;
    var leadId = data.lead_id || data.id || data.reference || null;
    var rejectReason = !accepted ? data.reason || data.message || data.error || "rejected" : null;

    return {
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      accepted: accepted,
      payout: accepted ? parseFloat(payout) || 0 : 0,
      lead_id: leadId,
      reject_reason: rejectReason,
      duration_ms: duration,
      response: JSON.stringify(data).substring(0, 500),
    };
  } catch (err) {
    return {
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      accepted: false,
      payout: 0,
      lead_id: null,
      reject_reason: err.message || "network_error",
      duration_ms: Date.now() - startTime,
      response: "ERROR: " + (err.message || "timeout"),
    };
  }
}

// ============================================================
// MAIN DISTRIBUTION ENGINE
// ============================================================
async function distributeLead(lead) {
  var results = {
    mode: MODE,
    ping_results: [],
    post_results: [],
    total_revenue: 0,
    accepted_buyers: [],
    rejected_buyers: [],
  };

  // 1. Get eligible buyers
  var eligible = getEligibleBuyers(lead);
  if (eligible.length === 0) {
    return Object.assign(results, { error: "No eligible buyers for this lead profile." });
  }

  // 2. PING all eligible buyers simultaneously
  var pingPromises = eligible.map(function (buyer) {
    // Create initial buyer response record
    queries.insertBuyerResponse.run({
      lead_id: lead.id,
      buyer_id: buyer.id,
      buyer_name: buyer.name,
    });
    return pingBuyer(lead, buyer);
  });

  var pingResults = await Promise.all(pingPromises);
  results.ping_results = pingResults;

  // Save ping results to DB
  pingResults.forEach(function (pr) {
    queries.updatePing.run({
      lead_id: lead.id,
      buyer_id: pr.buyer_id,
      ping_sent_at: new Date().toISOString(),
      ping_response: pr.response,
      ping_bid: pr.bid,
      ping_accepted: pr.accepted ? 1 : 0,
      ping_duration_ms: pr.duration_ms,
      status: pr.accepted ? "ping_accepted" : "ping_rejected",
    });
  });

  // 3. Filter to accepted bids, sort by bid descending
  var acceptedBids = pingResults
    .filter(function (pr) { return pr.accepted && pr.bid > 0; })
    .sort(function (a, b) { return b.bid - a.bid; });

  if (acceptedBids.length === 0) {
    return Object.assign(results, { error: "No buyers accepted this lead." });
  }

  // 4. Determine winners based on distribution mode
  var winners = [];
  var currentMode = MODE;

  if (currentMode === "exclusive") {
    // Always sell to highest bidder only
    winners = [acceptedBids[0]];
  } else if (currentMode === "shared") {
    // Sell to top N buyers
    winners = acceptedBids.slice(0, MAX_SHARED);
  } else if (currentMode === "hybrid") {
    // If top bid is high enough, sell exclusive. Otherwise sell shared.
    if (acceptedBids[0].bid >= EXCLUSIVE_MIN_BID) {
      winners = [acceptedBids[0]];
      currentMode = "exclusive";
    } else {
      winners = acceptedBids.slice(0, MAX_SHARED);
      currentMode = "shared";
    }
  } else if (currentMode === "round_robin") {
    // Rotate through buyers (use lead count to determine)
    winners = [acceptedBids[0]]; // Simplified; real implementation tracks rotation
  }

  results.mode = currentMode;

  // 5. POST full lead to winning buyer(s)
  var postPromises = winners.map(function (winner) {
    var buyerCfg = eligible.find(function (b) { return b.id === winner.buyer_id; });
    return postToBuyer(lead, buyerCfg);
  });

  var postResults = await Promise.all(postPromises);
  results.post_results = postResults;

  // 6. Save post results and calculate revenue
  var totalRevenue = 0;
  var acceptedCount = 0;
  var rejectedCount = 0;

  postResults.forEach(function (pr) {
    queries.updatePost.run({
      lead_id: lead.id,
      buyer_id: pr.buyer_id,
      post_sent_at: new Date().toISOString(),
      post_response: pr.response,
      post_accepted: pr.accepted ? 1 : 0,
      post_lead_id: pr.lead_id,
      post_payout: pr.payout,
      post_duration_ms: pr.duration_ms,
      post_reject_reason: pr.reject_reason,
      final_payout: pr.accepted ? pr.payout : 0,
      status: pr.accepted ? "sold" : "post_rejected",
    });

    if (pr.accepted) {
      totalRevenue += pr.payout;
      acceptedCount++;
      results.accepted_buyers.push({
        id: pr.buyer_id,
        name: pr.buyer_name,
        payout: pr.payout,
      });
    } else {
      rejectedCount++;
      results.rejected_buyers.push({
        id: pr.buyer_id,
        name: pr.buyer_name,
        reason: pr.reject_reason,
      });
    }
  });

  // 7. Update lead totals
  results.total_revenue = totalRevenue;
  queries.updateLeadTotals.run({
    id: lead.id,
    total_revenue: totalRevenue,
    buyers_accepted: acceptedCount,
    buyers_rejected: rejectedCount,
    status: acceptedCount > 0 ? "sold" : "rejected",
  });

  return results;
}

module.exports = { distributeLead, getEligibleBuyers };
