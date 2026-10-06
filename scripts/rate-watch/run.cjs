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

// Auto-detect quarterly window (first week of Jan/Apr/Jul/Oct) unless MODE is set.
function resolveMode(now = new Date()) {
  const m = (process.env.MODE || '').trim();
  if (m) {
    if (m !== 'weekly' && m !== 'quarterly') {
      throw new Error(`Invalid MODE "${m}" — expected "weekly" or "quarterly".`);
    }
    return m;
  }
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

// Deduction rates (AU WFH fixed rate, cents per km, instant asset write-off).
// Findings come from analyzeDeductionRates() in src/rateWatch.ts; this only prints
// them. Like everything here it never edits a rate.
function renderDeductions(L, d) {
  if (!d) return;
  const tag = (x) => `**${x.countryCode}** ${x.label}`;
  if (d.unverifiedCurrent.length) {
    L.push('## ❓ Deduction rates with no verified figure for the current income year');
    for (const u of d.unverifiedCurrent) L.push(`- ${tag(u)} — ${u.incomeYear}: ${u.reason} (row from ${u.effectiveFrom}). Edit \`${u.file}\` once confirmed.`);
    L.push('');
  }
  if (d.staleCitations.length) {
    L.push('## 🕸️ Stale deduction-rate citations');
    for (const s of d.staleCitations) L.push(`- ${tag(s)} — last read ${s.readOn} (${s.ageDays} days ago). Re-read ${s.sourceUrl} and update \`readOn\` in \`${s.file}\`.`);
    L.push('');
  }
  if (d.pastReviewBy && d.pastReviewBy.length) {
    L.push('## ⏰ Past their review date (the freshness test fails the build until these are re-read)');
    for (const r of d.pastReviewBy) L.push(`- ${tag(r)} — ${r.incomeYear}: review was due ${r.reviewBy} (${r.daysPast} days ago). Re-read ${r.sourceUrl || 'the source'}, then update the row and move \`reviewBy\` in \`${r.file}\`.`);
    L.push('');
  }
  if (d.home && d.home.length) {
    L.push('## ⏰ Home-decision figures and rules past their review date');
    for (const h of d.home) L.push(`- **${h.country}** ${h.label} — review was due ${h.reviewBy}. Re-read ${h.sourceUrl} and move \`reviewBy\` in \`${h.file}\`.`);
    L.push('');
  }
  if (d.upcoming.length) {
    L.push('## 🗓️ Upcoming deduction-rate rows');
    for (const r of d.upcoming) L.push(`- ${tag(r)} → ${r.incomeYear} from ${r.effectiveFrom}: ${r.value ?? 'no rate published yet'}`);
    L.push('');
  }
}

function pct(n) {
  return `${+(n * 100).toFixed(2)}%`;
}

const DATASET = { incomeTax: 'income tax', retirement: 'retirement contributions', studentLoan: 'student loan', companyTax: 'company tax', capitalGains: 'capital gains' };
const DATASET_FILE = { incomeTax: 'src/data/incomeTax.ts', retirement: 'src/data/superannuation.ts', studentLoan: 'src/data/studentLoan.ts', companyTax: 'src/data/companyTax.ts', capitalGains: 'src/data/finland.ts' };

// Annual schedules (income tax / super / student loan). Rollovers lead because
// they are the silent failure: the resolver keeps answering with last year's
// figures and nothing errors.
function renderSchedules(L, s) {
  if (!s) return;
  const tag = (x) => `**${x.countryCode}** ${DATASET[x.dataset]}`;
  if (s.rollovers.length) {
    L.push("## ⛔ Tax year rolled over with NO new schedule (silently serving last year's figures)");
    for (const r of s.rollovers) L.push(`- ${tag(r)} — newest set is ${r.latestLabel} (from ${r.latestEffectiveFrom}, ${r.ageDays} days ago); nothing covers ${r.uncoveredFrom ? `the year from ${r.uncoveredFrom}` : 'the current year'}. Append the current year's set in \`${r.file || DATASET_FILE[r.dataset]}\`.`);
    L.push('');
  }
  if (s.missing && s.missing.length) {
    L.push('## ⛔ Schedules with NO set in force (the resolver falls back to the oldest set)');
    for (const m of s.missing) L.push(`- ${tag(m)} — add a set covering today in \`${m.file || DATASET_FILE[m.dataset]}\`.`);
    L.push('');
  }
  if (s.recentlyActivated.length) {
    L.push('## ✅ Schedules that just took effect (confirm the app and the Tax MCP picked them up)');
    for (const r of s.recentlyActivated) L.push(`- ${tag(r)} → ${r.taxYearLabel} as of ${r.effectiveFrom}`);
    L.push('');
  }
  if (s.staleCitations.length) {
    L.push('## 🕸️ Stale schedule citations');
    for (const c of s.staleCitations) L.push(`- ${tag(c)} — last verified ${c.citationDate} (${c.ageDays} days ago). Re-confirm against the authority.`);
    L.push('');
  }
  if (s.unverified.length) {
    L.push('## ❓ Unverified schedules');
    for (const u of s.unverified) L.push(`- ${tag(u)} — not verified against the authority`);
    L.push('');
  }
  if (s.upcoming.length) {
    L.push('## 🗓️ Upcoming schedules — will activate automatically');
    for (const r of s.upcoming) L.push(`- ${tag(r)} → ${r.taxYearLabel} on ${r.effectiveFrom}`);
    L.push('');
  }
  if (s.undated.length) {
    L.push('## 📎 Schedules with a source URL but no dated citation (cannot be staleness-checked yet)');
    L.push(s.undated.map((u) => tag(u)).join(' · '));
    L.push('');
  }
}

function render(f, mode, external, sched, deductions) {
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

  renderSchedules(L, sched);
  renderDeductions(L, deductions);

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

// `deps` exists for tests only: `now` and `fetchExternal` are injectable so a suite
// can prove both analyses share one timestamp even when the clock rolls over
// during the awaited external check. Production callers pass nothing.
async function main({ now = () => new Date(), fetchExternal = fetchExternalRates } = {}) {
  // Required INSIDE main() so a load failure (e.g. dist not built) is caught by the
  // failure handler below and opens a "runner failed" issue, instead of throwing at
  // module load and bypassing the report path entirely. embracingearth.space
  const {
    analyzeLedger,
    hasActionableFindings,
    analyzeSchedules,
    hasActionableScheduleFindings,
    analyzeDeductionRates,
    hasActionableDeductionFindings,
  } = require('../../dist/rateWatch');
  const { homeFiguresPastReview } = require('../../dist/decisions/homeRatesFreshness');
  // ONE timestamp for the whole run. The awaited external check sits between the
  // analyses; if the local date rolled over during it, the ledger, schedule and
  // deduction findings would be computed against different days while the report
  // title only shows findings.asOf. Capture once, pass everywhere.
  const asOf = now();
  const mode = resolveMode(asOf);
  const findings = analyzeLedger(asOf);
  const deductions = analyzeDeductionRates(asOf);
  deductions.home = homeFiguresPastReview(asOf);
  const external = await fetchExternal();
  const schedules = analyzeSchedules(asOf);
  const report = render(findings, mode, external, schedules, deductions);

  const outPath = path.join(process.cwd(), 'rate-watch-report.md');
  fs.writeFileSync(outPath, report);

  // quarterly always opens an issue (the review prompt); weekly only when actionable
  const shouldOpen =
    mode === 'quarterly' ||
    hasActionableFindings(findings) ||
    hasActionableScheduleFindings(schedules) ||
    hasActionableDeductionFindings(deductions) ||
    deductions.home.length > 0;
  const title = `Rate Watch — ${findings.asOf} (${mode})`;

  console.log(report);
  console.log(`\n--- shouldOpen=${shouldOpen} title="${title}" ---`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `should_open=${shouldOpen}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `issue_title=${title}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `report_path=${outPath}\n`);
  }
}

module.exports = { main, resolveMode, render, fetchExternalRates };

if (require.main === module) main().catch((e) => {
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
