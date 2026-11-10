import { useEffect, useState } from 'react';
import { type CountdownParts, countdownTo } from '../lib/dates';

/** Ticks once a second while the page is visible. */
export function useCountdown(targetEpoch: number | null): CountdownParts | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetEpoch === null) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [targetEpoch]);

  return targetEpoch === null ? null : countdownTo(targetEpoch, now);
}
