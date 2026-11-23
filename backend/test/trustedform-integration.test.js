// Static regression checks: never replace real TrustedForm consent evidence with mock data.
// Browser-level certificate generation and partner delivery require separate staging tests.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("chatbot retains TrustedForm SDK and certificate input", () => {
  const html = read("chatbot/index.html");
  assert.match(html, /api\.trustedform\.com\/trustedform\.js/);
  assert.match(html, /xxTrustedFormCertUrl/);
});
test("chatbot forwards actual certificate reference on lead capture", () => {
  const app = read("chatbot/src/App.jsx");
  assert.match(app, /function tfCert\(\)/);
  assert.ok((app.match(/trustedform_cert_url:\s*tfCert\(\)/g) || []).length >= 2);
});
test("lead and callback endpoints validate TrustedForm certificate URLs", () => {
  for (const file of ["backend/api/leads.js", "backend/api/callback.js"]) {
    const src = read(file);
    assert.match(src, /function tfUrl\(v\)/);
    assert.match(src, /cert\\\.trustedform\\\.com/);
    assert.match(src, /trustedform_cert_url:\s*tfUrl\(/);
  }
});
