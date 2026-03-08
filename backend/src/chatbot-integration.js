// ============================================================
// CHATBOT → BACKEND INTEGRATION
// ============================================================
// Add this to your AI InsureGenie React chatbot (aiinsuregenie-v5.jsx)
// Replace the current handleConsent function's "showUnlockedResults" logic
// with this API call that sends the lead to your backend for distribution.

// Configuration — point to your backend
var LEAD_API_URL = "https://your-server.com/api/leads"; // Change this

// This function sends the completed lead to your distribution backend
async function submitLeadToBackend(profile) {
  try {
    var response = await fetch(LEAD_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // PII
        first_name: profile.firstName,
        phone: profile.phone,
        email: profile.email,

        // Profile data
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

        // TCPA Consent (CRITICAL)
        consent_text: "I provide express written consent to be contacted by AI InsureGenie and its insurance partners (Progressive, GEICO, State Farm, Allstate, Liberty Mutual, Nationwide, and others) via phone, text, and email at the info provided, including automated technology. Consent is not required to purchase.",
        consent_timestamp: profile.consentTs,
        consent_checked: true,
        disclosed_buyers: "Progressive, GEICO, State Farm, Allstate, Liberty Mutual, Nationwide, and partners",

        // Tracking
        publisher_id: getPublisherId(),     // from URL params
        sub_id: getSubId(),                 // from URL params
        utm_source: getUTMParam("source"),
        utm_medium: getUTMParam("medium"),
        utm_campaign: getUTMParam("campaign"),
        landing_page: window.location.href,

        // Call request (if user clicked "Talk to Agent")
        call_requested: profile.callRequested || false,
        preferred_call_time: profile.callTime || null,
      }),
    });

    var data = await response.json();

    if (data.success) {
      console.log("Lead sold!", data);
      // data.distribution.accepted_buyers = [{ name: "LendingTree", payout: 18.00 }, ...]
      // data.distribution.total_revenue = 18.00
      // data.lead_id = "abc-123-..."
      return data;
    } else {
      console.error("Lead rejected:", data);
      return null;
    }
  } catch (err) {
    console.error("Backend error:", err);
    return null;
  }
}

// Helper: Extract publisher/sub_id from URL params
// e.g., yoursite.com/quote?pub=facebook&sub_id=ad123
function getPublisherId() {
  var params = new URLSearchParams(window.location.search);
  return params.get("pub") || params.get("publisher") || params.get("utm_source") || "direct";
}

function getSubId() {
  var params = new URLSearchParams(window.location.search);
  return params.get("sub_id") || params.get("click_id") || null;
}

function getUTMParam(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get("utm_" + name) || null;
}

// ============================================================
// HOW TO INTEGRATE INTO YOUR CHATBOT
// ============================================================
//
// In aiinsuregenie-v5.jsx, modify the handleConsent function:
//
// BEFORE (current — just shows cards):
//   var handleConsent = function() {
//     ...
//     showUnlockedResults(updated);
//   };
//
// AFTER (sends to backend FIRST, then shows cards):
//   var handleConsent = async function() {
//     if (!ck) return;
//     setShowCon(false);
//     usr("✅ I agree");
//     var u = Object.assign({}, pro, { consent: true, consentTs: new Date().toISOString() });
//     setPro(u);
//     
//     // Show "Finding your best quotes..." message
//     setTyp(true);
//     bot("🔍 Matching you with insurers in real-time...");
//     
//     // Send to backend for distribution
//     var result = await submitLeadToBackend(u);
//     
//     if (result && result.success) {
//       // Lead was sold! Show results
//       bot("✅ " + result.distribution.accepted_buyers.length + " insurer(s) want to give you a quote!");
//       // Continue showing insurer cards as before
//       showUnlockedResults(u);
//     } else {
//       // Fallback — still show cards even if backend fails
//       showUnlockedResults(u);
//     }
//   };
//
// This way:
// 1. User gives consent
// 2. Lead is IMMEDIATELY sent to your backend
// 3. Backend distributes to all buyers via ping-post
// 4. User sees their insurer cards (doesn't know about backend)
// 5. You earn $15-40 per lead from buyer payouts
// 6. User clicks "View Quote" → goes to insurer site (additional CPC revenue)
//
// You're now earning TWICE: CPL (from backend) + CPC (from click-throughs)
