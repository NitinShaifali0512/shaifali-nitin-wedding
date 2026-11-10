import { describe, expect, it } from 'vitest';
import {
  countdownTo,
  formatDate,
  formatLongDate,
  formatTime,
  formatTimeShort,
  formatTimestamp,
  istDateTimeToEpoch,
  istToEpoch,
  nextDay,
  parseDate,
  parseTime,
  todayInIndia,
  weekdayName,
} from '../../src/lib/dates';

describe('the three wedding dates', () => {
  it('fall on the days printed on the card', () => {
    expect(weekdayName('2026-11-21')).toBe('Saturday'); // Sagai
    expect(weekdayName('2026-12-03')).toBe('Thursday'); // Sangeet
    expect(weekdayName('2026-12-05')).toBe('Saturday'); // Wedding
  });

  it('are written day first, the Indian way', () => {
    expect(formatDate('2026-12-05')).toBe('5 December 2026');
    expect(formatLongDate('2026-11-21')).toBe('Saturday, 21 November 2026');
    expect(formatLongDate('2026-12-03')).toBe('Thursday, 3 December 2026');
  });
});

describe('parsing', () => {
  it('rejects dates that do not exist', () => {
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2026-13-01')).toBeNull();
    expect(parseDate('5 December')).toBeNull();
    expect(parseDate('')).toBeNull();
    expect(formatLongDate('not a date')).toBe('');
  });

  it('accepts a leap day only in a leap year', () => {
    expect(parseDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseDate('2026-02-29')).toBeNull();
  });

  it('rejects times that do not exist', () => {
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('10:60')).toBeNull();
    expect(parseTime('ten')).toBeNull();
    expect(parseTime('9:05')).toEqual({ hour: 9, minute: 5 });
  });
});

describe('times', () => {
  it('are shown on the 12-hour clock', () => {
    expect(formatTime('10:00')).toBe('10:00 AM');
    expect(formatTime('11:30')).toBe('11:30 AM');
    expect(formatTime('12:30')).toBe('12:30 PM');
    expect(formatTime('13:00')).toBe('1:00 PM');
    expect(formatTime('17:00')).toBe('5:00 PM');
    expect(formatTime('00:15')).toBe('12:15 AM');
    expect(formatTime('')).toBe('');
  });

  it('have a compact form for the date lockup', () => {
    expect(formatTimeShort('10:00')).toBe('10 AM');
    expect(formatTimeShort('11:00')).toBe('11 AM');
    expect(formatTimeShort('12:30')).toBe('12:30 PM');
  });
});

describe('India Standard Time', () => {
  it('is five and a half hours ahead of UTC', () => {
    // 10:00 AM on 5 December 2026 in India is 04:30 UTC.
    expect(new Date(istToEpoch('2026-12-05', '10:00')!).toISOString()).toBe('2026-12-05T04:30:00.000Z');
    // Just after midnight in India is still the previous day in UTC.
    expect(new Date(istToEpoch('2026-12-05', '00:15')!).toISOString()).toBe('2026-12-04T18:45:00.000Z');
  });

  it('reads the countdown target as India time', () => {
    expect(new Date(istDateTimeToEpoch('2026-12-05T10:00')!).toISOString()).toBe('2026-12-05T04:30:00.000Z');
    expect(istDateTimeToEpoch('')).toBeNull();
    expect(istDateTimeToEpoch('soon')).toBeNull();
  });

  it('knows today in India even when UTC is on the previous day', () => {
    expect(todayInIndia(Date.parse('2026-12-04T19:00:00Z'))).toBe('2026-12-05');
    expect(todayInIndia(Date.parse('2026-12-04T18:00:00Z'))).toBe('2026-12-04');
  });

  it('formats database timestamps in India time', () => {
    const text = formatTimestamp('2026-11-06T10:30:00Z');
    expect(text).toContain('6 Nov 2026');
    expect(text).toMatch(/4:00\s?pm/i);
  });
});

describe('the next day', () => {
  it('crosses month and year ends', () => {
    expect(nextDay('2026-12-03')).toBe('2026-12-04');
    expect(nextDay('2026-11-30')).toBe('2026-12-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
  });
});

describe('countdown', () => {
  const target = istDateTimeToEpoch('2026-12-05T10:00')!;

  it('counts days, hours, minutes and seconds', () => {
    const now = Date.parse('2026-11-06T04:30:00Z'); // 10:00 AM in India, 29 days before
    expect(countdownTo(target, now)).toEqual({ done: false, days: 29, hours: 0, minutes: 0, seconds: 0 });
    expect(countdownTo(target, now + 1000)).toEqual({ done: false, days: 28, hours: 23, minutes: 59, seconds: 59 });
  });

  it('finishes exactly at the moment and never goes negative', () => {
    expect(countdownTo(target, target - 1000)).toEqual({ done: false, days: 0, hours: 0, minutes: 0, seconds: 1 });
    expect(countdownTo(target, target).done).toBe(true);
    expect(countdownTo(target, target + 86_400_000)).toEqual({ done: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
