import { useCallback, useState } from 'react';
import { CoupleDoodle, Flourish, HeartsDoodle } from '../art/Art';
import { scallopEllipsePath, scallopRectPath } from '../art/arch';
import catsArt from '../assets/art/cats.webp';
import scribbleHeart from '../assets/art/scribble-heart.webp';
import type { FrameStyle, GalleryPhoto, SiteContent } from '../content/types';
import { assetUrl } from '../lib/links';
import { Lightbox } from './Lightbox';

/** A gentle, repeating pattern of tilts and widths so the page feels hand-arranged. */
const TILTS = [-2.6, 1.9, 1.4, -1.8, 2.4, -1.2, -2.1, 1.6, -0.8];
const WIDTHS = ['100%', '94%', '97%', '90%', '100%', '95%', '92%', '100%', '96%'];
const TAPE_ANGLES = [-4, 3, -2, 5];

const OVAL_OUTLINE = scallopEllipsePath(400, 540, 36, 9);
const SCALLOP_OUTLINE = scallopRectPath(400, 280, 11);

function FrameOutline({ frame }: { frame: FrameStyle }) {
  if (frame === 'oval') {
    return (
      <svg className="frame-outline" viewBox="0 0 400 540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={OVAL_OUTLINE} fill="none" stroke="#2b1a22" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <ellipse cx="200" cy="270" rx="183" ry="253" fill="none" stroke="#2b1a22" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  if (frame === 'scallop') {
    return (
      <svg className="frame-outline" viewBox="0 0 400 280" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d={SCALLOP_OUTLINE} fill="#fdfbf7" stroke="#2b1a22" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

interface PhotoCardProps {
  photo: GalleryPhoto;
  index: number;
  onOpen: (index: number) => void;
}

function PhotoCard({ photo, index, onOpen }: PhotoCardProps) {
  const src = assetUrl(photo.src);
  const tilt = TILTS[index % TILTS.length];
  const hasTape = photo.frame === 'tape' || (photo.frame === 'polaroid' && index % 2 === 1);
  const label = photo.caption ? `Open photograph: ${photo.caption}` : `Open photograph ${index + 1}`;
  if (!src) return null;

  return (
    <div className="mb-7 break-inside-avoid sm:mb-9" style={{ width: WIDTHS[index % WIDTHS.length], marginLeft: index % 2 ? 'auto' : 0 }} data-reveal>
      <button
        type="button"
        onClick={() => onOpen(index)}
        className={`photo-frame frame-${photo.frame}`}
        style={{ ['--tilt' as string]: `${tilt}deg` }}
        aria-label={label}
        data-testid="gallery-photo"
      >
        {photo.frame === 'scallop' ? <FrameOutline frame="scallop" /> : null}
        {hasTape ? (
          <span
            className="tape"
            style={{ top: '-10px', left: '33%', transform: `rotate(${TAPE_ANGLES[index % TAPE_ANGLES.length]}deg)` }}
            aria-hidden="true"
          />
        ) : null}
        <img
          src={src}
          alt={photo.caption || 'The couple'}
          loading="lazy"
          decoding="async"
          // The pixel size lets the browser keep the right space free before the picture arrives.
          width={photo.width > 0 ? photo.width : undefined}
          height={photo.height > 0 ? photo.height : undefined}
          className={`relative ${photo.frame === 'arch' ? 'rounded-t-[999px]' : ''}`}
        />
        {photo.frame === 'oval' ? <FrameOutline frame="oval" /> : null}
        {photo.caption && photo.frame === 'polaroid' ? <span className="photo-caption">{photo.caption}</span> : null}
      </button>
      {photo.caption && photo.frame !== 'polaroid' ? (
        <p className="photo-caption mt-3" style={{ transform: `rotate(${tilt / 2}deg)` }}>
          {photo.caption}
        </p>
      ) : null}
    </div>
  );
}

export function Gallery({ content }: { content: SiteContent }) {
  const { gallery } = content;
  const photos = gallery.photos.filter((photo) => assetUrl(photo.src));
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const close = useCallback(() => setOpenIndex(null), []);

  return (
    <section id="gallery" className="bg-blush-paper relative overflow-hidden" aria-labelledby="gallery-heading">
      <img src={scribbleHeart} alt="" className="pointer-events-none absolute -right-6 top-24 w-32 opacity-80 sm:right-[8%] sm:w-44" loading="lazy" decoding="async" />
      <HeartsDoodle className="pointer-events-none absolute -left-4 top-[42%] w-24 text-white/80 sm:left-[4%] sm:w-32" />

      <div className="relative mx-auto max-w-content px-5 pb-20 pt-20 sm:px-8 sm:pt-24">
        <div className="mx-auto max-w-xl text-center" data-reveal>
          {gallery.eyebrow ? <p className="eyebrow text-gold-700">{gallery.eyebrow}</p> : null}
          <h2 id="gallery-heading" className="section-heading mt-3 text-wine-800">
            {gallery.heading || 'Our Moments'}
          </h2>
          <CoupleDoodle className="mx-auto mt-4 w-44 text-wine-700/80" />
          {gallery.description ? <p className="lead mt-3 text-ink-soft">{gallery.description}</p> : null}
        </div>

        {photos.length === 0 ? (
          <div className="mt-10 text-center" data-reveal>
            <Flourish className="mb-5 text-gold-500" />
            <p className="font-serif text-xl italic text-ink-soft">Photographs will be added here soon.</p>
          </div>
        ) : (
          <div className="mt-12 columns-2 gap-5 sm:gap-8 lg:columns-3" data-testid="gallery-grid">
            {photos.map((photo, index) => (
              <PhotoCard key={photo.id} photo={photo} index={index} onOpen={setOpenIndex} />
            ))}
          </div>
        )}

        <img src={catsArt} alt="" className="pointer-events-none mx-auto mt-4 w-28 sm:w-36" loading="lazy" decoding="async" />
      </div>

      {openIndex !== null ? <Lightbox photos={photos} index={openIndex} onIndexChange={setOpenIndex} onClose={close} /> : null}
    </section>
  );
}
