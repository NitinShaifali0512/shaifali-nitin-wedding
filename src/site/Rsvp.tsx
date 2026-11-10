import { Check, Heart, Loader2, Minus, Plus, Send } from 'lucide-react';
import { type FormEvent, useMemo, useRef, useState } from 'react';
import { Flourish } from '../art/Art';
import type { RsvpInput, SiteContent, WeddingEvent } from '../content/types';
import { ApiError, RSVP_LIMITS, submitRsvp, validateRsvp } from '../lib/api';
import { backendConfigured } from '../lib/config';
import { formatDate, parseDate } from '../lib/dates';
import { assetUrl, siteUrl, whatsappShareHref } from '../lib/links';
import { readStored, writeStored } from '../lib/storage';
import { WhatsAppIcon } from './WhatsAppIcon';

const SAVED_KEY = 'wedding:rsvp:v1';

interface SavedRsvp {
  name: string;
  at: number;
}

type FormErrors = Partial<Record<keyof RsvpInput, string>>;

function shortDate(event: WeddingEvent): string {
  const parts = parseDate(event.date);
  if (!parts) return '';
  return formatDate(event.date).replace(` ${parts.year}`, '');
}

const ERROR_MESSAGES: Record<string, string> = {
  network: 'We could not reach the server. Please check your internet connection and try again.',
  busy: 'Many guests are responding right now. Please wait a minute and try again.',
  invalid: 'Some details were not accepted. Please check the form and try again.',
  server: 'Something went wrong while saving your response. Please try again in a moment.',
  'not-configured':
    'This is a preview of the invitation. RSVPs will be saved as soon as the website is connected to its database.',
};

export function Rsvp({ content, previewOnly }: { content: SiteContent; previewOnly: boolean }) {
  const { rsvp, share } = content;
  const events = useMemo(() => content.events.filter((event) => event.visible && event.rsvp), [content.events]);
  const maxGuests = Math.max(1, rsvp.maxGuests);

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [declining, setDeclining] = useState(false);
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [failure, setFailure] = useState('');
  const [closedByServer, setClosedByServer] = useState(false);
  const [saved, setSaved] = useState<SavedRsvp | null>(() => readStored<SavedRsvp>(SAVED_KEY));
  const [sentSummary, setSentSummary] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const background = assetUrl(rsvp.backgroundImage);

  const toggleEvent = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
    setErrors((current) => ({ ...current, events: undefined }));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === 'sending') return;
    setFailure('');

    const chosen = declining ? [] : events.filter((item) => selected.includes(item.id)).map((item) => ({ id: item.id, name: item.name }));
    const input: RsvpInput = {
      guestName: name,
      mobile,
      guestCount: declining ? 0 : guestCount,
      events: chosen,
      message,
    };

    const found = validateRsvp(input, maxGuests);
    if (declining) {
      // Someone who cannot come does not need to pick events or a guest count.
      delete found.events;
      delete found.guestCount;
    } else if (events.length === 0) {
      delete found.events;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = document.querySelector<HTMLElement>('#rsvp [aria-invalid="true"]');
      first?.focus();
      return;
    }

    // Automated spam fills every field, including this hidden one. Real guests never see it.
    if (trap) {
      setStatus('done');
      return;
    }

    if (previewOnly) {
      setFailure('This is the live preview inside the dashboard, so the response was not sent.');
      return;
    }

    setStatus('sending');
    try {
      await submitRsvp(input);
      const record: SavedRsvp = { name: name.trim(), at: Date.now() };
      writeStored(SAVED_KEY, record);
      setSaved(record);
      setSentSummary(
        declining
          ? 'We are sorry you cannot make it, and we are grateful for your wishes.'
          : chosen.length > 0
            ? `We have noted ${guestCount} ${guestCount === 1 ? 'guest' : 'guests'} for ${chosen.map((item) => item.name).join(', ')}.`
            : `We have noted ${guestCount} ${guestCount === 1 ? 'guest' : 'guests'}.`,
      );
      setStatus('done');
      window.setTimeout(() => headingRef.current?.focus(), 50);
    } catch (error) {
      setStatus('idle');
      const kind = error instanceof ApiError ? error.kind : 'server';
      if (kind === 'closed') setClosedByServer(true);
      else setFailure(ERROR_MESSAGES[kind] ?? ERROR_MESSAGES.server);
    }
  };

  const reset = () => {
    setStatus('idle');
    setSelected([]);
    setMessage('');
    setGuestCount(1);
    setDeclining(false);
    setErrors({});
    setFailure('');
  };

  const closed = !rsvp.enabled || closedByServer;
  const shareHref = whatsappShareHref(share.whatsappMessage, siteUrl());

  return (
    <section id="rsvp" className="bg-paper relative overflow-hidden" aria-labelledby="rsvp-heading">
      {background ? (
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url("${background}")` }} aria-hidden="true" />
      ) : null}
      <div
        className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full opacity-70"
        style={{ background: 'radial-gradient(circle, rgba(241,194,198,0.6) 0%, rgba(241,194,198,0) 68%)' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-xl px-5 pb-24 pt-20 sm:pt-24">
        <div className="text-center" data-reveal>
          {rsvp.eyebrow ? <p className="eyebrow text-gold-700">{rsvp.eyebrow}</p> : null}
          <h2 id="rsvp-heading" className="section-heading mt-3 text-wine-800">
            {rsvp.heading}
          </h2>
          <Flourish className="my-5 text-gold-500" />
          {rsvp.description && !closed ? <p className="lead text-ink-soft">{rsvp.description}</p> : null}
          {rsvp.deadlineNote && !closed ? (
            <p className="mt-3 font-sans text-[0.78rem] font-semibold uppercase tracking-label text-wine-700">{rsvp.deadlineNote}</p>
          ) : null}
        </div>

        <div
          className="relative mt-9 overflow-hidden rounded-[1.75rem] border border-gold-500/35 bg-white/80 px-5 py-8 shadow-card sm:px-9 sm:py-10"
          data-reveal
        >
          <span className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, #570A34, #C29A52, #570A34)' }} aria-hidden="true" />

          {closed ? (
            <p className="lead py-6 text-center text-ink" data-testid="rsvp-closed">
              {rsvp.closedMessage}
            </p>
          ) : status === 'done' ? (
            <div className="py-4 text-center" data-testid="rsvp-success" style={{ animation: 'pop-in 0.5s ease' }}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-wine-800 text-cream shadow-soft">
                <Heart size={28} fill="currentColor" aria-hidden="true" />
              </div>
              <h3 ref={headingRef} tabIndex={-1} className="mt-5 font-serif text-4xl font-medium text-wine-800 outline-none">
                {rsvp.successTitle}
              </h3>
              <p className="lead mx-auto mt-3 max-w-sm text-ink">{rsvp.successMessage}</p>
              {sentSummary ? <p className="mx-auto mt-4 max-w-sm font-sans text-sm text-ink-soft">{sentSummary}</p> : null}
              <div className="mt-7 flex flex-col items-center gap-3">
                <a href={shareHref} target="_blank" rel="noopener noreferrer" className="btn-wine">
                  <WhatsAppIcon size={16} />
                  Share the Invitation
                </a>
                <button type="button" onClick={reset} className="min-h-[2.75rem] px-3 font-sans text-[0.76rem] font-semibold uppercase tracking-label text-wine-700 underline underline-offset-4">
                  Send another response
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate data-testid="rsvp-form">
              {saved && !previewOnly ? (
                <p className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-center font-sans text-[0.82rem] text-ink" data-testid="rsvp-saved-note">
                  <Check size={14} className="mr-1 inline text-wine-700" aria-hidden="true" />
                  {saved.name ? `${saved.name}, your` : 'Your'} response has already reached us. You are welcome to send an updated one.
                </p>
              ) : null}

              <div className="space-y-5">
                <div>
                  <label htmlFor="rsvp-name" className="field-label">
                    Guest name
                  </label>
                  <input
                    id="rsvp-name"
                    className="field-input"
                    type="text"
                    autoComplete="name"
                    maxLength={RSVP_LIMITS.name}
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={errors.guestName ? 'true' : undefined}
                    aria-describedby={errors.guestName ? 'rsvp-name-error' : undefined}
                    required
                  />
                  {errors.guestName ? (
                    <p id="rsvp-name-error" className="field-error">
                      {errors.guestName}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="rsvp-mobile" className="field-label">
                    Mobile number
                  </label>
                  <input
                    id="rsvp-mobile"
                    className="field-input"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    placeholder="10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    aria-invalid={errors.mobile ? 'true' : undefined}
                    aria-describedby={errors.mobile ? 'rsvp-mobile-error' : undefined}
                    required
                  />
                  {errors.mobile ? (
                    <p id="rsvp-mobile-error" className="field-error">
                      {errors.mobile}
                    </p>
                  ) : null}
                </div>

                {!declining ? (
                  <>
                    <div>
                      <span id="rsvp-guests-label" className="field-label">
                        Number of guests
                      </span>
                      <div className="flex items-center gap-4" role="group" aria-labelledby="rsvp-guests-label">
                        <button
                          type="button"
                          className="flex h-12 w-12 items-center justify-center rounded-full border border-wine-800/30 text-wine-800 transition hover:bg-wine-800/5 disabled:opacity-35"
                          onClick={() => setGuestCount((n) => Math.max(1, n - 1))}
                          disabled={guestCount <= 1}
                          aria-label="One guest fewer"
                        >
                          <Minus size={18} aria-hidden="true" />
                        </button>
                        <output className="min-w-[3rem] text-center font-serif text-4xl font-medium tabular-nums text-wine-800" aria-live="polite" data-testid="guest-count">
                          {guestCount}
                        </output>
                        <button
                          type="button"
                          className="flex h-12 w-12 items-center justify-center rounded-full border border-wine-800/30 text-wine-800 transition hover:bg-wine-800/5 disabled:opacity-35"
                          onClick={() => setGuestCount((n) => Math.min(maxGuests, n + 1))}
                          disabled={guestCount >= maxGuests}
                          aria-label="One guest more"
                          data-testid="guest-plus"
                        >
                          <Plus size={18} aria-hidden="true" />
                        </button>
                        <span className="font-sans text-[0.8rem] text-ink-soft">including you</span>
                      </div>
                      {errors.guestCount ? <p className="field-error">{errors.guestCount}</p> : null}
                    </div>

                    {events.length > 0 ? (
                      <fieldset aria-describedby={errors.events ? 'rsvp-events-error' : undefined}>
                        <legend className="field-label">Events attending</legend>
                        <div className="grid gap-2.5 sm:grid-cols-3">
                          {events.map((item) => {
                            const checked = selected.includes(item.id);
                            return (
                              <label
                                key={item.id}
                                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition sm:flex-col sm:items-start sm:gap-1 ${
                                  checked ? 'border-wine-800 bg-wine-800 text-cream shadow-soft' : 'border-wine-800/25 bg-white/70 text-wine-800 hover:border-wine-800/60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="peer sr-only"
                                  checked={checked}
                                  onChange={() => toggleEvent(item.id)}
                                  aria-invalid={errors.events ? 'true' : undefined}
                                />
                                <span
                                  className={`flex h-5 w-5 flex-none items-center justify-center rounded-md border peer-focus-visible:ring-2 peer-focus-visible:ring-gold-500 ${
                                    checked ? 'border-cream bg-cream text-wine-800' : 'border-wine-800/40'
                                  }`}
                                  aria-hidden="true"
                                >
                                  {checked ? <Check size={14} strokeWidth={3} /> : null}
                                </span>
                                <span className="flex flex-1 items-baseline justify-between gap-2 sm:block">
                                  <span className="font-serif text-xl font-semibold leading-tight">{item.name}</span>
                                  <span className={`font-sans text-[0.78rem] sm:mt-0.5 sm:block ${checked ? 'text-cream/85' : 'text-ink-soft'}`}>{shortDate(item)}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                        {errors.events ? (
                          <p id="rsvp-events-error" className="field-error">
                            {errors.events}
                          </p>
                        ) : null}
                      </fieldset>
                    ) : null}
                  </>
                ) : null}

                {rsvp.allowDecline ? (
                  <label className="flex cursor-pointer items-center gap-3 font-sans text-[0.86rem] text-ink">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-wine-800/40 accent-[#570A34]"
                      checked={declining}
                      onChange={(e) => setDeclining(e.target.checked)}
                      data-testid="rsvp-decline"
                    />
                    Sadly, I will not be able to attend
                  </label>
                ) : null}

                <div>
                  <label htmlFor="rsvp-message" className="field-label">
                    Personal message <span className="font-normal normal-case tracking-normal text-ink-soft">(optional)</span>
                  </label>
                  <textarea
                    id="rsvp-message"
                    className="field-input min-h-[6.5rem] resize-y"
                    maxLength={RSVP_LIMITS.message}
                    placeholder="Your wishes and blessings for the couple"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                {/* Hidden from people; only automated spam fills it in. */}
                <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                  <label>
                    Website
                    <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
                  </label>
                </div>
              </div>

              {failure ? (
                <p className="mt-6 rounded-xl border border-red-800/30 bg-red-50 px-4 py-3 font-sans text-[0.86rem] text-red-900" role="alert" data-testid="rsvp-error">
                  {failure}
                </p>
              ) : null}

              <button type="submit" className="btn-wine mt-7 w-full" disabled={status === 'sending'} data-testid="rsvp-submit">
                {status === 'sending' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
                {status === 'sending' ? 'Sending' : rsvp.submitLabel || 'Send RSVP'}
              </button>

              {!backendConfigured && !previewOnly ? (
                <p className="mt-4 text-center font-sans text-[0.8rem] text-ink-soft">
                  Preview mode: responses will be saved once the website is connected to its database.
                </p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
