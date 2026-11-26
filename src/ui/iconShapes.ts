// The palette and SVG shape helpers the icons are drawn with, on a 16 by 16 grid. No DOM.

/** The icon palette. */
export const C = Object.freeze({
  wood: '#a0682f',
  woodDark: '#5e3a1c',
  ring: '#e0b479',
  stone: '#a3a29a',
  stoneDark: '#6c6b66',
  stoneLight: '#cfcdc4',
  wheat: '#e8be4e',
  wheatDark: '#a27b26',
  skin: '#e6b48c',
  cloth: '#7d5c34',
  roof: '#a8432e',
  iron: '#b9bec6',
  green: '#5d8a38',
  red: '#d0392a',
  dark: '#2a1a0c',
});

/** `<rect>` at `x, y` of size `w` by `h` filled with `fill`. */
export function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

/** `<path>` with outline `d` filled with `fill`. */
export function path(d: string, fill: string): string {
  return `<path d="${d}" fill="${fill}"/>`;
}

/** `<line>` from `x1, y1` to `x2, y2`, `width` wide in `stroke`. */
export function line(x1: number, y1: number, x2: number, y2: number, width: number, stroke: string): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"/>`;
}

/** Crenellations: `count` merlons 2 wide with 1 gaps along the top `y` of a wall starting at `x`. */
export function crenels(x: number, y: number, count: number, fill: string): string {
  return Array.from({ length: count }, (_, i) => rect(x + i * 3, y, 2, 2, fill)).join('');
}

/** A log lying left to right with its cut end at the right, its top at `y`. */
export function log(y: number): string {
  return (
    rect(1, y, 11, 5, C.wood) +
    rect(1, y + 4, 11, 1, C.woodDark) +
    `<ellipse cx="12" cy="${y + 2.5}" rx="2.5" ry="2.5" fill="${C.ring}"/>` +
    `<circle cx="12" cy="${y + 2.5}" r="1" fill="${C.wood}"/>`
  );
}

/** A tied wheat sheaf. */
export const SHEAF =
  rect(7, 5, 2, 10, C.wheatDark) +
  [3, 6, 9]
    .map(
      (y) =>
        `<ellipse cx="5.5" cy="${y}" rx="1.5" ry="2" fill="${C.wheat}"/><ellipse cx="10.5" cy="${y}" rx="1.5" ry="2" fill="${C.wheat}"/>`,
    )
    .join('') +
  `<ellipse cx="8" cy="2.5" rx="1.5" ry="2" fill="${C.wheat}"/>` +
  rect(5, 10, 6, 2, C.woodDark);
/** A hammer, head up and right. */
export const HAMMER = line(3, 14, 10, 7, 2, C.wood) + path('M8 3 L13 8 L11 10 L6 5 Z', C.iron);
