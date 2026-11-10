import shareDefaults from './shareDefaults.json';
import type { SiteContent } from './types';

/**
 * The initial content of the website.
 *
 * It is used in three situations:
 *   1. to fill the database the first time the administrator signs in,
 *   2. to fill in any field that an older saved document does not have yet,
 *   3. as a safe fallback if the database cannot be reached, so the invitation
 *      still opens for guests.
 *
 * Paths that start with "media/" point to files shipped with the website
 * (see the public/media folder). Anything uploaded through the dashboard is
 * stored in Supabase Storage and referenced by its full https address.
 */

export const GRAND_PARIS_ADDRESS =
  'No. 41/8, Link Rd, Site 4, Sahibabad Industrial Area Site 4, Sahibabad, Ghaziabad, Uttar Pradesh 201010';

export const GOLDEN_MOMENTS_ADDRESS =
  'Convention Hall, Sector 16A, Sector 16, Vasundhara, Ghaziabad, Uttar Pradesh 201012';

const GRAND_PARIS_MAP =
  'https://www.google.com/maps/dir/?api=1&destination=The%20Grand%20Paris%20Banquets%2C%20Site%204%2C%20Sahibabad%2C%20Ghaziabad&destination_place_id=ChIJ8TMDgnH7DDkRQKhINWzFtp0';

const GOLDEN_MOMENTS_MAP =
  'https://www.google.com/maps/dir/?api=1&destination=Golden%20Moments%2C%20Sector%2016A%2C%20Vasundhara%2C%20Ghaziabad&destination_place_id=ChIJbbjyQ8X7DDkRrt0pfxaVrm0';

export const CONTENT_SCHEMA_VERSION = 1;

export const defaultContent: SiteContent = {
  schemaVersion: CONTENT_SCHEMA_VERSION,

  couple: {
    brideName: 'Shaifali Singh',
    groomName: 'Nitin Kaushik',
    nameOrder: 'groom-first',
    monogram: 'NS',
    monogramImage: 'media/art/monogram.svg',
    brideParents: '',
    groomParents: '',
  },

  opening: {
    emblem: 'ganesha',
    invocation: '॥ श्री गणेशाय नमः ॥',
    heading: 'Together with their families',
    message: 'cordially invite you to celebrate the joyous occasion of their wedding',
    dateLine: 'Saturday, 5 December 2026 · Golden Moments Banquet, Vasundhara, Ghaziabad',
    buttonLabel: 'Open Invitation',
    backgroundImage: '',
  },

  welcome: {
    eyebrow: 'We are getting married',
    message:
      'With the blessings of our families and hearts full of joy, we invite you to be a part of the most special days of our lives. Your presence will make our celebrations complete.',
    photo: 'media/photos/together.jpg',
    photoFocus: 'left',
    dateLabel: 'Saturday, 5 December 2026',
    locationLabel: 'Golden Moments Banquet, Convention Hall, Sector 16A, Vasundhara, Ghaziabad, Uttar Pradesh 201012',
    backgroundImage: '',
    eventsButtonLabel: 'View the Celebrations',
    galleryButtonLabel: 'Our Moments',
  },

  countdown: {
    enabled: true,
    target: '2026-12-05T08:30',
    label: 'Counting down to the wedding day',
    doneMessage: 'The big day is here. Thank you for your love and blessings!',
  },

  eventsIntro: {
    eyebrow: 'The Celebrations',
    heading: 'Join Us For Every Celebration',
    description:
      'Three occasions and one beautiful beginning. We would love to have you with us at each of them.',
  },

  events: [
    {
      id: 'sagai',
      visible: true,
      name: 'Sagai',
      subtitle: 'The Engagement Ceremony',
      description: 'Two families, two rings and the first promise of forever.',
      date: '2026-11-21',
      timeNote: 'Timing to be announced',
      schedule: [
        { id: 'sagai-1', time: '11:00', label: 'Sagai' },
        { id: 'sagai-2', time: '12:30', label: 'Ring Exchange' },
        { id: 'sagai-3', time: '13:00', label: 'Lunch' },
      ],
      endTime: '',
      venueName: 'The Grand Paris Banquets',
      address: GRAND_PARIS_ADDRESS,
      mapsUrl: GRAND_PARIS_MAP,
      dressCodeLabel: 'Theme',
      dressCode: 'Pastel',
      style: 'pastel',
      backgroundImage: '',
      rsvp: true,
    },
    {
      id: 'sangeet',
      visible: true,
      name: 'Sangeet',
      subtitle: 'A Night of Music and Dance',
      description:
        'An evening of music, dance and celebration. Bring your best dance moves and get ready to light up the floor!',
      date: '2026-12-03',
      timeNote: '6 PM onwards',
      schedule: [{ id: 'sangeet-1', time: '18:00', label: 'Sangeet' }],
      endTime: '',
      venueName: 'The Grand Paris Banquets',
      address: GRAND_PARIS_ADDRESS,
      mapsUrl: GRAND_PARIS_MAP,
      dressCodeLabel: 'Dress code',
      dressCode: '',
      style: 'festive',
      backgroundImage: '',
      rsvp: true,
    },
    {
      id: 'wedding',
      visible: true,
      name: 'Wedding',
      subtitle: 'The Wedding Ceremony',
      description:
        'The baraat will depart from our residence, C-704, Mayur Dhwaj Apartment, Plot No. 60, I.P. Extension, Patparganj, Delhi 110092, and proceed to the wedding venue.',
      date: '2026-12-05',
      timeNote: '',
      schedule: [
        { id: 'wedding-1', time: '08:30', label: 'Sehrabandi' },
        { id: 'wedding-2', time: '09:00', label: 'Ghurchari' },
        { id: 'wedding-3', time: '09:30', label: 'Departure of Baraat' },
        { id: 'wedding-4', time: '12:30', label: 'Lunch' },
      ],
      endTime: '',
      venueName: 'Golden Moments Banquet',
      address: GOLDEN_MOMENTS_ADDRESS,
      mapsUrl: GOLDEN_MOMENTS_MAP,
      dressCodeLabel: 'Dress code',
      dressCode: '',
      style: 'royal',
      backgroundImage: '',
      rsvp: true,
    },
  ],

  gallery: {
    eyebrow: 'Our Moments',
    heading: 'A Few Pages From Our Story',
    description: 'Little moments that became our favourite memories.',
    photos: [
      { id: 'photo-1', src: 'media/photos/will-you-marry-me.jpg', caption: 'She said yes!', frame: 'white', width: 984, height: 1400 },
      { id: 'photo-2', src: 'media/photos/the-surprise.jpg', caption: 'The surprise', frame: 'polaroid', width: 1224, height: 1008 },
      { id: 'photo-3', src: 'media/photos/riverside-proposal.jpg', caption: 'The proposal', frame: 'gold', width: 1338, height: 921 },
      { id: 'photo-4', src: 'media/photos/portrait-oval.jpg', caption: '', frame: 'oval', width: 1026, height: 1389 },
      { id: 'photo-5', src: 'media/photos/the-ring.jpg', caption: 'The ring', frame: 'polaroid', width: 1164, height: 1161 },
      { id: 'photo-6', src: 'media/photos/riverside-laughter.jpg', caption: '', frame: 'scallop', width: 1380, height: 927 },
      { id: 'photo-7', src: 'media/photos/together.jpg', caption: '', frame: 'tape', width: 1212, height: 762 },
      { id: 'photo-8', src: 'media/photos/by-the-river.jpg', caption: 'By the river', frame: 'white', width: 984, height: 1400 },
      { id: 'photo-9', src: 'media/photos/pink-saree.jpg', caption: '', frame: 'polaroid', width: 1400, height: 878 },
    ],
  },

  rsvp: {
    enabled: true,
    eyebrow: 'RSVP',
    heading: 'Will You Be There To Celebrate With Us?',
    description:
      'Kindly let us know by filling in this short form, so that we can make arrangements to welcome you.',
    deadlineNote: '',
    maxGuests: 10,
    allowDecline: true,
    submitLabel: 'Send RSVP',
    successTitle: 'Thank You!',
    successMessage:
      'Your response has reached us. We cannot wait to celebrate these special days with you.',
    closedMessage:
      'RSVPs are now closed. Please call us on the numbers below and we will be happy to help.',
    backgroundImage: '',
  },

  music: {
    enabled: true,
    source: 'default',
    url: '',
    title: 'Saxophone Serenade',
    volume: 0.6,
  },

  footer: {
    visible: true,
    thankYouHeading: 'Thank You',
    message:
      'Your love and blessings mean the world to us. We look forward to celebrating with you.',
    closingLine: 'With love',
    contactsHeading: 'For RSVP and any help, please call',
    contacts: [
      { id: 'contact-1', label: '', phone: '9810007038' },
      { id: 'contact-2', label: '', phone: '9873483646' },
      { id: 'contact-3', label: '', phone: '9650086438' },
    ],
    socials: [],
    backgroundImage: '',
    showShareButton: true,
  },

  share: {
    // Kept in a small JSON file so the build can also use it for the link preview.
    title: shareDefaults.title,
    description: shareDefaults.description,
    image: '',
    whatsappMessage: [
      'We are getting married! 🤍',
      '',
      'Together with our families, we invite you to celebrate with us. So pick your outfits, bring your best dance moves, and get ready for days full of love, music, laughter and unforgettable memories!',
      '',
      '💍 Sagai: Saturday, 21 November 2026',
      '🎶 Sangeet: Thursday, 3 December 2026',
      '🌸 Wedding: Saturday, 5 December 2026',
      '📍 Ghaziabad',
      '',
      'Open your invitation and RSVP here:',
      '{link}',
      '',
      'We cannot wait to celebrate with our favourite people.',
      '',
      'With love,',
      'Nitin & Shaifali',
    ].join('\n'),
  },

  sections: [
    { id: 'welcome', type: 'welcome', visible: true, navLabel: 'Home' },
    { id: 'events', type: 'events', visible: true, navLabel: 'Events' },
    { id: 'gallery', type: 'gallery', visible: true, navLabel: 'Gallery' },
    { id: 'rsvp', type: 'rsvp', visible: true, navLabel: 'RSVP' },
  ],
};
