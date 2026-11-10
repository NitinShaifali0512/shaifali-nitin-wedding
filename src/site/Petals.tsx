import { useMemo } from 'react';

const COLOURS: Array<[string, string]> = [
  ['#fff1e0', '#f6cfc9'],
  ['#ffe3be', '#f1b9b0'],
  ['#fbe1e3', '#e699a3'],
  ['#fff6ea', '#f3d6b8'],
];

/** A small pseudo-random generator so every visit gets the same graceful arrangement. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * A short shower of peony petals, shown once when the invitation opens.
 * It ends by itself after a few seconds, so nothing keeps drifting over the
 * text while guests read.
 */
export function Petals({ count = 16 }: { count?: number }) {
  const petals = useMemo(() => {
    const random = seeded(20261205);
    return Array.from({ length: count }, (_, index) => {
      const [a, b] = COLOURS[index % COLOURS.length];
      return {
        id: index,
        left: `${4 + random() * 92}%`,
        size: `${12 + random() * 12}px`,
        duration: `${6.5 + random() * 4.5}s`,
        delay: `${random() * 2.6}s`,
        drift: `${-70 + random() * 140}px`,
        spin: `${260 + random() * 520}deg`,
        a,
        b,
      };
    });
  }, [count]);

  return (
    <div aria-hidden="true">
      {petals.map((petal) => (
        <span
          key={petal.id}
          className="petal"
          style={{
            left: petal.left,
            ['--size' as string]: petal.size,
            ['--duration' as string]: petal.duration,
            ['--delay' as string]: petal.delay,
            ['--drift' as string]: petal.drift,
            ['--spin' as string]: petal.spin,
            ['--petal-a' as string]: petal.a,
            ['--petal-b' as string]: petal.b,
          }}
        />
      ))}
    </div>
  );
}
