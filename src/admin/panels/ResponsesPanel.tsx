import { Download, FileSpreadsheet, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RsvpRecord, SiteContent } from '../../content/types';
import { formatTimestamp } from '../../lib/dates';
import { formatPhone, telHref } from '../../lib/links';
import { deleteRsvp, listRsvps } from '../data';
import { downloadCsv, downloadExcel } from '../export';
import { Button, Card, Notice, PageHeader, errorText, useConfirm, useToast } from '../ui';

interface Row extends RsvpRecord {
  /** True when the same mobile number sent a newer response. */
  superseded: boolean;
}

/** Marks every response that was later replaced by a newer one from the same mobile number. */
export function markSuperseded(rsvps: RsvpRecord[]): Row[] {
  const newest = new Map<string, string>();
  for (const rsvp of rsvps) {
    const key = rsvp.mobile.replace(/\D/g, '').slice(-10);
    const current = newest.get(key);
    if (!current || rsvp.created_at > current) newest.set(key, rsvp.created_at);
  }
  return rsvps.map((rsvp) => ({ ...rsvp, superseded: newest.get(rsvp.mobile.replace(/\D/g, '').slice(-10)) !== rsvp.created_at }));
}

export interface RsvpSummary {
  responses: number;
  attendingParties: number;
  declined: number;
  totalGuests: number;
  perEvent: Array<{ id: string; name: string; parties: number; guests: number }>;
}

export function summarise(rows: Row[], content: SiteContent): RsvpSummary {
  const counted = rows.filter((row) => !row.superseded);
  const names = new Map<string, string>();
  for (const event of content.events) names.set(event.id, event.name);
  const perEvent = new Map<string, { id: string; name: string; parties: number; guests: number }>();
  for (const event of content.events) {
    if (event.rsvp) perEvent.set(event.id, { id: event.id, name: event.name, parties: 0, guests: 0 });
  }
  for (const row of counted) {
    for (const choice of row.events) {
      const entry = perEvent.get(choice.id) ?? { id: choice.id, name: names.get(choice.id) ?? choice.name, parties: 0, guests: 0 };
      entry.parties += 1;
      entry.guests += row.guest_count;
      perEvent.set(choice.id, entry);
    }
  }
  return {
    responses: counted.length,
    attendingParties: counted.filter((row) => row.guest_count > 0).length,
    declined: counted.filter((row) => row.guest_count === 0).length,
    totalGuests: counted.reduce((sum, row) => sum + row.guest_count, 0),
    perEvent: Array.from(perEvent.values()),
  };
}

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <p className="font-sans text-[0.72rem] font-semibold uppercase tracking-wider text-stone-500">{label}</p>
      <p className="mt-1 font-serif text-4xl font-semibold text-wine-800">{value}</p>
      {note ? <p className="mt-0.5 font-sans text-[0.76rem] text-stone-500">{note}</p> : null}
    </div>
  );
}

export function ResponsesPanel({ content }: { content: SiteContent }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rsvps, setRsvps] = useState<RsvpRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setProblem('');
    try {
      setRsvps(await listRsvps());
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => markSuperseded(rsvps ?? []), [rsvps]);
  const summary = useMemo(() => summarise(rows, content), [rows, content]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === 'declined' && row.guest_count !== 0) return false;
      if (filter === 'attending' && row.guest_count === 0) return false;
      if (filter.startsWith('event:') && !row.events.some((event) => event.id === filter.slice(6))) return false;
      if (!needle) return true;
      return (
        row.guest_name.toLowerCase().includes(needle) ||
        row.mobile.includes(needle.replace(/\s/g, '')) ||
        (row.message ?? '').toLowerCase().includes(needle) ||
        row.events.some((event) => event.name.toLowerCase().includes(needle))
      );
    });
  }, [filter, query, rows]);

  const remove = async (row: Row) => {
    const ok = await confirm({
      title: `Delete the response from ${row.guest_name}?`,
      message: 'This removes the response permanently. It cannot be undone.',
      confirmLabel: 'Delete response',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRsvp(row.id);
      setRsvps((current) => (current ?? []).filter((item) => item.id !== row.id));
      toast.success('Response deleted.');
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadExcel(visible);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader title="RSVP Responses" description="Everyone who has replied. Only signed-in administrators can see this list; guests can never read it." />

      {problem ? (
        <div className="mb-6">
          <Notice tone="warning">{problem}</Notice>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="rsvp-stats">
        <Stat label="Responses" value={summary.responses} note={summary.declined > 0 ? `${summary.declined} cannot attend` : undefined} />
        <Stat label="Guests expected" value={summary.totalGuests} note="across all replies" />
        {summary.perEvent.slice(0, 6).map((event) => (
          <Stat key={event.id} label={event.name} value={event.guests} note={`${event.parties} ${event.parties === 1 ? 'reply' : 'replies'}`} />
        ))}
      </div>
      <p className="mt-2 font-sans text-[0.78rem] text-stone-500">
        When the same mobile number replies more than once, only the latest reply is counted. Earlier replies are shown faded and marked as replaced.
      </p>

      <div className="mt-6">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[12rem] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search responses"
                placeholder="Search by name, mobile number or message"
                className="block w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-9 pr-3 font-sans text-[0.95rem] focus:border-wine-700 focus:outline-none focus:ring-2 focus:ring-wine-700/20"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                data-testid="rsvp-search"
              />
            </div>
            <select
              aria-label="Filter responses"
              className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-sans text-[0.95rem]"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              data-testid="rsvp-filter"
            >
              <option value="all">All responses</option>
              <option value="attending">Attending</option>
              <option value="declined">Cannot attend</option>
              {summary.perEvent.map((event) => (
                <option key={event.id} value={`event:${event.id}`}>
                  Attending {event.name}
                </option>
              ))}
            </select>
            <Button icon={<RefreshCw size={15} aria-hidden="true" />} onClick={() => void load()} busy={loading}>
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button small icon={<Download size={15} aria-hidden="true" />} onClick={() => downloadCsv(visible)} disabled={visible.length === 0} data-testid="export-csv">
              Download CSV
            </Button>
            <Button small icon={<FileSpreadsheet size={15} aria-hidden="true" />} onClick={() => void exportExcel()} busy={exporting} disabled={visible.length === 0} data-testid="export-xlsx">
              Download Excel
            </Button>
            <span className="font-sans text-[0.8rem] text-stone-500">
              {visible.length} of {rows.length} shown. The download contains what is shown.
            </span>
          </div>

          {rsvps === null && loading ? <p className="py-8 text-center font-sans text-sm text-stone-500">Loading responses…</p> : null}
          {rsvps !== null && rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-300 px-5 py-10 text-center font-sans text-sm text-stone-600">
              No responses yet. They will appear here as soon as guests reply.
            </p>
          ) : null}
          {rows.length > 0 && visible.length === 0 ? <p className="py-6 text-center font-sans text-sm text-stone-500">No responses match your search.</p> : null}

          {visible.length > 0 ? (
            <ul className="divide-y divide-stone-200" data-testid="rsvp-list">
              {visible.map((row) => (
                <li key={row.id} className={`flex flex-wrap items-start gap-x-6 gap-y-2 py-4 ${row.superseded ? 'opacity-50' : ''}`} data-testid="rsvp-row">
                  <div className="min-w-[11rem] flex-1">
                    <p className="font-sans text-[0.98rem] font-bold text-stone-900">
                      {row.guest_name}
                      {row.superseded ? <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-[0.66rem] font-semibold uppercase tracking-wide text-stone-700">Replaced</span> : null}
                    </p>
                    <a href={telHref(row.mobile)} className="font-sans text-[0.86rem] text-wine-700 underline-offset-2 hover:underline">
                      {formatPhone(row.mobile)}
                    </a>
                    <p className="mt-0.5 font-sans text-[0.74rem] text-stone-500">{formatTimestamp(row.created_at)}</p>
                  </div>
                  <div className="min-w-[10rem] flex-1">
                    {row.guest_count > 0 ? (
                      <>
                        <p className="font-sans text-[0.9rem] font-semibold text-stone-800">
                          {row.guest_count} {row.guest_count === 1 ? 'guest' : 'guests'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {row.events.map((event) => (
                            <span key={event.id} className="rounded-full bg-wine-800/10 px-2.5 py-0.5 font-sans text-[0.74rem] font-semibold text-wine-800">
                              {event.name}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="font-sans text-[0.9rem] font-semibold text-stone-600">Cannot attend</p>
                    )}
                  </div>
                  <p className="min-w-[12rem] flex-[2] whitespace-pre-line font-sans text-[0.88rem] leading-relaxed text-stone-700">
                    {row.message || <span className="text-stone-400">No message</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => void remove(row)}
                    className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                    aria-label={`Delete the response from ${row.guest_name}`}
                    title="Delete this response"
                    data-testid="rsvp-delete"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </>
  );
}
