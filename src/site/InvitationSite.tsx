import { useCallback, useEffect, useRef, useState } from 'react';
import { coupleNames as joinCoupleNames } from '../content/names';
import type { SectionConfig, SiteContent } from '../content/types';
import { useMusic } from '../hooks/useMusic';
import { isPreviewFrame, usePublishedContent } from '../hooks/usePublishedContent';
import { useReveal } from '../hooks/useReveal';
import { Cover, type CoverPhase } from './Cover';
import { CustomSection } from './CustomSection';
import { Events } from './Events';
import { Footer } from './Footer';
import { Gallery } from './Gallery';
import { MusicControl } from './MusicControl';
import { Nav } from './Nav';
import { Petals } from './Petals';
import { Rsvp } from './Rsvp';
import { Splash } from './Splash';
import { Welcome } from './Welcome';

const DOORS_OPEN_MS = 1950;
const PETALS_MS = 13_000;

function renderSection(section: SectionConfig, content: SiteContent, previewOnly: boolean) {
  const has = (type: SectionConfig['type']) => content.sections.some((item) => item.type === type && item.visible);
  switch (section.type) {
    case 'welcome':
      return <Welcome key={section.id} content={content} hasEvents={has('events')} hasGallery={has('gallery')} />;
    case 'events':
      return <Events key={section.id} content={content} />;
    case 'gallery':
      return <Gallery key={section.id} content={content} />;
    case 'rsvp':
      return <Rsvp key={section.id} content={content} previewOnly={previewOnly} />;
    case 'custom':
      return <CustomSection key={section.id} section={section} />;
    default:
      return null;
  }
}

/** The public invitation: the opening cover, then one continuous page. */
export function InvitationSite() {
  const { content, ready } = usePublishedContent();
  const previewOnly = useRef(isPreviewFrame()).current;
  const skipCover = useRef(new URLSearchParams(window.location.search).has('skipCover')).current;
  const [phase, setPhase] = useState<CoverPhase>(skipCover ? 'open' : 'closed');
  const [showPetals, setShowPetals] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const coupleNames = joinCoupleNames(content.couple);
  const music = useMusic(content.music, coupleNames);
  useReveal(ready && phase !== 'closed');

  // The page behind the cover must not scroll until the invitation is opened.
  useEffect(() => {
    document.body.classList.toggle('is-locked', phase === 'closed');
    return () => document.body.classList.remove('is-locked');
  }, [phase]);

  useEffect(() => {
    document.body.style.backgroundColor = phase === 'closed' ? '#570A34' : '#FBF5EA';
  }, [phase]);

  const open = useCallback(() => {
    if (phase !== 'closed') return;
    // Starting the music inside the tap is what browsers require before they allow sound.
    music.start();
    window.scrollTo(0, 0);
    setPhase('opening');
    setShowPetals(true);
    window.setTimeout(() => {
      setPhase('open');
      // A link such as …/#rsvp opens the invitation and then goes to that section.
      const target = window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null;
      if (target) target.scrollIntoView();
      else mainRef.current?.focus({ preventScroll: true });
    }, DOORS_OPEN_MS);
    window.setTimeout(() => setShowPetals(false), PETALS_MS);
  }, [music, phase]);

  if (!ready) return <Splash />;

  const visibleSections = content.sections.filter((section) => section.visible);

  return (
    <>
      <a
        href="#welcome"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-full focus:bg-ivory focus:px-4 focus:py-2 focus:font-sans focus:text-sm focus:text-wine-800"
      >
        Skip to the invitation
      </a>

      <Cover content={content} phase={phase} onOpen={open} />

      <main ref={mainRef} tabIndex={-1} aria-hidden={phase === 'closed' ? true : undefined} className="outline-none" data-testid="site">
        {visibleSections.map((section) => renderSection(section, content, previewOnly))}
        {visibleSections.length === 0 ? (
          <div className="bg-paper px-6 py-32 text-center font-serif text-2xl italic text-wine-800">The invitation will be shared here very soon.</div>
        ) : null}
      </main>
      <Footer content={content} />

      {phase !== 'closed' ? (
        <>
          <MusicControl music={music} />
          <Nav sections={content.sections} />
        </>
      ) : null}
      {showPetals ? <Petals /> : null}
    </>
  );
}
