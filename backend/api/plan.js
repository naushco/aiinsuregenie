// Cheap, read-only Genie 2.1 qualification planner: no model call, no PII,
// no lead submission, no D1 access and no storage. Confirmed facts only.
"use strict";
const { cors } = require("../lib/http");
const { buildIntelligence } = require("../lib/genie-runtime");
module.exports = async function plan(req, res) {
  cors(req, res, "POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  if (req.genieV2Enabled !== true || !req.body || req.body.genie_v2 !== true)
    return res.status(404).json({error:"Not available"});
  try {
    const intelligence = buildIntelligence(req.body.genie_facts, "");
    return res.status(200).json({
      version:"2.1",
      confirmed:intelligence.confirmed,
      next:intelligence.next,
      complete:intelligence.next.complete,
      buyer_routing:"not_in_advisor_engine"
    });
  } catch {
    return res.status(400).json({error:"Invalid qualification request"});
  }
};
