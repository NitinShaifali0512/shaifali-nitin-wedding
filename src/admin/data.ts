import { defaultContent } from '../content/defaults';
import { normalizeContent } from '../content/normalize';
import type { RsvpRecord, SiteContent } from '../content/types';
import { MEDIA_BUCKET } from '../lib/config';
import { MAX_AUDIO_BYTES, audioTypeOf, prepareImage } from './images';
import { getSupabase } from './supabase';

/** A problem the dashboard can explain to the administrator in plain words. */
export class AdminError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'AdminError';
  }
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  status?: number;
  statusCode?: string | number;
}

function explain(error: SupabaseErrorLike, action: string): AdminError {
  const code = String(error.code ?? error.statusCode ?? error.status ?? '');
  const message = error.message ?? '';
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|schema cache/i.test(message)) {
    return new AdminError('setup', 'The database has not been set up yet. Please run the file supabase/schema.sql in the Supabase SQL Editor.');
  }
  if (code === '42501' || code === '401' || code === '403' || /row-level security|permission denied|not_authorised/i.test(message)) {
    return new AdminError('forbidden', 'This account is not allowed to do that. Please sign in with an administrator account.');
  }
  if (/Failed to fetch|NetworkError|network/i.test(message)) {
    return new AdminError('network', 'The server could not be reached. Please check your internet connection and try again.');
  }
  if (/draft_changed/.test(message)) {
    return new AdminError('conflict', 'The draft was changed somewhere else after you opened it.');
  }
  return new AdminError('unknown', `${action} did not work. ${message}`.trim());
}

export interface ContentRow {
  content: SiteContent;
  revision: number;
  updatedAt: string;
}

export interface LoadedContent {
  draft: ContentRow;
  published: ContentRow | null;
  /** True when the database held no draft and one was created from the built-in content. */
  createdDraft: boolean;
}

function toRow(row: { content: unknown; revision: number; updated_at: string }): ContentRow {
  return { content: normalizeContent(row.content), revision: row.revision, updatedAt: row.updated_at };
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_admin');
  if (error) throw explain(error, 'Checking your access');
  return data === true;
}

/** Loads the draft and the published copy. Creates the first draft if the database is empty. */
export async function loadContent(): Promise<LoadedContent> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('site_content').select('id, content, revision, updated_at');
  if (error) throw explain(error, 'Loading the website content');

  const rows = data ?? [];
  const publishedRow = rows.find((row) => row.id === 'published');
  const draftRow = rows.find((row) => row.id === 'draft');
  const published = publishedRow ? toRow(publishedRow) : null;
  if (draftRow) return { draft: toRow(draftRow), published, createdDraft: false };

  const starting = published ? published.content : normalizeContent(defaultContent);
  const { data: created, error: createError } = await supabase
    .from('site_content')
    .insert({ id: 'draft', content: starting })
    .select('content, revision, updated_at')
    .single();
  if (createError) throw explain(createError, 'Creating the first draft');
  return { draft: toRow(created), published, createdDraft: true };
}

/**
 * Saves the draft. `expectedRevision` is the revision the dashboard last saw;
 * if the stored draft has moved on (someone else saved), nothing is written
 * and a "conflict" error is raised. Pass null to overwrite regardless.
 */
export async function saveDraft(content: SiteContent, expectedRevision: number | null): Promise<ContentRow> {
  const supabase = getSupabase();
  let query = supabase.from('site_content').update({ content }).eq('id', 'draft');
  if (expectedRevision !== null) query = query.eq('revision', expectedRevision);
  const { data, error } = await query.select('content, revision, updated_at');
  if (error) throw explain(error, 'Saving your changes');
  if (!data || data.length === 0) {
    throw new AdminError('conflict', 'The draft was changed somewhere else after you opened it.');
  }
  return toRow(data[0]);
}

export async function fetchDraft(): Promise<ContentRow> {
  const { data, error } = await getSupabase().from('site_content').select('content, revision, updated_at').eq('id', 'draft').single();
  if (error) throw explain(error, 'Loading the draft');
  return toRow(data);
}

/** Makes the saved draft the live website. */
export async function publishDraft(expectedRevision: number): Promise<{ revision: number; updatedAt: string }> {
  const { data, error } = await getSupabase().rpc('publish_site', { expected_revision: expectedRevision });
  if (error) throw explain(error, 'Publishing the website');
  const row = Array.isArray(data) ? data[0] : data;
  return { revision: row?.revision ?? 0, updatedAt: row?.updated_at ?? new Date().toISOString() };
}

export interface VersionRow {
  id: number;
  publishedAt: string;
  content: SiteContent;
}

export async function listVersions(): Promise<VersionRow[]> {
  const { data, error } = await getSupabase()
    .from('site_versions')
    .select('id, published_at, content')
    .order('id', { ascending: false })
    .limit(30);
  if (error) throw explain(error, 'Loading the publishing history');
  return (data ?? []).map((row) => ({ id: row.id, publishedAt: row.published_at, content: normalizeContent(row.content) }));
}

/* ------------------------------- RSVPs ------------------------------- */

const PAGE_SIZE = 1000;

export async function listRsvps(): Promise<RsvpRecord[]> {
  const supabase = getSupabase();
  const all: RsvpRecord[] = [];
  for (let page = 0; page < 20; page += 1) {
    const { data, error } = await supabase
      .from('rsvps')
      .select('id, created_at, guest_name, mobile, guest_count, events, message')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) throw explain(error, 'Loading the RSVP responses');
    const rows = (data ?? []) as RsvpRecord[];
    all.push(...rows.map((row) => ({ ...row, events: Array.isArray(row.events) ? row.events : [] })));
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}

export async function deleteRsvp(id: string): Promise<void> {
  const { data, error } = await getSupabase().from('rsvps').delete().eq('id', id).select('id');
  if (error) throw explain(error, 'Deleting the response');
  if (!data || data.length === 0) throw new AdminError('forbidden', 'The response could not be deleted.');
}

/* ------------------------------ uploads ------------------------------ */

function uniqueName(extension: string): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${id}.${extension}`;
}

async function upload(path: string, body: Blob, contentType: string): Promise<string> {
  const supabase = getSupabase();
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, body, {
    contentType,
    // File names are unique, so browsers may keep them for a year.
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    const message = error.message ?? '';
    if (/bucket not found/i.test(message)) {
      throw new AdminError('setup', 'The storage bucket does not exist yet. Please run the file supabase/schema.sql in the Supabase SQL Editor.');
    }
    if (/mime type|not supported/i.test(message)) throw new AdminError('type', 'This kind of file is not accepted.');
    if (/exceeded|too large|maximum allowed size/i.test(message)) throw new AdminError('size', 'This file is too large. The limit is 25 MB.');
    throw explain(error as SupabaseErrorLike, 'Uploading the file');
  }
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export interface UploadedImage {
  url: string;
  width: number;
  height: number;
}

/** Uploads a photograph and returns its public address and pixel size. */
export async function uploadPhoto(file: File): Promise<UploadedImage> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|avif|heic|heif)$/i.test(file.name)) {
    throw new AdminError('type', 'Please choose a picture file such as a JPG or PNG.');
  }
  const prepared = await prepareImage(file);
  const url = await upload(`images/${uniqueName(prepared.extension)}`, prepared.blob, prepared.contentType);
  return { url, width: prepared.width, height: prepared.height };
}

/** Uploads a photograph and returns the public address to store in the content. */
export async function uploadImage(file: File): Promise<string> {
  return (await uploadPhoto(file)).url;
}

/** Uploads a music file and returns its public address. */
export async function uploadAudio(file: File): Promise<string> {
  const type = audioTypeOf(file);
  if (!type) throw new AdminError('type', 'Please choose an audio file. MP3 works on every phone.');
  if (file.size > MAX_AUDIO_BYTES) throw new AdminError('size', 'This audio file is larger than 25 MB. Please choose a smaller MP3.');
  return upload(`audio/${uniqueName(type.extension)}`, file, type.contentType);
}

export interface StoredFile {
  path: string;
  url: string;
  size: number;
  createdAt: string;
}

/** Lists everything in the media bucket (two folders: images and audio). */
export async function listStoredFiles(): Promise<StoredFile[]> {
  const supabase = getSupabase();
  const files: StoredFile[] = [];
  for (const folder of ['images', 'audio']) {
    for (let offset = 0; offset < 5000; offset += 100) {
      const { data, error } = await supabase.storage.from(MEDIA_BUCKET).list(folder, { limit: 100, offset, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw explain(error as SupabaseErrorLike, 'Listing the uploaded files');
      const rows = data ?? [];
      for (const row of rows) {
        if (!row.name || row.name.startsWith('.')) continue;
        const path = `${folder}/${row.name}`;
        files.push({
          path,
          url: supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl,
          size: Number((row.metadata as { size?: number } | null)?.size ?? 0),
          createdAt: row.created_at ?? '',
        });
      }
      if (rows.length < 100) break;
    }
  }
  return files;
}

export async function removeStoredFiles(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await getSupabase().storage.from(MEDIA_BUCKET).remove(paths);
  if (error) throw explain(error as SupabaseErrorLike, 'Removing the files');
}

/** Every uploaded file that a content document refers to. */
export function referencedUploads(content: SiteContent): Set<string> {
  const found = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      if (/^https?:\/\//.test(value)) found.add(value.split('?')[0]);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(content);
  return found;
}

/* ------------------------------ account ------------------------------ */

export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password: newPassword });
  if (error) throw new AdminError('password', error.message || 'The password could not be changed.');
}
