/**
 * Shared export helpers for TaxFilingPlugin.generateExport(). embracingearth.space
 *
 * WHY THIS EXISTS. Every plugin's getSupportedExportFormats() advertised 'csv'
 * (several also advertised 'pdf'), but generateExport() ignored the `format`
 * argument entirely and always returned JSON — with a `.json` filename and MIME
 * type regardless of what was clicked. A user picking "CSV" in the filing UI
 * downloaded a file named and typed as JSON. Only ghana.ts and unitedKingdom.ts
 * actually branched on format; ghana.ts's CSV serialiser is reproduced here
 * verbatim (it was already correct — RFC 4180 quoting plus formula-injection
 * neutralisation) so every plugin shares one audited implementation instead of
 * 24 copies that could each drift.
 */
import type { FieldValues, ExportOutput } from './types';

/** RFC 4180 field escaping, with spreadsheet formula-injection neutralised. */
function escapeCsvField(value: unknown): string {
  let s = String(value ?? '');
  // A cell whose first character is = + - @ (or a tab/CR) is executed as a
  // formula by Excel/Sheets even when the cell is quoted, so defuse it first.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // Then quote any field containing a comma, quote or newline.
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Two-column "field,value" CSV of a filing's raw field values — the same shape
 * every plugin's JSON export already uses, just in the format that was clicked.
 * `filenamePrefix` should NOT include an extension (e.g. `BAS-AU-2026-08-20`);
 * this appends `.csv`, mirroring how each plugin already builds its own
 * `${prefix}-${date}.json` name.
 */
export function toCsv(values: FieldValues, filenamePrefix: string): ExportOutput {
  const rows = Object.entries(values).map(([k, v]) => `${escapeCsvField(k)},${escapeCsvField(v)}`);
  return {
    data: ['field,value', ...rows].join('\r\n'),
    filename: `${filenamePrefix}.csv`,
    mimeType: 'text/csv',
  };
}
