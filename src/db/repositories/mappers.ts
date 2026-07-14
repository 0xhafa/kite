export function omitNullValues<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null));
}
