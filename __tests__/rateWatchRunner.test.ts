/**
 * Runner-level guard: the rate-watch runner must analyse the ledger and the
 * schedules against ONE timestamp. The two analyses straddle an awaited external
 * check, so a clock that rolls past local midnight during that await would
 * otherwise yield findings for two different days under a single report title.
 * embracingearth.space
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

const analyzeLedger = jest.fn();
const analyzeSchedules = jest.fn();

// The runner requires the BUILT module; mock it virtually so the suite does not
// depend on `dist/` existing.
jest.mock(
  '../dist/rateWatch',
  () => ({
    analyzeLedger: (...a: unknown[]) => analyzeLedger(...a),
    analyzeSchedules: (...a: unknown[]) => analyzeSchedules(...a),
    hasActionableFindings: () => false,
    hasActionableScheduleFindings: () => false,
  }),
  { virtual: true },
);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const runner = require('../scripts/rate-watch/run.cjs');

const emptyFindings = (asOf: string) => ({
  asOf,
  coverageGaps: [],
  recentlyActivated: [],
  upcomingChanges: [],
  staleCitations: [],
  unverified: [],
  reviewChecklist: [],
});
const emptySchedules = (asOf: string) => ({
  asOf,
  unverified: [],
  staleCitations: [],
  rollovers: [],
  recentlyActivated: [],
  upcoming: [],
  undated: [],
});

describe('rate-watch runner — single asOf', () => {
  const savedOutput = process.env.GITHUB_OUTPUT;
  let writeSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    delete process.env.GITHUB_OUTPUT;
    process.env.MODE = 'weekly';
    analyzeLedger.mockReset().mockImplementation((d: Date) => emptyFindings(d.toISOString().slice(0, 10)));
    analyzeSchedules.mockReset().mockImplementation((d: Date) => emptySchedules(d.toISOString().slice(0, 10)));
    writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    writeSpy.mockRestore();
    logSpy.mockRestore();
    delete process.env.MODE;
    if (savedOutput !== undefined) process.env.GITHUB_OUTPUT = savedOutput;
  });

  it('passes the same Date to analyzeLedger and analyzeSchedules even when the clock rolls over during the external check', async () => {
    // Clock starts one second before local midnight and is advanced past it while
    // the external check is awaited — the exact window the review flagged.
    let clock = new Date(2026, 5, 30, 23, 59, 59); // 2026-06-30 23:59:59 local
    const now = jest.fn(() => clock);
    const fetchExternal = jest.fn(async () => {
      clock = new Date(2026, 6, 1, 0, 0, 1); // 2026-07-01 00:00:01 local
      return { available: false, reason: 'stub' };
    });

    await runner.main({ now, fetchExternal });

    expect(now).toHaveBeenCalledTimes(1);
    expect(analyzeLedger).toHaveBeenCalledTimes(1);
    expect(analyzeSchedules).toHaveBeenCalledTimes(1);
    const ledgerDate = analyzeLedger.mock.calls[0][0] as Date;
    const scheduleDate = analyzeSchedules.mock.calls[0][0] as Date;
    expect(ledgerDate).toBe(scheduleDate); // identical object, captured once
    expect(ledgerDate.getTime()).toBe(new Date(2026, 5, 30, 23, 59, 59).getTime());
    expect(scheduleDate.getTime()).not.toBe(clock.getTime()); // rollover did not leak in
    expect(fetchExternal).toHaveBeenCalledTimes(1);
  });

  it('reports findings.asOf and the schedule asOf as the same day', async () => {
    const fixed = new Date(2026, 0, 3, 12, 0, 0);
    await runner.main({ now: () => fixed, fetchExternal: async () => ({ available: false, reason: 'stub' }) });
    const ledgerAsOf = analyzeLedger.mock.results[0].value.asOf;
    const scheduleAsOf = analyzeSchedules.mock.results[0].value.asOf;
    expect(ledgerAsOf).toBe(scheduleAsOf);
    const report = writeSpy.mock.calls[0][1] as string;
    expect(report).toContain(`# 🪙 Rate Watch — ${ledgerAsOf} (weekly)`);
  });

  it('resolveMode derives the quarterly window from the supplied timestamp', () => {
    delete process.env.MODE;
    expect(runner.resolveMode(new Date(Date.UTC(2026, 0, 3)))).toBe('quarterly');
    expect(runner.resolveMode(new Date(Date.UTC(2026, 0, 9)))).toBe('weekly');
    expect(runner.resolveMode(new Date(Date.UTC(2026, 1, 2)))).toBe('weekly');
  });
});
