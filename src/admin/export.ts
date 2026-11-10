import type { RsvpRecord } from '../content/types';
import { IST_TIME_ZONE } from '../lib/dates';

export interface ExportRow {
  Name: string;
  Mobile: string;
  Attending: string;
  Guests: number;
  Events: string;
  Message: string;
  Received: string;
}

function receivedText(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Writes a mobile number with spaces ("98765 43210"), so that spreadsheet
 * programs keep it as text instead of turning it into a rounded number.
 */
export function readableMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return mobile;
}

export function toExportRows(rsvps: RsvpRecord[]): ExportRow[] {
  return rsvps.map((rsvp) => ({
    Name: rsvp.guest_name,
    Mobile: readableMobile(rsvp.mobile),
    Attending: rsvp.guest_count > 0 ? 'Yes' : 'No',
    Guests: rsvp.guest_count,
    Events: rsvp.events.map((event) => event.name).join(', '),
    Message: rsvp.message ?? '',
    Received: receivedText(rsvp.created_at),
  }));
}

/**
 * Spreadsheet programs treat a cell that begins with = + - or @ as a formula.
 * A guest could type one into the name or message box, so such cells are
 * prefixed with an apostrophe, which makes them plain text.
 */
export function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number, trusted = false): string {
  const text = typeof value === 'number' ? String(value) : trusted ? value : neutraliseFormula(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: ExportRow[]): string {
  const headers: Array<keyof ExportRow> = ['Name', 'Mobile', 'Attending', 'Guests', 'Events', 'Message', 'Received'];
  const lines = [headers.join(',')];
  // Mobile numbers are digits only (the database enforces it), so they need no formula guard.
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header], header === 'Mobile')).join(','));
  // The leading mark tells Excel the file is UTF-8, so Hindi names appear correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function stamp(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function downloadCsv(rsvps: RsvpRecord[]): void {
  saveBlob(new Blob([toCsv(toExportRows(rsvps))], { type: 'text/csv;charset=utf-8' }), `rsvp-responses-${stamp()}.csv`);
}

export async function downloadExcel(rsvps: RsvpRecord[]): Promise<void> {
  // Loaded only when the button is pressed, so it does not slow the dashboard down.
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const rows = toExportRows(rsvps);
  const header = ['Name', 'Mobile', 'Attending', 'Guests', 'Events', 'Message', 'Received'].map((value) => ({ value, fontWeight: 'bold' as const }));
  const body = rows.map((row) => [
    { type: String, value: neutraliseFormula(row.Name) },
    { type: String, value: row.Mobile },
    { type: String, value: row.Attending },
    { type: Number, value: row.Guests },
    { type: String, value: neutraliseFormula(row.Events) },
    { type: String, value: neutraliseFormula(row.Message), wrap: true },
    { type: String, value: row.Received },
  ]);
  const blob = await writeXlsxFile([header, ...body], {
    sheet: 'RSVP responses',
    columns: [{ width: 28 }, { width: 18 }, { width: 11 }, { width: 9 }, { width: 30 }, { width: 50 }, { width: 24 }],
  }).toBlob();
  saveBlob(blob, `rsvp-responses-${stamp()}.xlsx`);
}
