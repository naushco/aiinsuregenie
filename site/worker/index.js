// Serves the static site and logs AI agent visits.
// Logs appear in Cloudflare dashboard > Workers > aiinsuregenie-site > Logs.
// No IP addresses or cookies are logged; only the agent name, network owner and page.
// Agent visits are also saved to the D1 table agent_visits (see saveVisit).

// Known AI agents and crawlers, matched against the User-Agent header.
// "kind": training = model training crawler, search = AI search index,
// user = fetch made live for a person's question, browser = agentic browser.
const AGENTS = [
  { re: /ChatGPT-User/i, name: 'ChatGPT-User', company: 'OpenAI', kind: 'user' },
  { re: /ChatGPT Agent|Operator/i, name: 'ChatGPT Agent', company: 'OpenAI', kind: 'browser' },
  { re: /OAI-SearchBot/i, name: 'OAI-SearchBot', company: 'OpenAI', kind: 'search' },
  { re: /GPTBot/i, name: 'GPTBot', company: 'OpenAI', kind: 'training' },
  { re: /Claude-User/i, name: 'Claude-User', company: 'Anthropic', kind: 'user' },
  { re: /Claude-SearchBot/i, name: 'Claude-SearchBot', company: 'Anthropic', kind: 'search' },
  { re: /ClaudeBot/i, name: 'ClaudeBot', company: 'Anthropic', kind: 'training' },
  { re: /Perplexity-User/i, name: 'Perplexity-User', company: 'Perplexity', kind: 'user' },
  { re: /PerplexityBot/i, name: 'PerplexityBot', company: 'Perplexity', kind: 'search' },
  { re: /Comet/i, name: 'Comet', company: 'Perplexity', kind: 'browser' },
  { re: /Google-Agent|Gemini/i, name: 'Google agent', company: 'Google', kind: 'user' },
  { re: /Googlebot/i, name: 'Googlebot', company: 'Google', kind: 'search' },
  { re: /bingbot|BingPreview/i, name: 'Bingbot', company: 'Microsoft', kind: 'search' },
  { re: /meta-externalfetcher/i, name: 'Meta-ExternalFetcher', company: 'Meta', kind: 'user' },
  { re: /meta-externalagent/i, name: 'Meta-ExternalAgent', company: 'Meta', kind: 'training' },
  { re: /MistralAI-User/i, name: 'MistralAI-User', company: 'Mistral', kind: 'user' },
  { re: /DuckAssistBot/i, name: 'DuckAssistBot', company: 'DuckDuckGo', kind: 'user' },
  { re: /Applebot/i, name: 'Applebot', company: 'Apple', kind: 'search' },
  { re: /Amazonbot/i, name: 'Amazonbot', company: 'Amazon', kind: 'search' },
  { re: /cohere-ai/i, name: 'Cohere', company: 'Cohere', kind: 'user' },
  { re: /CCBot/i, name: 'CCBot', company: 'Common Crawl', kind: 'training' },
  { re: /Bytespider/i, name: 'Bytespider', company: 'ByteDance', kind: 'training' },
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// Networks each company's own bots come from. A public cloud (Google Cloud, Azure, AWS)
// is not listed, because anyone can rent those and fake the user agent.
const OWN_NETWORK = {
  OpenAI: /openai/i,
  Anthropic: /anthropic/i,
  Perplexity: /perplexity/i,
  Apple: /apple/i,
  Meta: /meta platforms|facebook/i,
  DuckDuckGo: /duckduckgo/i,
  Cohere: /cohere/i,
  Mistral: /mistral/i,
  ByteDance: /bytedance/i,
};

// Is this really the agent it says it is? Cloudflare's verified-bot list comes first.
export function verifyAgent(agent, cf) {
  if (cf && cf.verifiedBotCategory) return { verified: true, reason: 'cloudflare:' + cf.verifiedBotCategory };
  const net = (cf && cf.asOrganization) || '';
  const re = OWN_NETWORK[agent.company];
  if (re && re.test(net)) return { verified: true, reason: 'network' };
  return { verified: false, reason: net ? 'other network' : 'no network' };
}

// Keep agent visits in D1 (Workers Logs only keeps 7 days). Unverified visits are only
// kept when they reached a real page, so scanners probing for files don't fill the table.
async function saveVisit(db, row) {
  try {
    await db.prepare(
      'INSERT INTO agent_visits (at, agent, company, kind, verified, verify_reason, signed, signature_agent, path, status, network, asn, country, user_agent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(row.at, row.agent, row.company, row.kind, row.verified ? 1 : 0, row.verify_reason, row.signed ? 1 : 0,
      row.signature_agent, row.path, row.status, row.network, row.asn, row.country, row.user_agent).run();
  } catch (e) {
    console.error('agent_visit save failed:', e && e.message);
  }
}

export function detectAgent(request) {
  const ua = request.headers.get('user-agent') || '';
  // Web Bot Auth: agents that sign their requests send these headers.
  const signed = request.headers.has('signature') && request.headers.has('signature-input');
  const signatureAgent = request.headers.get('signature-agent');
  const match = AGENTS.find((a) => a.re.test(ua));
  if (match) return { ...match, signed, signatureAgent };
  if (signed) return { name: signatureAgent || 'Signed agent', company: 'unknown', kind: 'signed', signed, signatureAgent };
  return null;
}

export default {
  async fetch(request, env, ctx) {
    const response = await env.ASSETS.fetch(request);
    const agent = detectAgent(request);

    if (agent) {
      const url = new URL(request.url);
      const cf = request.cf || {};
      const check = verifyAgent(agent, cf);
      console.log(JSON.stringify({
        event: 'agent_visit',
        agent: agent.name,
        company: agent.company,
        kind: agent.kind,
        verified: check.verified,
        verify_reason: check.reason,
        signed: agent.signed,
        signature_agent: agent.signatureAgent || null,
        path: url.pathname,
        status: response.status,
        accept: request.headers.get('accept') || null,
        network: cf.asOrganization || null,
        country: cf.country || null,
        user_agent: request.headers.get('user-agent') || null,
      }));
      if (env.DB && ctx && (check.verified || response.status === 200)) {
        ctx.waitUntil(saveVisit(env.DB, {
          at: new Date().toISOString(),
          agent: agent.name,
          company: agent.company,
          kind: agent.kind,
          verified: check.verified,
          verify_reason: check.reason,
          signed: agent.signed,
          signature_agent: agent.signatureAgent || null,
          path: url.pathname,
          status: response.status,
          network: cf.asOrganization || null,
          asn: cf.asn || null,
          country: cf.country || null,
          user_agent: (request.headers.get('user-agent') || '').slice(0, 300) || null,
        }));
      }
    }

    const res = new Response(response.body, response);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
    return res;
  },
};
