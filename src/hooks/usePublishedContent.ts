import { useEffect, useRef, useState } from 'react';
import { defaultContent } from '../content/defaults';
import { normalizeContent } from '../content/normalize';
import type { SiteContent } from '../content/types';
import { fetchPublishedContent } from '../lib/api';
import { backendConfigured } from '../lib/config';
import { readStored, writeStored } from '../lib/storage';

const CACHE_KEY = 'wedding:published:v1';
const REFRESH_AFTER_MS = 60_000;

export const PREVIEW_READY = 'wedding-preview-ready';
export const PREVIEW_CONTENT = 'wedding-preview-content';

export type ContentSource = 'bundled' | 'cache' | 'live' | 'preview';

interface ContentState {
  content: SiteContent;
  ready: boolean;
  source: ContentSource;
}

interface CachedContent {
  content: unknown;
  updatedAt: string;
}

/** True when the page is the dashboard's live preview, shown inside a frame. */
export function isPreviewFrame(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('preview') && window.parent !== window;
  } catch {
    return false;
  }
}

/**
 * Supplies the content guests see.
 *
 * The last published copy is kept on the device, so a returning guest sees
 * the invitation immediately while the newest copy loads in the background.
 * If the database cannot be reached at all, the content that ships with the
 * website is shown, so the invitation never fails to open.
 */
export function usePublishedContent(): ContentState {
  const preview = useRef(isPreviewFrame()).current;

  const [state, setState] = useState<ContentState>(() => {
    if (preview) return { content: normalizeContent(defaultContent), ready: false, source: 'preview' };
    if (!backendConfigured) return { content: normalizeContent(defaultContent), ready: true, source: 'bundled' };
    const cached = readStored<CachedContent>(CACHE_KEY);
    if (cached?.content) return { content: normalizeContent(cached.content), ready: true, source: 'cache' };
    return { content: normalizeContent(defaultContent), ready: false, source: 'bundled' };
  });

  // Live preview: the dashboard sends the draft it is editing.
  useEffect(() => {
    if (!preview) return undefined;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; content?: unknown } | null;
      if (!data || data.type !== PREVIEW_CONTENT) return;
      setState({ content: normalizeContent(data.content), ready: true, source: 'preview' });
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: PREVIEW_READY }, window.location.origin);
    const timer = window.setTimeout(() => setState((current) => ({ ...current, ready: true })), 4000);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
    };
  }, [preview]);

  // Guests: load the published copy, and refresh it when they return to the tab.
  useEffect(() => {
    if (preview || !backendConfigured) return undefined;
    let cancelled = false;
    let lastLoaded = 0;
    let loading = false;

    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const published = await fetchPublishedContent();
        if (cancelled) return;
        lastLoaded = Date.now();
        if (published) {
          writeStored(CACHE_KEY, { content: published.content, updatedAt: published.updatedAt });
          setState({ content: published.content, ready: true, source: 'live' });
        } else {
          setState((current) => ({ ...current, ready: true }));
        }
      } catch {
        if (!cancelled) setState((current) => ({ ...current, ready: true }));
      } finally {
        loading = false;
      }
    };

    void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoaded > REFRESH_AFTER_MS) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [preview]);

  return state;
}
