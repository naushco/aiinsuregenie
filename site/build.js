// Static site builder. No dependencies.
// Usage: node build.js
// Posts live in content/posts/<slug>.md with frontmatter:
//   title, description, date (YYYY-MM-DD), updated (optional)
const fs = require('fs');
const path = require('path');

const SITE = 'https://aiinsuregenie.com';
const NAME = 'AI InsureGenie';
const CHAT_URL = 'https://chat.aiinsuregenie.com';
const root = __dirname;
const dist = path.join(root, 'dist');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'blog'), { recursive: true });

const header = read('src/partials/header.html');
const footer = read('src/partials/footer.html');
const menuScript = read('src/partials/menu-script.html');

// ---------- markdown (small subset) ----------
function inline(s) {
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
    const ext = /^https?:\/\//.test(u) && !u.startsWith(SITE);
    return `<a href="${u}"${ext ? ' rel="noopener"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return s;
}
function md(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{2,3})\s+(.*)$/))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(l); i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th scope="col">${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^>\s?/.test(l)) {
      const b = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) b.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(b.join(' '))}</p></blockquote>`); continue;
    }
    if (/^[-*]\s+/.test(l)) {
      const b = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) b.push(`<li>${inline(lines[i++].replace(/^[-*]\s+/, ''))}</li>`);
      out.push(`<ul>${b.join('')}</ul>`); continue;
    }
    if (/^\d+\.\s+/.test(l)) {
      const b = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) b.push(`<li>${inline(lines[i++].replace(/^\d+\.\s+/, ''))}</li>`);
      out.push(`<ol>${b.join('')}</ol>`); continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|[-*]\s|\d+\.\s|>|---)/.test(lines[i])) p.push(lines[i++]);
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('\n');
}
function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  m[1].split('\n').forEach((ln) => {
    const k = ln.match(/^(\w+):\s*(.*)$/);
    if (k) meta[k[1]] = k[2].replace(/^["']|["']$/g, '');
  });
  for (const req of ['title', 'description']) if (!meta[req]) throw new Error(`${file}: missing "${req}"`);
  meta.slug = path.basename(file, '.md');
  meta.body = m[2];
  return meta;
}
const fmtDate = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

// ---------- brand tags shared by every page ----------
const brandHead = `<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0f1b2d">
<meta name="color-scheme" content="light">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:image" content="${SITE}/og-image.png">`;
const langLinks = `<link rel="alternate" hreflang="en" href="${SITE}/">
<link rel="alternate" hreflang="es" href="${SITE}/es/">
<link rel="alternate" hreflang="x-default" href="${SITE}/">`;

// ---------- shared page shell ----------
function head({ title, description, url, type = 'website', extra = '', lang = 'en', hdr = null }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<link rel="alternate" type="application/rss+xml" title="${NAME} guides" href="${SITE}/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
${brandHead}
<link rel="stylesheet" href="/styles.css">
${extra}
</head>
<body>
${hdr || header}
`;
}
const tail = `
${footer}
${menuScript}
</body>
</html>
`;

// ---------- topic guides (content/guides/*.md, own URL via "path") ----------
const guidesDir = path.join(root, 'content/guides');
const guides = (fs.existsSync(guidesDir) ? fs.readdirSync(guidesDir) : []).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .map((f) => parse(path.join(guidesDir, f))).filter((g) => g.draft !== 'true').sort((a, b) => a.path.length - b.path.length);
for (const g of guides) {
  if (!/^## (Sources|Fuentes)\s*$/m.test(g.body) || !/\]\(https?:\/\//.test(g.body)) throw new Error(`${g.path}: every guide needs a "## Sources" section with links`);
}

// Related guides shown at the end of each guide (internal links between close topics).
const RELATED = {
  'sr22-insurance': ['sr22-insurance/texas', 'sr22-insurance/non-owner', 'fr44-insurance/florida', 'car-insurance-after-lapse'],
  'sr22-insurance/texas': ['sr22-insurance', 'sr22-insurance/non-owner', 'car-insurance-after-lapse', 'es/seguro-de-auto-obligatorio-texas'],
  'sr22-insurance/non-owner': ['sr22-insurance', 'sr22-insurance/texas', 'fr44-insurance/florida', 'fr44-insurance/virginia'],
  'fr44-insurance/florida': ['fr44-insurance/virginia', 'sr22-insurance', 'sr22-insurance/non-owner', 'car-insurance-after-lapse'],
  'fr44-insurance/virginia': ['fr44-insurance/florida', 'sr22-insurance', 'sr22-insurance/non-owner', 'car-insurance-after-lapse'],
  'car-insurance-after-lapse': ['late-car-insurance-payment', 'sr22-insurance', 'fr44-insurance/florida', 'car-insurance-after-accident-or-ticket'],
  'late-car-insurance-payment': ['car-insurance-after-lapse', 'sr22-insurance', 'car-insurance-after-accident-or-ticket'],
  'car-insurance-after-accident-or-ticket': ['sr22-insurance', 'fr44-insurance/florida', 'car-insurance-after-lapse', 'new-driver-car-insurance'],
  'new-driver-car-insurance': ['car-insurance-learners-permit', 'car-insurance-after-accident-or-ticket', 'rideshare-insurance'],
  'car-insurance-learners-permit': ['new-driver-car-insurance', 'car-insurance-after-accident-or-ticket', 'late-car-insurance-payment'],
  'rideshare-insurance': ['new-driver-car-insurance', 'car-insurance-after-accident-or-ticket', 'car-insurance-after-lapse'],
  'es/seguro-de-auto-obligatorio-texas': ['es/seguro-de-auto-licencia-extranjera'],
  'es/seguro-de-auto-licencia-extranjera': ['es/seguro-de-auto-obligatorio-texas'],
  'blog/how-to-compare-car-insurance-quotes': ['new-driver-car-insurance', 'car-insurance-after-accident-or-ticket', 'car-insurance-after-lapse', 'sr22-insurance'],
};

// ---------- posts ----------
const postsDir = path.join(root, 'content/posts');
const posts = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .map((f) => parse(path.join(postsDir, f)))
  .map((p) => { if (!p.date) throw new Error(`${p.slug}: missing "date"`); return p; })
  .filter((p) => p.draft !== 'true')
  .sort((a, b) => b.date.localeCompare(a.date));

// FAQ structured data from "### question" + answer pairs under "## Common questions".
function postFaqs(body) {
  const part = (body.split(/^## Common questions\s*$/m)[1] || '').split(/^## /m)[0];
  const faqs = [...part.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)].map((m) => ({ q: m[1].trim(), a: m[2].trim().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '') }));
  return faqs.length ? [{ '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [];
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;

for (const p of posts) {
  const url = `${SITE}/blog/${p.slug}/`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article', headline: p.title, description: p.description,
        datePublished: p.date, dateModified: p.updated || p.date,
        mainEntityOfPage: url, author: { '@type': 'Organization', name: NAME, url: SITE },
        publisher: { '@type': 'Organization', name: NAME, url: SITE },
      },
      {
        '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: SITE + '/blog/' },
          { '@type': 'ListItem', position: 3, name: p.title, item: url },
        ],
      },
      ...postFaqs(p.body),
    ],
  };
  const prel = (RELATED['blog/' + p.slug] || []).map((x) => guides.find((g) => g.path === x)).filter(Boolean);
  const html = head({
    title: p.seo_title || `${p.title} | ${NAME}`, description: p.description, url, type: 'article',
    extra: `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
  }) + `<main class="page">
<article class="article">
  <p class="crumbs"><a href="/">Home</a> / <a href="/blog/">Guides</a></p>
  <h1>${esc(p.title)}</h1>
  <p class="byline">By ${NAME} &middot; <time datetime="${p.date}">${fmtDate(p.date)}</time>${p.updated ? ` &middot; Updated <time datetime="${p.updated}">${fmtDate(p.updated)}</time>` : ''} &middot; ${Math.max(1, Math.round(words(p.body) / 220))} min read &middot; <a href="/how-we-check-facts/">How we check facts</a> &middot; <a href="/how-we-make-money/">How we make money</a></p>
${md(dedupeCitations(p.body))}
  ${prel.length ? `<nav class="related" aria-label="Related guides"><h2>Related guides</h2><ul>${prel.map((r) => `<li><a href="/${r.path}/">${esc(r.title)}</a></li>`).join('')}</ul></nav>` : ''}
  <aside class="article-cta">
    <h2>Find the best quote for your needs</h2>
    <p>Tell our free AI assistant what matters to you and get matched with the quoting partner that fits. No obligation to buy.</p>
    <a class="btn" href="${CHAT_URL}/#start=quote" rel="noopener">Get my quote</a>
  </aside>
  <p class="disclaimer">General information only, not insurance, legal, or financial advice. Coverage rules and prices vary by location and insurer.</p>
</article>
</main>` + tail;
  fs.mkdirSync(path.join(dist, 'blog', p.slug), { recursive: true });
  fs.writeFileSync(path.join(dist, 'blog', p.slug, 'index.html'), html);
}


// ---------- guide cover art (inline SVG, palette-driven) ----------
function cover(i) {
  const v = i % 3;
  const road = '<path d="M-10 150 C 90 120, 200 160, 330 118" fill="none" stroke="var(--road)" stroke-width="36" stroke-linecap="round"/><path d="M-10 150 C 90 120, 200 160, 330 118" fill="none" stroke="var(--pop)" stroke-width="2" stroke-dasharray="10 12"/>';
  const sun = '<circle cx="262" cy="46" r="18" fill="var(--pop)"/>';
  const scenes = [
    road + sun + '<use href="#ig-car" x="78" y="66" width="150" height="69"/>',
    sun + '<path d="M160 30l46 18v28c0 28-19 52-46 62-27-10-46-34-46-62V48z" fill="var(--accent)"/><path d="M142 84l14 14 26-28" fill="none" stroke="var(--accent-ink)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
    '<rect x="98" y="26" width="104" height="128" rx="10" fill="var(--surface)" stroke="var(--border)" stroke-width="2"/><path d="M116 54h68M116 72h52M116 90h60M116 108h40" stroke="var(--border)" stroke-width="6" stroke-linecap="round"/><circle cx="196" cy="114" r="26" fill="none" stroke="var(--accent)" stroke-width="8"/><path d="M215 133l22 22" stroke="var(--accent)" stroke-width="10" stroke-linecap="round"/>' + '<circle cx="64" cy="48" r="10" fill="var(--pop)"/>',
  ];
  return `<svg viewBox="0 0 320 168" aria-hidden="true" preserveAspectRatio="xMidYMid slice">${scenes[v]}</svg>`;
}

// ---------- blog index ----------
const list = (items) => items.length
  ? `<ul class="post-list">${items.map((p, i) => `<li><a href="/blog/${p.slug}/"><div class="cover">${cover(i)}</div><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><time datetime="${p.date}">${fmtDate(p.date)}</time></a></li>`).join('')}</ul>`
  : `<p class="muted">New guides are on the way.</p>`;

const blogLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${NAME} guides`, url: `${SITE}/blog/` };
fs.writeFileSync(path.join(dist, 'blog', 'index.html'), head({
  title: `Car Insurance Guides | ${NAME}`,
  description: 'Plain-language guides to comparing car insurance, understanding coverage, and finding a better rate.',
  url: `${SITE}/blog/`, extra: `<script type="application/ld+json">${JSON.stringify(blogLd)}</script>`,
}) + `<main class="page">
  <div class="blog-head">
    <span class="eyebrow">Guides</span>
    <h1>Car insurance, explained simply</h1>
    <p class="lede">Plain-language answers to help you compare coverage and prices with confidence.</p>
  </div>
  ${list(posts)}
  ${guides.filter((g) => g.lang === 'en').length ? `<h2 class="guides-h">Topic guides</h2><ul class="post-list">${guides.filter((g) => g.lang === 'en').map((g, i) => `<li><a href="/${g.path}/"><div class="cover">${cover(i + 1)}</div><h3>${esc(g.title)}</h3><p>${esc(g.description)}</p></a></li>`).join('')}</ul>` : ''}
</main>` + tail);

// ---------- homepage ----------
let home = read('src/index.template.html');
home = home.replace('{{HEADER}}', header).replace('{{FOOTER}}', footer).replace('{{MENU_SCRIPT}}', menuScript)
  .replace('{{LATEST_POSTS}}', list(posts.slice(0, 3)))
  .replace('<link rel="stylesheet" href="/styles.css">', brandHead + '\n' + langLinks + '\n<link rel="stylesheet" href="/styles.css">');
if (!posts.length) home = home.replace(/<section id="latest-guides">[\s\S]*?<\/section>\n/, '');
fs.writeFileSync(path.join(dist, 'index.html'), home);

// ---------- Spanish homepage ----------
const headerEs = header
  .replace('href="/" aria-label="AI InsureGenie home"', 'href="/es/" aria-label="Inicio de AI InsureGenie"')
  .replace('aria-label="Open menu"', 'aria-label="Abrir menú"')
  .replace('aria-label="Main"', 'aria-label="Principal"')
  .replace('<a href="/#how-it-works">How it works</a>', '<a href="/es/#como-funciona">Cómo funciona</a>')
  .replace('<a href="/blog/">Guides</a>', '<a href="/es/#situaciones">Situaciones difíciles</a>')
  .replace('<a href="/partners/">For partners</a>', '')
  .replace('<a href="/#faq">FAQ</a>', '<a href="/es/#preguntas">Preguntas</a>')
  .replace('<a class="lang" href="/es/" hreflang="es" lang="es">Español</a>', '<a class="lang" href="/" hreflang="en" lang="en">English</a>')
  .replace('>Get my quote</a>', '>Obtener mi cotización</a>');
let es = read('src/es.template.html');
es = es.replace('{{HEADER}}', headerEs).replace('{{FOOTER}}', footer).replace('{{MENU_SCRIPT}}', menuScript)
  .replace('<link rel="stylesheet" href="/styles.css">', brandHead + '\n' + langLinks + '\n<link rel="stylesheet" href="/styles.css">');
fs.mkdirSync(path.join(dist, 'es'), { recursive: true });
fs.writeFileSync(path.join(dist, 'es', 'index.html'), es);

// ---------- partners ----------
fs.mkdirSync(path.join(dist, 'partners'), { recursive: true });
fs.writeFileSync(path.join(dist, 'partners', 'index.html'), head({
  title: `Partner With Us | ${NAME}`,
  description: 'Reach drivers who have told us what they want. Click, CPL, and call-transfer placements for quoting platforms, insurers, and agencies.',
  url: `${SITE}/partners/`,
}) + read('src/partners.template.html') + tail);


// ---------- simple pages (privacy, terms) + contact ----------
const CONTACT_EMAIL = ''; // set to a monitored address, e.g. 'hello@aiinsuregenie.com'
const pagesDir = path.join(root, 'content/pages');
const simplePages = fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).filter((f) => f.endsWith('.md')).map((f) => parse(path.join(pagesDir, f))) : [];
for (const pg of simplePages) {
  const url = `${SITE}/${pg.slug}/`;
  const html = head({ title: pg.seo_title || `${pg.title} | ${NAME}`, description: pg.description, url }) + `<main class="page">
<article class="article legal-page">
  <h1>${esc(pg.title)}</h1>
  <p class="byline">Last updated <time datetime="${pg.updated || pg.date}">${fmtDate(pg.updated || pg.date)}</time></p>
${md(pg.body)}
</article>
</main>` + tail;
  fs.mkdirSync(path.join(dist, pg.slug), { recursive: true });
  fs.writeFileSync(path.join(dist, pg.slug, 'index.html'), html);
}
const emailCard = CONTACT_EMAIL ? `<li><span class="ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></span><h2>Email us</h2><p>For privacy requests and anything else.</p><p class="mail">${esc(CONTACT_EMAIL)}</p><a class="btn btn-2" href="mailto:${esc(CONTACT_EMAIL)}">Send an email</a></li>` : '';
fs.mkdirSync(path.join(dist, 'contact'), { recursive: true });
fs.writeFileSync(path.join(dist, 'contact', 'index.html'), head({
  title: `Contact us | ${NAME}`, description: 'Ask a question, request a call with a licensed agent, or partner with AI InsureGenie.', url: `${SITE}/contact/`,
}) + read('src/contact.template.html').replace('{{EMAIL_CARD}}', emailCard) + tail);

// ---------- Do Not Sell or Share page ----------
fs.mkdirSync(path.join(dist, 'do-not-sell'), { recursive: true });
fs.writeFileSync(path.join(dist, 'do-not-sell', 'index.html'), head({
  title: `Do Not Sell or Share My Personal Information | ${NAME}`, description: 'Ask AI InsureGenie not to sell or share your personal information with insurance partners.', url: `${SITE}/do-not-sell/`,
}) + read('src/do-not-sell.template.html') + tail);

// ---------- static assets ----------
fs.copyFileSync(path.join(root, 'src/styles.css'), path.join(dist, 'styles.css'));
for (const f of fs.readdirSync(path.join(root, 'public'))) fs.copyFileSync(path.join(root, 'public', f), path.join(dist, f));

// ---------- ad landing pages (/go/...) — noindex, built for Meta ads ----------
// Paste your Meta Pixel ID here when you have one; nothing loads until it's set.
const META_PIXEL_ID = '';
const pixel = META_PIXEL_ID ? `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');</script>` : '';
const US_STATES = (read('src/index.template.html').match(/<select class="select" id="state"[\s\S]*?<\/select>/)[0].match(/<option>([^<]+)<\/option>/g) || []).map((o) => o.replace(/<\/?option>/g, ''));
const check = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
const LEGAL_EN = 'AI InsureGenie is an AI assistant, not an insurance company or licensed agent. We connect you with quoting partners, who may pay us a fee. Quotes, eligibility, and final rates come from the partner or insurer. General information only, not insurance, legal, or financial advice. <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/do-not-sell/">Do Not Sell or Share My Personal Information</a>';
const LEGAL_ES = 'AI InsureGenie es un asistente de IA, no una compañía de seguros ni un agente con licencia. Le conectamos con socios de cotización, que pueden pagarnos una comisión. Las cotizaciones, la elegibilidad y las tarifas finales las da el socio o la aseguradora. Solo información general, no es asesoría de seguros, legal ni financiera. <a href="/privacy/">Privacidad</a> · <a href="/terms/">Términos</a> · <a href="/do-not-sell/">No vender ni compartir mi información personal</a>';

const landings = [
  {
    slug: 'sr22', lang: 'en', home: '/',
    title: 'SR-22 Insurance Help | AI InsureGenie',
    desc: 'Need an SR-22? Genie helps you find insurers that file SR-22s in your state, in plain words and without judgment.',
    trustMini: 'Free · No judgment',
    kicker: 'Need an SR-22?',
    h1: 'A DUI or suspension doesn’t mean <em>you’re out of options</em>',
    lede: 'Not every insurer files SR-22s. Genie asks a few quick questions and points you to quoting partners that work with drivers in your situation.',
    points: ['Free, and nothing to sign up for', 'Plain words, no judgment', 'Talk to a licensed agent any time'],
    genieSub: 'Your AI insurance guide · replies in seconds',
    cardNote: 'Genie is an AI assistant. A licensed agent is one tap away.',
    howTitle: 'How it works',
    steps: [['Tell Genie your situation', 'Your state and what the court or DMV asked for. No long forms.'], ['Get pointed to the right partner', 'Genie matches you with quoting partners that file SR-22s where you live.'], ['Compare and file', 'Get your quotes from the partner and ask them to file the SR-22 for you.']],
    faqTitle: 'Common questions',
    faq: [['What is an SR-22?', 'An SR-22 is a form your insurer files with the state to show you carry the required liability coverage. It is often needed after a DUI, driving without insurance, or a license suspension.'], ['How long do I need it?', 'It depends on your state and your case, often around three years. Your court or DMV paperwork will say. Ask the insurer to confirm before you buy.'], ['Will my rate go up?', 'Usually yes, but prices vary a lot between insurers. That is why comparing matters more for SR-22 drivers than almost anyone else.'], ['Do I have to own a car?', 'No. If you don’t own a car, ask about a non-owner SR-22 policy. Genie can help you find partners that offer it.']],
    finalTitle: 'Let’s get you back on the road',
    finalBtn: 'Start with Genie', barBtn: 'Start with Genie →',
    legal: 'Sources: <a href="https://www.nationwide.com/lc/resources/auto-insurance/articles/what-is-an-sr-22" rel="noopener">Nationwide: What is an SR-22?</a> · <a href="https://www.dps.texas.gov/node/676" rel="noopener">Texas DPS: SR-22</a> · <a href="https://www.carinsurance.com/kb/how-to-get-sr22-without-valid-license" rel="noopener">CarInsurance.com: non-owner SR-22</a>. More in our <a href="/sr22-insurance/">SR-22 guide</a>.<br><br>' + LEGAL_EN,
    config: {
      page: 'sr22', typing: 'Genie is typing',
      stateLabel: 'Your state', statePlaceholder: 'Choose your state',
      hello: ['Hi, I’m Genie 👋', 'I help drivers who need an SR-22 find insurers that will actually file it. No judgment, promise.', 'Which state do you need it in?'],
      afterState: ['Got it, {state}.', 'Has the court or DMV already asked you for an SR-22?'],
      q2: [
        { label: 'Yes, I need it now', goal: 'price', reply: ['Okay, let’s move quickly then.', 'I’ll ask a couple more questions in the chat and point you to a partner that files SR-22s in {state}. About a minute.'] },
        { label: 'Not yet, but soon', goal: 'price', reply: ['Smart to plan ahead.', 'Let’s look at what drivers in {state} usually pay, so there are no surprises. About a minute.'] },
        { label: 'I’d rather talk to a person', agent: true, reply: ['Of course. A licensed agent can walk you through it.', 'Leave your number in the chat and they’ll call you back.'] }
      ],
      go: 'Continue with Genie', goAgent: 'Request a call',
      states: US_STATES
    }
  },
  {
    slug: 'seguro', lang: 'es', home: '/es/',
    title: 'Seguro de auto en español | AI InsureGenie',
    desc: 'Encuentre el seguro de auto que le conviene, en español. Genie le hace unas preguntas y le indica el socio de cotización adecuado.',
    trustMini: 'Gratis · Sin compromiso',
    kicker: 'Seguro de auto, en su idioma',
    h1: 'Su seguro de auto, <em>explicado en español</em>',
    lede: 'Genie le hace unas preguntas rápidas y le indica el socio de cotización que mejor le conviene. Sin formularios largos y sin presión.',
    points: ['Gratis y sin compromiso', 'Ayuda con licencia extranjera, multas o SR-22', 'Hable con un agente con licencia cuando quiera'],
    genieSub: 'Su guía de seguros con IA · responde al instante',
    cardNote: 'Genie es un asistente de IA. Algunas partes del chat están en inglés por ahora.',
    howTitle: 'Cómo funciona',
    steps: [['Cuéntele a Genie lo que necesita', 'Su estado y lo que más le importa. Sin formularios largos.'], ['Reciba su recomendación', 'Genie le indica el socio de cotización que mejor encaja con usted.'], ['Compare y decida', 'Usted elige. No tiene que comprar nada para ver sus cotizaciones.']],
    faqTitle: 'Preguntas frecuentes',
    faq: [['¿Puedo asegurar mi auto con licencia extranjera?', 'Muchas aseguradoras lo permiten, aunque el precio puede variar. Genie le ayuda a encontrar socios que trabajan con conductores en su situación.'], ['¿Tiene algún costo?', 'No. Usar Genie es gratis. Los socios de cotización pueden pagarnos una comisión, sin costo extra para usted.'], ['¿Tengo que dar mi número de teléfono?', 'Solo si quiere que un agente le llame. Puede ver opciones sin compartir su número.']],
    finalTitle: 'Empiece a ahorrar hoy',
    finalBtn: 'Hablar con Genie', barBtn: 'Hablar con Genie →',
    legal: 'Fuentes: <a href="https://insurify.com/es/car-insurance/driver/international-drivers/" rel="noopener">Insurify: conductores internacionales</a> · <a href="https://www.carinsurance.com/insurance-with-mexican-license.aspx" rel="noopener">CarInsurance.com: licencia mexicana</a>. Más en nuestra <a href="/es/seguro-de-auto-licencia-extranjera/">guía</a>.<br><br>' + LEGAL_ES,
    config: {
      page: 'seguro-es', typing: 'Genie está escribiendo',
      stateLabel: 'Su estado', statePlaceholder: 'Elija su estado',
      hello: ['¡Hola! Soy Genie 👋', 'Le ayudo a encontrar un buen seguro de auto, en español y sin complicaciones.', '¿En qué estado vive?'],
      afterState: ['Perfecto, {state}.', '¿Qué es lo más importante para usted?'],
      q2: [
        { label: 'Pagar menos', goal: 'price', reply: ['¡Entendido! Vamos a buscar el mejor precio.', 'Le haré unas preguntas más en el chat. Toma como un minuto.'] },
        { label: 'Mejor cobertura', goal: 'coverage', reply: ['Muy buena decisión.', 'Vamos a buscar una cobertura que le proteja bien. Toma como un minuto.'] },
        { label: 'Hablar con una persona', agent: true, reply: ['Claro que sí.', 'Deje su número en el chat y un agente con licencia le llamará.'] }
      ],
      go: 'Continuar con Genie', goAgent: 'Pedir una llamada',
      states: US_STATES
    }
  }
];
const landingTpl = read('src/landing.template.html');
for (const L of landings) {
  const url = `${SITE}/go/${L.slug}/`;
  const html = landingTpl
    .replace('{{LANG}}', L.lang).replace(/\{\{TITLE\}\}/g, esc(L.title)).replace(/\{\{DESC\}\}/g, esc(L.desc)).replace(/\{\{URL\}\}/g, url)
    .replace('{{BRAND_HEAD}}', brandHead).replace('{{PIXEL}}', pixel).replace('{{HOME}}', L.home)
    .replace('{{TRUST_MINI}}', esc(L.trustMini)).replace('{{KICKER}}', esc(L.kicker)).replace('{{H1}}', L.h1).replace('{{LEDE}}', esc(L.lede))
    .replace('{{POINTS}}', L.points.map((p) => `<li>${check}<span>${esc(p)}</span></li>`).join(''))
    .replace('{{GENIE_SUB}}', esc(L.genieSub)).replace('{{CARD_NOTE}}', esc(L.cardNote))
    .replace('{{HOW_TITLE}}', esc(L.howTitle)).replace('{{STEPS}}', L.steps.map((s) => `<li><h3>${esc(s[0])}</h3><p>${esc(s[1])}</p></li>`).join(''))
    .replace('{{FAQ_TITLE}}', esc(L.faqTitle)).replace('{{FAQ}}', L.faq.map((f) => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join('\n    '))
    .replace('{{FINAL_TITLE}}', esc(L.finalTitle)).replace('{{FINAL_BTN}}', esc(L.finalBtn)).replace('{{BAR_BTN}}', esc(L.barBtn))
    .replace('{{LEGAL}}', L.legal).replace('{{CONFIG}}', JSON.stringify(L.config).replace(/</g, '\\u003c'));
  fs.mkdirSync(path.join(dist, 'go', L.slug), { recursive: true });
  fs.writeFileSync(path.join(dist, 'go', L.slug, 'index.html'), html);
}


// ---------- topic guide pages ----------
const genieTpl = read('src/partials/genie.html');
const byPage = (k) => landings.find((L) => L.config.page === k).config;
const GENIE = {
  sr22: { cfg: byPage('sr22'), sub: 'Your AI insurance guide · replies in seconds', note: 'Genie is an AI assistant. A licensed agent is one tap away.', aria: 'Chat with Genie' },
  'sr22-tx': { cfg: Object.assign({}, byPage('sr22'), { page: 'sr22-tx', state: 'Texas',
    hello: ['Hi, I\u2019m Genie \ud83d\udc4b', 'Need an SR-22 in Texas? I can point you to insurers that file it with DPS. No judgment.'],
    afterState: ['Has DPS or a court already asked you for one?'] }), sub: 'Your AI insurance guide · replies in seconds', note: 'Genie is an AI assistant. A licensed agent is one tap away.', aria: 'Chat with Genie' },
  'sr22-fl': { cfg: Object.assign({}, byPage('sr22'), { page: 'fr44-fl', state: 'Florida',
    hello: ['Hi, I’m Genie 👋', 'Need an FR-44 or SR-22 in Florida? I can point you to insurers that file them. No judgment.'],
    afterState: ['Has the court or FLHSMV already asked you for one?'] }), sub: 'Your AI insurance guide · replies in seconds', note: 'Genie is an AI assistant. A licensed agent is one tap away.', aria: 'Chat with Genie' },
  'fr44-va': { cfg: Object.assign({}, byPage('sr22'), { page: 'fr44-va', state: 'Virginia',
    hello: ['Hi, I\u2019m Genie \ud83d\udc4b', 'Need an FR-44 in Virginia? I can point you to insurers that file it with DMV. No judgment.'],
    afterState: ['Has the court or DMV already asked you for one?'] }), sub: 'Your AI insurance guide · replies in seconds', note: 'Genie is an AI assistant. A licensed agent is one tap away.', aria: 'Chat with Genie' },
  'late-pay': { cfg: Object.assign({}, byPage('sr22'), { page: 'late-pay',
    hello: ['Hi, I\u2019m Genie \ud83d\udc4b', 'Missed a car insurance payment? Let\u2019s keep you covered.', 'Which state is your car registered in?'],
    afterState: ['Got it, {state}.', 'Has your insurer cancelled the policy yet?'],
    q2: [
      { label: 'Not yet, just late', goal: 'price', reply: ['Good. Pay as soon as you can, and ask about a payment date that suits you.', 'If the price is the problem, I can point you to a partner that may cost less. About a minute.'] },
      { label: 'Yes, it was cancelled', goal: 'price', reply: ['That\u2019s fixable. Getting covered again quickly keeps the price lower.', 'Let\u2019s find a partner in {state}. About a minute in the chat.'] },
      { label: 'I\u2019d rather talk to a person', agent: true, reply: ['Of course.', 'Leave your number in the chat and a licensed agent will call you back.'] }
    ] }), sub: 'Your AI insurance guide · replies in seconds', note: 'Genie is an AI assistant. A licensed agent is one tap away.', aria: 'Chat with Genie' },
  lapse: { cfg: Object.assign({}, byPage('sr22'), { page: 'lapse',
    hello: ['Hi, I’m Genie 👋', 'A lapse happens to lots of drivers. Let’s get you covered again, quickly.', 'Which state is your car registered in?'],
    afterState: ['Got it, {state}.', 'How long have you been without insurance?'],
    q2: [
      { label: 'Less than 30 days', goal: 'price', reply: ['Good, that usually means a smaller price bump.', 'I’ll ask a couple more questions in the chat and point you to a partner. About a minute.'] },
      { label: 'More than 30 days', goal: 'price', reply: ['No problem, plenty of insurers still work with you.', 'Let’s find one in {state}. About a minute in the chat.'] },
      { label: 'I’d rather talk to a person', agent: true, reply: ['Of course.', 'Leave your number in the chat and a licensed agent will call you back.'] }
    ] }), sub: 'Your AI insurance guide · replies in seconds', note: 'Genie is an AI assistant. A licensed agent is one tap away.', aria: 'Chat with Genie' },
  'seguro-tx': { cfg: Object.assign({}, byPage('seguro-es'), { page: 'seguro-tx', state: 'Texas',
    hello: ['¡Hola! Soy Genie 👋', '¿Busca seguro de auto en Texas? Le ayudo a encontrar uno que cumpla con la ley, en español.'],
    afterState: ['¿Qué es lo más importante para usted?'] }), sub: 'Su guía de seguros con IA · responde al instante', note: 'Genie es un asistente de IA. Algunas partes del chat están en inglés por ahora.', aria: 'Hable con Genie' },
  record: { cfg: Object.assign({}, byPage('sr22'), { page: 'record',
    hello: ['Hi, I’m Genie 👋', 'A ticket or accident doesn’t have to mean overpaying. Some insurers are much more forgiving than others.', 'Which state do you live in?'],
    afterState: ['Got it, {state}.', 'What’s on your record?'],
    q2: [
      { label: 'A ticket', goal: 'price', reply: ['Thanks. Insurers weigh tickets very differently, so comparing really helps.', 'A few more questions in the chat and I’ll point you to a partner. About a minute.'] },
      { label: 'An accident', goal: 'price', reply: ['Sorry that happened. Let’s find an insurer that won’t overcharge you for it.', 'A few more questions in the chat. About a minute.'] },
      { label: 'I’d rather talk to a person', agent: true, reply: ['Of course.', 'Leave your number in the chat and a licensed agent will call you back.'] }
    ] }), sub: 'Your AI insurance guide · replies in seconds', note: 'Genie is an AI assistant. A licensed agent is one tap away.', aria: 'Chat with Genie' },
  'new-driver': { cfg: Object.assign({}, byPage('sr22'), { page: 'new-driver',
    hello: ['Hi, I’m Genie 👋', 'New to driving, or adding a teen? Discounts can make a real difference.', 'Which state do you live in?'],
    afterState: ['Got it, {state}.', 'Who’s the new driver?'],
    q2: [
      { label: 'Me, it’s my first policy', goal: 'price', reply: ['Welcome to the road! Let’s find a fair first price.', 'A few more questions in the chat. About a minute.'] },
      { label: 'I’m adding my teen', goal: 'coverage', reply: ['Smart to plan ahead. Ask about good-student and driver’s-ed discounts.', 'A few more questions in the chat and I’ll point you to a partner. About a minute.'] },
      { label: 'I’d rather talk to a person', agent: true, reply: ['Of course.', 'Leave your number in the chat and a licensed agent will call you back.'] }
    ] }), sub: 'Your AI insurance guide · replies in seconds', note: 'Genie is an AI assistant. A licensed agent is one tap away.', aria: 'Chat with Genie' },
  rideshare: { cfg: Object.assign({}, byPage('sr22'), { page: 'rideshare',
    hello: ['Hi, I’m Genie 👋', 'Driving for an app? Let’s make sure you’re covered while the app is on, not just when you have a passenger.', 'Which state do you drive in?'],
    afterState: ['Got it, {state}.', 'What kind of driving do you do?'],
    q2: [
      { label: 'Uber or Lyft', goal: 'coverage', reply: ['Good to know. Ask any insurer about rideshare coverage for the time you’re waiting for a ride.', 'A few more questions in the chat. About a minute.'] },
      { label: 'Food or package delivery', goal: 'coverage', reply: ['Got it. Delivery driving is often excluded from personal policies, so it’s worth checking.', 'A few more questions in the chat. About a minute.'] },
      { label: 'I’d rather talk to a person', agent: true, reply: ['Of course.', 'Leave your number in the chat and a licensed agent will call you back.'] }
    ] }), sub: 'Your AI insurance guide · replies in seconds', note: 'Genie is an AI assistant. A licensed agent is one tap away.', aria: 'Chat with Genie' },
  seguro: { cfg: Object.assign({}, byPage('seguro-es'), { hello: ['¡Hola! Soy Genie \ud83d\udc4b', '¿Tiene licencia de otro país? Le ayudo a encontrar aseguradoras que trabajan con conductores como usted.', '¿En qué estado vive?'] }), sub: 'Su guía de seguros con IA · responde al instante', note: 'Genie es un asistente de IA. Algunas partes del chat están en inglés por ahora.', aria: 'Hable con Genie' },
};

// Link each outside source once in the body (its first mention); later mentions stay as plain-text
// attribution. The Sources list keeps every link.
function dedupeCitations(src) {
  const [main, ...rest] = src.split(/^(?=## (?:Sources|Fuentes)\s*$)/m);
  const seen = new Set();
  const out = main.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, t, u) => {
    if (u.startsWith(SITE) || !seen.has(u)) { seen.add(u); return m; }
    return t;
  });
  return [out, ...rest].join('');
}

for (const g of guides) {
  const url = `${SITE}/${g.path}/`;
  const es = g.lang === 'es';
  const G = GENIE[g.genie];
  const box = G ? genieTpl.replace('{{ARIA}}', G.aria).replace('{{SUB}}', esc(G.sub)).replace('{{NOTE}}', esc(G.note))
    .replace('{{CONFIG}}', JSON.stringify(G.cfg).replace(/</g, '\\u003c')) : '';
  // FAQ structured data from the "### question" + answer pairs in the questions section
  const faqPart = (g.body.split(/^## (?:Common questions|Preguntas frecuentes)\s*$/m)[1] || '').split(/^## /m)[0];
  const faqs = [...faqPart.matchAll(/^### (.+)\n([\s\S]*?)(?=^### |(?![\s\S]))/gm)].map((m) => ({ q: m[1].trim(), a: m[2].trim().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '') }));
  const crumbs = es ? [['Inicio', SITE + '/es/'], [g.title, url]] : [['Home', SITE + '/'], ['Guides', SITE + '/blog/'], [g.title, url]];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: g.title, description: g.description, inLanguage: g.lang, datePublished: g.date, dateModified: g.updated || g.date,
      mainEntityOfPage: url, author: { '@type': 'Organization', name: NAME, url: SITE }, publisher: { '@type': 'Organization', name: NAME, url: SITE } },
    { '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: c[1] })) },
    ...(faqs.length ? [{ '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : []),
  ] };
  const body = md(dedupeCitations(g.body)).replace('<p>[[genie]]</p>', box);
  // "File it" only makes sense on SR-22 / FR-44 guides.
  const ctaHead = /sr22|fr44/.test(g.path) ? 'Ready to find an insurer that will file it?'
    : g.path === 'car-insurance-after-lapse' ? 'Ready to get covered again?' : 'Ready to find coverage that fits?';
  const cta = es
    ? `<aside class="article-cta"><h2>¿Listo para comparar?</h2><p>Genie le hace unas preguntas y le indica el socio de cotización que le conviene. Gratis y sin compromiso.</p><a class="btn btn-sun" href="#genie">Hablar con Genie</a></aside>`
    : `<aside class="article-cta"><h2>${ctaHead}</h2><p>Genie asks a few quick questions and points you to the quoting partner that fits. Free, no obligation.</p><a class="btn btn-sun" href="#genie">Start with Genie</a></aside>`;
  const rel = (RELATED[g.path] || []).map((p) => guides.find((x) => x.path === p)).filter(Boolean);
  const related = rel.length ? `<nav class="related" aria-label="${es ? 'Guías relacionadas' : 'Related guides'}"><h2>${es ? 'Guías relacionadas' : 'Related guides'}</h2><ul>${rel.map((r) => `<li><a href="/${r.path}/">${esc(r.title)}</a></li>`).join('')}</ul></nav>` : '';
  const html = head({ title: g.seo_title || `${g.title} | ${NAME}`, description: g.description, url, type: 'article', lang: g.lang, hdr: es ? headerEs : null,
    extra: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` }) + `<main class="page">
<article class="article">
  <p class="crumbs">${es ? '<a href="/es/">Inicio</a>' : '<a href="/">Home</a> / <a href="/blog/">Guides</a>'}</p>
  <h1>${esc(g.title)}</h1>
  <p class="byline">${es ? 'Por' : 'By'} ${NAME} &middot; ${es ? 'Datos verificados el' : 'Facts checked'} <time datetime="${g.updated || g.date}">${es ? new Date((g.updated || g.date) + 'T00:00:00Z').toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) : fmtDate(g.updated || g.date)}</time> &middot; <a href="/how-we-check-facts/">${es ? 'Cómo verificamos los datos' : 'How we check facts'}</a>${es ? '' : ' &middot; <a href="/how-we-make-money/">How we make money</a>'}</p>
${body}
  ${related}
  ${cta}
  <p class="disclaimer">${es ? 'Solo información general, no es asesoría de seguros, legal ni financiera. Las reglas y los precios cambian según el estado y la aseguradora.' : 'General information only, not insurance, legal, or financial advice. Rules and prices vary by state and insurer; check your official notice.'}</p>
</article>
</main>` + tail;
  fs.mkdirSync(path.join(dist, g.path), { recursive: true });
  fs.writeFileSync(path.join(dist, g.path, 'index.html'), html);
}

// ---------- llms.txt: a plain summary of the site for AI assistants ----------
fs.writeFileSync(path.join(dist, 'llms.txt'), `# ${NAME}

> ${NAME} is a free AI assistant (Genie) that helps US drivers understand car insurance and points them to the quoting partner that fits their needs. It is not an insurance company or licensed agent; quotes and final rates come from partners or insurers. Plain-language help in English and Spanish, including SR-22 and harder situations.

## Guides
${guides.filter((g) => g.lang === 'en').map((g) => `- [${g.title}](${SITE}/${g.path}/): ${g.description}`).join('\n')}
${posts.map((p) => `- [${p.title}](${SITE}/blog/${p.slug}/): ${p.description}`).join('\n')}

## En español
- [Inicio en español](${SITE}/es/): Ayuda con el seguro de auto en español.
${guides.filter((g) => g.lang === 'es').map((g) => `- [${g.title}](${SITE}/${g.path}/): ${g.description}`).join('\n')}

## Use the assistant
- [Chat with Genie](${CHAT_URL}/): Answers car insurance questions and suggests a quoting partner. Free, no obligation.

## About
- [For partners](${SITE}/partners/): How insurers and quoting platforms work with ${NAME}.
- [Privacy](${SITE}/privacy/) · [Terms](${SITE}/terms/)
`);

// ---------- sitemap, rss ----------
const urls = [
  { loc: SITE + '/', lastmod: posts[0] ? (posts[0].updated || posts[0].date) : undefined },
  { loc: SITE + '/es/' },
  { loc: SITE + '/partners/' },
  { loc: SITE + '/contact/' },
  { loc: SITE + '/privacy/' },
  { loc: SITE + '/terms/' },
  { loc: SITE + '/how-we-check-facts/' },
  { loc: SITE + '/how-we-make-money/' },
  { loc: SITE + '/blog/', lastmod: posts[0] ? (posts[0].updated || posts[0].date) : undefined },
  ...posts.map((p) => ({ loc: `${SITE}/blog/${p.slug}/`, lastmod: p.updated || p.date })),
  ...guides.map((g) => ({ loc: `${SITE}/${g.path}/`, lastmod: g.updated || g.date })),
];
fs.writeFileSync(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') + `\n</urlset>\n`);

fs.writeFileSync(path.join(dist, 'feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${NAME} guides</title><link>${SITE}/blog/</link><description>Car insurance guides from ${NAME}</description>\n` +
  posts.map((p) => `<item><title>${esc(p.title)}</title><link>${SITE}/blog/${p.slug}/</link><guid>${SITE}/blog/${p.slug}/</guid><pubDate>${new Date(p.date + 'T00:00:00Z').toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`).join('\n') +
  `\n</channel></rss>\n`);

console.log(`Built ${posts.length} post(s) -> dist/`);
