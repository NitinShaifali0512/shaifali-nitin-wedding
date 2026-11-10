import { CalendarHeart, House, Images, Send, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SectionConfig, SectionType } from '../content/types';

const ICONS: Record<SectionType, typeof House> = {
  welcome: House,
  events: CalendarHeart,
  gallery: Images,
  rsvp: Send,
  custom: Sparkles,
};

/**
 * A small floating menu for jumping between sections. It sits at the bottom
 * of the screen on phones, within reach of the thumb, and at the top on
 * larger screens.
 */
export function Nav({ sections }: { sections: SectionConfig[] }) {
  const items = sections.filter((section) => section.visible && section.navLabel.trim()).slice(0, 5);
  const [active, setActive] = useState<string>(items[0]?.id ?? '');
  const ids = items.map((item) => item.id).join('|');

  useEffect(() => {
    if (!ids) return undefined;
    const idList = ids.split('|');
    const update = () => {
      const probe = window.innerHeight * 0.4;
      let current = idList[0];
      for (const id of idList) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= probe) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [ids]);

  if (items.length < 2) return null;

  return (
    <nav
      className="site-nav"
      aria-label="Sections of the invitation"
      data-testid="nav"
    >
      <ul className="flex items-stretch gap-0.5 rounded-full border border-gold-500/50 bg-ivory/95 p-1 shadow-card">
        {items.map((item) => {
          const Icon = ICONS[item.type];
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`flex min-w-[3.6rem] flex-col items-center gap-0.5 rounded-full px-3 py-1.5 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.1em] transition md:flex-row md:gap-2 md:px-4 md:py-2 md:text-[0.66rem] ${
                  isActive ? 'bg-wine-800 text-cream' : 'text-wine-800 hover:bg-wine-800/10'
                }`}
                aria-current={isActive ? 'true' : undefined}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.navLabel}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
