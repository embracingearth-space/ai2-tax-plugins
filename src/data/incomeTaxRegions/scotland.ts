/**
 * Scotland — Scottish income tax rates and bands. @ai2/tax-plugins
 * embracingearth.space
 *
 * A Scottish taxpayer (main home in Scotland) pays income tax on NON-SAVINGS,
 * NON-DIVIDEND income — wages, in this calculator — at the rates and bands the
 * Scottish Parliament sets each year in its Scottish Rate Resolution, INSTEAD
 * of the England, Wales & Northern Ireland bands. Everything else stays
 * UK-wide and is not here: the personal allowance (and its taper above
 * £100,000), National Insurance, and the savings and dividend rates.
 *
 * So this region REPLACES the national bands (mode 'replacesBands'); it is
 * never added on top, and a taxpayer who selects Scotland is never given the
 * England bands — a Scottish year that is missing falls back to the previous
 * SCOTTISH year, reported as unverified, never to the rUK bands.
 *
 * The limits are TAXABLE income (after the personal allowance), exactly as the
 * resolution and HMRC's Scottish PAYE tables state them. gov.scot also prints
 * gross-income equivalents, but those hold only with the full £12,570
 * allowance; taxable limits stay right when the allowance tapers.
 *
 * Newest first. Append the next year when the Scottish Rate Resolution passes
 * (normally February, before the 6 April start).
 */
import type { IncomeTaxRegion } from '../incomeTax';

export const GB_SCOTLAND: IncomeTaxRegion = {
  code: 'SCT',
  name: 'Scotland',
  mode: 'replacesBands',
  file: 'src/data/incomeTaxRegions/scotland.ts',
  note: 'Scottish taxpayer: Scottish rates and bands on non-savings, non-dividend income (here, wages) in place of the England, Wales & NI bands. The personal allowance and National Insurance are UK-wide and unchanged.',
  assumptions: [
    'Scottish taxpayer (main home in Scotland) for the whole tax year.',
    'All income is employment income; savings and dividend income would use the UK-wide rates and are not modelled.',
  ],
  sets: [
    {
      effectiveFrom: '2026-04-06',
      taxYearLabel: '2026-27',
      // S6M-20844, passed 19 February 2026: starter 19% to 3,967; basic 20% to
      // 16,956; intermediate 21% to 31,092; higher 42% to 62,430; advanced 45%
      // to 125,140; top 48% above (taxable income).
      bands: [
        { upTo: 3967, rate: 0.19 },
        { upTo: 16956, rate: 0.2 },
        { upTo: 31092, rate: 0.21 },
        { upTo: 62430, rate: 0.42 },
        { upTo: 125140, rate: 0.45 },
        { upTo: null, rate: 0.48 },
      ],
      source: 'https://www.parliament.scot/chamber-and-committees/votes-and-motions/S6M-20844',
      authorityName: 'Scottish Parliament (Scottish Rate Resolution 2026-27); HMRC Scottish PAYE rates',
      citationDate: '2026-10-06',
      verified: true,
    },
    {
      effectiveFrom: '2025-04-06',
      taxYearLabel: '2025-26',
      // S6M-16531, passed 20 February 2025; HMRC rates and thresholds for
      // employers 2025-26: 2,827 / 14,921 / 31,092 / 62,430 / 125,140.
      bands: [
        { upTo: 2827, rate: 0.19 },
        { upTo: 14921, rate: 0.2 },
        { upTo: 31092, rate: 0.21 },
        { upTo: 62430, rate: 0.42 },
        { upTo: 125140, rate: 0.45 },
        { upTo: null, rate: 0.48 },
      ],
      source: 'https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2025-to-2026',
      authorityName: 'HM Revenue & Customs (Scottish PAYE bands); Scottish Parliament (Scottish Rate Resolution 2025-26)',
      citationDate: '2026-10-06',
      verified: true,
    },
  ],
};
