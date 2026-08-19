/**
 * Every plugin must deliver what getSupportedExportFormats() advertises.
 * embracingearth.space
 *
 * WHY THIS EXISTS. Every plugin advertised 'csv' (several also advertised
 * 'pdf'), but generateExport() ignored the `format` argument entirely and
 * always returned JSON — with a `.json` filename and MIME type regardless of
 * what was clicked. Only ghana.ts and unitedKingdom.ts actually branched.
 * Clicking "CSV" in the filing UI downloaded a file named and typed as JSON;
 * clicking "PDF Summary" (australia.ts, unitedKingdom.ts) did the same with a
 * worse mismatch, since no plugin generates a PDF at all.
 *
 * This iterates every REGISTERED plugin — not a hand-picked list — so a new
 * country plugin is covered automatically and cannot reintroduce the gap.
 */
import { getPluginForCountry, listOfficialCountries } from '../src';
import type { TaxFilingPlugin } from '../src';

const SAMPLE_VALUES = { field_a: '1234.56', field_b: 'Test & Co, "Ltd"', field_c: 0 };

function plugins(): { code: string; plugin: TaxFilingPlugin }[] {
  return listOfficialCountries()
    .map((code) => ({ code, plugin: getPluginForCountry(code) }))
    .filter((p): p is { code: string; plugin: TaxFilingPlugin } => Boolean(p.plugin));
}

describe('every plugin delivers the export formats it advertises', () => {
  const all = plugins();

  it('found a real set of plugins to check (this suite is not accidentally empty)', () => {
    expect(all.length).toBeGreaterThan(20);
  });

  for (const { code, plugin } of all) {
    const formats = plugin.getSupportedExportFormats();

    it(`${code}: getSupportedExportFormats() never lists a format generateExport() cannot produce`, async () => {
      for (const fmt of formats) {
        const out = await plugin.generateExport(SAMPLE_VALUES, fmt.id);
        // The two things a user actually sees: what the file is named and what
        // it downloads as. Both must match the format that was clicked.
        expect(out.mimeType).toBe(fmt.mimeType);
        expect(out.filename.toLowerCase().endsWith(`.${fmt.fileExtension}`)).toBe(true);
      }
    });

    if (formats.some((f) => f.id === 'csv')) {
      it(`${code}: CSV export is real CSV, not JSON wearing a .csv name`, async () => {
        const out = await plugin.generateExport(SAMPLE_VALUES, 'csv');
        const text = String(out.data);
        // The universal failure mode this guards, for every plugin: format:'csv'
        // silently returning the JSON branch. JSON.stringify output always
        // starts with '{', which is never valid CSV.
        expect(text.trim().startsWith('{')).toBe(false);
        expect(text.split(/\r?\n/)[0]).not.toBe('');
      });

      // unitedKingdom.ts is the one deliberate exception: its CSV reshapes data
      // into fixed MTD boxes (periodKey, vatDueSales, ...) rather than echoing
      // arbitrary field/value pairs, and was already reviewed as correct — see
      // its own generateExport. Every other plugin shares the generic toCsv()
      // helper and must follow its field/value contract exactly.
      if (code !== 'GB') {
        it(`${code}: CSV uses the shared field/value shape`, async () => {
          const out = await plugin.generateExport(SAMPLE_VALUES, 'csv');
          const text = String(out.data);
          expect(text.split(/\r?\n/)[0]).toMatch(/^field,value$/i);
          // The sample includes a comma and embedded quotes — both must
          // survive RFC 4180 escaping, or the file corrupts in Excel/Sheets.
          expect(text).toContain('"Test & Co, ""Ltd"""');
        });

        it(`${code}: CSV output neutralises spreadsheet formula injection`, async () => {
          const out = await plugin.generateExport({ risky: '=cmd|/c calc' }, 'csv');
          const text = String(out.data);
          // A raw leading '=' is executed as a formula by Excel/Sheets even
          // inside quotes; it must be defused with a leading apostrophe.
          expect(text).toMatch(/'=cmd\|\/c calc/);
        });
      }
    }

    it(`${code}: no format is advertised without a distinct file extension per format`, () => {
      const extensions = new Set(formats.map((f) => f.fileExtension));
      expect(extensions.size).toBe(formats.length);
    });
  }

  it('no plugin currently advertises a PDF it cannot generate', () => {
    // Not a permanent rule — real PDF generation may land later — but today
    // nothing in the engine produces one, so advertising it is a guaranteed
    // mismatch. If a plugin adds real PDF support, this line should be the one
    // that needs updating, not a silent gap.
    const stillClaimsPdf = all.filter(({ plugin }) =>
      plugin.getSupportedExportFormats().some((f) => f.id === 'pdf'),
    );
    expect(stillClaimsPdf.map((p) => p.code)).toEqual([]);
  });
});
