"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const chat = require("../api/chat.js");

test("production chat returns the exact legacy answer when the operator flag is disabled", async () => {
  const originalFetch = global.fetch;
  const key = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "synthetic-test-key";
  let invoked = 0;
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.anthropic.com/v1/messages");
    invoked++;
    assert.equal(JSON.parse(options.body).model.length > 0, true);
    return { ok: true, json: async () => ({ content:[{ type:"text", text:"Synthetic AI answer" }] }) };
  };
  const execute = async (enabled, userOptIn) => {
    const headers = {};
    let output;
    const res = {
      setHeader(k,v){headers[k]=v;return this;},
      status(c){this.code=c;return this;},
      json(v){output=v;return this;},
      end(){return this;}
    };
    await chat({
      method:"POST",
      genieV2Enabled:enabled,
      headers:{"x-forwarded-for":"198.51.100."+String(invoked+1), origin:"https://chat.aiinsuregenie.com"},
      body:{message:"I'm in Texas and I need SR-22 insurance this week",genie_v2:userOptIn,
        genie_facts:{state:"TX",situation:["sr22"],urgency:"within_week"}}
    },res);
    assert.equal(res.code, 200);
    return output;
  };
  try {
    const legacy = await execute(false, true);
    assert.deepEqual(legacy, {answer:"Synthetic AI answer"});
    const noClientOptIn = await execute(true, false);
    assert.deepEqual(noClientOptIn, {answer:"Synthetic AI answer"});
    const enabled = await execute(true, true);
    assert.equal(enabled.answer, "Synthetic AI answer");
    assert.equal(enabled.genie_v2.confirmed.state, "TX");
    assert.equal(enabled.genie_v2.confirmed.urgency, "within_week");
    assert.equal(enabled.genie_v2.next.field, "vehicle_status");
    assert.equal(invoked,3);
  } finally {
    global.fetch = originalFetch;
    if (key === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = key;
  }
});
