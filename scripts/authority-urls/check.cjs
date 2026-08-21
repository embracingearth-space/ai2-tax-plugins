/**
 * Authority URL Watch — liveness check for every tax-authority URL in
 * src/countries: the `authority.portalUrl` / `authority.helpUrl` fields, the
 * `getPortalSubmissionInfo().portalUrl`, and the `Reference:` URLs in file
 * headers.
 *
 * Same philosophy as Rate Watch: it NEVER edits a URL. It reports, a human fixes.
 * Tax-authority sites reorganise silently, so a link that shipped correct rots
 * without any code change — this is the detector for that class of drift.
 *
 * Run: node scripts/authority-urls/check.cjs
 * Env: FAIL_ON_DEAD=1 to exit non-zero when a hard failure is found (CI use).
 *
 * Classification is deliberately conservative, because government sites treat
 * scripted clients differently from browsers:
 *   dead        — 404/410, or a 200 whose page says "page not found" (soft 404).
 *                 Actionable: the URL is wrong.
 *   login-wall  — redirects to an auth page. A defect for anything that has to be
 *                 publicly readable (helpUrl, Reference), but CORRECT for a
 *                 portalUrl: you are supposed to authenticate to lodge a return.
 *   inconclusive— 403 / timeout / TLS refusal. NOT actionable on its own: these
 *                 are usually bot-blocking (Cloudflare, Akamai) or geo-fencing,
 *                 and the page is fine in a real browser. Verify by hand.
 * A plain-fetch checker cannot tell "blocked" from "broken", so it must not
 * claim to. Anything inconclusive needs a browser before you touch the URL.
 * embracingearth.space
 */
const fs = require('fs');
const path = require('path');

const COUNTRIES_DIR = path.join(__dirname, '..', '..', 'src', 'countries');
const URL_RE = /(portalUrl|helpUrl)\s*:\s*['"](https?:\/\/[^'"]+)['"]/g;
const BARE_URL_RE = /https?:\/\/[^\s'"`,\]]+/g;
const SOFT_404 =
  /page not found|not be found|couldn't find|cannot be found|no longer available|doesn't exist|does not exist|não encontrada|nicht gefunden|no encontrad|introuvable|^404\b|something went wrong/i;
const LOGIN_WALL = /require_login|\/login|\/signin|auth\/realms|came_from=/i;
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 25000);

/**
 * Trim trailing sentence punctuation without breaking URLs that legitimately end
 * in a bracket — IRAS paths contain "(gst)", so a blind rstrip of ")" silently
 * truncates them into 404s.
 */
function trimUrl(raw) {
  let u = raw.replace(/[.,;:]+$/, '');
  while (u.endsWith(')')) {
    const opens = (u.match(/\(/g) || []).length;
    const closes = (u.match(/\)/g) || []).length;
    if (closes <= opens) break;
    u = u.slice(0, -1);
  }
  return u;
}

function collectUrls() {
  const found = new Map();
  const add = (url, where, kind) => {
    if (!found.has(url)) found.set(url, { where: [], kinds: new Set() });
    found.get(url).where.push(where);
    found.get(url).kinds.add(kind);
  };

  for (const file of fs.readdirSync(COUNTRIES_DIR).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(COUNTRIES_DIR, file), 'utf8');
    const fieldUrls = new Set();
    let m;
    URL_RE.lastIndex = 0;
    while ((m = URL_RE.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      fieldUrls.add(m[2]);
      add(m[2], `${file}:${line} ${m[1]}`, m[1]);
    }

    // Also audit URLs that appear ONLY in comments. The `Reference:` header cites
    // the form spec a plugin implements and rots exactly like a field does —
    // scanning only field positions is how a dead reference URL survived a full
    // audit of this very file. embracingearth.space
    src.split(/\r?\n/).forEach((lineText, i) => {
      let mm;
      BARE_URL_RE.lastIndex = 0;
      while ((mm = BARE_URL_RE.exec(lineText))) {
        const url = trimUrl(mm[0]);
        if (!url || fieldUrls.has(url)) continue;
        add(url, `${file}:${i + 1} comment`, 'reference');
      }
    });
  }
  return found;
}

async function check(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept-Language': 'en',
      },
    });
    const finalUrl = res.url || url;
    if (res.status === 404 || res.status === 410) return { verdict: 'dead', status: res.status };
    if (res.status === 403 || res.status === 429)
      return { verdict: 'inconclusive', status: res.status, note: 'likely bot-blocked' };
    if (!res.ok) return { verdict: 'inconclusive', status: res.status };
    if (LOGIN_WALL.test(finalUrl) && finalUrl !== url)
      return { verdict: 'login-wall', status: res.status, finalUrl };
    // Soft 404: 200 status, "not found" page. Only inspect the first slice —
    // site-wide nav/footers legitimately contain words like "not found".
    const body = (await res.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(body);
    if (SOFT_404.test((title && title[1]) || '') || SOFT_404.test(body.slice(0, 500)))
      return { verdict: 'dead', status: res.status, note: 'soft 404' };
    return { verdict: 'ok', status: res.status };
  } catch (e) {
    return { verdict: 'inconclusive', note: String(e.message || e).slice(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  const urls = collectUrls();
  const results = [];
  const entries = [...urls.entries()];
  const CONC = 6;
  let i = 0;
  await Promise.all(
    Array.from({ length: CONC }, async () => {
      while (i < entries.length) {
        const [url, meta] = entries[i++];
        const r = await check(url);
        // A login wall is CORRECT for a portalUrl — you must authenticate to lodge.
        // It is only a defect where the page has to be publicly readable.
        const mustBePublic = meta.kinds.has('helpUrl') || meta.kinds.has('reference');
        if (r.verdict === 'login-wall' && !mustBePublic) {
          r.verdict = 'ok';
          r.note = 'login required (expected for a lodgement portal)';
        }
        results.push({ url, where: meta.where, ...r });
      }
    }),
  );

  const by = (v) =>
    results.filter((r) => r.verdict === v).sort((a, b) => a.url.localeCompare(b.url));
  const dead = [...by('dead'), ...by('login-wall')];
  const incon = by('inconclusive');

  console.log(
    `Authority URL Watch — ${results.length} URLs across ${fs.readdirSync(COUNTRIES_DIR).length} country files\n`,
  );
  console.log(
    `✅ ok: ${by('ok').length}   ❌ actionable: ${dead.length}   ⚠️  inconclusive: ${incon.length}\n`,
  );

  if (dead.length) {
    console.log('❌ Actionable — wrong or non-public URL:');
    for (const r of dead)
      console.log(
        `  [${r.verdict}${r.status ? ' ' + r.status : ''}${r.note ? ', ' + r.note : ''}] ${r.url}\n      ${r.where.join(' | ')}`,
      );
    console.log('');
  }
  if (incon.length) {
    console.log('⚠️  Inconclusive — verify in a real browser before changing anything:');
    for (const r of incon)
      console.log(
        `  [${r.status || 'ERR'}${r.note ? ', ' + r.note : ''}] ${r.url}\n      ${r.where.join(' | ')}`,
      );
    console.log('');
  }

  if (dead.length && process.env.FAIL_ON_DEAD === '1') process.exit(1);
})();
