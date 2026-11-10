import type { WeddingEvent } from '../content/types';

/**
 * Returns the address unchanged when it is a normal web link, and an empty
 * string otherwise. This keeps "javascript:" and other unsafe schemes out of
 * links whose text comes from the dashboard.
 */
export function safeHttpUrl(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

/**
 * Resolves an image or audio reference from the content document.
 * Files shipped with the website are written as "media/…"; uploads are full
 * https addresses.
 */
export function assetUrl(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (/^(https?:|data:image\/|blob:)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return ''; // any other scheme is refused
  return `${import.meta.env.BASE_URL}${trimmed.replace(/^\/+/, '')}`;
}

/** Google Maps directions to the venue. A custom link from the dashboard wins. */
export function directionsUrl(event: Pick<WeddingEvent, 'mapsUrl' | 'venueName' | 'address'>): string {
  const custom = safeHttpUrl(event.mapsUrl);
  if (custom) return custom;
  const destination = [event.venueName, event.address].filter(Boolean).join(', ');
  if (!destination) return '';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Digits only, with the India country code added to ten-digit mobile numbers. */
export function internationalNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export function telHref(phone: string): string {
  const number = internationalNumber(phone);
  return number ? `tel:+${number}` : '';
}

export function whatsappChatHref(phone: string): string {
  const number = internationalNumber(phone);
  return number ? `https://wa.me/${number}` : '';
}

/** "98975 32301" */
export function formatPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return (phone || '').trim();
}

/** The public address of the invitation, without preview parameters. */
export function siteUrl(): string {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/+$/, '') + '/';
  if (typeof window === 'undefined') return '';
  const base = import.meta.env.BASE_URL;
  if (base.startsWith('/')) return `${window.location.origin}${base}`;
  return window.location.href.split(/[?#]/)[0];
}

export function whatsappShareHref(message: string, link: string): string {
  const text = message.includes('{link}') ? message.split('{link}').join(link) : `${message}\n${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text.trim())}`;
}
