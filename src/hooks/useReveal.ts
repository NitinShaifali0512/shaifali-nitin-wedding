import { useEffect } from 'react';

/**
 * Fades sections in as they scroll into view. Elements opt in with a
 * `data-reveal` attribute. Elements added later (for example after new content
 * arrives) are picked up automatically.
 */
export function useReveal(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    const watch = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)').forEach((el) => observer.observe(el));
    };

    root.classList.add('reveal-ready');
    watch(document);

    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches('[data-reveal]:not(.is-visible)')) observer.observe(node);
          watch(node);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      root.classList.remove('reveal-ready');
    };
  }, [active]);
}
