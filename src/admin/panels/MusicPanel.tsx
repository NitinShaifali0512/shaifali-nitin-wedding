import { Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { musicSource } from '../../hooks/useMusic';
import { safeHttpUrl } from '../../lib/links';
import { uploadAudio } from '../data';
import type { Editor } from '../useEditor';
import { Button, Card, Notice, PageHeader, TextField, Toggle, errorText, useToast } from '../ui';

export function MusicPanel({ editor }: { editor: Editor }) {
  const { content, update } = editor;
  const { music } = content;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const toast = useToast();
  const playing = musicSource(music);
  const usingOwn = music.source === 'custom' && Boolean(safeHttpUrl(music.url));

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadAudio(file);
      const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      update((d) => {
        d.music.source = 'custom';
        d.music.url = url;
        if (title) d.music.title = title;
      });
      toast.success('Music uploaded. Listen to it below, then save your changes.');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const useLink = () => {
    const url = safeHttpUrl(linkDraft);
    if (!url) {
      toast.error('Please paste a complete web address that starts with https://');
      return;
    }
    update((d) => {
      d.music.source = 'custom';
      d.music.url = url;
    });
    setLinkDraft('');
    toast.success('Music link set. Listen to it below to make sure it plays, then save your changes.');
  };

  return (
    <>
      <PageHeader title="Background Music" description="The music starts when a guest taps “Open Invitation” and keeps playing as they scroll. Guests can pause it, mute it and change the volume." />
      <div className="space-y-6">
        <Card title="Music on the website">
          <Toggle
            label="Play background music"
            hint="When switched off, the music control disappears from the website completely."
            checked={music.enabled}
            onChange={(v) => update((d) => void (d.music.enabled = v))}
          />
          <div>
            <p className="mb-1.5 font-sans text-[0.82rem] font-semibold text-stone-800">
              Now set to play: <span className="font-normal">{usingOwn ? 'your own track' : 'the built-in saxophone instrumental'}</span>
            </p>
            {/* A real player, so you can hear exactly what guests will hear. */}
            <audio key={playing} controls preload="none" src={playing} className="w-full max-w-md" data-testid="music-preview">
              Your browser cannot play this audio file.
            </audio>
          </div>
          <TextField label="Title shown in the music control" value={music.title} onChange={(v) => update((d) => void (d.music.title = v))} />
          <div>
            <label htmlFor="music-volume" className="mb-1.5 block font-sans text-[0.82rem] font-semibold text-stone-800">
              Starting volume: {Math.round(music.volume * 100)}%
            </label>
            <input
              id="music-volume"
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round(music.volume * 100)}
              onChange={(e) => update((d) => void (d.music.volume = Number(e.target.value) / 100))}
              className="w-full max-w-md accent-[#570A34]"
            />
            <p className="mt-1.5 font-sans text-[0.78rem] text-stone-500">
              A soft start is kinder to guests. On iPhones the website cannot set the volume, so guests there use the buttons on the phone.
            </p>
          </div>
        </Card>

        <Card title="Use your own music" description="Upload an MP3 (up to 25 MB), or paste a direct link to an audio file. Please only use music you have permission to use.">
          <div className="flex flex-wrap items-center gap-3">
            <input ref={inputRef} type="file" accept="audio/*,.mp3,.m4a" className="sr-only" onChange={onFile} data-testid="music-input" />
            <Button variant="primary" busy={busy} icon={<Upload size={16} aria-hidden="true" />} onClick={() => inputRef.current?.click()}>
              {usingOwn ? 'Replace with another file' : 'Upload a music file'}
            </Button>
            {usingOwn ? (
              <Button
                onClick={() =>
                  update((d) => {
                    d.music.source = 'default';
                    d.music.url = '';
                    d.music.title = 'Saxophone Serenade';
                  })
                }
                data-testid="music-use-default"
              >
                Go back to the built-in music
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <TextField
                label="Or paste a link to an audio file"
                type="url"
                value={linkDraft}
                placeholder="https://example.com/our-song.mp3"
                onChange={setLinkDraft}
                hint="The link must point straight to an MP3 or similar file. Links to YouTube, Spotify or JioSaavn pages cannot be played by a website."
              />
            </div>
            <Button onClick={useLink} disabled={!linkDraft.trim()} className="mb-[1.9rem]">
              Use this link
            </Button>
          </div>
          {usingOwn ? <p className="break-all font-mono text-[0.76rem] text-stone-500">{music.url}</p> : null}
        </Card>

        <Notice>
          Browsers do not allow any website to start music by itself. That is why the invitation begins with the “Open Invitation” button: the guest’s tap is what
          lets the music start. If a phone is on silent, the music follows the phone’s setting.
        </Notice>
      </div>
    </>
  );
}
