import { CalendarPlus, Check, Copy, Download, MapPin, Music2, Navigation } from 'lucide-react';
import { useState } from 'react';
import { ArchPanel, Flourish, OmArt, RingsDoodle } from '../art/Art';
import peonyCorner from '../assets/art/peony-corner.webp';
import peonyLarge from '../assets/art/peony-large.webp';
import type { SiteContent, WeddingEvent } from '../content/types';
import { downloadIcs, eventTiming, googleCalendarUrl } from '../lib/calendar';
import { formatTime, formatTimeShort } from '../lib/dates';
import { SANDBOX_PREVIEW } from '../lib/config';
import { assetUrl, directionsUrl, siteUrl } from '../lib/links';
import { DateLockup } from './DateLockup';

/* ----------------------------- decorations ----------------------------- */

function PastelDecor() {
  return (
    <div aria-hidden="true">
      <span className="pastel-blob -left-16 top-10 h-56 w-56" style={{ background: '#f9d2d6' }} />
      <span className="pastel-blob -right-20 top-1/3 h-64 w-64" style={{ background: '#cfe3f2' }} />
      <span className="pastel-blob -left-10 bottom-8 h-52 w-52" style={{ background: '#dcd0f0' }} />
      <span className="pastel-blob right-4 bottom-0 h-44 w-44" style={{ background: '#fbe3c4' }} />
    </div>
  );
}

const BULB_COLOURS = ['#ffc163', '#ff7fae', '#7fe3d4', '#ffe08a', '#c79bff'];

function StringLights() {
  const bulbs = Array.from({ length: 13 }, (_, index) => {
    const t = index / 12;
    const x = 10 + t * 380;
    // Two shallow swags of wire.
    const y = 10 + Math.abs(Math.sin(t * Math.PI * 2)) * 20;
    return { x, y, colour: BULB_COLOURS[index % BULB_COLOURS.length], delay: (index % 5) * 0.45 };
  });
  return (
    <svg viewBox="0 0 400 60" className="string-lights" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 8 Q100 52 200 12 Q300 52 400 8" fill="none" stroke="rgba(255,243,226,0.4)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {bulbs.map((bulb) => (
        <g key={bulb.x} className="bulb" style={{ animationDelay: `${bulb.delay}s` }}>
          <circle cx={bulb.x} cy={bulb.y + 7} r="7" fill={bulb.colour} opacity="0.25" />
          <circle cx={bulb.x} cy={bulb.y + 7} r="3" fill={bulb.colour} />
        </g>
      ))}
    </svg>
  );
}

function FestiveDecor() {
  const sparkles = [
    { left: '8%', top: '22%', delay: '0s' },
    { left: '88%', top: '30%', delay: '0.8s' },
    { left: '14%', top: '62%', delay: '1.4s' },
    { left: '82%', top: '70%', delay: '0.4s' },
    { left: '50%', top: '92%', delay: '1.9s' },
    { left: '94%', top: '52%', delay: '1.1s' },
  ];
  const notes = [
    { left: '10%', top: '40%', delay: '0s', size: 20 },
    { left: '86%', top: '46%', delay: '1.6s', size: 24 },
    { left: '20%', top: '82%', delay: '2.8s', size: 18 },
    { left: '78%', top: '86%', delay: '0.9s', size: 20 },
  ];
  return (
    <div aria-hidden="true">
      <StringLights />
      {sparkles.map((s) => (
        <span key={`${s.left}${s.top}`} className="sparkle" style={{ left: s.left, top: s.top, animationDelay: s.delay }} />
      ))}
      {notes.map((n) => (
        <Music2
          key={`${n.left}${n.top}`}
          size={n.size}
          className="pointer-events-none absolute text-[#ffc163]"
          style={{ left: n.left, top: n.top, animation: `float-up 5.5s ease-in-out ${n.delay} infinite`, opacity: 0 }}
        />
      ))}
    </div>
  );
}

function RoyalDecor() {
  return (
    <div aria-hidden="true">
      <div className="lattice" />
      <div className="lotus-border lotus-border-top" />
      <div className="lotus-border lotus-border-bottom" />
      <img src={peonyCorner} alt="" className="pointer-events-none absolute -left-10 -top-3 w-40 sm:w-56" style={{ transform: 'rotate(-4deg)' }} loading="lazy" decoding="async" />
      <img
        src={peonyCorner}
        alt=""
        className="pointer-events-none absolute -right-10 -top-3 w-40 sm:w-56"
        style={{ transform: 'scaleX(-1) rotate(-4deg)' }}
        loading="lazy"
        decoding="async"
      />
      <img src={peonyLarge} alt="" className="pointer-events-none absolute -bottom-4 -left-12 w-44 sm:w-64" loading="lazy" decoding="async" />
      <img
        src={peonyLarge}
        alt=""
        className="pointer-events-none absolute -bottom-4 -right-12 w-44 sm:w-64"
        style={{ transform: 'scaleX(-1)' }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

const PASTEL_SWATCHES = ['#f9d2d6', '#fbe3c4', '#fdf3c9', '#d5ead8', '#cfe3f2', '#dcd0f0'];

/* ------------------------------- parts ------------------------------- */

function Schedule({ event }: { event: WeddingEvent }) {
  if (event.schedule.length === 0) {
    return event.timeNote ? (
      <p
        className="mx-auto inline-flex items-center rounded-full px-5 py-2.5 font-sans text-[0.76rem] font-semibold uppercase tracking-label"
        style={{ border: '1px dashed var(--ev-line)', color: 'var(--ev-accent)' }}
        data-testid="time-note"
      >
        {event.timeNote}
      </p>
    ) : null;
  }
  return (
    <ul className="mx-auto max-w-[19rem] space-y-2.5 text-left" aria-label={`${event.name} schedule`}>
      {event.schedule.map((item) => (
        <li key={item.id} className="flex items-baseline gap-3 font-serif text-[1.22rem] leading-snug">
          <span>{item.label}</span>
          <span className="min-w-[1.5rem] flex-1 translate-y-[-0.25em] border-b border-dotted" style={{ borderColor: 'var(--ev-line)' }} aria-hidden="true" />
          <span className="whitespace-nowrap tabular-nums" style={{ color: 'var(--ev-accent)' }}>
            {formatTime(item.time) || item.time}
          </span>
        </li>
      ))}
    </ul>
  );
}

function CopyAddress({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };
  if (typeof navigator === 'undefined' || !navigator.clipboard) return null;
  return (
    <button
      type="button"
      onClick={copy}
      className="mt-1 inline-flex min-h-[2.75rem] items-center gap-1.5 px-3 font-sans text-[0.7rem] font-semibold uppercase tracking-label underline-offset-4 hover:underline"
      style={{ color: 'var(--ev-accent)' }}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      <span aria-live="polite">{copied ? 'Address copied' : 'Copy address'}</span>
    </button>
  );
}

function EventBody({ event, coupleNames }: { event: WeddingEvent; coupleNames: string }) {
  const timing = eventTiming(event);
  const side = timing.startTime ? `At ${formatTimeShort(timing.startTime)}` : '';
  const maps = directionsUrl(event);
  const invitation = siteUrl();
  const google = googleCalendarUrl(event, coupleNames, invitation);
  const isFestive = event.style === 'festive';
  const isPastel = event.style === 'pastel';

  return (
    <div className="text-center">
      {event.subtitle ? (
        <p className="eyebrow" style={{ color: 'var(--ev-accent)' }}>
          {event.subtitle}
        </p>
      ) : null}

      <h3
        className={`mt-2 font-serif font-medium ${isFestive ? 'festive-title italic' : ''}`}
        style={{ fontSize: 'clamp(2.7rem, 13vw, 4rem)', lineHeight: 1.05 }}
      >
        {event.name}
      </h3>

      {isFestive ? (
        <div className="equalizer mt-3" aria-hidden="true">
          {[0.9, 0.5, 1, 0.65, 0.85, 0.45, 0.75].map((height, index) => (
            <span key={index} style={{ height: `${height * 100}%`, animationDelay: `${index * 0.12}s` }} />
          ))}
        </div>
      ) : null}

      <DateLockup date={event.date} side={side} className="mt-6" />

      {event.description ? (
        <p className="lead mx-auto mt-6 max-w-sm" style={{ color: 'var(--ev-muted)' }}>
          {event.description}
        </p>
      ) : null}

      <div className="mt-7">
        <Schedule event={event} />
      </div>

      {event.dressCode ? (
        <div className="mt-7">
          <p className="font-serif text-[1.25rem]">
            <span style={{ color: 'var(--ev-muted)' }}>{event.dressCodeLabel || 'Dress code'}: </span>
            <span className="font-semibold">{event.dressCode}</span>
          </p>
          {isPastel ? (
            <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
              {PASTEL_SWATCHES.map((colour) => (
                <span key={colour} className="h-6 w-6 rounded-full border border-white shadow-sm" style={{ background: colour }} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {event.venueName || event.address ? (
        <div className="mt-8">
          <div className="gold-rule mx-auto mb-6 w-40" style={{ color: 'var(--ev-accent)' }} aria-hidden="true" />
          <MapPin size={20} className="mx-auto mb-2" style={{ color: 'var(--ev-accent)' }} aria-hidden="true" />
          {event.venueName ? <p className="font-serif text-[1.5rem] font-semibold leading-tight">{event.venueName}</p> : null}
          {event.address ? (
            <address className="mx-auto mt-2 max-w-[20rem] font-sans text-[0.86rem] not-italic leading-relaxed" style={{ color: 'var(--ev-muted)' }}>
              {event.address}
            </address>
          ) : null}
          {event.address ? <CopyAddress text={[event.venueName, event.address].filter(Boolean).join(', ')} /> : null}
        </div>
      ) : null}

      <div className="mx-auto mt-8 flex max-w-[19rem] flex-col gap-3">
        {maps ? (
          <a href={maps} target="_blank" rel="noopener noreferrer" className="btn-event" data-testid="directions">
            <Navigation size={15} aria-hidden="true" />
            Get Directions
          </a>
        ) : null}
        {google ? (
          <a href={google} target="_blank" rel="noopener noreferrer" className="btn-event-outline" data-testid="google-calendar">
            <CalendarPlus size={15} aria-hidden="true" />
            Add to Google Calendar
          </a>
        ) : null}
        {google && !SANDBOX_PREVIEW ? (
          <button type="button" onClick={() => downloadIcs(event, coupleNames, invitation)} className="btn-event-outline" data-testid="download-ics">
            <Download size={15} aria-hidden="true" />
            Download Calendar File
          </button>
        ) : null}
      </div>
    </div>
  );
}

function EventBlock({ event, coupleNames }: { event: WeddingEvent; coupleNames: string }) {
  const background = assetUrl(event.backgroundImage);
  const style = event.style;

  return (
    <article id={`event-${event.id}`} className={`event event--${style}`} aria-label={event.name} data-testid={`event-${event.id}`}>
      {background ? (
        <div className="absolute inset-0 bg-cover bg-center opacity-25" style={{ backgroundImage: `url("${background}")` }} aria-hidden="true" />
      ) : null}
      {style === 'pastel' ? <PastelDecor /> : null}
      {style === 'festive' ? <FestiveDecor /> : null}
      {style === 'royal' ? <RoyalDecor /> : null}

      <div className={`relative mx-auto max-w-[34rem] px-5 ${style === 'royal' ? 'py-24 sm:py-28' : 'py-16 sm:py-20'}`} data-reveal>
        {style === 'royal' ? (
          <ArchPanel fill="#570A34" className="mx-auto max-w-[27rem]">
            <div className="px-7 pb-12 pt-[27%] sm:px-10">
              <OmArt className="mx-auto mb-4 h-9 w-auto text-cream" />
              <EventBody event={event} coupleNames={coupleNames} />
            </div>
          </ArchPanel>
        ) : (
          <div className={`event-panel px-6 py-11 sm:px-10 ${style === 'pastel' ? 'rounded-[2.2rem]' : 'rounded-[1.6rem]'} ${style === 'festive' ? '' : 'shadow-card'}`}>
            {style === 'pastel' ? (
              <>
                <span className="pointer-events-none absolute inset-2 rounded-[1.8rem] border" style={{ borderColor: 'var(--ev-panel-border)' }} aria-hidden="true" />
                <RingsDoodle className="relative mx-auto mb-4 h-12 w-auto" style={{ color: 'var(--ev-accent)' }} />
              </>
            ) : null}
            {style !== 'pastel' && style !== 'festive' ? <Flourish className="mb-5" /> : null}
            <div className="relative">
              <EventBody event={event} coupleNames={coupleNames} />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function Events({ content }: { content: SiteContent }) {
  const events = content.events.filter((event) => event.visible);
  const { eventsIntro, couple } = content;
  const coupleNames = [couple.brideName, couple.groomName].filter(Boolean).join(' & ');

  return (
    <section id="events" aria-labelledby="events-heading">
      <div className="bg-paper px-6 pb-14 pt-20 text-center sm:pt-24">
        <div className="mx-auto max-w-xl" data-reveal>
          {eventsIntro.eyebrow ? <p className="eyebrow text-gold-700">{eventsIntro.eyebrow}</p> : null}
          <h2 id="events-heading" className="section-heading mt-3 text-wine-800">
            {eventsIntro.heading || 'The Celebrations'}
          </h2>
          <Flourish className="my-5 text-gold-500" />
          {eventsIntro.description ? <p className="lead text-ink-soft">{eventsIntro.description}</p> : null}
        </div>
      </div>
      {events.length === 0 ? (
        <p className="bg-paper px-6 pb-20 text-center font-serif text-xl italic text-ink-soft">The celebration details will be shared here soon.</p>
      ) : (
        events.map((event) => <EventBlock key={event.id} event={event} coupleNames={coupleNames} />)
      )}
    </section>
  );
}
