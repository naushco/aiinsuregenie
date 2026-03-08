// src/services/validator.js — Lead validation and duplicate detection

const { queries } = require("../database");

var DUPLICATE_WINDOW = parseInt(process.env.DUPLICATE_WINDOW_HOURS) || 72;

function validateLead(data) {
  var errors = [];

  // Required PII
  if (!data.first_name || data.first_name.trim().length < 2) errors.push("first_name is required (min 2 chars)");
  if (!data.phone) errors.push("phone is required");
  if (!data.email) errors.push("email is required");

  // Phone validation (US 10-digit)
  if (data.phone) {
    var phone = data.phone.replace(/\D/g, "");
    if (phone.length === 11 && phone[0] === "1") phone = phone.slice(1);
    if (phone.length !== 10) errors.push("phone must be 10 digits");
    else if ("01".includes(phone[0])) errors.push("invalid US phone number");
    else if (/^(\d)\1{9}$/.test(phone)) errors.push("phone appears to be fake");
    else data.phone = phone; // normalize
  }

  // Email validation
  if (data.email) {
    var email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) errors.push("invalid email format");
    else data.email = email; // normalize
  }

  // ZIP validation
  if (data.zip) {
    var zip = data.zip.replace(/\D/g, "");
    if (zip.length !== 5) errors.push("zip must be 5 digits");
    else data.zip = zip;
  }

  // Consent validation (CRITICAL for TCPA)
  if (!data.consent_text) errors.push("consent_text is required for TCPA compliance");
  if (!data.consent_timestamp) errors.push("consent_timestamp is required");
  if (!data.consent_checked) errors.push("consent must be actively checked by user");

  return {
    valid: errors.length === 0,
    errors: errors,
    data: data,
  };
}

function checkDuplicate(phone, email) {
  var windowStr = "-" + DUPLICATE_WINDOW + " hours";
  var existing = queries.findDuplicate.get({
    phone: phone,
    email: email,
    window: windowStr,
  });

  if (existing) {
    return {
      isDuplicate: true,
      original_lead_id: existing.id,
      original_created: existing.created_at,
      message: "Duplicate lead detected within " + DUPLICATE_WINDOW + "hr window",
    };
  }

  return { isDuplicate: false };
}

module.exports = { validateLead, checkDuplicate };
