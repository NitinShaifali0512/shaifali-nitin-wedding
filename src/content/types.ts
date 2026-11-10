/**
 * The complete, editable content of the wedding website.
 *
 * One JSON document of this shape is stored twice in the database:
 *   - "draft"      what the administrator is currently editing
 *   - "published"  what guests see
 *
 * Everything a guest can read on the website comes from this document, so
 * nothing needs a code change or a redeploy.
 */

export type EventStyle = 'pastel' | 'festive' | 'royal' | 'classic' | 'sunshine' | 'garden';

export type FrameStyle = 'polaroid' | 'tape' | 'gold' | 'white' | 'oval' | 'scallop' | 'arch';

export type SectionType = 'welcome' | 'events' | 'gallery' | 'rsvp' | 'custom';

export type CustomSectionStyle = 'ivory' | 'blush' | 'wine';

export type EmblemStyle = 'ganesha' | 'medallion' | 'om' | 'none';

export const NAME_ORDERS = ['bride-first', 'groom-first'] as const;
export type NameOrder = (typeof NAME_ORDERS)[number];

export type PhotoFocus = 'center' | 'left' | 'right' | 'top' | 'bottom';

export interface ScheduleItem {
  id: string;
  /** 24-hour time, "HH:mm", in India Standard Time. */
  time: string;
  label: string;
}

export interface WeddingEvent {
  id: string;
  visible: boolean;
  name: string;
  subtitle: string;
  description: string;
  /** Calendar date, "YYYY-MM-DD", in India Standard Time. */
  date: string;
  /** Shown instead of a schedule when no timings are confirmed yet. */
  timeNote: string;
  schedule: ScheduleItem[];
  /** Optional "HH:mm" end time used only for calendar entries. */
  endTime: string;
  venueName: string;
  address: string;
  /** Optional custom Google Maps link. When empty, a directions link is built from the venue and address. */
  mapsUrl: string;
  dressCodeLabel: string;
  dressCode: string;
  style: EventStyle;
  /** Optional background photograph for the event block. */
  backgroundImage: string;
  /** Whether guests can pick this event in the RSVP form. */
  rsvp: boolean;
}

export interface GalleryPhoto {
  id: string;
  src: string;
  caption: string;
  frame: FrameStyle;
  /** Pixel size of the picture, when known. It lets the page keep space for a photograph before it has loaded. */
  width: number;
  height: number;
}

export interface SectionConfig {
  id: string;
  type: SectionType;
  visible: boolean;
  /** Label used in the navigation menu. Leave empty to keep the section out of the menu. */
  navLabel: string;
  /** Only used by custom sections. */
  eyebrow?: string;
  heading?: string;
  body?: string;
  image?: string;
  style?: CustomSectionStyle;
  buttonLabel?: string;
  buttonUrl?: string;
}

export interface ContactNumber {
  id: string;
  label: string;
  phone: string;
}

export interface SocialLink {
  id: string;
  label: string;
  url: string;
}

export interface SiteContent {
  schemaVersion: number;

  couple: {
    brideName: string;
    groomName: string;
    /** Whose name is written first wherever the two names appear together. */
    nameOrder: NameOrder;
    /** Short initials used when no monogram image is set. */
    monogram: string;
    /** Monogram artwork. Empty string falls back to the initials above. */
    monogramImage: string;
    brideParents: string;
    groomParents: string;
  };

  opening: {
    emblem: EmblemStyle;
    invocation: string;
    heading: string;
    message: string;
    dateLine: string;
    buttonLabel: string;
    backgroundImage: string;
  };

  welcome: {
    eyebrow: string;
    message: string;
    photo: string;
    /** Which part of the photograph stays visible inside the arch frame. */
    photoFocus: PhotoFocus;
    dateLabel: string;
    locationLabel: string;
    backgroundImage: string;
    eventsButtonLabel: string;
    galleryButtonLabel: string;
  };

  countdown: {
    enabled: boolean;
    /** "YYYY-MM-DDTHH:mm" in India Standard Time. */
    target: string;
    label: string;
    doneMessage: string;
  };

  eventsIntro: {
    eyebrow: string;
    heading: string;
    description: string;
  };

  events: WeddingEvent[];

  gallery: {
    eyebrow: string;
    heading: string;
    description: string;
    photos: GalleryPhoto[];
  };

  rsvp: {
    /** When false the form is replaced by the closed message and the database rejects new responses. */
    enabled: boolean;
    eyebrow: string;
    heading: string;
    description: string;
    deadlineNote: string;
    maxGuests: number;
    /** Lets a guest say that they cannot attend. */
    allowDecline: boolean;
    submitLabel: string;
    successTitle: string;
    successMessage: string;
    closedMessage: string;
    backgroundImage: string;
  };

  music: {
    enabled: boolean;
    /** "default" plays the bundled track; "custom" plays the uploaded file or external link in `url`. */
    source: 'default' | 'custom';
    url: string;
    title: string;
    /** Starting volume, from 0 to 1. */
    volume: number;
  };

  footer: {
    visible: boolean;
    thankYouHeading: string;
    message: string;
    closingLine: string;
    contactsHeading: string;
    contacts: ContactNumber[];
    socials: SocialLink[];
    backgroundImage: string;
    showShareButton: boolean;
  };

  share: {
    title: string;
    description: string;
    /** Link-preview thumbnail. Empty string uses the bundled invitation image. */
    image: string;
    /** WhatsApp message. "{link}" is replaced by the website address. */
    whatsappMessage: string;
  };

  /** Order and visibility of the sections of the page. */
  sections: SectionConfig[];
}

export interface RsvpEventChoice {
  id: string;
  name: string;
}

export interface RsvpInput {
  guestName: string;
  mobile: string;
  guestCount: number;
  events: RsvpEventChoice[];
  message: string;
}

export interface RsvpRecord {
  id: string;
  created_at: string;
  guest_name: string;
  mobile: string;
  guest_count: number;
  events: RsvpEventChoice[];
  message: string | null;
}
