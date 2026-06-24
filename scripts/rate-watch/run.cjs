/**
 * Rate Watch runner — renders a human-review report from the ledger self-checks
 * and (best-effort) external cross-checks, then writes it to a file for the
 * workflow to open/update an issue with. NEVER edits a rate. embracingearth.space
 *
 * Run: npm run build && node scripts/rate-watch/run.cjs
 * Env: MODE=weekly|quarterly (default: auto from date), GITHUB_OUTPUT (optional).
 */
const fs = require('fs');
const path = require('path');
const { analyzeLedger, hasActionableFindings } = require('../../dist/rateWatch');

// Auto-detect quarterly window (first week of Jan/Apr/Jul/Oct) unless MODE is set.
function resolveMode() {
  if (process.env.MODE) return process.env.MODE;
  const now = new Date();
  const quarterMonth = [0, 3, 6, 9].includes(now.getUTCMonth());
  return quarterMonth && now.getUTCDate() <= 7 ? 'quarterly' : 'weekly';
}

/**
 * External cross-check hook. Intentionally a documented stub: shipping an
 * unverified live parser that silently breaks is worse than none. Candidates to
 * wire here (each returning { [countryCode]: standardRateFraction }), fail-loud:
 *   - EU TEDB SOAP  https://ec.europa.eu/taxation_customs/tedb/ws/VatRetrievalService.wsdl
 *     (RetrieveVatRates, situationOn=<date> — supports future-dated lookups)
 *   - OECD VAT/GST xlsx  https://www.oecd.org/.../vat-gst-rates-ctt-trends.xlsx (periodic baseline)
 * When wired, diff vs activeNationalRows() and require a 2nd source to agree before
 * proposing a change. Until then the scheduled human-review checklist below is the
 * verification mechanism.
 */
async function fetchExternalRates() {
  return { available: false, reason: 'live external auto-diff not yet wired — verify via the authority checklist below' };
}

function pct(n) {
  return `${+(n * 100).toFixed(2)}%`;
}

function render(f, mode, external) {
  const L = [];
  L.push(`# 🪙 Rate Watch — ${f.asOf} (${mode})`);
  L.push('');
  L.push('_Automated health check of the tax-rate ledger. This issue is a prompt for a human — nothing here changes a rate. To act on a finding, edit `src/data/rateLedger.data.ts` (append a dated row) per CONTRIBUTING._');
  L.push('');

  if (f.coverageGaps.length) {
    L.push('## ⛔ Coverage gaps (a country has NO active rate)');
    for (const g of f.coverageGaps) L.push(`- **${g.countryCode}** ${g.taxType}${g.stateProvince ? ` (${g.stateProvince})` : ''} — series ended ${g.endedOn} with no successor row. Add the current rate.`);
    L.push('');
  }
  if (f.recentlyActivated.length) {
    L.push('## ✅ Scheduled changes that just activated (confirm downstream picked them up)');
    for (const r of f.recentlyActivated) L.push(`- **${r.countryCode}** → ${pct(r.standardRate)} as of ${r.effectiveFrom}. Confirm the deployed DB seed reflects it.`);
    L.push('');
  }
  if (f.upcomingChanges.length) {
    L.push('## 🗓️ Upcoming (future-dated) changes — will activate automatically');
    for (const r of f.upcomingChanges) L.push(`- **${r.countryCode}** → ${pct(r.standardRate)} on ${r.effectiveFrom}`);
    L.push('');
  }
  if (f.staleCitations.length) {
    L.push('## 🕸️ Stale citations (verified rate not re-checked recently)');
    for (const s of f.staleCitations) L.push(`- **${s.countryCode}** — last verified ${s.citationDate} (${s.ageDays} days ago). Re-confirm against the authority.`);
    L.push('');
  }
  if (f.unverified.length) {
    L.push('## ❓ Unverified current rows (need an authority citation)');
    for (const u of f.unverified) L.push(`- **${u.countryCode}** ${u.countryName} — ${u.reason}`);
    L.push('');
  }

  L.push('## 🌐 External auto cross-check');
  L.push(external.available ? '- live source diff attached above' : `- _${external.reason}_`);
  L.push('');

  if (mode === 'quarterly') {
    L.push('## 📋 Quarterly authority review checklist');
    L.push('Eyeball each country against its official source; tick if still correct.');
    L.push('');
    for (const c of f.reviewChecklist) {
      const link = c.url ? `[${c.authority || 'source'}](${c.url})` : '⚠️ no source url';
      L.push(`- [ ] **${c.countryCode}** ${c.countryName} — ${pct(c.standardRate)} — ${link}`);
    }
    L.push('');
  }

  return L.join('\n');
}

async function main() {
  const mode = resolveMode();
  const findings = analyzeLedger(new Date());
  const external = await fetchExternalRates();
  const report = render(findings, mode, external);

  const outPath = path.join(process.cwd(), 'rate-watch-report.md');
  fs.writeFileSync(outPath, report);

  // quarterly always opens an issue (the review prompt); weekly only when actionable
  const shouldOpen = mode === 'quarterly' || hasActionableFindings(findings);
  const title = `Rate Watch — ${findings.asOf} (${mode})`;

  console.log(report);
  console.log(`\n--- shouldOpen=${shouldOpen} title="${title}" ---`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_open=${shouldOpen}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `issue_title=${title}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `report_path=${outPath}\n`);
  }
}

main().catch((e) => {
  // fail loud: a runner crash should open a "rate-watch broken" issue, not pass silently
  console.error('rate-watch runner failed:', e);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_open=true\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `issue_title=Rate Watch — RUNNER FAILED\n`);
    fs.writeFileSync(path.join(process.cwd(), 'rate-watch-report.md'), `# Rate Watch runner failed\n\n\`\`\`\n${String(e && e.stack || e)}\n\`\`\`\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `report_path=${path.join(process.cwd(), 'rate-watch-report.md')}\n`);
  }
  process.exit(1);
});
