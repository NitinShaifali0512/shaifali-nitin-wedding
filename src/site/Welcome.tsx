import { Flourish, OmArt } from '../art/Art';
import { ARCH_WIDTH, archMask, archPath } from '../art/arch';
import peonyCorner from '../assets/art/peony-corner.webp';
import peonyLarge from '../assets/art/peony-large.webp';
import type { SiteContent } from '../content/types';
import { useCountdown } from '../hooks/useCountdown';
import { istDateTimeToEpoch } from '../lib/dates';
import { assetUrl } from '../lib/links';

const ARCH_HEIGHT = 430;
const ARCH_MASK = archMask(ARCH_HEIGHT);

const FOCUS_POSITION: Record<SiteContent['welcome']['photoFocus'], string> = {
  center: '50% 40%',
  left: '36% 40%',
  right: '64% 40%',
  top: '50% 12%',
  bottom: '50% 88%',
};

function ArchPhoto({ src, alt, focus }: { src: string; alt: string; focus: SiteContent['welcome']['photoFocus'] }) {
  return (
    <div className="relative mx-auto w-[min(78vw,21rem)] lg:w-[23rem]" data-reveal="zoom">
      {/* fine gold outline that follows the arch */}
      <svg
        viewBox={`-10 -10 ${ARCH_WIDTH + 20} ${ARCH_HEIGHT + 20}`}
        className="pointer-events-none absolute -inset-[3%] h-[106%] w-[106%] text-gold-500"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d={archPath(ARCH_HEIGHT)} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="arch-photo">
        <div
          className="arch-photo-inner bg-wine-800"
          style={{
            WebkitMaskImage: ARCH_MASK,
            maskImage: ARCH_MASK,
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
          }}
        >
          {src ? (
            <img
              src={src}
              alt={alt}
              className="h-full w-full object-cover"
              style={{ objectPosition: FOCUS_POSITION[focus] }}
              decoding="async"
            />
          ) : null}
        </div>
      </div>
      <img src={peonyLarge} alt="" className="pointer-events-none absolute -bottom-[7%] -left-[19%] w-[52%]" decoding="async" />
      <img
        src={peonyCorner}
        alt=""
        className="pointer-events-none absolute -bottom-[6%] -right-[17%] w-[44%]"
        style={{ transform: 'scaleX(-1) rotate(8deg)' }}
        decoding="async"
      />
    </div>
  );
}

function Countdown({ countdown }: { countdown: SiteContent['countdown'] }) {
  const target = istDateTimeToEpoch(countdown.target);
  const parts = useCountdown(countdown.enabled ? target : null);
  if (!countdown.enabled || !parts) return null;

  if (parts.done) {
    return (
      <p className="lead mx-auto max-w-sm text-wine-800" data-reveal data-testid="countdown-done">
        {countdown.doneMessage}
      </p>
    );
  }

  const cells: Array<[number, string]> = [
    [parts.days, parts.days === 1 ? 'Day' : 'Days'],
    [parts.hours, parts.hours === 1 ? 'Hour' : 'Hours'],
    [parts.minutes, parts.minutes === 1 ? 'Minute' : 'Minutes'],
    [parts.seconds, parts.seconds === 1 ? 'Second' : 'Seconds'],
  ];

  return (
    <div data-reveal data-testid="countdown">
      {countdown.label ? <p className="eyebrow mb-3 text-gold-700">{countdown.label}</p> : null}
      <div
        className="mx-auto grid max-w-[22rem] grid-cols-4 gap-2 lg:mx-0"
        role="timer"
        aria-label={`${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes to go`}
      >
        {cells.map(([value, label]) => (
          <div
            key={label}
            className="rounded-2xl border border-gold-500/40 bg-white/60 px-1 py-3 shadow-[0_6px_20px_-14px_rgba(69,8,41,0.5)]"
            aria-hidden="true"
          >
            <div className="font-serif font-medium tabular-nums text-wine-800" style={{ fontSize: 'clamp(1.7rem, 8vw, 2.3rem)', lineHeight: 1 }}>
              {String(value).padStart(2, '0')}
            </div>
            <div className="mt-1.5 font-sans text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-ink-soft">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface WelcomeProps {
  content: SiteContent;
  hasEvents: boolean;
  hasGallery: boolean;
}

export function Welcome({ content, hasEvents, hasGallery }: WelcomeProps) {
  const { couple, welcome } = content;
  const background = assetUrl(welcome.backgroundImage);

  return (
    <section id="welcome" className="relative overflow-hidden bg-paper" aria-labelledby="welcome-names">
      {background ? (
        <div className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: `url("${background}")` }} aria-hidden="true" />
      ) : null}
      {/* a soft blush glow behind the photograph */}
      <div
        className="pointer-events-none absolute left-1/2 top-24 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full opacity-70 lg:left-[26%]"
        style={{ background: 'radial-gradient(circle, rgba(241,194,198,0.55) 0%, rgba(241,194,198,0) 68%)' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-content px-6 pb-20 pt-[4.5rem] text-center sm:pt-24 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:pb-28 lg:text-left">
        <div className="lg:order-1">
          <div className="mb-8 lg:hidden">
            <OmArt className="mx-auto h-9 w-auto text-wine-700" label="Om" />
            {welcome.eyebrow ? <p className="eyebrow mt-4 text-gold-700">{welcome.eyebrow}</p> : null}
          </div>
          <ArchPhoto src={assetUrl(welcome.photo)} alt={`${couple.brideName} and ${couple.groomName}`} focus={welcome.photoFocus} />
        </div>

        <div className="mt-14 lg:order-2 lg:mt-0">
          <div className="hidden lg:block">
            <OmArt className="h-10 w-auto text-wine-700" label="Om" />
            {welcome.eyebrow ? <p className="eyebrow mt-5 text-gold-700">{welcome.eyebrow}</p> : null}
          </div>

          <h2 id="welcome-names" className="names mt-4 text-wine-800" style={{ fontSize: 'clamp(1.9rem, 8.6vw, 3.1rem)' }} data-reveal>
            <span className="block">{couple.brideName}</span>
            <span className="block font-serif italic text-gold-500" style={{ fontSize: '0.75em' }} aria-label="and">
              &amp;
            </span>
            <span className="block">{couple.groomName}</span>
          </h2>

          {couple.brideParents || couple.groomParents ? (
            <div className="mt-5 space-y-1 font-serif text-[1.02rem] text-ink-soft" data-reveal>
              {couple.brideParents ? <p>{couple.brideParents}</p> : null}
              {couple.groomParents ? <p>{couple.groomParents}</p> : null}
            </div>
          ) : null}

          <Flourish className="my-6 text-gold-500 lg:justify-start" />

          {welcome.message ? (
            <p className="lead mx-auto max-w-md text-ink lg:mx-0" data-reveal>
              {welcome.message}
            </p>
          ) : null}

          {welcome.dateLabel || welcome.locationLabel ? (
            <div className="mt-8" data-reveal>
              {welcome.dateLabel ? (
                <p className="inline-block border-y border-wine-800/35 px-3 py-2.5 font-sans text-[0.78rem] font-semibold uppercase tracking-label text-wine-800">
                  {welcome.dateLabel}
                </p>
              ) : null}
              {welcome.locationLabel ? <p className="mt-3 font-serif text-lg italic text-ink-soft">{welcome.locationLabel}</p> : null}
            </div>
          ) : null}

          <div className="mt-9">
            <Countdown countdown={content.countdown} />
          </div>

          {hasEvents || hasGallery ? (
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start" data-reveal>
              {hasEvents && welcome.eventsButtonLabel ? (
                <a href="#events" className="btn-wine w-full max-w-[18rem] sm:w-auto">
                  {welcome.eventsButtonLabel}
                </a>
              ) : null}
              {hasGallery && welcome.galleryButtonLabel ? (
                <a href="#gallery" className="btn-outline w-full max-w-[18rem] sm:w-auto">
                  {welcome.galleryButtonLabel}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
