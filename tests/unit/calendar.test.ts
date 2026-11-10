import { describe, expect, it } from 'vitest';
import { GOLDEN_MOMENTS_ADDRESS, GRAND_PARIS_ADDRESS, defaultContent } from '../../src/content/defaults';
import { blankEvent } from '../../src/content/factory';
import { buildIcs, eventTiming, googleCalendarUrl, icsFileName } from '../../src/lib/calendar';
import { directionsUrl } from '../../src/lib/links';

const [sagai, sangeet, wedding] = defaultContent.events;
const NAMES = 'Shaifali Singh & Nitin Kaushik';
const SITE = 'https://example.com/';

describe('event timing', () => {
  it('starts at the earliest time in the schedule and ends an hour after the last', () => {
    const timing = eventTiming(wedding);
    expect(timing.allDay).toBe(false);
    expect(timing.startTime).toBe('10:00');
    expect(new Date(timing.startEpoch!).toISOString()).toBe('2026-12-05T04:30:00.000Z'); // 10:00 AM IST
    expect(new Date(timing.endEpoch!).toISOString()).toBe('2026-12-05T12:30:00.000Z'); // 6:00 PM IST, one hour after Vidai
  });

  it('handles the Sagai', () => {
    const timing = eventTiming(sagai);
    expect(new Date(timing.startEpoch!).toISOString()).toBe('2026-11-21T05:30:00.000Z'); // 11:00 AM IST
    expect(new Date(timing.endEpoch!).toISOString()).toBe('2026-11-21T08:30:00.000Z'); // 2:00 PM IST
  });

  it('treats an event without timings as a whole day, inventing nothing', () => {
    expect(eventTiming(sangeet)).toEqual({ allDay: true, startEpoch: null, endEpoch: null, startTime: '' });
  });

  it('uses the optional end time when it is given', () => {
    const timing = eventTiming({ ...wedding, endTime: '21:30' });
    expect(new Date(timing.endEpoch!).toISOString()).toBe('2026-12-05T16:00:00.000Z');
  });

  it('copes with a schedule entered out of order and with blank rows', () => {
    const event = { ...blankEvent(), date: '2026-12-01', schedule: [
      { id: 'a', time: '19:00', label: 'Dinner' },
      { id: 'b', time: '', label: 'To be decided' },
      { id: 'c', time: '17:30', label: 'Welcome' },
    ] };
    expect(eventTiming(event).startTime).toBe('17:30');
  });
});

describe('Google Calendar link', () => {
  it('carries the right moment in UTC for a timed event', () => {
    const url = new URL(googleCalendarUrl(wedding, NAMES, SITE));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261205T043000Z/20261205T123000Z');
    expect(url.searchParams.get('ctz')).toBe('Asia/Kolkata');
    expect(url.searchParams.get('text')).toBe('Wedding | Shaifali Singh & Nitin Kaushik');
    expect(url.searchParams.get('location')).toBe(`Golden Moments Banquet, ${GOLDEN_MOMENTS_ADDRESS}`);
    expect(url.searchParams.get('details')).toContain('11:30 AM - Jaimala');
  });

  it('is an all-day entry when the timing is not confirmed', () => {
    const url = new URL(googleCalendarUrl(sangeet, NAMES, SITE));
    expect(url.searchParams.get('dates')).toBe('20261203/20261204');
    expect(url.searchParams.get('details')).toContain('Timing to be announced');
  });

  it('is not offered for an event without a valid date', () => {
    expect(googleCalendarUrl({ ...sangeet, date: '' }, NAMES, SITE)).toBe('');
  });
});

describe('.ics calendar file', () => {
  const ics = buildIcs(wedding, NAMES, SITE, Date.parse('2026-11-06T00:00:00Z'));

  it('is a well-formed calendar with one event', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('DTSTART:20261205T043000Z');
    expect(ics).toContain('DTEND:20261205T123000Z');
    expect(ics).toContain('DTSTAMP:20261106T000000Z');
    expect(ics).toContain('SUMMARY:Wedding | Shaifali Singh & Nitin Kaushik');
  });

  it('escapes commas and keeps every line within 75 bytes', () => {
    expect(ics).toContain('LOCATION:Golden Moments Banquet\\, Convention Hall\\, Sector 16A');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('unfolds back to the full description', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('10:00 AM - Baraat Welcome\\n11:30 AM - Jaimala\\n1:00 PM - Lunch\\n1:00 PM - Phere\\n5:00 PM - Vidai');
  });

  it('uses whole-day dates when there are no timings', () => {
    const allDay = buildIcs(sangeet, NAMES, SITE);
    expect(allDay).toContain('DTSTART;VALUE=DATE:20261203');
    expect(allDay).toContain('DTEND;VALUE=DATE:20261204');
  });

  it('gets a tidy file name', () => {
    expect(icsFileName(wedding)).toBe('wedding.ics');
    expect(icsFileName({ ...wedding, name: 'Haldi & Mehendi!' })).toBe('haldi-mehendi.ics');
    expect(icsFileName({ ...wedding, name: 'शुभ विवाह' })).toBe('event.ics');
  });
});

describe('venues', () => {
  it('keeps the two venue addresses on the right events', () => {
    expect(sagai.venueName).toBe('The Grand Paris Banquets');
    expect(sagai.address).toBe(GRAND_PARIS_ADDRESS);
    expect(sangeet.address).toBe(GRAND_PARIS_ADDRESS);
    expect(wedding.venueName).toBe('Golden Moments Banquet');
    expect(wedding.address).toBe(GOLDEN_MOMENTS_ADDRESS);
    expect(wedding.address).not.toContain('Sahibabad');
    expect(wedding.mapsUrl).not.toContain('Paris');
    expect(sagai.mapsUrl).not.toContain('Golden');
  });

  it('builds directions from the venue and address when no link is given', () => {
    const url = new URL(directionsUrl({ mapsUrl: '', venueName: 'Golden Moments Banquet', address: GOLDEN_MOMENTS_ADDRESS }));
    expect(url.hostname).toBe('www.google.com');
    expect(url.searchParams.get('destination')).toBe(`Golden Moments Banquet, ${GOLDEN_MOMENTS_ADDRESS}`);
  });

  it('prefers a link pasted in the dashboard, and ignores unsafe ones', () => {
    expect(directionsUrl({ mapsUrl: 'https://maps.app.goo.gl/abc', venueName: 'X', address: 'Y' })).toBe('https://maps.app.goo.gl/abc');
    expect(directionsUrl({ mapsUrl: 'javascript:alert(1)', venueName: 'X', address: 'Y' })).toContain('google.com/maps/dir');
    expect(directionsUrl({ mapsUrl: '', venueName: '', address: '' })).toBe('');
  });
});
