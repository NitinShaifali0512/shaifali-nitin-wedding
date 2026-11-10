import { Pause, Play, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MusicController } from '../hooks/useMusic';

/**
 * The floating music control: one tap turns the music on or off, and the
 * second button opens the volume slider and the mute switch.
 */
export function MusicControl({ music }: { music: MusicController }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!music.enabled) return null;

  const playing = music.status === 'playing';
  const loading = music.status === 'loading';
  const failed = music.status === 'error';
  const percent = Math.round(music.volume * 100);

  const statusText = failed
    ? 'The music could not be loaded.'
    : playing
      ? music.muted
        ? 'Playing, muted'
        : 'Now playing'
      : loading
        ? 'Loading music'
        : 'Music is off';

  return (
    <div
      ref={panelRef}
      className="fixed right-3 z-50 flex flex-col items-end gap-2"
      style={{ top: 'calc(var(--safe-top) + 0.75rem)' }}
      data-testid="music-control"
      data-status={music.status}
    >
      <div className="flex items-center rounded-full border border-gold-500/50 bg-ivory/95 p-1 text-wine-800 shadow-soft">
        <button
          type="button"
          onClick={music.toggle}
          disabled={failed}
          className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-wine-800/10 disabled:opacity-50"
          aria-label={playing ? 'Turn music off' : 'Turn music on'}
          aria-pressed={playing}
          title={statusText}
          data-testid="music-toggle"
        >
          {failed ? (
            <VolumeX size={17} aria-hidden="true" />
          ) : playing && !music.muted ? (
            <span className="sound-bars is-playing" aria-hidden="true">
              <span style={{ animationDelay: '0s' }} />
              <span style={{ animationDelay: '0.18s' }} />
              <span style={{ animationDelay: '0.36s' }} />
              <span style={{ animationDelay: '0.1s' }} />
            </span>
          ) : playing ? (
            <VolumeX size={17} aria-hidden="true" />
          ) : (
            <Play size={16} className={loading ? 'animate-pulse' : ''} aria-hidden="true" />
          )}
        </button>
        <span className="h-5 w-px bg-wine-800/20" aria-hidden="true" />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex h-10 w-9 items-center justify-center rounded-full transition hover:bg-wine-800/10"
          aria-label="Music settings"
          aria-expanded={open}
          data-testid="music-settings"
        >
          {open ? <X size={16} aria-hidden="true" /> : <SlidersHorizontal size={16} aria-hidden="true" />}
        </button>
      </div>

      {open ? (
        <div
          className="w-64 rounded-2xl border border-gold-500/40 bg-ivory p-4 text-ink shadow-card"
          style={{ animation: 'pop-in 0.2s ease' }}
          role="group"
          aria-label="Music settings"
          data-testid="music-panel"
        >
          <p className="font-serif text-lg font-semibold leading-tight text-wine-800">{music.title || 'Wedding music'}</p>
          <p className="mt-0.5 font-sans text-[0.78rem] text-ink-soft" aria-live="polite" data-testid="music-status">
            {statusText}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={music.toggleMute}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-wine-800/25 text-wine-800 transition hover:bg-wine-800/10"
              aria-label={music.muted ? 'Unmute music' : 'Mute music'}
              aria-pressed={music.muted}
              data-testid="music-mute"
            >
              {music.muted ? <VolumeX size={17} aria-hidden="true" /> : <Volume2 size={17} aria-hidden="true" />}
            </button>
            {music.volumeAdjustable ? (
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={percent}
                onChange={(event) => music.setVolume(Number(event.target.value) / 100)}
                className="volume-slider w-full"
                style={{ ['--fill' as string]: `${percent}%` }}
                aria-label="Music volume"
                data-testid="music-volume"
              />
            ) : (
              <p className="font-sans text-[0.76rem] leading-snug text-ink-soft">Use the volume buttons on your phone to change the loudness.</p>
            )}
          </div>

          <button type="button" onClick={music.toggle} disabled={failed} className="btn-wine mt-4 w-full disabled:opacity-50">
            {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            {playing ? 'Turn music off' : 'Turn music on'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
