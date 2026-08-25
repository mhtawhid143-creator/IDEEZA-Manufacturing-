export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | readonly ClassValue[]
  | Readonly<Record<string, boolean | null | undefined>>;

/**
 * Joins class names. Small on purpose: the components never need Tailwind class
 * conflict resolution because variants are composed, not overridden.
 */
export const cn = (...values: readonly ClassValue[]): string => {
  const out: string[] = [];
  for (const value of values) {
    if (value === null || value === undefined || value === false || value === '') continue;
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value));
      continue;
    }
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested !== '') out.push(nested);
      continue;
    }
    for (const [key, enabled] of Object.entries(value)) {
      if (enabled === true) out.push(key);
    }
  }
  return out.join(' ');
};
