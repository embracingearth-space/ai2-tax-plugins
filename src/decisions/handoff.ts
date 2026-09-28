/**
 * Website → app handoff, version 1 — ai2fin.com
 *
 * The website's "Weigh it up" tools can open the same figures in the app. The
 * figures travel in the app URL's hash query (`#/properties?weigh=<token>`),
 * so this codec is the contract between the two, and both vendor it from here:
 *
 *   token   = '1.' + base64url(JSON)            at most 1,200 characters
 *   payload = { v: 1, t: 'space' | 'moving' | 'someone', mr,
 *               s: { sh, oc, hr, y, g, co, os },  // space   (see INPUT_SPECS.space)
 *               m: { y, r, og, ng },              // moving  (r: 1 = the old home will be rented)
 *               o: { wk, rm, cm, wh, hc, y, g } } // someone
 *
 * NO FREE TEXT AND NO PII. Only numbers, the `t` tag and the version travel;
 * income is turned into a marginal rate on the website. Names, addresses and
 * notes never enter a payload, so a decoder need not sanitise text.
 *
 * STRICT. Every number is checked against the same bounds as the decisions'
 * input guards (via INPUT_SPECS); amounts are also capped at
 * HANDOFF_MAX_AMOUNT, because a URL is not the place for a 13-digit figure.
 * Unknown keys are dropped, a field that fails its bounds is dropped and
 * reported, and only the section matching `t` is kept. `decode` never throws:
 * a malformed token (bad prefix, base64, JSON, version or tag, or too long)
 * is `{ ok: false, problems }`.
 */

import { INPUT_SPECS, withinSpec, type DecisionKind, type InputSpec } from './inputSpecs';
import { DecisionInputError, type DecisionInputProblem } from './inputGuards';

export const HANDOFF_VERSION = 1;
export const HANDOFF_MAX_LENGTH = 1200;
/** No amount in a handoff exceeds this — a sanity cap for a URL, above anything a home decision needs. */
export const HANDOFF_MAX_AMOUNT = 1_000_000_000;
const PREFIX = `${HANDOFF_VERSION}.`;

export interface HandoffSpace { sh?: number; oc?: number; hr?: number; y?: number; g?: number; co?: number; os?: number }
export interface HandoffMoving { y?: number; r?: 0 | 1; og?: number; ng?: number }
export interface HandoffSomeone { wk?: number; rm?: number; cm?: number; wh?: number; hc?: number; y?: number; g?: number }

export interface HandoffV1 {
  v: 1;
  t: DecisionKind;
  /** Marginal rate, percent. */
  mr?: number;
  s?: HandoffSpace;
  m?: HandoffMoving;
  o?: HandoffSomeone;
}

export type DecodeResult =
  | { ok: true; payload: HandoffV1; problems: DecisionInputProblem[] }
  | { ok: false; problems: DecisionInputProblem[] };

const SECTION: Record<DecisionKind, 's' | 'm' | 'o'> = { space: 's', moving: 'm', someone: 'o' };
const KINDS = Object.keys(SECTION) as DecisionKind[];

/** handoffKey → spec, per section (mr is top level). */
function sectionSpecs(kind: DecisionKind): Map<string, InputSpec> {
  const m = new Map<string, InputSpec>();
  for (const spec of Object.values(INPUT_SPECS[kind])) if (spec.handoffKey !== 'mr') m.set(spec.handoffKey, spec);
  return m;
}
const MR_SPEC = INPUT_SPECS.space.marginalRatePct;

const isMoney = (spec: InputSpec) => spec.unit.startsWith('money');

/** The handoff test for one value: the spec's bounds, the amount cap, and `r` as 0 or 1. */
function valid(spec: InputSpec, value: unknown): boolean {
  if (spec.unit === 'boolean') return value === 0 || value === 1;
  if (!withinSpec(spec, value)) return false;
  return !(isMoney(spec) && (value as number) > HANDOFF_MAX_AMOUNT);
}

const describe = (spec: InputSpec) =>
  spec.unit === 'boolean'
    ? 'expected 0 or 1'
    : `expected ${spec.integer ? 'a whole number' : 'a number'} from ${spec.min ?? '-∞'} to ${isMoney(spec) ? Math.min(spec.max ?? Infinity, HANDOFF_MAX_AMOUNT) : spec.max ?? '∞'}`;

/**
 * Clean a parsed object into a payload: keep known keys with valid values, drop the rest, report each drop.
 * Returns null (with problems) when the envelope itself is not a v1 payload.
 */
function clean(raw: unknown): { payload: HandoffV1 | null; problems: DecisionInputProblem[] } {
  const problems: DecisionInputProblem[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { payload: null, problems: [{ field: 'payload', message: 'expected an object' }] };
  const r = raw as Record<string, unknown>;
  if (r.v !== HANDOFF_VERSION) return { payload: null, problems: [{ field: 'v', message: `expected version ${HANDOFF_VERSION}, got ${JSON.stringify(r.v)}` }] };
  if (typeof r.t !== 'string' || !KINDS.includes(r.t as DecisionKind)) {
    return { payload: null, problems: [{ field: 't', message: `expected one of ${KINDS.join(', ')}, got ${JSON.stringify(r.t)}` }] };
  }
  const t = r.t as DecisionKind;
  const payload: HandoffV1 = { v: 1, t };
  if (r.mr !== undefined) {
    if (valid(MR_SPEC, r.mr)) payload.mr = r.mr as number;
    else problems.push({ field: 'mr', message: describe(MR_SPEC) });
  }
  const key = SECTION[t];
  const section = r[key];
  if (section !== undefined) {
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      problems.push({ field: key, message: 'expected an object' });
    } else {
      const specs = sectionSpecs(t);
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(section as Record<string, unknown>)) {
        const spec = specs.get(k);
        if (!spec) continue; // unknown keys are dropped silently
        if (valid(spec, v)) out[k] = v as number;
        else problems.push({ field: `${key}.${k}`, message: describe(spec) });
      }
      (payload as unknown as Record<string, unknown>)[key] = out;
    }
  }
  return { payload, problems };
}

/** Every problem with a payload, without changing it. Empty when it can be encoded as it stands. */
export function problemsOf(payload: unknown): DecisionInputProblem[] {
  const { payload: cleaned, problems } = clean(payload);
  if (!cleaned) return problems;
  // Keys the cleaner would drop silently are problems for a sender: nothing it did not mean to send may travel.
  const raw = payload as Record<string, unknown>;
  const allowedTop = new Set(['v', 't', 'mr', SECTION[cleaned.t]]);
  for (const k of Object.keys(raw)) if (!allowedTop.has(k)) problems.push({ field: k, message: `not part of a v1 '${cleaned.t}' payload` });
  const section = raw[SECTION[cleaned.t]];
  if (section && typeof section === 'object' && !Array.isArray(section)) {
    const specs = sectionSpecs(cleaned.t);
    for (const k of Object.keys(section)) if (!specs.has(k)) problems.push({ field: `${SECTION[cleaned.t]}.${k}`, message: 'unknown key' });
  }
  return problems;
}

// ─── base64url, ASCII only (the JSON here is ASCII: numbers and fixed keys) ──

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const INDEX = new Map([...ALPHABET].map((c, i) => [c, i]));

function toBase64Url(ascii: string): string {
  let out = '';
  for (let i = 0; i < ascii.length; i += 3) {
    const [a, b, c] = [ascii.charCodeAt(i), ascii.charCodeAt(i + 1), ascii.charCodeAt(i + 2)];
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < ascii.length) out += ALPHABET[(n >> 6) & 63];
    if (i + 2 < ascii.length) out += ALPHABET[n & 63];
  }
  return out;
}

function fromBase64Url(s: string): string | null {
  if (s.length % 4 === 1) return null;
  let out = '';
  for (let i = 0; i < s.length; i += 4) {
    const chunk = s.slice(i, i + 4);
    const v = [...chunk].map((c) => INDEX.get(c));
    if (v.some((x) => x === undefined)) return null;
    const [a, b, c = 0, d = 0] = v as number[];
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    out += String.fromCharCode((n >> 16) & 255);
    if (chunk.length > 2) out += String.fromCharCode((n >> 8) & 255);
    if (chunk.length > 3) out += String.fromCharCode(n & 255);
  }
  return out;
}

/**
 * Encode a payload as a handoff token. Throws DecisionInputError when the payload has any problem (including
 * keys it should not carry) or the token would exceed HANDOFF_MAX_LENGTH — a sender must know, not silently lose a field.
 */
export function encodeHandoff(payload: HandoffV1): string {
  const problems = problemsOf(payload);
  if (problems.length) throw new DecisionInputError(problems);
  const token = PREFIX + toBase64Url(JSON.stringify(clean(payload).payload));
  if (token.length > HANDOFF_MAX_LENGTH) {
    throw new DecisionInputError([{ field: 'payload', message: `token is ${token.length} characters, over ${HANDOFF_MAX_LENGTH}` }]);
  }
  return token;
}

/** Decode a handoff token. Never throws. Fields that fail their bounds are dropped and listed in `problems`. */
export function decodeHandoff(token: unknown): DecodeResult {
  try {
    if (typeof token !== 'string') return { ok: false, problems: [{ field: 'token', message: 'expected a string' }] };
    if (token.length > HANDOFF_MAX_LENGTH) return { ok: false, problems: [{ field: 'token', message: `longer than ${HANDOFF_MAX_LENGTH} characters` }] };
    if (!token.startsWith(PREFIX)) return { ok: false, problems: [{ field: 'token', message: `expected a version ${HANDOFF_VERSION} token ('${PREFIX}…')` }] };
    const json = fromBase64Url(token.slice(PREFIX.length));
    if (json === null) return { ok: false, problems: [{ field: 'token', message: 'not base64url' }] };
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return { ok: false, problems: [{ field: 'token', message: 'not JSON' }] };
    }
    const { payload, problems } = clean(raw);
    return payload ? { ok: true, payload, problems } : { ok: false, problems };
  } catch (e) {
    // Belt and braces: nothing above should throw, and a decoder on a URL must not.
    return { ok: false, problems: [{ field: 'token', message: `could not be read (${(e as Error)?.message ?? 'unknown error'})` }] };
  }
}

/** The payload's section as scenario fields (./scenarioFromYears names), for pre-filling a form. */
export function handoffFields(payload: HandoffV1): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  if (payload.mr !== undefined) out.marginalRatePct = payload.mr;
  const section = (payload as unknown as Record<string, Record<string, number> | undefined>)[SECTION[payload.t]] ?? {};
  for (const [field, spec] of Object.entries(INPUT_SPECS[payload.t])) {
    const v = section[spec.handoffKey];
    if (v !== undefined && spec.handoffKey !== 'mr') out[field] = spec.unit === 'boolean' ? v === 1 : v;
  }
  return out;
}
