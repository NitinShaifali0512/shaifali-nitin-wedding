import { ChevronDown, ChevronUp, Eye, EyeOff, Plus } from 'lucide-react';
import { useState } from 'react';
import { blankEvent, blankScheduleItem } from '../../content/factory';
import type { EventStyle, WeddingEvent } from '../../content/types';
import { formatLongDate, formatTime } from '../../lib/dates';
import { directionsUrl } from '../../lib/links';
import type { Editor } from '../useEditor';
import { Button, Card, Grid, ImageField, PageHeader, RowControls, SelectField, TextAreaField, TextField, Toggle, moveItem, useConfirm } from '../ui';

const STYLES: Array<{ value: EventStyle; label: string }> = [
  { value: 'pastel', label: 'Pastel: soft blush, sage and powder blue' },
  { value: 'festive', label: 'Festive night: jewel tones, lights and music' },
  { value: 'royal', label: 'Royal: wine and gold with the arch, as on the card' },
  { value: 'classic', label: 'Classic: ivory and wine' },
  { value: 'sunshine', label: 'Sunshine: warm yellows, ideal for Haldi' },
  { value: 'garden', label: 'Garden: fresh greens, ideal for Mehendi' },
];

function EventEditor({ event, index, editor }: { event: WeddingEvent; index: number; editor: Editor }) {
  const { update } = editor;
  const set = (mutate: (target: WeddingEvent) => void) => update((d) => mutate(d.events[index]));
  const maps = directionsUrl(event);

  return (
    <div className="space-y-5 border-t border-stone-200 pt-5">
      <Grid>
        <TextField label="Event name" value={event.name} onChange={(v) => set((e) => void (e.name = v))} />
        <TextField label="Line above the name" value={event.subtitle} onChange={(v) => set((e) => void (e.subtitle = v))} />
      </Grid>
      <TextAreaField label="Short description" value={event.description} rows={2} onChange={(v) => set((e) => void (e.description = v))} />
      <Grid>
        <TextField
          label="Date"
          type="date"
          value={event.date}
          onChange={(v) => set((e) => void (e.date = v))}
          hint={event.date ? `Guests will see: ${formatLongDate(event.date) || 'this date is not valid'}` : 'The day of the week is worked out automatically.'}
        />
        <SelectField label="Look of this event" value={event.style} options={STYLES} onChange={(v) => set((e) => void (e.style = v))} />
      </Grid>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="font-sans text-[0.82rem] font-semibold text-stone-800">Schedule</p>
          <Button small icon={<Plus size={15} aria-hidden="true" />} onClick={() => set((e) => void e.schedule.push(blankScheduleItem()))} data-testid="add-timing">
            Add a timing
          </Button>
        </div>
        {event.schedule.length === 0 ? (
          <p className="rounded-lg bg-stone-50 px-3 py-2.5 font-sans text-[0.82rem] text-stone-600">
            No timings yet, so guests see the note below instead, and the calendar entry covers the whole day.
          </p>
        ) : (
          <ul className="space-y-2">
            {event.schedule.map((item, itemIndex) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                <input
                  type="time"
                  aria-label="Time"
                  className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 font-sans text-[0.95rem]"
                  value={item.time}
                  onChange={(e) => set((target) => void (target.schedule[itemIndex].time = e.target.value))}
                />
                <input
                  type="text"
                  aria-label="What happens"
                  placeholder="What happens, for example Jaimala"
                  className="min-w-[8rem] flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 font-sans text-[0.95rem]"
                  value={item.label}
                  onChange={(e) => set((target) => void (target.schedule[itemIndex].label = e.target.value))}
                />
                <span className="hidden w-20 font-sans text-xs text-stone-500 sm:block">{formatTime(item.time)}</span>
                <RowControls
                  index={itemIndex}
                  count={event.schedule.length}
                  itemName="timing"
                  onMove={(from, to) => set((target) => void (target.schedule = moveItem(target.schedule, from, to)))}
                  onRemove={() => set((target) => void target.schedule.splice(itemIndex, 1))}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Grid>
        <TextField
          label="Note shown when there are no timings"
          value={event.timeNote}
          onChange={(v) => set((e) => void (e.timeNote = v))}
          hint="For example: Timing to be announced."
        />
        <TextField
          label="Calendar end time (optional)"
          type="time"
          value={event.endTime}
          onChange={(v) => set((e) => void (e.endTime = v))}
          hint="Only used for calendar entries. If empty, the entry ends one hour after the last timing."
        />
      </Grid>

      <Grid>
        <TextField label="Venue name" value={event.venueName} onChange={(v) => set((e) => void (e.venueName = v))} />
        <TextField
          label="Google Maps link (optional)"
          type="url"
          value={event.mapsUrl}
          placeholder="https://maps.app.goo.gl/…"
          onChange={(v) => set((e) => void (e.mapsUrl = v))}
          hint="Paste a link from Google Maps. If empty, directions are built from the venue name and address."
        />
      </Grid>
      <TextAreaField label="Complete address" value={event.address} rows={2} onChange={(v) => set((e) => void (e.address = v))} />
      {maps ? (
        <p className="font-sans text-[0.8rem] text-stone-600">
          <a href={maps} target="_blank" rel="noopener noreferrer" className="font-semibold text-wine-700 underline underline-offset-2">
            Test the directions link
          </a>{' '}
          to make sure it opens the right place.
        </p>
      ) : null}

      <Grid>
        <TextField label="Dress code or theme" value={event.dressCode} placeholder="For example: Pastel" onChange={(v) => set((e) => void (e.dressCode = v))} hint="Leave empty to hide." />
        <TextField label="Label for it" value={event.dressCodeLabel} placeholder="Dress code" onChange={(v) => set((e) => void (e.dressCodeLabel = v))} hint="For example: Theme, or Dress code." />
      </Grid>

      <ImageField label="Background picture (optional)" value={event.backgroundImage} onChange={(v) => set((e) => void (e.backgroundImage = v))} optional />

      <Toggle
        label="Offer in the RSVP form"
        hint="Guests can tick this event when they respond."
        checked={event.rsvp}
        onChange={(v) => set((e) => void (e.rsvp = v))}
      />
    </div>
  );
}

export function EventsPanel({ editor }: { editor: Editor }) {
  const { content, update } = editor;
  const confirm = useConfirm();
  const [openId, setOpenId] = useState<string | null>(null);

  const addEvent = () => {
    const event = blankEvent();
    update((d) => void d.events.push(event));
    setOpenId(event.id);
  };

  const removeEvent = async (index: number) => {
    const event = content.events[index];
    const ok = await confirm({
      title: `Delete “${event.name || 'this event'}”?`,
      message: 'The event will be removed from the website when you publish. RSVP responses that mention it are kept.',
      confirmLabel: 'Delete event',
      danger: true,
    });
    if (ok) update((d) => void d.events.splice(index, 1));
  };

  return (
    <>
      <PageHeader title="Events" description="Add, edit, reorder, hide or delete events. Guests see them in the order shown here." />
      <div className="space-y-6">
        <Card title="Heading of the events section">
          <Grid>
            <TextField label="Small heading" value={content.eventsIntro.eyebrow} onChange={(v) => update((d) => void (d.eventsIntro.eyebrow = v))} />
            <TextField label="Heading" value={content.eventsIntro.heading} onChange={(v) => update((d) => void (d.eventsIntro.heading = v))} />
          </Grid>
          <TextAreaField label="Description" value={content.eventsIntro.description} rows={2} onChange={(v) => update((d) => void (d.eventsIntro.description = v))} />
        </Card>

        <div className="space-y-4" data-testid="event-list">
          {content.events.map((event, index) => {
            const open = openId === event.id;
            return (
              <section key={event.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5" data-testid="event-card">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : event.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={open}
                    data-testid="event-toggle"
                  >
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-wine-800/10 text-wine-800">
                      {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-sans text-base font-bold text-stone-900">{event.name || 'Untitled event'}</span>
                      <span className="block truncate font-sans text-[0.8rem] text-stone-600">
                        {formatLongDate(event.date) || 'No date yet'}
                        {event.venueName ? ` · ${event.venueName}` : ''}
                        {event.visible ? '' : ' · Hidden'}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => update((d) => void (d.events[index].visible = !d.events[index].visible))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                      aria-label={event.visible ? `Hide ${event.name}` : `Show ${event.name}`}
                      title={event.visible ? 'Shown on the website. Click to hide.' : 'Hidden. Click to show.'}
                      aria-pressed={!event.visible}
                    >
                      {event.visible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                    </button>
                    <RowControls
                      index={index}
                      count={content.events.length}
                      itemName={event.name || 'event'}
                      onMove={(from, to) => update((d) => void (d.events = moveItem(d.events, from, to)))}
                      onRemove={() => void removeEvent(index)}
                    />
                  </div>
                </div>
                {open ? <div className="mt-5"><EventEditor event={event} index={index} editor={editor} /></div> : null}
              </section>
            );
          })}
          {content.events.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-8 text-center font-sans text-sm text-stone-600">There are no events yet.</p>
          ) : null}
        </div>

        <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={addEvent} data-testid="add-event">
          Add an event
        </Button>
      </div>
    </>
  );
}
