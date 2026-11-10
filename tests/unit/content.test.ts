import { describe, expect, it } from 'vitest';
import { defaultContent } from '../../src/content/defaults';
import { contentFingerprint, normalizeContent } from '../../src/content/normalize';
import { cleanMobile, validateRsvp } from '../../src/lib/api';
import { looksLikeSecretKey } from '../../src/lib/config';
import { formatPhone, internationalNumber, safeHttpUrl, telHref, whatsappShareHref } from '../../src/lib/links';
import { neutraliseFormula, toCsv, toExportRows } from '../../src/admin/export';
import { markSuperseded, summarise } from '../../src/admin/panels/ResponsesPanel';

describe('starting content', () => {
  it('uses the names and details the couple gave', () => {
    expect(defaultContent.couple.brideName).toBe('Shaifali Singh');
    expect(defaultContent.couple.groomName).toBe('Nitin Kaushik');
    expect(defaultContent.events.map((event) => [event.name, event.date])).toEqual([
      ['Sagai', '2026-11-21'],
      ['Sangeet', '2026-12-03'],
      ['Wedding', '2026-12-05'],
    ]);
    expect(defaultContent.events[0].schedule.map((item) => `${item.time} ${item.label}`)).toEqual(['11:00 Sagai', '12:30 Ring Exchange', '13:00 Lunch']);
    expect(defaultContent.events[1].schedule).toEqual([]);
    expect(defaultContent.events[1].timeNote).toBe('Timing to be announced');
    expect(defaultContent.events[2].schedule.map((item) => `${item.time} ${item.label}`)).toEqual([
      '10:00 Baraat Welcome',
      '11:30 Jaimala',
      '13:00 Lunch',
      '13:00 Phere',
      '17:00 Vidai',
    ]);
    expect(defaultContent.events[0].dressCode).toBe('Pastel');
    expect(defaultContent.countdown.target).toBe('2026-12-05T10:00');
    expect(defaultContent.footer.contacts.map((contact) => contact.phone)).toEqual(['9650086438', '9810007038', '9873483646']);
    expect(defaultContent.rsvp.heading).toBe('Will You Be There To Celebrate With Us?');
  });

  it('never mentions the couple from the reference website', () => {
    expect(JSON.stringify(defaultContent)).not.toMatch(/Shashank|Manasi|Karjat|Pegasus/i);
  });

  it('is already in normal form', () => {
    expect(contentFingerprint(normalizeContent(defaultContent))).toBe(contentFingerprint(defaultContent));
  });
});

describe('normalising saved content', () => {
  it('falls back to the starting content for anything that is not a document', () => {
    for (const junk of [null, undefined, 'text', 42, []]) {
      expect(normalizeContent(junk).couple.brideName).toBe('Shaifali Singh');
    }
  });

  it('fills in fields that an older document does not have', () => {
    const content = normalizeContent({ couple: { brideName: 'A', groomName: 'B' } });
    expect(content.couple.brideName).toBe('A');
    expect(content.rsvp.heading).toBe(defaultContent.rsvp.heading);
    expect(content.events).toHaveLength(3);
    expect(content.sections.map((section) => section.type)).toEqual(['welcome', 'events', 'gallery', 'rsvp']);
  });

  it('keeps an empty list empty instead of bringing the defaults back', () => {
    const content = normalizeContent({ events: [], gallery: { photos: [] }, footer: { contacts: [] }, sections: [] });
    expect(content.events).toEqual([]);
    expect(content.gallery.photos).toEqual([]);
    expect(content.footer.contacts).toEqual([]);
    expect(content.sections).toEqual([]);
  });

  it('repairs wrong types and unknown choices', () => {
    const content = normalizeContent({
      music: { enabled: 'yes', volume: 7, source: 'spotify' },
      rsvp: { maxGuests: 900, enabled: false },
      opening: { emblem: 'dragon' },
      welcome: { photoFocus: 'diagonal' },
      events: [{ name: 'Haldi', style: 'neon', schedule: [{ time: '09:00', label: 'Start' }, 'nonsense'] }, 'not an event'],
    });
    expect(content.music.enabled).toBe(true); // an invalid value keeps the default
    expect(content.music.volume).toBe(1);
    expect(content.music.source).toBe('default');
    expect(content.rsvp.maxGuests).toBe(50);
    expect(content.rsvp.enabled).toBe(false);
    expect(content.opening.emblem).toBe('ganesha');
    expect(content.welcome.photoFocus).toBe('center');
    expect(content.events).toHaveLength(1);
    expect(content.events[0].style).toBe('classic');
    expect(content.events[0].schedule).toHaveLength(1);
    expect(content.events[0].id).toBeTruthy();
  });

  it('gives every list item a unique id and allows each built-in section once', () => {
    const content = normalizeContent({
      events: [{ id: 'same', name: 'One' }, { id: 'same', name: 'Two' }],
      sections: [
        { type: 'gallery', visible: true, navLabel: 'Photos' },
        { type: 'gallery', visible: true, navLabel: 'Again' },
        { type: 'custom', heading: 'Travel' },
        { type: 'custom', heading: 'Gifts' },
      ],
    });
    expect(new Set(content.events.map((event) => event.id)).size).toBe(2);
    expect(content.sections.map((section) => section.type)).toEqual(['gallery', 'custom', 'custom']);
    expect(content.sections[0].id).toBe('gallery');
    expect(new Set(content.sections.map((section) => section.id)).size).toBe(3);
  });

  it('drops photographs that have no picture', () => {
    const content = normalizeContent({ gallery: { photos: [{ src: '' }, { src: 'media/photos/the-ring.jpg', frame: 'hologram' }] } });
    expect(content.gallery.photos).toHaveLength(1);
    expect(content.gallery.photos[0].frame).toBe('polaroid');
  });

  it('ignores unknown extra fields', () => {
    const content = normalizeContent({ couple: { brideName: 'A', secretField: 'x' }, surprise: true }) as unknown as Record<string, unknown>;
    expect(content.surprise).toBeUndefined();
    expect((content.couple as Record<string, unknown>).secretField).toBeUndefined();
  });
});

describe('RSVP form checks', () => {
  const good = { guestName: 'Asha Verma', mobile: '98765 43210', guestCount: 2, events: [{ id: 'wedding', name: 'Wedding' }], message: '' };

  it('accepts a complete response', () => {
    expect(validateRsvp(good, 10)).toEqual({});
  });

  it('explains what is missing', () => {
    const errors = validateRsvp({ guestName: ' ', mobile: '123', guestCount: 0, events: [], message: '' }, 10);
    expect(Object.keys(errors).sort()).toEqual(['events', 'guestCount', 'guestName', 'mobile']);
  });

  it('respects the largest party size', () => {
    expect(validateRsvp({ ...good, guestCount: 11 }, 10).guestCount).toMatch(/10 guests or fewer/);
    expect(validateRsvp({ ...good, guestCount: 2.5 }, 10).guestCount).toBeTruthy();
  });

  it('cleans mobile numbers', () => {
    expect(cleanMobile(' +91 98765-43210 ')).toBe('+919876543210');
    expect(cleanMobile('098765 43210')).toBe('09876543210');
    expect(validateRsvp({ ...good, mobile: '+91 98765 43210' }, 10)).toEqual({});
    expect(validateRsvp({ ...good, mobile: 'abcdefghij' }, 10).mobile).toBeTruthy();
  });
});

describe('links', () => {
  it('lets only ordinary web links through', () => {
    expect(safeHttpUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHttpUrl('  http://example.com ')).toBe('http://example.com/');
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'not a link', '']) expect(safeHttpUrl(bad)).toBe('');
  });

  it('formats Indian phone numbers for calling and WhatsApp', () => {
    expect(internationalNumber('9897532301')).toBe('919897532301');
    expect(internationalNumber('09897532301')).toBe('919897532301');
    expect(internationalNumber('+91 98975 32301')).toBe('919897532301');
    expect(telHref('9897532301')).toBe('tel:+919897532301');
    expect(formatPhone('9897532301')).toBe('98975 32301');
    expect(telHref('')).toBe('');
  });

  it('puts the website address into the WhatsApp message', () => {
    const href = whatsappShareHref('Join us!\n{link}\nSee you', 'https://example.com/');
    expect(decodeURIComponent(href.replace('https://wa.me/?text=', ''))).toBe('Join us!\nhttps://example.com/\nSee you');
    expect(decodeURIComponent(whatsappShareHref('No placeholder', 'https://example.com/'))).toContain('No placeholder\nhttps://example.com/');
    expect(defaultContent.share.whatsappMessage).toContain('{link}');
  });
});

describe('safety checks', () => {
  it('recognises a secret key pasted where the public key belongs', () => {
    const jwt = (role: string) => `x.${btoa(JSON.stringify({ role }))}.y`;
    expect(looksLikeSecretKey('sb_secret_abc123')).toBe(true);
    expect(looksLikeSecretKey(jwt('service_role'))).toBe(true);
    expect(looksLikeSecretKey(jwt('anon'))).toBe(false);
    expect(looksLikeSecretKey('sb_publishable_abc123')).toBe(false);
  });

  it('stops spreadsheet formulas in exported guest text', () => {
    expect(neutraliseFormula('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(neutraliseFormula('+919876543210')).toBe(`'+919876543210`);
    expect(neutraliseFormula('Asha')).toBe('Asha');
  });
});

describe('RSVP export and totals', () => {
  const rsvps = [
    { id: '1', created_at: '2026-11-06T10:00:00Z', guest_name: 'Asha Verma', mobile: '9876543210', guest_count: 2, events: [{ id: 'sagai', name: 'Sagai' }], message: 'See you, "soon"' },
    { id: '2', created_at: '2026-11-07T10:00:00Z', guest_name: 'Asha Verma', mobile: '+919876543210', guest_count: 4, events: [{ id: 'sagai', name: 'Sagai' }, { id: 'wedding', name: 'Wedding' }], message: null },
    { id: '3', created_at: '2026-11-07T11:00:00Z', guest_name: 'रवि कुमार', mobile: '9000000001', guest_count: 0, events: [], message: 'शुभकामनाएं' },
    { id: '4', created_at: '2026-11-08T11:00:00Z', guest_name: '=cmd', mobile: '9000000002', guest_count: 3, events: [{ id: 'wedding', name: 'Wedding' }], message: 'line one\nline two' },
  ];

  it('counts only the latest reply from each mobile number', () => {
    const rows = markSuperseded(rsvps);
    expect(rows.map((row) => row.superseded)).toEqual([true, false, false, false]);
    const summary = summarise(rows, defaultContent);
    expect(summary.responses).toBe(3);
    expect(summary.declined).toBe(1);
    expect(summary.totalGuests).toBe(7);
    expect(summary.perEvent.find((event) => event.id === 'sagai')).toMatchObject({ guests: 4, parties: 1 });
    expect(summary.perEvent.find((event) => event.id === 'sangeet')).toMatchObject({ guests: 0, parties: 0 });
    expect(summary.perEvent.find((event) => event.id === 'wedding')).toMatchObject({ guests: 7, parties: 2 });
  });

  it('writes a CSV that Excel opens correctly', () => {
    const csv = toCsv(toExportRows(rsvps));
    const lines = csv.split('\r\n');
    expect(csv.charCodeAt(0)).toBe(0xfeff); // marks the file as UTF-8 so Hindi names survive
    expect(lines[0].slice(1)).toBe('Name,Mobile,Attending,Guests,Events,Message,Received');
    expect(lines[1]).toContain('Asha Verma,98765 43210,Yes,2,Sagai,"See you, ""soon"""');
    expect(lines[2]).toContain('+91 98765 43210,Yes,4,"Sagai, Wedding",');
    expect(lines[3]).toContain('रवि कुमार,90000 00001,No,0,,शुभकामनाएं');
    expect(csv).toContain(`'=cmd,90000 00002,Yes,3,Wedding,"line one\nline two"`);
    expect(csv).toMatch(/6 Nov 2026, 0?3:30 pm/i); // 10:00 UTC shown as India time
  });
});
