import type { WeddingEvent } from '../content/types';
import { formatTime, istToEpoch, nextDay, parseDate, parseTime } from './dates';
import { directionsUrl } from './links';

export interface EventTiming {
  /** True when the event has no confirmed time and is shown as an all-day entry. */
  allDay: boolean;
  startEpoch: number | null;
  endEpoch: number | null;
  /** Earliest "HH:mm" in the schedule, or an empty string. */
  startTime: string;
}

function minutesOf(time: string): number | null {
  const t = parseTime(time);
  return t ? t.hour * 60 + t.minute : null;
}

function toTime(totalMinutes: number): string {
  const capped = Math.min(totalMinutes, 23 * 60 + 59);
  return `${String(Math.floor(capped / 60)).padStart(2, '0')}:${String(capped % 60).padStart(2, '0')}`;
}

/**
 * Works out when an event starts and ends for calendar entries.
 * The start is the earliest time in the schedule. The end is the optional
 * "calendar end time"; without one, it is one hour after the last item in the
 * schedule (three hours after the start when there is a single item).
 * An event with no timings becomes an all-day entry, so nothing is invented.
 */
export function eventTiming(event: WeddingEvent): EventTiming {
  const times = event.schedule
    .map((item) => minutesOf(item.time))
    .filter((m): m is number => m !== null)
    .sort((a, b) => a - b);

  if (!parseDate(event.date) || times.length === 0) {
    return { allDay: true, startEpoch: null, endEpoch: null, startTime: '' };
  }

  const start = times[0];
  const last = times[times.length - 1];
  const explicitEnd = minutesOf(event.endTime);
  let end = explicitEnd !== null && explicitEnd > start ? explicitEnd : last > start ? last + 60 : start + 180;
  end = Math.min(end, 23 * 60 + 59);

  return {
    allDay: false,
    startEpoch: istToEpoch(event.date, toTime(start)),
    endEpoch: istToEpoch(event.date, toTime(end)),
    startTime: toTime(start),
  };
}

function compactDate(date: string): string {
  return date.replace(/-/g, '');
}

function utcStamp(epoch: number): string {
  return new Date(epoch).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function eventTitle(event: WeddingEvent, coupleNames: string): string {
  return coupleNames ? `${event.name} | ${coupleNames}` : event.name;
}

function eventLocation(event: WeddingEvent): string {
  return [event.venueName, event.address].filter(Boolean).join(', ');
}

function eventDetails(event: WeddingEvent, siteUrl: string): string {
  const lines: string[] = [];
  if (event.subtitle) lines.push(event.subtitle);
  if (event.schedule.length > 0) {
    lines.push('', 'Schedule:');
    for (const item of event.schedule) {
      const time = formatTime(item.time);
      lines.push(time ? `${time} - ${item.label}` : item.label);
    }
  } else if (event.timeNote) {
    lines.push('', event.timeNote);
  }
  if (event.dressCode) lines.push('', `${event.dressCodeLabel || 'Dress code'}: ${event.dressCode}`);
  const maps = directionsUrl(event);
  if (maps) lines.push('', `Directions: ${maps}`);
  if (siteUrl) lines.push('', `Invitation: ${siteUrl}`);
  return lines.join('\n').trim();
}

/** A link that opens Google Calendar with the event already filled in. */
export function googleCalendarUrl(event: WeddingEvent, coupleNames: string, siteUrl: string): string {
  if (!parseDate(event.date)) return '';
  const timing = eventTiming(event);
  const dates =
    timing.allDay || timing.startEpoch === null || timing.endEpoch === null
      ? `${compactDate(event.date)}/${compactDate(nextDay(event.date))}`
      : `${utcStamp(timing.startEpoch)}/${utcStamp(timing.endEpoch)}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventTitle(event, coupleNames),
    dates,
    details: eventDetails(event, siteUrl),
    location: eventLocation(event),
    ctz: 'Asia/Kolkata',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a line to at most 75 bytes, as the iCalendar standard requires. */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with one space
    if (currentBytes + size > limit) {
      out.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  if (current) out.push(current);
  return out.join('\r\n ');
}

/** The text of a standard .ics calendar file for one event. */
export function buildIcs(event: WeddingEvent, coupleNames: string, siteUrl: string, now: number = Date.now()): string {
  if (!parseDate(event.date)) return '';
  const timing = eventTiming(event);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shaifali and Nitin//Wedding Invitation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}-${compactDate(event.date)}@wedding-invitation`,
    `DTSTAMP:${utcStamp(now)}`,
  ];
  if (timing.allDay || timing.startEpoch === null || timing.endEpoch === null) {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(nextDay(event.date))}`);
  } else {
    lines.push(`DTSTART:${utcStamp(timing.startEpoch)}`);
    lines.push(`DTEND:${utcStamp(timing.endEpoch)}`);
  }
  lines.push(`SUMMARY:${escapeIcsText(eventTitle(event, coupleNames))}`);
  const location = eventLocation(event);
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
  const details = eventDetails(event, siteUrl);
  if (details) lines.push(`DESCRIPTION:${escapeIcsText(details)}`);
  if (siteUrl) lines.push(`URL:${siteUrl}`);
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(eventTitle(event, coupleNames))}`,
    'TRIGGER:-P1D',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

export function icsFileName(event: WeddingEvent): string {
  const slug = event.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'event'}.ics`;
}

/** Saves the .ics file on the guest's phone or computer. */
export function downloadIcs(event: WeddingEvent, coupleNames: string, siteUrl: string): boolean {
  const text = buildIcs(event, coupleNames, siteUrl);
  if (!text) return false;
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = icsFileName(event);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}
