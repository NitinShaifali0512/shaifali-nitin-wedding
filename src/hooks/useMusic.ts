import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SiteContent } from '../content/types';
import { DEFAULT_MUSIC_PATH } from '../lib/config';
import { assetUrl, safeHttpUrl } from '../lib/links';
import { readStored, writeStored } from '../lib/storage';

const PREFS_KEY = 'wedding:music:v1';
const FADE_IN_MS = 1800;

/**
 * - idle:    nothing has been asked to play yet
 * - loading: the browser is fetching or buffering the track
 * - playing: sound is actually coming out
 * - paused:  stopped by the guest, or the browser refused to start it
 * - error:   the audio file could not be loaded
 *
 * The interface only ever shows "playing" after the browser itself reports
 * that playback has started.
 */
export type MusicStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface MusicPrefs {
  volume?: number;
  muted?: boolean;
}

export interface MusicController {
  enabled: boolean;
  status: MusicStatus;
  title: string;
  volume: number;
  muted: boolean;
  /** False on iPhones and iPads, where only the hardware buttons change the volume. */
  volumeAdjustable: boolean;
  start: () => void;
  toggle: () => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
}

function detectVolumeControl(): boolean {
  try {
    const probe = document.createElement('audio');
    probe.volume = 0.5;
    return probe.volume === 0.5;
  } catch {
    return false;
  }
}

export function musicSource(music: SiteContent['music']): string {
  if (music.source === 'custom') {
    const custom = safeHttpUrl(music.url);
    if (custom) return custom;
  }
  return assetUrl(DEFAULT_MUSIC_PATH);
}

export function useMusic(music: SiteContent['music'], artist: string): MusicController {
  const src = useMemo(() => musicSource(music), [music]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wantsPlayRef = useRef(false);
  const fadeRef = useRef<number | null>(null);
  const resumeOnVisibleRef = useRef(false);

  const prefs = useRef<MusicPrefs>(readStored<MusicPrefs>(PREFS_KEY) ?? {}).current;
  const [status, setStatus] = useState<MusicStatus>('idle');
  const [volume, setVolumeState] = useState<number>(() =>
    typeof prefs.volume === 'number' ? Math.min(1, Math.max(0, prefs.volume)) : music.volume,
  );
  const [muted, setMuted] = useState<boolean>(() => prefs.muted === true);
  const [volumeAdjustable] = useState<boolean>(() => detectVolumeControl());

  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const stopFade = useCallback(() => {
    if (fadeRef.current !== null) {
      window.cancelAnimationFrame(fadeRef.current);
      fadeRef.current = null;
    }
  }, []);

  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.addEventListener('playing', () => setStatus('playing'));
    audio.addEventListener('waiting', () => {
      if (wantsPlayRef.current) setStatus('loading');
    });
    audio.addEventListener('pause', () => {
      if (!audio.error) setStatus('paused');
    });
    audio.addEventListener('error', () => {
      wantsPlayRef.current = false;
      setStatus('error');
    });
    audioRef.current = audio;
    return audio;
  }, []);

  const play = useCallback(
    (fadeIn: boolean) => {
      if (!music.enabled || !src) return;
      const audio = ensureAudio();
      if (audio.getAttribute('data-src') !== src) {
        audio.src = src;
        audio.setAttribute('data-src', src);
      }
      wantsPlayRef.current = true;
      audio.muted = mutedRef.current;
      stopFade();

      const target = volumeRef.current;
      if (fadeIn && volumeAdjustable && target > 0) {
        audio.volume = 0;
        const startedAt = performance.now();
        const step = (now: number) => {
          // The frame's timestamp can be a hair earlier than the moment the fade began,
          // so the progress is kept between 0 and 1. A negative volume makes browsers throw.
          const progress = Math.min(1, Math.max(0, (now - startedAt) / FADE_IN_MS));
          audio.volume = Math.min(1, Math.max(0, volumeRef.current * progress));
          fadeRef.current = progress < 1 ? window.requestAnimationFrame(step) : null;
        };
        fadeRef.current = window.requestAnimationFrame(step);
      } else if (volumeAdjustable) {
        audio.volume = target;
      }

      setStatus((current) => (current === 'playing' ? current : 'loading'));
      const attempt = audio.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => {
          // The browser refused (for example autoplay rules) or the file failed to load.
          wantsPlayRef.current = false;
          stopFade();
          setStatus(audio.error ? 'error' : 'paused');
        });
      }
    },
    [ensureAudio, music.enabled, src, stopFade, volumeAdjustable],
  );

  const pause = useCallback(() => {
    wantsPlayRef.current = false;
    stopFade();
    audioRef.current?.pause();
  }, [stopFade]);

  const start = useCallback(() => play(true), [play]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) pause();
    else play(false);
  }, [pause, play]);

  const setVolume = useCallback(
    (value: number) => {
      const next = Math.min(1, Math.max(0, value));
      stopFade();
      setVolumeState(next);
      if (audioRef.current && volumeAdjustable) audioRef.current.volume = next;
      const nextMuted = next === 0 ? mutedRef.current : false;
      if (next > 0 && mutedRef.current) {
        setMuted(false);
        if (audioRef.current) audioRef.current.muted = false;
      }
      writeStored(PREFS_KEY, { volume: next, muted: nextMuted });
    },
    [stopFade, volumeAdjustable],
  );

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
    writeStored(PREFS_KEY, { volume: volumeRef.current, muted: next });
  }, []);

  // If the track is replaced in the dashboard while a guest is listening, switch to it.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audio.getAttribute('data-src') === src) return;
    const wasPlaying = !audio.paused;
    audio.src = src;
    audio.setAttribute('data-src', src);
    if (wasPlaying) play(false);
  }, [play, src]);

  // Music switched off in the dashboard: stop immediately.
  useEffect(() => {
    if (!music.enabled) pause();
  }, [music.enabled, pause]);

  // Be polite: go quiet when the guest leaves the tab or locks the phone.
  useEffect(() => {
    const onVisibility = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (document.visibilityState === 'hidden') {
        if (!audio.paused) {
          resumeOnVisibleRef.current = true;
          stopFade();
          audio.pause();
        }
      } else if (resumeOnVisibleRef.current) {
        resumeOnVisibleRef.current = false;
        play(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [play, stopFade]);

  // Lock-screen and notification details on phones.
  useEffect(() => {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    if (status !== 'playing') return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: music.title || 'Wedding music', artist });
    } catch {
      /* optional feature */
    }
  }, [artist, music.title, status]);

  useEffect(
    () => () => {
      stopFade();
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    },
    [stopFade],
  );

  return {
    enabled: music.enabled && Boolean(src),
    status: music.enabled ? status : 'idle',
    title: music.title,
    volume,
    muted,
    volumeAdjustable,
    start,
    toggle,
    setVolume,
    toggleMute,
  };
}
