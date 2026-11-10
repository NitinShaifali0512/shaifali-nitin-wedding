import { Flourish } from '../art/Art';
import type { SectionConfig } from '../content/types';
import { assetUrl, safeHttpUrl } from '../lib/links';

const STYLES = {
  ivory: { section: 'bg-paper text-ink', heading: 'text-wine-800', eyebrow: 'text-gold-700', flourish: 'text-gold-500', button: 'btn-wine' },
  blush: { section: 'bg-blush-paper text-ink', heading: 'text-wine-800', eyebrow: 'text-gold-700', flourish: 'text-gold-500', button: 'btn-wine' },
  wine: { section: 'bg-wine-rich text-cream', heading: 'text-cream', eyebrow: 'text-gold-300', flourish: 'text-gold-300', button: 'btn-gold' },
} as const;

/** A free-form section the administrator can add: a heading, some text, an optional picture and button. */
export function CustomSection({ section }: { section: SectionConfig }) {
  const style = STYLES[section.style ?? 'ivory'];
  const image = assetUrl(section.image ?? '');
  const buttonUrl = safeHttpUrl(section.buttonUrl ?? '');
  const paragraphs = (section.body ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <section id={section.id} className={`relative overflow-hidden ${style.section}`} aria-label={section.heading || section.navLabel || 'Section'}>
      {section.style === 'wine' ? <div className="lattice" /> : null}
      <div className="relative mx-auto max-w-2xl px-6 py-20 text-center sm:py-24" data-reveal>
        {section.eyebrow ? <p className={`eyebrow ${style.eyebrow}`}>{section.eyebrow}</p> : null}
        {section.heading ? <h2 className={`section-heading mt-3 ${style.heading}`}>{section.heading}</h2> : null}
        <Flourish className={`my-5 ${style.flourish}`} />
        {image ? (
          <img src={image} alt={section.heading || ''} className="mx-auto mb-8 max-h-[30rem] w-auto max-w-full rounded-2xl shadow-photo" loading="lazy" decoding="async" />
        ) : null}
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="mx-auto mb-4 max-w-xl whitespace-pre-line font-serif text-[1.2rem] leading-relaxed last:mb-0">
            {paragraph}
          </p>
        ))}
        {buttonUrl && section.buttonLabel ? (
          <a href={buttonUrl} target="_blank" rel="noopener noreferrer" className={`${style.button} mt-8`}>
            {section.buttonLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}
