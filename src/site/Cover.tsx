import { useEffect, useRef } from 'react';
import { GaneshaArt, Monogram, OmArt } from '../art/Art';
import ganeshMedallion from '../assets/art/ganesh-medallion.webp';
import peonyCorner from '../assets/art/peony-corner.webp';
import peonyLarge from '../assets/art/peony-large.webp';
import { orderedNames } from '../content/names';
import type { SiteContent } from '../content/types';
import { assetUrl } from '../lib/links';

export type CoverPhase = 'closed' | 'opening' | 'open';

interface CoverProps {
  content: SiteContent;
  phase: CoverPhase;
  onOpen: () => void;
}

function Door({ side }: { side: 'left' | 'right' }) {
  return (
    <div className={`cover-door cover-door-${side}`}>
      <div className="lattice" />
      <div className="lotus-border lotus-border-top" />
      <div className="lotus-border lotus-border-bottom" />
      <div className="cover-door-frame" />
      <img src={peonyCorner} alt="" className="cover-floral-top" decoding="async" />
      <img src={peonyLarge} alt="" className="cover-floral-bottom" decoding="async" />
    </div>
  );
}

function Emblem({ kind }: { kind: SiteContent['opening']['emblem'] }) {
  const size = { height: 'clamp(58px, 11.5vh, 104px)' };
  if (kind === 'none') return null;
  if (kind === 'medallion') {
    return <img src={ganeshMedallion} alt="Shri Ganesh" style={{ height: 'clamp(84px, 16vh, 150px)' }} className="mx-auto w-auto" />;
  }
  if (kind === 'om') return <OmArt label="Om" className="mx-auto w-auto text-cream" style={size} />;
  return <GaneshaArt label="Shri Ganesh" className="mx-auto w-auto text-gold-300" style={size} />;
}

/**
 * The opening invitation. It behaves like a gatefold card: the guest taps
 * "Open Invitation", the monogram seal lifts away and the two doors swing
 * open to reveal the website. The tap is also what allows the music to start,
 * because browsers only play sound after the visitor has interacted.
 */
export function Cover({ content, phase, onOpen }: CoverProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { couple, opening } = content;
  const [firstName, secondName] = orderedNames(couple);
  const background = assetUrl(opening.backgroundImage);

  useEffect(() => {
    // Keyboard and screen-reader users land on the button straight away.
    if (phase === 'closed') buttonRef.current?.focus({ preventScroll: true });
  }, [phase]);

  if (phase === 'open') return null;

  return (
    <div
      className={`cover ${phase === 'opening' ? 'is-opening' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Wedding invitation of ${firstName} and ${secondName}`}
      data-testid="cover"
    >
      <div className="cover-doors" aria-hidden="true">
        <Door side="left" />
        <Door side="right" />
      </div>

      {background ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 transition-opacity duration-500"
          style={{ backgroundImage: `url("${background}")`, opacity: phase === 'opening' ? 0 : undefined }}
          aria-hidden="true"
        />
      ) : null}

      <div className="cover-content">
        <div
          className="mx-auto flex min-h-full w-full max-w-[26rem] flex-col items-center justify-center px-7 text-center text-cream"
          style={{
            paddingTop: 'calc(var(--safe-top) + clamp(2.4rem, 6vh, 4rem))',
            paddingBottom: 'calc(var(--safe-bottom) + clamp(2.4rem, 6vh, 4rem))',
            gap: 'clamp(0.5rem, 1.7vh, 1.15rem)',
          }}
        >
          <Emblem kind={opening.emblem} />

          {opening.invocation ? (
            <p className="font-deva text-gold-300" style={{ fontSize: 'clamp(0.95rem, 2.3vh, 1.2rem)' }} lang="sa">
              {opening.invocation}
            </p>
          ) : null}

          {opening.heading ? (
            <p className="font-serif italic text-cream/90" style={{ fontSize: 'clamp(1.05rem, 2.6vh, 1.35rem)' }}>
              {opening.heading}
            </p>
          ) : null}

          <h1 className="names text-cream" style={{ fontSize: 'clamp(1.55rem, min(7.4vw, 4.6vh), 2.7rem)' }}>
            <span className="block">{firstName}</span>
            <span
              className="block font-serif italic text-gold-300"
              style={{ fontSize: '0.8em', lineHeight: 1.25 }}
              aria-label="and"
            >
              &amp;
            </span>
            <span className="block">{secondName}</span>
          </h1>

          {opening.message ? (
            <p
              className="max-w-[19rem] font-serif text-cream/90"
              style={{ fontSize: 'clamp(1rem, 2.4vh, 1.2rem)', lineHeight: 1.4 }}
            >
              {opening.message}
            </p>
          ) : null}

          {opening.dateLine ? (
            <p
              className="font-sans font-semibold uppercase text-gold-300"
              style={{ fontSize: 'clamp(0.68rem, 1.7vh, 0.82rem)', letterSpacing: '0.18em', lineHeight: 1.7 }}
            >
              {/* "Date · Place" is shown as two tidy lines, split at the dot. */}
              {opening.dateLine.split(/\s*[·|\n]\s*/).map((part, index) => (
                <span key={index} className="block">
                  {part}
                </span>
              ))}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onOpen}
            className="seal flex-none rounded-full focus-visible:outline-offset-8"
            aria-label={opening.buttonLabel || 'Open invitation'}
            tabIndex={-1}
          >
            <span className="seal-mandala mask-art" aria-hidden="true" />
            <span className="seal-glow" aria-hidden="true" />
            <span className="seal-disc" aria-hidden="true" />
            <Monogram
              image={couple.monogramImage}
              initials={couple.monogram}
              tint={couple.monogramImage.startsWith('media/art/')}
              className="absolute left-[22%] top-[22%] h-[56%] w-[56%] text-gold-300"
            />
          </button>

          <button
            ref={buttonRef}
            type="button"
            onClick={onOpen}
            className="btn-gold shimmer mt-1 px-8"
            data-testid="open-invitation"
          >
            {opening.buttonLabel || 'Open Invitation'}
          </button>
        </div>
      </div>
    </div>
  );
}
