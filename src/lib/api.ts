import { normalizeContent } from '../content/normalize';
import type { RsvpInput, SiteContent } from '../content/types';
import { SUPABASE_KEY, SUPABASE_URL, backendConfigured } from './config';

/**
 * The small part of the backend that guests use: reading the published
 * content and sending an RSVP. It talks to Supabase's REST interface with
 * plain `fetch`, so guests do not have to download the full Supabase library.
 * The dashboard, which needs sign-in and uploads, uses the full library.
 */

export type ApiErrorKind = 'not-configured' | 'network' | 'closed' | 'busy' | 'invalid' | 'server';

export class ApiError extends Error {
  kind: ApiErrorKind;
  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'ApiError';
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    ...extra,
  };
}

async function request(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${SUPABASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError('network', 'The server could not be reached.');
  } finally {
    clearTimeout(timer);
  }
}

export interface PublishedContent {
  content: SiteContent;
  updatedAt: string;
}

/** Reads the published website content. Returns null when nothing has been published yet. */
export async function fetchPublishedContent(timeoutMs = 8000): Promise<PublishedContent | null> {
  if (!backendConfigured) throw new ApiError('not-configured', 'The website is not connected to a database yet.');
  const response = await request(
    '/rest/v1/site_content?id=eq.published&select=content,updated_at',
    { headers: headers({ Accept: 'application/json' }), cache: 'no-store' },
    timeoutMs,
  );
  if (!response.ok) throw new ApiError('server', `Content request failed (${response.status}).`);
  const rows = (await response.json()) as Array<{ content: unknown; updated_at: string }>;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return { content: normalizeContent(rows[0].content), updatedAt: rows[0].updated_at };
}

export const RSVP_LIMITS = {
  name: 120,
  message: 1000,
} as const;

/** Keeps digits and one leading plus sign: "+91 98975-32301" becomes "+919897532301". */
export function cleanMobile(value: string): string {
  const trimmed = (value || '').trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

export function validateRsvp(input: RsvpInput, maxGuests: number): Partial<Record<keyof RsvpInput, string>> {
  const errors: Partial<Record<keyof RsvpInput, string>> = {};
  const name = input.guestName.trim();
  if (name.length < 2) errors.guestName = 'Please enter your name.';
  else if (name.length > RSVP_LIMITS.name) errors.guestName = 'This name is too long.';

  const digits = cleanMobile(input.mobile).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) errors.mobile = 'Please enter a valid mobile number.';

  if (!Number.isInteger(input.guestCount) || input.guestCount < 1) errors.guestCount = 'Please tell us how many guests.';
  else if (input.guestCount > maxGuests) errors.guestCount = `Please enter ${maxGuests} guests or fewer.`;

  if (input.events.length === 0) errors.events = 'Please choose at least one event.';
  if (input.message.length > RSVP_LIMITS.message) errors.message = 'This message is too long.';
  return errors;
}

/** Saves one RSVP. Guests can add a response but can never read the list. */
export async function submitRsvp(input: RsvpInput): Promise<void> {
  if (!backendConfigured) throw new ApiError('not-configured', 'The website is not connected to a database yet.');
  const body = {
    guest_name: input.guestName.trim().slice(0, RSVP_LIMITS.name),
    mobile: cleanMobile(input.mobile),
    guest_count: input.guestCount,
    events: input.events.map((event) => ({ id: event.id, name: event.name.slice(0, 120) })),
    message: input.message.trim().slice(0, RSVP_LIMITS.message) || null,
  };
  const response = await request(
    '/rest/v1/rsvps',
    {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(body),
    },
    12_000,
  );
  if (response.ok) return;

  let code = '';
  let message = '';
  try {
    const payload = (await response.json()) as { code?: string; message?: string };
    code = payload.code ?? '';
    message = payload.message ?? '';
  } catch {
    /* the body was not JSON */
  }
  if (message.includes('rsvp_rate_limited') || response.status === 429) {
    throw new ApiError('busy', 'Too many responses were sent in a short time.');
  }
  if (code === '42501' || response.status === 401 || response.status === 403) {
    throw new ApiError('closed', 'RSVPs are not being accepted right now.');
  }
  if (code === '23514' || code === '22001' || code === '23502') {
    throw new ApiError('invalid', 'Some details were not accepted.');
  }
  throw new ApiError('server', `The RSVP could not be saved (${response.status}).`);
}
