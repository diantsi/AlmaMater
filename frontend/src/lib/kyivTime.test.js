// BUG-01 — a Kyiv `datetime-local` value must name a real Kyiv wall time (lib/kyivTime.js; api-contracts.md §2)
// Transition dates follow the Europe/Kyiv tzdata rules: 2027-03-28 03:00 → 04:00, 2027-10-31 04:00 → 03:00
import { describe, expect, it } from 'vitest';
import { isoToKyivLocal, kyivLocalToIso } from './kyivTime.js';

describe('BUG-01 kyivLocalToIso rejects times that do not exist in Kyiv', () => {
  it.each(['2027-03-28T03:00', '2027-03-28T03:30'])('rejects %s, skipped by the spring transition', (local) => {
    expect(kyivLocalToIso(local)).toBeNull();
  });

  it.each(['2027-02-29T10:00', '2027-04-31T10:00'])('rejects the nonexistent calendar date %s', (local) => {
    expect(kyivLocalToIso(local)).toBeNull();
  });

  it.each(['2027-01-01T25:00', '2027-01-01T10:60'])('rejects the out-of-range time %s', (local) => {
    expect(kyivLocalToIso(local)).toBeNull();
  });
});

describe('BUG-01 kyivLocalToIso keeps every valid Kyiv time', () => {
  it.each([
    ['2027-03-28T02:59', '2027-03-28T02:59:00+02:00'], // last minute before the spring transition
    ['2027-03-28T04:00', '2027-03-28T04:00:00+03:00'], // first minute after it
    ['2028-02-29T10:00', '2028-02-29T10:00:00+02:00'], // leap day
    ['2027-01-15T18:00', '2027-01-15T18:00:00+02:00'], // winter
    ['2027-07-10T18:30', '2027-07-10T18:30:00+03:00'], // summer
    ['2027-12-31T23:59', '2027-12-31T23:59:00+02:00'], // last minute of the year
  ])('converts %s to %s', (local, iso) => {
    expect(kyivLocalToIso(local)).toBe(iso);
  });

  it('converts to the right instant, not only the right text', () => {
    expect(Date.parse(kyivLocalToIso('2027-07-10T18:30'))).toBe(Date.UTC(2027, 6, 10, 15, 30));
    expect(Date.parse(kyivLocalToIso('2027-01-15T18:00'))).toBe(Date.UTC(2027, 0, 15, 16, 0));
  });

  it.each(['2027-03-28T02:59', '2027-03-28T04:00', '2028-02-29T10:00', '2027-01-15T18:00', '2027-07-10T18:30'])(
    'round-trips %s unchanged through isoToKyivLocal',
    (local) => {
      expect(isoToKyivLocal(kyivLocalToIso(local))).toBe(local);
    },
  );

  it('keeps the existing choice for the repeated autumn hour: its later (winter-time) occurrence', () => {
    expect(kyivLocalToIso('2027-10-31T02:59')).toBe('2027-10-31T02:59:00+03:00');
    expect(kyivLocalToIso('2027-10-31T03:30')).toBe('2027-10-31T03:30:00+02:00');
    expect(isoToKyivLocal(kyivLocalToIso('2027-10-31T03:30'))).toBe('2027-10-31T03:30');
  });
});
