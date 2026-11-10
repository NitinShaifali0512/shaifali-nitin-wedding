import { Monitor, Smartphone, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SiteContent } from '../content/types';
import { PREVIEW_CONTENT, PREVIEW_READY } from '../hooks/usePublishedContent';

/**
 * Live preview: the real website, shown inside a frame and fed with the
 * content that is on screen in the dashboard, including unsaved changes.
 * Nothing here is visible to guests.
 */
export function Preview({ content, onClose }: { content: SiteContent; onClose: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const [showOpening, setShowOpening] = useState(false);

  const base = import.meta.env.BASE_URL.startsWith('/') ? import.meta.env.BASE_URL : '/';
  const src = `${base}?preview=1${showOpening ? '' : '&skipCover=1'}`;

  useEffect(() => {
    const send = () => frameRef.current?.contentWindow?.postMessage({ type: PREVIEW_CONTENT, content: contentRef.current }, window.location.origin);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string } | null)?.type === PREVIEW_READY) {
        readyRef.current = true;
        send();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Keep the preview in step with the editor.
  useEffect(() => {
    if (!readyRef.current) return undefined;
    const timer = window.setTimeout(() => {
      frameRef.current?.contentWindow?.postMessage({ type: PREVIEW_CONTENT, content }, window.location.origin);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [content]);

  useEffect(() => {
    readyRef.current = false;
  }, [src]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('is-locked');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('is-locked');
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-stone-900/95" role="dialog" aria-modal="true" aria-label="Live preview" data-testid="preview">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-white">
        <div>
          <p className="font-sans text-sm font-bold">Live preview</p>
          <p className="font-sans text-[0.76rem] text-white/70">This is your draft, including changes you have not saved. Guests cannot see it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 py-2 font-sans text-[0.8rem] font-semibold">
            <input type="checkbox" className="h-4 w-4 accent-[#C29A52]" checked={showOpening} onChange={(e) => setShowOpening(e.target.checked)} data-testid="preview-opening" />
            Start from the opening screen
          </label>
          <div className="hidden overflow-hidden rounded-lg bg-white/10 sm:flex" role="group" aria-label="Preview size">
            <button
              type="button"
              onClick={() => setDevice('phone')}
              className={`flex items-center gap-2 px-3 py-2 font-sans text-[0.8rem] font-semibold ${device === 'phone' ? 'bg-white text-stone-900' : ''}`}
              aria-pressed={device === 'phone'}
            >
              <Smartphone size={15} aria-hidden="true" /> Phone
            </button>
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              className={`flex items-center gap-2 px-3 py-2 font-sans text-[0.8rem] font-semibold ${device === 'desktop' ? 'bg-white text-stone-900' : ''}`}
              aria-pressed={device === 'desktop'}
            >
              <Monitor size={15} aria-hidden="true" /> Computer
            </button>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 items-center gap-2 rounded-lg bg-white px-3 font-sans text-[0.82rem] font-bold text-stone-900" data-testid="preview-close">
            <X size={16} aria-hidden="true" /> Close preview
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-stretch justify-center px-2 pb-3 sm:px-4">
        <iframe
          key={src}
          ref={frameRef}
          src={src}
          title="Preview of the wedding website"
          className={`h-full rounded-2xl border-4 border-white/20 bg-white shadow-2xl ${device === 'phone' ? 'w-full max-w-[25.5rem]' : 'w-full max-w-[82rem]'}`}
          data-testid="preview-frame"
        />
      </div>
    </div>
  );
}
