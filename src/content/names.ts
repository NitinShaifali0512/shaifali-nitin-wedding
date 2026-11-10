import type { SiteContent } from './types';

/** The two names in the order chosen in the dashboard: [first, second]. */
export function orderedNames(couple: SiteContent['couple']): [string, string] {
  return couple.nameOrder === 'groom-first' ? [couple.groomName, couple.brideName] : [couple.brideName, couple.groomName];
}

/** "Nitin Kaushik & Shaifali Singh", skipping an empty name. */
export function coupleNames(couple: SiteContent['couple']): string {
  return orderedNames(couple).filter(Boolean).join(' & ');
}
