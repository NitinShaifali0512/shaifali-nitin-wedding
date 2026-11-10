import { Check, Link2, Phone } from 'lucide-react';
import { useState } from 'react';
import { Flourish, Monogram } from '../art/Art';
import { orderedNames } from '../content/names';
import type { SiteContent } from '../content/types';
import { SANDBOX_PREVIEW } from '../lib/config';
import { formatDate, parseDate } from '../lib/dates';
import { assetUrl, formatPhone, safeHttpUrl, siteUrl, telHref, whatsappChatHref, whatsappShareHref } from '../lib/links';
import { WhatsAppIcon } from './WhatsAppIcon';

export function Footer({ content }: { content: SiteContent }) {
  const { footer, couple, share } = content;
  const [firstName, secondName] = orderedNames(couple);
  const [copied, setCopied] = useState(false);
  if (!footer.visible) return null;

  const background = assetUrl(footer.backgroundImage);
  const dates = content.events.filter((event) => event.visible && parseDate(event.date));
  const contacts = footer.contacts.filter((contact) => contact.phone.trim());
  const socials = footer.socials.filter((social) => safeHttpUrl(social.url));
  const link = siteUrl();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <footer className="bg-wine-rich relative overflow-hidden text-cream" data-testid="footer">
      {background ? (
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url("${background}")` }} aria-hidden="true" />
      ) : null}
      <div className="lattice" />
      <div className="lotus-border lotus-border-top" />
      <div className="mandala-backdrop mask-art" aria-hidden="true" />

      <div className="relative mx-auto max-w-xl px-6 pb-[calc(var(--safe-bottom)+7rem)] pt-24 text-center md:pb-16">
        <Monogram
          image={couple.monogramImage}
          initials={couple.monogram}
          tint={couple.monogramImage.startsWith('media/art/')}
          className="mx-auto h-20 w-20 text-rose-300"
        />

        {footer.thankYouHeading ? (
          <h2 className="mt-7 font-serif italic" style={{ fontSize: 'clamp(2.2rem, 9vw, 3rem)', lineHeight: 1.1 }} data-reveal>
            {footer.thankYouHeading}
          </h2>
        ) : null}
        {footer.message ? (
          <p className="lead mx-auto mt-4 max-w-md text-cream/90" data-reveal>
            {footer.message}
          </p>
        ) : null}

        <Flourish className="my-8 text-gold-300" />

        <p className="names text-cream" style={{ fontSize: 'clamp(1.35rem, 6vw, 1.9rem)' }}>
          <span className="block">{firstName}</span>
          <span className="block font-serif italic text-gold-300" aria-label="and">
            &amp;
          </span>
          <span className="block">{secondName}</span>
        </p>

        {dates.length > 0 ? (
          <ul className="mt-5 space-y-1.5 font-sans text-[0.78rem] font-medium uppercase tracking-label text-cream/85">
            {dates.map((event) => (
              <li key={event.id}>
                <span className="text-gold-300">{event.name}</span>
                <span className="mx-2 opacity-60" aria-hidden="true">
                  ·
                </span>
                {formatDate(event.date)}
              </li>
            ))}
          </ul>
        ) : null}

        {contacts.length > 0 ? (
          <div className="mt-10" data-reveal>
            {footer.contactsHeading ? <p className="eyebrow text-gold-300">{footer.contactsHeading}</p> : null}
            <ul className="mt-4 flex flex-col items-center gap-2.5">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex items-center gap-2">
                  <a
                    href={telHref(contact.phone)}
                    className="inline-flex min-h-[2.75rem] items-center gap-2.5 rounded-full border border-cream/30 px-5 font-sans text-[0.95rem] font-medium tracking-wide transition hover:border-cream/70 hover:bg-cream/10"
                    aria-label={`Call ${contact.label || ''} ${formatPhone(contact.phone)}`.replace(/\s+/g, ' ')}
                  >
                    <Phone size={15} className="text-gold-300" aria-hidden="true" />
                    <span>
                      {contact.label ? <span className="mr-2 text-cream/75">{contact.label} </span> : null}
                      <span className="tabular-nums">{formatPhone(contact.phone)}</span>
                    </span>
                  </a>
                  <a
                    href={whatsappChatHref(contact.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-cream/30 text-cream transition hover:border-cream/70 hover:bg-cream/10"
                    aria-label={`Message ${formatPhone(contact.phone)} on WhatsApp`}
                  >
                    <WhatsAppIcon size={18} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {footer.showShareButton && !SANDBOX_PREVIEW ? (
          <div className="mt-10 flex flex-col items-center gap-3" data-reveal>
            <a
              href={whatsappShareHref(share.whatsappMessage, link)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold"
              data-testid="whatsapp-share"
            >
              <WhatsAppIcon size={17} />
              Share on WhatsApp
            </a>
            {typeof navigator !== 'undefined' && navigator.clipboard ? (
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex min-h-[2.75rem] items-center gap-2 px-3 font-sans text-[0.7rem] font-semibold uppercase tracking-label text-cream/85 underline-offset-4 hover:underline"
              >
                {copied ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
                <span aria-live="polite">{copied ? 'Link copied' : 'Copy invitation link'}</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {socials.length > 0 ? (
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-sans text-[0.78rem] font-semibold uppercase tracking-label">
            {socials.map((social) => (
              <li key={social.id}>
                <a href={safeHttpUrl(social.url)} target="_blank" rel="noopener noreferrer" className="text-cream/85 underline-offset-4 hover:text-cream hover:underline">
                  {social.label || 'Link'}
                </a>
              </li>
            ))}
          </ul>
        ) : null}

        {footer.closingLine ? (
          <p className="mt-12 font-serif text-xl italic text-cream/90">
            {footer.closingLine},
            <br />
            <span className="not-italic">
              {firstName.split(' ')[0]} &amp; {secondName.split(' ')[0]}
            </span>
          </p>
        ) : null}

        {SANDBOX_PREVIEW ? (
          <p className="mx-auto mt-12 max-w-md rounded-2xl border border-cream/25 px-5 py-4 font-sans text-[0.8rem] leading-relaxed text-cream/85" data-testid="preview-note">
            You are viewing a preview copy with the built-in content. Saving RSVPs, sharing on WhatsApp and downloading
            calendar files switch on when the website goes online at its own address.
          </p>
        ) : null}
      </div>
    </footer>
  );
}
