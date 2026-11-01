// After a deploy, tell Bing (and other IndexNow search engines) which pages changed.
// Sends the homepage plus every sitemap URL updated in the last 3 days. Never fails the deploy.
const fs = require('fs');
const path = require('path');
const KEY = '60fed12a3bbd3f41f9050b0ccf257aac';
const HOST = 'aiinsuregenie.com';
(async () => {
  try {
    const xml = fs.readFileSync(path.join(__dirname, 'dist', 'sitemap.xml'), 'utf8');
    const cutoff = Date.now() - 3 * 864e5;
    const urls = new Set([`https://${HOST}/`]);
    for (const m of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)) {
      if (m[2] && Date.parse(m[2]) >= cutoff) urls.add(m[1]);
    }
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: [...urls] }),
    });
    console.log(`IndexNow: sent ${urls.size} URL(s), status ${res.status}`);
  } catch (e) {
    console.log('IndexNow: skipped (' + e.message + ')');
  }
})();
