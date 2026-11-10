import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryPhoto } from '../content/types';
import { assetUrl } from '../lib/links';

interface LightboxProps {
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const SWIPE_DISTANCE = 48;

/** Full-screen photo viewer with swipe, arrow keys and a close button. */
export function Lightbox({ photos, index, onIndexChange, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const startX = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  const count = photos.length;
  const photo = photos[index];

  const go = useCallback(
    (step: number) => {
      if (count < 2) return;
      onIndexChange((index + step + count) % count);
    },
    [count, index, onIndexChange],
  );

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.classList.add('is-locked');
    return () => {
      document.body.classList.remove('is-locked');
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Load the neighbouring photographs ahead of time so swiping feels instant.
  useEffect(() => {
    if (count < 2) return;
    [1, -1].forEach((step) => {
      const neighbour = photos[(index + step + count) % count];
      const src = neighbour ? assetUrl(neighbour.src) : '';
      if (src) new Image().src = src;
    });
  }, [count, index, photos]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-wine-950/[0.97]"
      style={{ animation: 'fade-in 0.3s ease' }}
      role="dialog"
      aria-modal="true"
      aria-label="Photograph viewer"
      data-testid="lightbox"
    >
      <div className="flex items-center justify-between px-4 pt-[calc(var(--safe-top)+0.75rem)] text-cream">
        <p className="font-sans text-xs font-semibold uppercase tracking-label" aria-live="polite">
          {index + 1} / {count}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
          aria-label="Close photograph viewer"
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center px-3"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onPointerDown={(event) => {
          startX.current = event.clientX;
        }}
        onPointerMove={(event) => {
          if (startX.current !== null) setDrag(event.clientX - startX.current);
        }}
        onPointerUp={() => {
          if (Math.abs(drag) > SWIPE_DISTANCE) go(drag < 0 ? 1 : -1);
          startX.current = null;
          setDrag(0);
        }}
        onPointerCancel={() => {
          startX.current = null;
          setDrag(0);
        }}
      >
        <img
          key={photo.id}
          src={assetUrl(photo.src)}
          alt={photo.caption || 'The couple'}
          className={`max-h-full max-w-full select-none object-contain shadow-2xl ${photo.frame === 'oval' ? 'rounded-[50%]' : 'rounded-sm'}`}
          style={{
            transform: `translateX(${drag}px)`,
            transition: drag === 0 ? 'transform 0.25s ease' : 'none',
            animation: 'pop-in 0.35s ease',
            maxHeight: '100%',
          }}
          draggable={false}
        />

        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-cream transition hover:bg-black/55 sm:left-5"
              aria-label="Previous photograph"
            >
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-cream transition hover:bg-black/55 sm:right-5"
              aria-label="Next photograph"
              data-testid="lightbox-next"
            >
              <ChevronRight size={24} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <p className="min-h-[3.5rem] px-6 pb-[calc(var(--safe-bottom)+1rem)] pt-3 text-center font-serif text-lg italic text-cream/90">
        {photo.caption}
      </p>
    </div>
  );
}
