import { History, KeyRound, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { contentFingerprint } from '../../content/normalize';
import { formatTimestamp } from '../../lib/dates';
import { type StoredFile, type VersionRow, changePassword, listStoredFiles, listVersions, referencedUploads, removeStoredFiles } from '../data';
import type { Editor } from '../useEditor';
import { Button, Card, Notice, PageHeader, TextField, errorText, useConfirm, useToast } from '../ui';

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function SettingsPanel({ editor, email }: { editor: Editor; email: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [changing, setChanging] = useState(false);
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [unused, setUnused] = useState<StoredFile[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const loadVersions = useCallback(async () => {
    try {
      setVersions(await listVersions());
    } catch (error) {
      toast.error(errorText(error));
      setVersions([]);
    }
  }, [toast]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions, editor.publishedAt]);

  const submitPassword = async () => {
    if (password.length < 8) {
      toast.error('Please choose a password of at least 8 characters.');
      return;
    }
    if (password !== again) {
      toast.error('The two passwords are not the same.');
      return;
    }
    setChanging(true);
    try {
      await changePassword(password);
      setPassword('');
      setAgain('');
      toast.success('Your password has been changed.');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setChanging(false);
    }
  };

  const restore = async (version: VersionRow) => {
    const ok = await confirm({
      title: 'Bring this version back for editing?',
      message: `The version published on ${formatTimestamp(version.publishedAt)} will be loaded into the editor. Nothing changes for guests until you publish.`,
      confirmLabel: 'Load this version',
    });
    if (!ok) return;
    editor.replace(version.content);
    toast.info('The older version is loaded. Review it, then save and publish to make it live.');
  };

  const scan = async () => {
    setScanning(true);
    try {
      const [files, history] = await Promise.all([listStoredFiles(), listVersions()]);
      const used = referencedUploads(editor.content);
      for (const version of history) referencedUploads(version.content).forEach((url) => used.add(url));
      setUnused(files.filter((file) => !used.has(file.url.split('?')[0])));
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setScanning(false);
    }
  };

  const clean = async () => {
    if (!unused || unused.length === 0) return;
    const ok = await confirm({
      title: `Delete ${unused.length} unused ${unused.length === 1 ? 'file' : 'files'}?`,
      message: 'These uploads are not used by the current content or by any version in the publishing history. Deleting them cannot be undone.',
      confirmLabel: 'Delete files',
      danger: true,
    });
    if (!ok) return;
    setCleaning(true);
    try {
      await removeStoredFiles(unused.map((file) => file.path));
      toast.success('Unused files deleted.');
      setUnused([]);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setCleaning(false);
    }
  };

  const currentPrint = contentFingerprint(editor.content);

  return (
    <>
      <PageHeader title="Settings" description="Your account, the publishing history and housekeeping for uploaded files." />
      <div className="space-y-6">
        <Card title="Your account" description={`You are signed in as ${email}.`}>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="New password" type="password" value={password} onChange={setPassword} hint="At least 8 characters." />
            <TextField label="New password, once more" type="password" value={again} onChange={setAgain} />
          </div>
          <Button icon={<KeyRound size={15} aria-hidden="true" />} busy={changing} onClick={() => void submitPassword()} disabled={!password}>
            Change password
          </Button>
        </Card>

        <Card title="Publishing history" description="Every time you publish, a copy is kept. The 30 most recent copies are stored, and any of them can be brought back.">
          {versions === null ? <p className="font-sans text-sm text-stone-500">Loading…</p> : null}
          {versions !== null && versions.length === 0 ? <p className="font-sans text-sm text-stone-600">Nothing has been published yet.</p> : null}
          {versions && versions.length > 0 ? (
            <ul className="divide-y divide-stone-200" data-testid="version-list">
              {versions.map((version, index) => {
                const same = contentFingerprint(version.content) === currentPrint;
                return (
                  <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <History size={16} className="text-stone-400" aria-hidden="true" />
                      <p className="font-sans text-[0.9rem] text-stone-800">
                        {formatTimestamp(version.publishedAt)}
                        {index === 0 ? <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide text-emerald-800">Live now</span> : null}
                      </p>
                    </div>
                    <Button small onClick={() => void restore(version)} disabled={same} data-testid="version-restore">
                      {same ? 'Same as the editor' : 'Load into the editor'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Card>

        <Card
          title="Uploaded files"
          description="Replacing a photograph or track leaves the old file in storage, so that a published page never loses a picture. From time to time you can clear out the files nothing uses any more."
        >
          {editor.dirty ? <Notice tone="warning">Please save your changes first, so that the check uses your latest content.</Notice> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void scan()} busy={scanning} disabled={editor.dirty} data-testid="scan-files">
              Check for unused files
            </Button>
            {unused && unused.length > 0 ? (
              <Button variant="danger" icon={<Trash2 size={15} aria-hidden="true" />} onClick={() => void clean()} busy={cleaning} data-testid="clean-files">
                Delete {unused.length} unused {unused.length === 1 ? 'file' : 'files'}
              </Button>
            ) : null}
          </div>
          {unused !== null ? (
            <p className="font-sans text-[0.86rem] text-stone-700" data-testid="unused-result">
              {unused.length === 0
                ? 'Every uploaded file is in use. There is nothing to clear.'
                : `${unused.length} unused ${unused.length === 1 ? 'file' : 'files'}, ${formatBytes(unused.reduce((sum, file) => sum + file.size, 0))} in total.`}
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}
