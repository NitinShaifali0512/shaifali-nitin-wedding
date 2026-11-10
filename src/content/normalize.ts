import { CONTENT_SCHEMA_VERSION, defaultContent } from './defaults';
import { blankContact, blankCustomSection, blankEvent, blankPhoto, blankSocial, newId } from './factory';
import { NAME_ORDERS } from './types';
import type {
  ContactNumber,
  CustomSectionStyle,
  EmblemStyle,
  EventStyle,
  FrameStyle,
  GalleryPhoto,
  PhotoFocus,
  ScheduleItem,
  SectionConfig,
  SectionType,
  SiteContent,
  SocialLink,
  WeddingEvent,
} from './types';

export const EVENT_STYLES: EventStyle[] = ['pastel', 'festive', 'royal', 'classic', 'sunshine', 'garden'];
export const FRAME_STYLES: FrameStyle[] = ['polaroid', 'tape', 'gold', 'white', 'oval', 'scallop', 'arch'];
export const SECTION_TYPES: SectionType[] = ['welcome', 'events', 'gallery', 'rsvp', 'custom'];
export const CUSTOM_STYLES: CustomSectionStyle[] = ['ivory', 'blush', 'wine'];
export const EMBLEM_STYLES: EmblemStyle[] = ['ganesha', 'medallion', 'om', 'none'];
export const PHOTO_FOCUS: PhotoFocus[] = ['center', 'left', 'right', 'top', 'bottom'];

type Dict = Record<string, unknown>;

function isDict(value: unknown): value is Dict {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Copies `raw` onto the shape of `template`: unknown keys are dropped, missing
 * keys take the template value, and every value is coerced to the template's
 * type. Arrays are handled by the callers because their items need their own
 * templates.
 */
function shape<T extends object>(template: T, raw: unknown): T {
  const source = isDict(raw) ? raw : {};
  const result: Dict = {};
  for (const [key, fallback] of Object.entries(template)) {
    const value = source[key];
    if (Array.isArray(fallback)) {
      result[key] = fallback;
    } else if (isDict(fallback)) {
      result[key] = shape(fallback, value);
    } else if (typeof fallback === 'string') {
      result[key] = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
    } else if (typeof fallback === 'number') {
      const n = typeof value === 'string' ? Number(value) : value;
      result[key] = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
    } else if (typeof fallback === 'boolean') {
      result[key] = typeof value === 'boolean' ? value : fallback;
    } else {
      result[key] = value === undefined ? fallback : value;
    }
  }
  return result as T;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function list<T>(raw: unknown, fallback: T[], mapItem: (item: unknown, index: number) => T | null): T[] {
  if (!Array.isArray(raw)) return fallback.map((item) => structuredCloneSafe(item));
  const seen = new Set<string>();
  const out: T[] = [];
  raw.forEach((item, index) => {
    const mapped = mapItem(item, index);
    if (!mapped) return;
    // Every item needs a unique id because the editor and the page use it as a key.
    const withId = mapped as unknown as { id: string };
    if (!withId.id || seen.has(withId.id)) withId.id = newId('item');
    seen.add(withId.id);
    out.push(mapped);
  });
  return out;
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function normalizeSchedule(raw: unknown): ScheduleItem[] {
  return list<ScheduleItem>(raw, [], (item) => {
    if (!isDict(item)) return null;
    return shape<ScheduleItem>({ id: '', time: '', label: '' }, item);
  });
}

function normalizeEvent(raw: unknown): WeddingEvent | null {
  if (!isDict(raw)) return null;
  const template: WeddingEvent = { ...blankEvent(), id: '', name: '' };
  const event = shape(template, raw);
  event.style = oneOf(raw.style, EVENT_STYLES, 'classic');
  event.schedule = normalizeSchedule(raw.schedule);
  return event;
}

function normalizePhoto(raw: unknown): GalleryPhoto | null {
  if (!isDict(raw)) return null;
  const photo = shape<GalleryPhoto>({ ...blankPhoto(), id: '' }, raw);
  photo.frame = oneOf(raw.frame, FRAME_STYLES, 'polaroid');
  return photo.src ? photo : null;
}

function normalizeSection(raw: unknown): SectionConfig | null {
  if (!isDict(raw)) return null;
  const type = oneOf(raw.type, SECTION_TYPES, 'custom');
  if (type === 'custom') {
    const section = shape<SectionConfig>({ ...blankCustomSection(), id: '', heading: '' }, raw);
    section.type = 'custom';
    section.style = oneOf(raw.style, CUSTOM_STYLES, 'ivory');
    return section;
  }
  const section = shape<SectionConfig>({ id: type, type, visible: true, navLabel: '' }, raw);
  section.type = type;
  section.id = type;
  return section;
}

/**
 * Turns anything loaded from the database (or nothing at all) into a complete,
 * well-formed SiteContent. Guests never see a broken page because a field was
 * missing or had the wrong type.
 */
export function normalizeContent(raw: unknown): SiteContent {
  const base = structuredCloneSafe(defaultContent);
  if (!isDict(raw)) return base;

  const content = shape(base, raw);
  content.schemaVersion = CONTENT_SCHEMA_VERSION;

  content.opening.emblem = oneOf(content.opening.emblem, EMBLEM_STYLES, base.opening.emblem);

  content.welcome.photoFocus = oneOf(content.welcome.photoFocus, PHOTO_FOCUS, 'center');
  content.couple.nameOrder = oneOf(content.couple.nameOrder, NAME_ORDERS, 'bride-first');

  content.events = list<WeddingEvent>(raw.events, base.events, normalizeEvent);

  const rawGallery = isDict(raw.gallery) ? raw.gallery : {};
  content.gallery.photos = list<GalleryPhoto>(rawGallery.photos, base.gallery.photos, normalizePhoto);

  const rawFooter = isDict(raw.footer) ? raw.footer : {};
  content.footer.contacts = list<ContactNumber>(rawFooter.contacts, base.footer.contacts, (item) =>
    isDict(item) ? shape<ContactNumber>({ ...blankContact(), id: '' }, item) : null,
  );
  content.footer.socials = list<SocialLink>(rawFooter.socials, base.footer.socials, (item) =>
    isDict(item) ? shape<SocialLink>({ ...blankSocial(), id: '' }, item) : null,
  );

  // A built-in section type may appear only once; custom sections may repeat.
  const usedTypes = new Set<SectionType>();
  content.sections = list<SectionConfig>(raw.sections, base.sections, normalizeSection).filter((section) => {
    if (section.type === 'custom') return true;
    if (usedTypes.has(section.type)) return false;
    usedTypes.add(section.type);
    return true;
  });

  content.music.source = content.music.source === 'custom' ? 'custom' : 'default';
  content.music.volume = clamp(content.music.volume, 0, 1);
  content.rsvp.maxGuests = Math.round(clamp(content.rsvp.maxGuests, 1, 50));

  return content;
}

/** Stable text form used to detect unsaved or unpublished changes. */
export function contentFingerprint(content: SiteContent): string {
  return JSON.stringify(content);
}
