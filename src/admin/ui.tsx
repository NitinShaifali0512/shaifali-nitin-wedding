import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, ImagePlus, Info, Loader2, Trash2, Upload, X } from 'lucide-react';
import {
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { assetUrl } from '../lib/links';
import { AdminError, uploadImage } from './data';

/* ------------------------------ buttons ------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-wine-800 text-white hover:bg-wine-700 disabled:bg-wine-800/40',
  gold: 'bg-gold-500 text-wine-950 hover:bg-gold-400 disabled:opacity-50',
  secondary: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 disabled:opacity-50',
  ghost: 'text-stone-700 hover:bg-stone-100 disabled:opacity-50',
  danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  busy?: boolean;
  icon?: ReactNode;
  small?: boolean;
}

export function Button({ variant = 'secondary', busy = false, icon, small = false, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-sans font-semibold transition disabled:cursor-not-allowed ${
        small ? 'min-h-[2.25rem] px-3 text-[0.8rem]' : 'min-h-[2.75rem] px-4 text-sm'
      } ${BUTTON_STYLES[variant]} ${className}`}
    >
      {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------- layout ------------------------------- */

export function Card({ title, description, actions, children }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      {title || actions ? (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="font-sans text-base font-bold text-stone-900">{title}</h2> : null}
            {description ? <p className="mt-1 max-w-2xl font-sans text-[0.84rem] leading-relaxed text-stone-600">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className="space-y-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6">
      <h1 className="font-serif text-3xl font-semibold text-wine-800">{title}</h1>
      <p className="mt-1.5 max-w-2xl font-sans text-sm leading-relaxed text-stone-600">{description}</p>
    </header>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning' | 'success'; children: ReactNode }) {
  const styles = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    warning: 'border-amber-300 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone];
  const Icon = tone === 'success' ? CircleCheck : tone === 'warning' ? CircleAlert : Info;
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 font-sans text-[0.86rem] leading-relaxed ${styles}`}>
      <Icon size={18} className="mt-0.5 flex-none" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/* ------------------------------- fields ------------------------------- */

const INPUT_CLASS =
  'block w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 font-sans text-[0.95rem] text-stone-900 shadow-sm transition placeholder:text-stone-400 focus:border-wine-700 focus:outline-none focus:ring-2 focus:ring-wine-700/20';

interface FieldShellProps {
  label: string;
  hint?: string;
  id: string;
  children: ReactNode;
}

function FieldShell({ label, hint, id, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-sans text-[0.82rem] font-semibold text-stone-800">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 font-sans text-[0.78rem] leading-relaxed text-stone-500">{hint}</p> : null}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  type?: 'text' | 'date' | 'time' | 'url' | 'tel' | 'datetime-local' | 'email' | 'password';
  maxLength?: number;
  lang?: string;
}

export function TextField({ label, value, onChange, hint, placeholder, type = 'text', maxLength, lang }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id}>
      <input
        id={id}
        type={type}
        className={INPUT_CLASS}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        lang={lang}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldShell>
  );
}

export function TextAreaField({ label, value, onChange, hint, placeholder, rows = 3 }: TextFieldProps & { rows?: number }) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id}>
      <textarea id={id} className={`${INPUT_CLASS} resize-y leading-relaxed`} rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </FieldShell>
  );
}

export function NumberField({ label, value, onChange, hint, min, max }: { label: string; value: number; onChange: (value: number) => void; hint?: string; min?: number; max?: number }) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className={`${INPUT_CLASS} max-w-[9rem]`}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </FieldShell>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  hint?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id}>
      <select id={id} className={INPUT_CLASS} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="block cursor-pointer font-sans text-[0.9rem] font-semibold text-stone-800">
          {label}
        </label>
        {hint ? <p className="mt-0.5 font-sans text-[0.78rem] leading-relaxed text-stone-500">{hint}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 flex-none rounded-full transition ${checked ? 'bg-wine-800' : 'bg-stone-300'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2">{children}</div>;
}

/* ------------------------- reorder and remove ------------------------- */

export function RowControls({
  index,
  count,
  onMove,
  onRemove,
  itemName,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove?: () => void;
  itemName: string;
}) {
  return (
    <div className="flex flex-none items-center gap-1.5">
      <IconButton label={`Move ${itemName} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        <ArrowUp size={16} aria-hidden="true" />
      </IconButton>
      <IconButton label={`Move ${itemName} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
        <ArrowDown size={16} aria-hidden="true" />
      </IconButton>
      {onRemove ? (
        <IconButton label={`Delete ${itemName}`} onClick={onRemove} className="!border-red-200 !text-red-700 hover:!bg-red-50">
          <Trash2 size={16} aria-hidden="true" />
        </IconButton>
      ) : null}
    </div>
  );
}

/** Returns a copy of `list` with one item moved. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/* ------------------------------- toasts ------------------------------- */

interface Toast {
  id: number;
  tone: 'success' | 'error' | 'info';
  text: string;
}

interface ToastApi {
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside ToastProvider');
  return api;
}

export function errorText(error: unknown): string {
  if (error instanceof AdminError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const push = useCallback(
    (tone: Toast['tone'], text: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, tone, text }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 9000 : 4500);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(
    () => ({ success: (text) => push('success', text), error: (text) => push('error', text), info: (text) => push('info', text) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-3" aria-live="polite" data-testid="toasts">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            data-tone={toast.tone}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 font-sans text-[0.88rem] shadow-lg ${
              toast.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : toast.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-stone-200 bg-white text-stone-800'
            }`}
            style={{ animation: 'pop-in 0.2s ease' }}
          >
            {toast.tone === 'success' ? (
              <CircleCheck size={18} className="mt-0.5 flex-none" aria-hidden="true" />
            ) : toast.tone === 'error' ? (
              <CircleAlert size={18} className="mt-0.5 flex-none" aria-hidden="true" />
            ) : (
              <Info size={18} className="mt-0.5 flex-none" aria-hidden="true" />
            )}
            <p className="flex-1 leading-snug">{toast.text}</p>
            <button type="button" onClick={() => dismiss(toast.id)} className="-m-1 rounded p-1 opacity-60 hover:opacity-100" aria-label="Dismiss message">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------------------------- confirm dialog ---------------------------- */

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider');
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const confirm = useCallback<Confirm>((options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })), []);
  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending ? (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-stone-900/50 p-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
          onKeyDown={(event) => {
            if (event.key === 'Escape') close(false);
          }}
          data-testid="confirm-dialog"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" style={{ animation: 'pop-in 0.18s ease' }}>
            <h2 id="confirm-title" className="font-sans text-lg font-bold text-stone-900">
              {pending.title}
            </h2>
            <p id="confirm-message" className="mt-2 font-sans text-[0.9rem] leading-relaxed text-stone-600">
              {pending.message}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => close(false)} data-testid="confirm-cancel">
                {pending.cancelLabel ?? 'Cancel'}
              </Button>
              <Button variant={pending.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-testid="confirm-ok" autoFocus>
                {pending.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

/* ------------------------------ image field ------------------------------ */

interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  /** Shows a "Remove" button, for pictures that are optional. */
  optional?: boolean;
  /** A bundled picture to fall back to, offered as "Use the original". */
  defaultValue?: string;
  /** How the preview is cropped. */
  shape?: 'wide' | 'square' | 'tall';
}

export function ImageField({ label, value, onChange, hint, optional = false, defaultValue, shape = 'wide' }: ImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const preview = assetUrl(value);
  const shapeClass = shape === 'tall' ? 'h-40 w-32' : shape === 'square' ? 'h-32 w-32' : 'h-32 w-48';

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadImage(file));
      toast.success('Picture uploaded. Remember to save your changes.');
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-1.5 font-sans text-[0.82rem] font-semibold text-stone-800">{label}</p>
      <div className="flex flex-wrap items-start gap-4">
        <div className={`flex flex-none items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-100 ${shapeClass}`}>
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={26} className="text-stone-400" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <input ref={inputRef} id={id} type="file" accept="image/*" className="sr-only" onChange={onFile} data-testid="image-input" />
          <Button small busy={busy} icon={<Upload size={15} aria-hidden="true" />} onClick={() => inputRef.current?.click()}>
            {preview ? 'Replace picture' : 'Upload picture'}
          </Button>
          {defaultValue && value !== defaultValue ? (
            <Button small variant="ghost" onClick={() => onChange(defaultValue)}>
              Use the original
            </Button>
          ) : null}
          {optional && value ? (
            <Button small variant="ghost" icon={<Trash2 size={15} aria-hidden="true" />} onClick={() => onChange('')}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      {hint ? <p className="mt-2 font-sans text-[0.78rem] leading-relaxed text-stone-500">{hint}</p> : null}
    </div>
  );
}
