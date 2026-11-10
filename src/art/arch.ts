/**
 * The scalloped arch from the printed invitation, traced from the card itself.
 * Coordinates are in a 352-unit-wide space; the straight sides can be any height.
 */

const ARCH_HEAD =
  'M344.7 206.8V181.6C349.7 178.5 351.7 173 351.7 166.7C351.7 156.9 343.8 149 334 149C338.3 145.8 341.1 140.7 341.1 134.9C341.1 125.1 333.1 117.2 323.3 117.2C322.9 117.2 322.5 117.3 322.1 117.3C324.3 114.4 325.6 110.8 325.6 106.8C325.6 97 317.6 89.1 307.8 89.1C305.5 89.1 303.3 89.6 301.2 90.4C302.1 88.3 302.6 86 302.6 83.7C302.6 73.9 294.6 66 284.8 66C281.3 66 278.2 67 275.4 68.7C275.4 68.3 275.5 67.8 275.5 67.4C275.5 57.6 267.5 49.7 257.7 49.7C251.7 49.7 246.4 52.7 243.2 57.2C243.2 57 243.1 57.6 243 58.9V54.3C242.1 46.1 234.5 43 227 41.7C212.1 39 199.6 29.4 189.6 18.5C185.8 14.4 182.3 10.1 179.2 5.5C178.9 5.1 176.7 1 175.9 0.3V0V0.1C175.1 0.8 172.9 4.9 172.6 5.3C169.4 9.9 165.9 14.2 162.2 18.3C152.2 29.2 139.7 38.8 124.8 41.5C116.8 42.9 108.7 46.4 108.7 55.9C108.7 55.8 108.6 55.8 108.6 55.7V57C105.4 52.5 100.1 49.6 94.2 49.6C84.4 49.6 76.4 57.5 76.4 67.3C76.4 67.7 76.5 68.2 76.5 68.6C73.8 66.9 70.6 65.9 67.1 65.9C57.3 65.9 49.3 73.8 49.3 83.6C49.3 86 49.8 88.3 50.7 90.3C48.7 89.5 46.5 89 44.1 89C34.3 89 26.3 96.9 26.3 106.7C26.3 110.6 27.6 114.2 29.8 117.2C29.4 117.2 29 117.1 28.6 117.1C18.8 117.1 10.8 125 10.8 134.8C10.8 140.6 13.6 145.6 17.9 148.9C8.1 148.9 0.2 156.9 0.2 166.6C0.2 172.9 2.3 178.4 7.2 181.5V206.7C12.4 210 15.8 215.7 15.8 222.2C15.8 229.4 11.6 235.6 5.6 238.6';

const ARCH_SHOULDER = 'V238.8C340.4 235.8 336.2 229.6 336.2 222.4C336.1 215.8 339.6 210.1 344.7 206.8Z';

export const ARCH_WIDTH = 352;
/** Height of the decorative head of the arch; below this the sides are straight. */
export const ARCH_HEAD_HEIGHT = 240;

/** The closed outline of the arch for a panel `height` units tall. */
export function archPath(height: number): string {
  const h = Math.max(height, ARCH_HEAD_HEIGHT);
  return `${ARCH_HEAD}V${h}H346.4${ARCH_SHOULDER}`;
}

/** A CSS `url(...)` value that masks an element to the arch shape. */
export function archMask(height: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${ARCH_WIDTH} ${height}' preserveAspectRatio='none'><path d='${archPath(height)}'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Points of a scalloped ("cloud") outline around an ellipse or rounded rectangle, used for hand-drawn frames. */
export function scallopEllipsePath(width: number, height: number, bumps: number, depth: number): string {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2 - depth;
  const ry = height / 2 - depth;
  const points: Array<[number, number]> = [];
  for (let i = 0; i < bumps; i += 1) {
    const angle = (i / bumps) * Math.PI * 2 - Math.PI / 2;
    points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < bumps; i += 1) {
    const next = points[(i + 1) % bumps];
    const current = points[i];
    const chord = Math.hypot(next[0] - current[0], next[1] - current[1]);
    const r = (chord / 2) * 1.08;
    d += `A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${next[0].toFixed(1)} ${next[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

export function scallopRectPath(width: number, height: number, bump: number): string {
  const inset = bump * 0.6;
  const w = width - inset * 2;
  const h = height - inset * 2;
  const nx = Math.max(4, Math.round(w / (bump * 2)));
  const ny = Math.max(3, Math.round(h / (bump * 2)));
  const sx = w / nx;
  const sy = h / ny;
  let d = `M${inset} ${inset}`;
  for (let i = 1; i <= nx; i += 1) d += `A${(sx / 2).toFixed(1)} ${(sx / 2).toFixed(1)} 0 0 1 ${(inset + i * sx).toFixed(1)} ${inset}`;
  for (let i = 1; i <= ny; i += 1) d += `A${(sy / 2).toFixed(1)} ${(sy / 2).toFixed(1)} 0 0 1 ${(inset + w).toFixed(1)} ${(inset + i * sy).toFixed(1)}`;
  for (let i = nx - 1; i >= 0; i -= 1) d += `A${(sx / 2).toFixed(1)} ${(sx / 2).toFixed(1)} 0 0 1 ${(inset + i * sx).toFixed(1)} ${(inset + h).toFixed(1)}`;
  for (let i = ny - 1; i >= 0; i -= 1) d += `A${(sy / 2).toFixed(1)} ${(sy / 2).toFixed(1)} 0 0 1 ${inset} ${(inset + i * sy).toFixed(1)}`;
  return `${d}Z`;
}
