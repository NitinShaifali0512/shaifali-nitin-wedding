import { Eye, EyeOff, Plus } from 'lucide-react';
import { blankCustomSection } from '../../content/factory';
import type { CustomSectionStyle, SectionConfig, SectionType } from '../../content/types';
import type { Editor } from '../useEditor';
import { Button, Card, Grid, ImageField, Notice, PageHeader, RowControls, SelectField, TextAreaField, TextField, moveItem, useConfirm } from '../ui';

const TYPE_NAMES: Record<SectionType, string> = {
  welcome: 'Welcome and countdown',
  events: 'Events',
  gallery: 'Gallery',
  rsvp: 'RSVP form',
  custom: 'Custom section',
};

const DEFAULT_NAV: Record<Exclude<SectionType, 'custom'>, string> = {
  welcome: 'Home',
  events: 'Events',
  gallery: 'Gallery',
  rsvp: 'RSVP',
};

const STYLES: Array<{ value: CustomSectionStyle; label: string }> = [
  { value: 'ivory', label: 'Ivory paper' },
  { value: 'blush', label: 'Blush paper' },
  { value: 'wine', label: 'Wine with gold lattice' },
];

const BUILT_IN: Array<Exclude<SectionType, 'custom'>> = ['welcome', 'events', 'gallery', 'rsvp'];

export function SectionsPanel({ editor }: { editor: Editor }) {
  const { content, update } = editor;
  const confirm = useConfirm();
  const missing = BUILT_IN.filter((type) => !content.sections.some((section) => section.type === type));
  const set = (index: number, mutate: (section: SectionConfig) => void) => update((d) => mutate(d.sections[index]));

  const remove = async (index: number) => {
    const section = content.sections[index];
    const name = section.type === 'custom' ? section.heading || 'this section' : TYPE_NAMES[section.type];
    const ok = await confirm({
      title: `Remove “${name}” from the page?`,
      message:
        section.type === 'custom'
          ? 'The section and its text will be deleted when you save.'
          : 'The section is taken off the page. Its content is kept, and you can add the section back at any time.',
      confirmLabel: 'Remove section',
      danger: true,
    });
    if (ok) update((d) => void d.sections.splice(index, 1));
  };

  return (
    <>
      <PageHeader
        title="Page Sections"
        description="Choose which sections the page has, the order they appear in and their names in the menu. You can also add your own sections, for example travel tips or a note about gifts."
      />
      <div className="space-y-4" data-testid="section-list">
        {content.sections.map((section, index) => (
          <section key={section.id} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5" data-testid="section-card">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-sans text-base font-bold text-stone-900">{section.type === 'custom' ? section.heading || 'Custom section' : TYPE_NAMES[section.type]}</p>
                <p className="font-sans text-[0.8rem] text-stone-600">
                  {section.type === 'custom' ? 'Your own section' : 'Built-in section'}
                  {section.visible ? '' : ' · Hidden'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => set(index, (s) => void (s.visible = !s.visible))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                  aria-label={section.visible ? 'Hide this section' : 'Show this section'}
                  title={section.visible ? 'Shown on the website. Click to hide.' : 'Hidden. Click to show.'}
                  aria-pressed={!section.visible}
                  data-testid="section-visibility"
                >
                  {section.visible ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
                </button>
                <RowControls
                  index={index}
                  count={content.sections.length}
                  itemName="section"
                  onMove={(from, to) => update((d) => void (d.sections = moveItem(d.sections, from, to)))}
                  onRemove={() => void remove(index)}
                />
              </div>
            </div>

            <div className="mt-4 space-y-5">
              <TextField
                label="Name in the menu"
                value={section.navLabel}
                maxLength={12}
                onChange={(v) => set(index, (s) => void (s.navLabel = v))}
                hint="Keep it to one short word. Leave empty to keep this section out of the menu. The menu shows up to five sections."
              />
              {section.type === 'custom' ? (
                <>
                  <Grid>
                    <TextField label="Small heading (optional)" value={section.eyebrow ?? ''} onChange={(v) => set(index, (s) => void (s.eyebrow = v))} />
                    <TextField label="Heading" value={section.heading ?? ''} onChange={(v) => set(index, (s) => void (s.heading = v))} />
                  </Grid>
                  <TextAreaField
                    label="Text"
                    value={section.body ?? ''}
                    rows={5}
                    onChange={(v) => set(index, (s) => void (s.body = v))}
                    hint="Leave an empty line between paragraphs."
                  />
                  <SelectField label="Background" value={section.style ?? 'ivory'} options={STYLES} onChange={(v) => set(index, (s) => void (s.style = v))} />
                  <ImageField label="Picture (optional)" value={section.image ?? ''} onChange={(v) => set(index, (s) => void (s.image = v))} optional />
                  <Grid>
                    <TextField label="Button text (optional)" value={section.buttonLabel ?? ''} onChange={(v) => set(index, (s) => void (s.buttonLabel = v))} />
                    <TextField label="Button link" type="url" value={section.buttonUrl ?? ''} placeholder="https://" onChange={(v) => set(index, (s) => void (s.buttonUrl = v))} />
                  </Grid>
                </>
              ) : null}
            </div>
          </section>
        ))}
        {content.sections.length === 0 ? <Notice tone="warning">The page has no sections. Add at least one below.</Notice> : null}
      </div>

      <div className="mt-6">
        <Card title="Add a section">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => update((d) => void d.sections.push(blankCustomSection()))} data-testid="add-section">
              Add a custom section
            </Button>
            {missing.map((type) => (
              <Button
                key={type}
                icon={<Plus size={16} aria-hidden="true" />}
                onClick={() => update((d) => void d.sections.push({ id: type, type, visible: true, navLabel: DEFAULT_NAV[type] }))}
              >
                Add back: {TYPE_NAMES[type]}
              </Button>
            ))}
          </div>
          <p className="font-sans text-[0.8rem] text-stone-500">The footer is managed under Footer and Contact, and always stays at the end of the page.</p>
        </Card>
      </div>
    </>
  );
}
