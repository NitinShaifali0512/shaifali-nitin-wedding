import type {
  ContactNumber,
  GalleryPhoto,
  ScheduleItem,
  SectionConfig,
  SocialLink,
  WeddingEvent,
} from './types';

/** A short unique id that is safe to use in HTML ids and URLs. */
export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export function blankScheduleItem(): ScheduleItem {
  return { id: newId('time'), time: '', label: '' };
}

export function blankEvent(): WeddingEvent {
  return {
    id: newId('event'),
    visible: true,
    name: 'New Event',
    subtitle: '',
    description: '',
    date: '',
    timeNote: 'Timing to be announced',
    schedule: [],
    endTime: '',
    venueName: '',
    address: '',
    mapsUrl: '',
    dressCodeLabel: 'Dress code',
    dressCode: '',
    style: 'classic',
    backgroundImage: '',
    rsvp: true,
  };
}

export function blankPhoto(src = '', width = 0, height = 0): GalleryPhoto {
  return { id: newId('photo'), src, caption: '', frame: 'polaroid', width, height };
}

export function blankContact(): ContactNumber {
  return { id: newId('contact'), label: '', phone: '' };
}

export function blankSocial(): SocialLink {
  return { id: newId('social'), label: '', url: '' };
}

export function blankCustomSection(): SectionConfig {
  return {
    id: newId('section'),
    type: 'custom',
    visible: true,
    navLabel: '',
    eyebrow: '',
    heading: 'New Section',
    body: '',
    image: '',
    style: 'ivory',
    buttonLabel: '',
    buttonUrl: '',
  };
}
