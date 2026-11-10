/**
 * Date and time helpers.
 *
 * Every date and time on the website is an India Standard Time (Asia/Kolkata)
 * wall-clock value, stored as plain text ("2026-12-05", "10:00"). India does
 * not observe daylight saving time, so IST is always UTC+05:30. Keeping the
 * values as text means a guest opening the invitation from another country
 * still sees the Indian date and time, exactly as printed on the card.
 */

export const IST_TIME_ZONE = 'Asia/Kolkata';
const IST_OFFSET_MINUTES = 330;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface DateParts {
  year: number;
  month: number; // 1 to 12
  day: number;
}

export interface TimeParts {
  hour: number; // 0 to 23
  minute: number;
}

export function parseDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function parseTime(value: string): TimeParts | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value || '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** "Saturday" */
export function weekdayName(date: string): string {
  const parts = parseDate(date);
  if (!parts) return '';
  return WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()];
}

/** "December" */
export function monthName(date: string): string {
  const parts = parseDate(date);
  return parts ? MONTHS[parts.month - 1] : '';
}

/** "5 December 2026", the day-first order used in India. */
export function formatDate(date: string): string {
  const parts = parseDate(date);
  if (!parts) return '';
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

/** "Saturday, 5 December 2026" */
export function formatLongDate(date: string): string {
  const parts = parseDate(date);
  if (!parts) return '';
  return `${weekdayName(date)}, ${formatDate(date)}`;
}

/** "10:00 AM" */
export function formatTime(time: string): string {
  const parts = parseTime(time);
  if (!parts) return '';
  const suffix = parts.hour >= 12 ? 'PM' : 'AM';
  const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  return `${hour12}:${String(parts.minute).padStart(2, '0')} ${suffix}`;
}

/** "10 AM" or "12:30 PM", the compact form used in the date lockup. */
export function formatTimeShort(time: string): string {
  const parts = parseTime(time);
  if (!parts) return '';
  const suffix = parts.hour >= 12 ? 'PM' : 'AM';
  const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  return parts.minute === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(parts.minute).padStart(2, '0')} ${suffix}`;
}

/** The exact instant of an IST date and time, in milliseconds since the Unix epoch. */
export function istToEpoch(date: string, time = '00:00'): number | null {
  const d = parseDate(date);
  const t = parseTime(time);
  if (!d || !t) return null;
  return Date.UTC(d.year, d.month - 1, d.day, t.hour, t.minute) - IST_OFFSET_MINUTES * 60_000;
}

/** Parses "YYYY-MM-DDTHH:mm" (IST) into epoch milliseconds. */
export function istDateTimeToEpoch(value: string): number | null {
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})/.exec((value || '').trim());
  if (!match) return null;
  return istToEpoch(match[1], match[2]);
}

/** "2026-12-06" for "2026-12-05": the next calendar day. */
export function nextDay(date: string): string {
  const d = parseDate(date);
  if (!d) return '';
  const next = new Date(Date.UTC(d.year, d.month - 1, d.day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

/** Today's date in India, as "YYYY-MM-DD". */
export function todayInIndia(now: number = Date.now()): string {
  const shifted = new Date(now + IST_OFFSET_MINUTES * 60_000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export interface CountdownParts {
  done: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdownTo(targetEpoch: number, now: number = Date.now()): CountdownParts {
  const remaining = Math.max(0, targetEpoch - now);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    done: remaining <= 0,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** Formats a database timestamp for the dashboard, in Indian format and time. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
