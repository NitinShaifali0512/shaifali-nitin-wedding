import { monthName, parseDate, weekdayName } from '../lib/dates';

interface DateLockupProps {
  date: string;
  /** Text for the right-hand side, for example "At 10 AM". */
  side: string;
  className?: string;
}

/**
 * The date arrangement from the printed card: the weekday on the left, the
 * day number in the centre between the month and the year, and the time on
 * the right.
 */
export function DateLockup({ date, side, className = '' }: DateLockupProps) {
  const parts = parseDate(date);
  if (!parts) {
    return (
      <p className={`eyebrow ${className}`} style={{ color: 'var(--ev-accent, currentColor)' }}>
        Date to be announced
      </p>
    );
  }
  // With a confirmed time the card's arrangement is used: weekday | month, day, year | time.
  // Without one, the full month takes the right-hand side, so the lockup stays balanced.
  const hasSide = Boolean(side);
  const label = `${weekdayName(date)}, ${parts.day} ${monthName(date)} ${parts.year}${hasSide ? `, ${side}` : ''}`;
  return (
    <div className={`flex items-center justify-center gap-3 sm:gap-5 ${className}`} role="group" aria-label={label}>
      <span className="lockup-side flex-1 text-right" aria-hidden="true">
        <span className="lockup-rule">{weekdayName(date)}</span>
      </span>
      <span className="flex-none text-center leading-none" aria-hidden="true">
        {hasSide ? (
          <span className="eyebrow block" style={{ letterSpacing: '0.3em', textIndent: '0.3em' }}>
            {monthName(date).slice(0, 3)}
          </span>
        ) : null}
        <span className="my-1 block font-serif font-medium" style={{ fontSize: 'clamp(3rem, 14vw, 4rem)', lineHeight: 0.95 }}>
          {parts.day}
        </span>
        <span className="eyebrow block" style={{ letterSpacing: '0.3em', textIndent: '0.3em' }}>
          {parts.year}
        </span>
      </span>
      <span className="lockup-side flex-1 text-left" aria-hidden="true">
        <span className="lockup-rule">{hasSide ? side : monthName(date)}</span>
      </span>
    </div>
  );
}
