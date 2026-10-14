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

// ---------- shared page shell ----------
function head({ title, description, url, type = 'website', extra = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
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
<link rel="stylesheet" href="/styles.css">
${extra}
</head>
<body>
${header}
`;
}
const tail = `
${footer}
${menuScript}
</body>
</html>
`;

// ---------- posts ----------
const postsDir = path.join(root, 'content/posts');
const posts = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md') && !f.startsWith('_'))
  .map((f) => parse(path.join(postsDir, f)))
  .map((p) => { if (!p.date) throw new Error(`${p.slug}: missing "date"`); return p; })
  .filter((p) => p.draft !== 'true')
  .sort((a, b) => b.date.localeCompare(a.date));

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
    ],
  };
  const html = head({
    title: `${p.title} | ${NAME}`, description: p.description, url, type: 'article',
    extra: `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
  }) + `<main class="page">
<article class="article">
  <p class="crumbs"><a href="/">Home</a> / <a href="/blog/">Guides</a></p>
  <h1>${esc(p.title)}</h1>
  <p class="byline">By ${NAME} &middot; <time datetime="${p.date}">${fmtDate(p.date)}</time>${p.updated ? ` &middot; Updated <time datetime="${p.updated}">${fmtDate(p.updated)}</time>` : ''} &middot; ${Math.max(1, Math.round(words(p.body) / 220))} min read</p>
${md(p.body)}
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
</main>` + tail);

// ---------- homepage ----------
let home = read('src/index.template.html');
home = home.replace('{{HEADER}}', header).replace('{{FOOTER}}', footer).replace('{{MENU_SCRIPT}}', menuScript)
  .replace('{{LATEST_POSTS}}', list(posts.slice(0, 3)));
if (!posts.length) home = home.replace(/<section id="latest-guides">[\s\S]*?<\/section>\n/, '');
fs.writeFileSync(path.join(dist, 'index.html'), home);

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
  const html = head({ title: `${pg.title} | ${NAME}`, description: pg.description, url }) + `<main class="page">
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

// ---------- static assets ----------
fs.copyFileSync(path.join(root, 'src/styles.css'), path.join(dist, 'styles.css'));
for (const f of fs.readdirSync(path.join(root, 'public'))) fs.copyFileSync(path.join(root, 'public', f), path.join(dist, f));

// ---------- sitemap, rss ----------
const urls = [
  { loc: SITE + '/', lastmod: posts[0] ? (posts[0].updated || posts[0].date) : undefined },
  { loc: SITE + '/partners/' },
  { loc: SITE + '/contact/' },
  { loc: SITE + '/privacy/' },
  { loc: SITE + '/terms/' },
  { loc: SITE + '/blog/', lastmod: posts[0] ? (posts[0].updated || posts[0].date) : undefined },
  ...posts.map((p) => ({ loc: `${SITE}/blog/${p.slug}/`, lastmod: p.updated || p.date })),
];
fs.writeFileSync(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') + `\n</urlset>\n`);

fs.writeFileSync(path.join(dist, 'feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${NAME} guides</title><link>${SITE}/blog/</link><description>Car insurance guides from ${NAME}</description>\n` +
  posts.map((p) => `<item><title>${esc(p.title)}</title><link>${SITE}/blog/${p.slug}/</link><guid>${SITE}/blog/${p.slug}/</guid><pubDate>${new Date(p.date + 'T00:00:00Z').toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`).join('\n') +
  `\n</channel></rss>\n`);

console.log(`Built ${posts.length} post(s) -> dist/`);
