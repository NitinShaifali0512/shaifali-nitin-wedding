import type { CSSProperties } from 'react';
import { assetUrl } from '../lib/links';
import { ARCH_HEAD_HEIGHT, ARCH_WIDTH, archPath } from './arch';
import { type ArtData, coupleArt, ganeshaArt, heartsArt, omArt, ringsArt } from './cardArt';

interface LineArtProps {
  art: ArtData;
  className?: string;
  style?: CSSProperties;
  label?: string;
}

/** A drawing from the invitation card, coloured with the current text colour. */
export function LineArt({ art, className, style, label }: LineArtProps) {
  return (
    <svg
      viewBox={art.viewBox}
      className={className}
      style={style}
      fill="currentColor"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      // The markup is generated at build time from the couple's own card, never from user input.
      dangerouslySetInnerHTML={{ __html: art.inner }}
    />
  );
}

type ArtProps = Omit<LineArtProps, 'art'>;

export const OmArt = (props: ArtProps) => <LineArt art={omArt} {...props} />;
export const GaneshaArt = (props: ArtProps) => <LineArt art={ganeshaArt} {...props} />;
export const CoupleDoodle = (props: ArtProps) => <LineArt art={coupleArt} {...props} />;
export const RingsDoodle = (props: ArtProps) => <LineArt art={ringsArt} {...props} />;
export const HeartsDoodle = (props: ArtProps) => <LineArt art={heartsArt} {...props} />;

interface MonogramProps {
  image: string;
  initials: string;
  className?: string;
  /** When true the bundled monogram is tinted with the current colour instead of shown as drawn. */
  tint?: boolean;
}

/** The couple's monogram: artwork when available, otherwise their initials. */
export function Monogram({ image, initials, className = '', tint = false }: MonogramProps) {
  const url = assetUrl(image);
  if (url && tint) {
    return (
      <span
        className={`mask-art block ${className}`}
        style={{ WebkitMaskImage: `url("${url}")`, maskImage: `url("${url}")` }}
        role="img"
        aria-label={`${initials} monogram`}
      />
    );
  }
  if (url) {
    return <img src={url} alt={`${initials} monogram`} className={`block object-contain ${className}`} />;
  }
  return (
    <span className={`flex items-center justify-center font-serif font-medium leading-none ${className}`} aria-label={`${initials} monogram`}>
      <span style={{ fontSize: '2.2em', letterSpacing: '-0.08em' }}>{initials}</span>
    </span>
  );
}

/** A small ornamental divider: a rule, a diamond, a rule. */
export function Flourish({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-12 bg-current opacity-50" />
      <span className="h-1.5 w-1.5 rotate-45 bg-current opacity-80" />
      <span className="h-px w-12 bg-current opacity-50" />
    </div>
  );
}

/**
 * The arch-topped panel from the card. The decorative head keeps its exact
 * proportions and the straight sides stretch to fit whatever is inside.
 */
export function ArchPanel({ children, fill, className = '' }: { children: React.ReactNode; fill: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-0 flex flex-col" aria-hidden="true">
        <svg viewBox={`0 0 ${ARCH_WIDTH} ${ARCH_HEAD_HEIGHT}`} className="block w-full flex-none" focusable="false">
          <path d={archPath(ARCH_HEAD_HEIGHT)} fill={fill} />
        </svg>
        <div className="-mt-px flex-1" style={{ background: fill, marginLeft: '1.6%', marginRight: '1.6%' }} />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
