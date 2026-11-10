/** The brief loading screen. It matches the one shown before the page's code arrives. */
export function Splash({ text = 'Opening your invitation' }: { text?: string }) {
  return (
    <div className="boot" role="status" aria-live="polite">
      <div className="boot-ring" />
      <div className="boot-text">{text}</div>
    </div>
  );
}
