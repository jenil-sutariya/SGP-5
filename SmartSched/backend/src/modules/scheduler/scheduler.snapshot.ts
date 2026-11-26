import { createHash } from 'node:crypto';
import { types } from 'node:util';

// Compare all planning inputs again before saving. Maps and Sets must retain their
// contents; JSON.stringify alone would turn them into empty objects.
export function generationFingerprint(snapshot: unknown): string {
  const serialized = JSON.stringify(snapshot, (_key, value) => {
    if (types.isMap(value)) {
      return [...value.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)));
    }
    if (types.isSet(value)) return [...value].sort();
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    }
    return value;
  });
  return createHash('sha256').update(serialized).digest('hex');
}
