import { CalendarHeart, ExternalLink, Images, Mail, Music, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatLongDate, formatTimestamp } from '../../lib/dates';
import { siteUrl } from '../../lib/links';
import { listRsvps } from '../data';
import type { Editor } from '../useEditor';
import { Card, Notice, PageHeader } from '../ui';
import { markSuperseded, summarise } from './ResponsesPanel';

export function OverviewPanel({ editor, onNavigate }: { editor: Editor; onNavigate: (panel: string) => void }) {
  const { content } = editor;
  const [replies, setReplies] = useState<{ responses: number; guests: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRsvps()
      .then((rsvps) => {
        if (cancelled) return;
        const summary = summarise(markSuperseded(rsvps), content);
        setReplies({ responses: summary.responses, guests: summary.totalGuests });
      })
      .catch(() => {
        if (!cancelled) setReplies(null);
      });
    return () => {
      cancelled = true;
    };
    // Loaded once when the overview opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shortcuts: Array<{ id: string; label: string; detail: string; icon: typeof Mail }> = [
    { id: 'responses', label: 'RSVP responses', detail: replies ? `${replies.responses} replies, ${replies.guests} guests` : 'See who is coming', icon: Mail },
    { id: 'events', label: 'Events', detail: `${content.events.filter((event) => event.visible).length} shown on the website`, icon: CalendarHeart },
    { id: 'gallery', label: 'Gallery', detail: `${content.gallery.photos.length} photographs`, icon: Images },
    { id: 'music', label: 'Music', detail: content.music.enabled ? (content.music.source === 'custom' ? 'Your own track' : 'Built-in saxophone instrumental') : 'Switched off', icon: Music },
    { id: 'sharing', label: 'Sharing', detail: 'WhatsApp message and link preview', icon: Share2 },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${content.couple.brideName.split(' ')[0]} and ${content.couple.groomName.split(' ')[0]}`}
        description="This is where you control the whole invitation. Edit anything, save, preview, and publish when you are happy."
      />
      <div className="space-y-6">
        {editor.neverPublished ? (
          <Notice tone="warning">
            The website has not been published from this dashboard yet. Guests currently see the content that came with the website. Press <strong>Publish</strong> to
            make your version live.
          </Notice>
        ) : editor.dirty ? (
          <Notice tone="warning">You have changes that are not saved yet.</Notice>
        ) : editor.unpublished ? (
          <Notice tone="warning">Your saved changes are not live yet. Press <strong>Publish</strong> when you want guests to see them.</Notice>
        ) : (
          <Notice tone="success">Everything is published. Guests see exactly what is in this dashboard.</Notice>
        )}

        <Card title="How it works">
          <ol className="grid gap-4 font-sans text-[0.88rem] leading-relaxed text-stone-700 sm:grid-cols-3">
            <li className="rounded-xl bg-stone-50 p-4">
              <span className="mb-1 block font-bold text-wine-800">1. Edit</span>
              Change text, dates, photographs or music on any page of this dashboard.
            </li>
            <li className="rounded-xl bg-stone-50 p-4">
              <span className="mb-1 block font-bold text-wine-800">2. Save and preview</span>
              “Save Changes” keeps your work as a private draft. “Preview” shows it exactly as guests would see it.
            </li>
            <li className="rounded-xl bg-stone-50 p-4">
              <span className="mb-1 block font-bold text-wine-800">3. Publish</span>
              “Publish” makes the draft live for everyone, within seconds, with no technical steps.
            </li>
          </ol>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((shortcut) => (
            <button
              key={shortcut.id}
              type="button"
              onClick={() => onNavigate(shortcut.id)}
              className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:border-wine-700/40 hover:shadow"
            >
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-wine-800/10 text-wine-800">
                <shortcut.icon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-sans text-[0.95rem] font-bold text-stone-900">{shortcut.label}</span>
                <span className="block font-sans text-[0.8rem] text-stone-600">{shortcut.detail}</span>
              </span>
            </button>
          ))}
          <a
            href={siteUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:border-wine-700/40 hover:shadow"
          >
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-wine-800/10 text-wine-800">
              <ExternalLink size={20} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-sans text-[0.95rem] font-bold text-stone-900">Open the live website</span>
              <span className="block font-sans text-[0.8rem] text-stone-600">See what guests see right now</span>
            </span>
          </a>
        </div>

        <Card title="At a glance">
          <dl className="grid gap-x-8 gap-y-3 font-sans text-[0.88rem] sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Last published</dt>
              <dd className="font-semibold text-stone-900">{editor.publishedAt ? formatTimestamp(editor.publishedAt) : 'Not yet'}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Draft last saved</dt>
              <dd className="font-semibold text-stone-900">{editor.savedAt ? formatTimestamp(editor.savedAt) : 'Not yet'}</dd>
            </div>
            {content.events
              .filter((event) => event.visible)
              .map((event) => (
                <div key={event.id}>
                  <dt className="text-stone-500">{event.name}</dt>
                  <dd className="font-semibold text-stone-900">{formatLongDate(event.date) || 'No date yet'}</dd>
                </div>
              ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
