import { generationFingerprint } from '../modules/scheduler/scheduler.snapshot';

test('equivalent maps, sets and JSON properties have the same fingerprint', () => {
  const a = {
    settings: { daily: 4, weekly: 20 },
    availability: new Map([
      ['a', new Set(['mon|p1', 'tue|p1'])],
      ['b', new Set<string>()],
    ]),
  };
  const b = {
    availability: new Map([
      ['b', new Set<string>()],
      ['a', new Set(['tue|p1', 'mon|p1'])],
    ]),
    settings: { weekly: 20, daily: 4 },
  };
  expect(generationFingerprint(a)).toBe(generationFingerprint(b));
});

test('changed availability and workload map contents are detected', () => {
  expect(generationFingerprint(new Map([['teacher', new Set(['mon|p1'])]]))).not.toBe(
    generationFingerprint(new Map([['teacher', new Set<string>()]]))
  );
  expect(generationFingerprint(new Map([['teacher', 20]]))).not.toBe(
    generationFingerprint(new Map([['teacher', 21]]))
  );
});

test('semester date changes and ordered assignment changes are detected', () => {
  expect(generationFingerprint({ date: new Date('2026-07-01') })).not.toBe(
    generationFingerprint({ date: new Date('2026-08-01') })
  );
  expect(generationFingerprint(['faculty-a', 'faculty-b'])).not.toBe(
    generationFingerprint(['faculty-b', 'faculty-a'])
  );
});

test('cloned context maps and sets retain their contents in the fingerprint', () => {
  const original = {
    limits: new Map([['teacher', 20]]),
    availability: new Map([['teacher', new Set(['mon|p1'])]]),
  };
  const cloned = structuredClone(original);
  expect(generationFingerprint(cloned)).toBe(generationFingerprint(original));
  cloned.limits.set('teacher', 10);
  expect(generationFingerprint(cloned)).not.toBe(generationFingerprint(original));
  cloned.limits.set('teacher', 20);
  cloned.availability.get('teacher')!.clear();
  expect(generationFingerprint(cloned)).not.toBe(generationFingerprint(original));
});
