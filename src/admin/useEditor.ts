import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { defaultContent } from '../content/defaults';
import { contentFingerprint, normalizeContent } from '../content/normalize';
import type { SiteContent } from '../content/types';
import { AdminError, fetchDraft, loadContent, publishDraft, saveDraft } from './data';
import { errorText, useConfirm, useToast } from './ui';

export interface Editor {
  status: 'loading' | 'ready' | 'error';
  error: AdminError | null;
  /** The copy being edited on screen. */
  content: SiteContent;
  /** True when the screen holds changes that are not saved to the database yet. */
  dirty: boolean;
  /** True when the saved draft differs from what guests currently see. */
  unpublished: boolean;
  neverPublished: boolean;
  saving: boolean;
  publishing: boolean;
  savedAt: string;
  publishedAt: string | null;
  update: (mutate: (draft: SiteContent) => void) => void;
  replace: (content: SiteContent) => void;
  save: () => Promise<boolean>;
  publish: () => Promise<boolean>;
  discard: () => void;
  reload: () => Promise<void>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Holds the content while it is being edited and talks to the database.
 *
 *   edit on screen  ->  Save Changes  ->  draft in the database
 *                       Publish       ->  published copy that guests see
 */
export function useEditor(): Editor {
  const toast = useToast();
  const confirm = useConfirm();

  const [status, setStatus] = useState<Editor['status']>('loading');
  const [error, setError] = useState<AdminError | null>(null);
  const [content, setContent] = useState<SiteContent>(() => normalizeContent(defaultContent));
  const [savedPrint, setSavedPrint] = useState('');
  const [publishedPrint, setPublishedPrint] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState('');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const revisionRef = useRef(0);
  const savedContentRef = useRef<SiteContent>(content);
  const contentRef = useRef(content);
  contentRef.current = content;

  const currentPrint = useMemo(() => contentFingerprint(content), [content]);
  const dirty = status === 'ready' && currentPrint !== savedPrint;
  const unpublished = status === 'ready' && savedPrint !== publishedPrint;

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const loaded = await loadContent();
      revisionRef.current = loaded.draft.revision;
      savedContentRef.current = loaded.draft.content;
      setContent(loaded.draft.content);
      setSavedPrint(contentFingerprint(loaded.draft.content));
      setSavedAt(loaded.draft.updatedAt);
      setPublishedPrint(loaded.published ? contentFingerprint(loaded.published.content) : null);
      setPublishedAt(loaded.published ? loaded.published.updatedAt : null);
      setStatus('ready');
    } catch (problem) {
      setError(problem instanceof AdminError ? problem : new AdminError('unknown', errorText(problem)));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Warn before the tab is closed or reloaded with unsaved changes.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const update = useCallback((mutate: (draft: SiteContent) => void) => {
    setContent((current) => {
      const next = clone(current);
      mutate(next);
      return next;
    });
  }, []);

  const replace = useCallback((next: SiteContent) => setContent(normalizeContent(next)), []);

  const discard = useCallback(() => setContent(clone(savedContentRef.current)), []);

  /** Writes the screen copy to the draft. Returns the saved revision, or null if it did not save. */
  const writeDraft = useCallback(async (): Promise<number | null> => {
    const toSave = normalizeContent(contentRef.current);
    const apply = (row: Awaited<ReturnType<typeof saveDraft>>) => {
      revisionRef.current = row.revision;
      savedContentRef.current = row.content;
      setSavedPrint(contentFingerprint(row.content));
      setSavedAt(row.updatedAt);
      // Only replace the screen copy if nothing was typed while saving.
      setContent((current) => (contentFingerprint(current) === contentFingerprint(toSave) ? row.content : current));
      return row.revision;
    };
    try {
      return apply(await saveDraft(toSave, revisionRef.current));
    } catch (problem) {
      if (!(problem instanceof AdminError) || problem.code !== 'conflict') throw problem;
      const overwrite = await confirm({
        title: 'This draft was changed somewhere else',
        message:
          'Someone saved changes to the draft after you opened this page, perhaps in another tab or on another device. You can keep your version, which replaces theirs, or load their version, which discards what you changed here.',
        confirmLabel: 'Keep my version',
        cancelLabel: 'Load their version',
        danger: true,
      });
      if (overwrite) return apply(await saveDraft(toSave, null));
      const theirs = await fetchDraft();
      revisionRef.current = theirs.revision;
      savedContentRef.current = theirs.content;
      setContent(theirs.content);
      setSavedPrint(contentFingerprint(theirs.content));
      setSavedAt(theirs.updatedAt);
      toast.info('The other version has been loaded.');
      return null;
    }
  }, [confirm, toast]);

  const save = useCallback(async (): Promise<boolean> => {
    if (saving || publishing) return false;
    setSaving(true);
    try {
      const revision = await writeDraft();
      if (revision !== null) toast.success('Changes saved. Publish when you are ready for guests to see them.');
      return revision !== null;
    } catch (problem) {
      toast.error(errorText(problem));
      return false;
    } finally {
      setSaving(false);
    }
  }, [publishing, saving, toast, writeDraft]);

  const publish = useCallback(async (): Promise<boolean> => {
    if (saving || publishing) return false;
    setPublishing(true);
    try {
      // Publishing always includes what is on screen, so unsaved changes are saved first.
      let revision: number | null = revisionRef.current;
      if (contentFingerprint(contentRef.current) !== contentFingerprint(savedContentRef.current)) {
        revision = await writeDraft();
        if (revision === null) return false;
      }
      const result = await publishDraft(revision);
      setPublishedPrint(contentFingerprint(savedContentRef.current));
      setPublishedAt(result.updatedAt);
      toast.success('Website updated. Guests now see the new version.');
      return true;
    } catch (problem) {
      toast.error(errorText(problem));
      return false;
    } finally {
      setPublishing(false);
    }
  }, [publishing, saving, toast, writeDraft]);

  return {
    status,
    error,
    content,
    dirty,
    unpublished,
    neverPublished: status === 'ready' && publishedPrint === null,
    saving,
    publishing,
    savedAt,
    publishedAt,
    update,
    replace,
    save,
    publish,
    discard,
    reload,
  };
}
