/**
 * Reading a plugin's auto-populate mapping against a host's aggregates — ai2fin.com
 *
 * ONE function every host calls for every mapping row, so a field that sums
 * several aggregates (`aggregateKeys`) is read the same way on the statement
 * page, in an emailed statement and in tests. Indexing `aggregateKey` directly
 * still works for single-key rows but silently reads only the first key of a
 * multi-key row.
 */

import type { AggregationMapping, FieldValues, TaxFilingPlugin } from './types';

/** The keys a mapping row reads, in order. */
export function mappingKeys(m: AggregationMapping): readonly string[] {
  return m.aggregateKeys && m.aggregateKeys.length > 0 ? m.aggregateKeys : [m.aggregateKey];
}

/**
 * The value a mapping row resolves to, rounded to 2 dp, or undefined when the
 * host produced none of its keys. `transform` applies to the sum.
 */
export function resolveAggregateMapping(
  m: AggregationMapping,
  aggregates: Readonly<Record<string, number | null | undefined>>,
): number | undefined {
  let sum = 0;
  let found = false;
  for (const key of mappingKeys(m)) {
    const raw = aggregates[key];
    if (raw === undefined || raw === null || !Number.isFinite(Number(raw))) continue;
    sum += Number(raw);
    found = true;
  }
  if (!found) return undefined;
  const value = m.transform ? m.transform(sum) : sum;
  return Math.round(value * 100) / 100;
}

/** Every mapped field the aggregates can fill, keyed by field id. */
export function valuesFromAggregates(
  plugin: Pick<TaxFilingPlugin, 'getAutoPopulateMapping'>,
  aggregates: Readonly<Record<string, number | null | undefined>>,
): FieldValues {
  const values: FieldValues = {};
  for (const m of plugin.getAutoPopulateMapping()) {
    const v = resolveAggregateMapping(m, aggregates);
    if (v !== undefined) values[m.fieldId] = v;
  }
  return values;
}
