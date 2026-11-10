import { ImagePlus, Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { blankPhoto } from '../../content/factory';
import type { FrameStyle } from '../../content/types';
import { assetUrl } from '../../lib/links';
import { uploadPhoto } from '../data';
import type { Editor } from '../useEditor';
import { Button, Card, Grid, PageHeader, RowControls, SelectField, TextAreaField, TextField, errorText, moveItem, useConfirm, useToast } from '../ui';

const FRAMES: Array<{ value: FrameStyle; label: string }> = [
  { value: 'polaroid', label: 'Polaroid' },
  { value: 'tape', label: 'White frame with tape' },
  { value: 'white', label: 'White frame' },
  { value: 'gold', label: 'Gold frame' },
  { value: 'oval', label: 'Oval, hand-drawn edge' },
  { value: 'scallop', label: 'Scalloped, hand-drawn edge' },
  { value: 'arch', label: 'Arch top' },
];

export function GalleryPanel({ editor }: { editor: Editor }) {
  const { content, update } = editor;
  const { gallery } = content;
  const addRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceIndex = useRef<number | null>(null);
  const [busy, setBusy] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  const onAdd = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    let done = 0;
    for (const file of files) {
      setBusy(`Uploading ${done + 1} of ${files.length}`);
      try {
        const uploaded = await uploadPhoto(file);
        update((d) => void d.gallery.photos.push(blankPhoto(uploaded.url, uploaded.width, uploaded.height)));
        done += 1;
      } catch (error) {
        toast.error(`${file.name}: ${errorText(error)}`);
      }
    }
    setBusy('');
    if (done > 0) toast.success(`${done} ${done === 1 ? 'photograph' : 'photographs'} added. Remember to save your changes.`);
  };

  const onReplace = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const index = replaceIndex.current;
    event.target.value = '';
    if (!file || index === null) return;
    setBusy('Uploading');
    try {
      const uploaded = await uploadPhoto(file);
      update((d) => {
        const photo = d.gallery.photos[index];
        if (!photo) return;
        photo.src = uploaded.url;
        photo.width = uploaded.width;
        photo.height = uploaded.height;
      });
      toast.success('Photograph replaced. Remember to save your changes.');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy('');
    }
  };

  const remove = async (index: number) => {
    const ok = await confirm({
      title: 'Remove this photograph?',
      message: 'It will disappear from the gallery when you publish.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) update((d) => void d.gallery.photos.splice(index, 1));
  };

  return (
    <>
      <PageHeader title="Gallery" description="Your scrapbook of photographs. Add, replace, caption, reframe, reorder or remove them." />
      <div className="space-y-6">
        <Card title="Heading of the gallery">
          <Grid>
            <TextField label="Small heading" value={gallery.eyebrow} onChange={(v) => update((d) => void (d.gallery.eyebrow = v))} />
            <TextField label="Heading" value={gallery.heading} onChange={(v) => update((d) => void (d.gallery.heading = v))} />
          </Grid>
          <TextAreaField label="Description" value={gallery.description} rows={2} onChange={(v) => update((d) => void (d.gallery.description = v))} />
        </Card>

        <Card
          title={`Photographs (${gallery.photos.length})`}
          description="Large photographs are resized automatically before upload, so the gallery stays quick on mobile data."
          actions={
            <>
              <input ref={addRef} type="file" accept="image/*" multiple className="sr-only" onChange={onAdd} data-testid="gallery-input" />
              <input ref={replaceRef} type="file" accept="image/*" className="sr-only" onChange={onReplace} data-testid="gallery-replace-input" />
              <Button variant="primary" busy={Boolean(busy)} icon={<Upload size={16} aria-hidden="true" />} onClick={() => addRef.current?.click()}>
                {busy || 'Add photographs'}
              </Button>
            </>
          }
        >
          {gallery.photos.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-300 px-5 py-10 text-center">
              <ImagePlus size={28} className="text-stone-400" aria-hidden="true" />
              <p className="mt-3 font-sans text-sm text-stone-600">The gallery is empty. Add your first photographs.</p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2" data-testid="gallery-list">
              {gallery.photos.map((photo, index) => (
                <li key={photo.id} className="flex gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3" data-testid="gallery-item">
                  <img src={assetUrl(photo.src)} alt="" className="h-28 w-24 flex-none rounded-lg bg-stone-200 object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <input
                      type="text"
                      aria-label={`Caption of photograph ${index + 1}`}
                      placeholder="Caption (optional)"
                      className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-sans text-[0.9rem]"
                      value={photo.caption}
                      onChange={(e) => update((d) => void (d.gallery.photos[index].caption = e.target.value))}
                    />
                    <SelectField label="Frame" value={photo.frame} options={FRAMES} onChange={(v) => update((d) => void (d.gallery.photos[index].frame = v))} />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        small
                        onClick={() => {
                          replaceIndex.current = index;
                          replaceRef.current?.click();
                        }}
                      >
                        Replace
                      </Button>
                      <RowControls
                        index={index}
                        count={gallery.photos.length}
                        itemName={`photograph ${index + 1}`}
                        onMove={(from, to) => update((d) => void (d.gallery.photos = moveItem(d.gallery.photos, from, to)))}
                        onRemove={() => void remove(index)}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
