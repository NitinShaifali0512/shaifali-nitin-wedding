/**
 * Connection settings for the Supabase backend.
 *
 * Only the project URL and the PUBLIC key belong here. The public key is
 * called the "publishable" key in new Supabase projects and the "anon" key in
 * older ones. It is safe to ship in a website because every table is
 * protected by Row Level Security. The secret / service_role key must never
 * be placed in this project.
 */

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const SUPABASE_URL = clean(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '');

export const SUPABASE_KEY =
  clean(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) || clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

/** True when someone has pasted a secret key where the public key belongs. */
export function looksLikeSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

export const secretKeyDetected = looksLikeSecretKey(SUPABASE_KEY);

/** True when the website has been connected to its database. */
export const backendConfigured =
  /^https?:\/\/.+/.test(SUPABASE_URL) && SUPABASE_KEY.length >= 20 && !secretKeyDetected;

/** The public storage bucket that holds uploaded photographs and music. */
export const MEDIA_BUCKET = 'media';

/** The track that ships with the website. */
export const DEFAULT_MUSIC_PATH = 'media/audio/saxophone-serenade.mp3';

/** The link-preview image that ships with the website. */
export const DEFAULT_SHARE_IMAGE_PATH = 'og-image.jpg';

/**
 * True only in the single-file preview build (`npm run build:preview`).
 *
 * That build is meant for sandboxed viewers which block file downloads and
 * have no public address of their own. Rather than show buttons that cannot
 * work there, the preview leaves out the calendar-file download and the
 * share buttons, and says so in the footer. The real website is unaffected.
 */
export const SANDBOX_PREVIEW = import.meta.env.MODE === 'artifact';
