// Inline SVG icons for the build and resource bars, drawn in code on a 16 by 16 grid (no image assets).
import { ResourceKind } from '../sim/ResourceKind';
import { C, HAMMER, log, SHEAF, crenels, line, path, rect } from './iconShapes';

/** Every icon's name. */
export type IconName =
  | 'wood'
  | 'stone'
  | 'food'
  | 'peasant'
  | 'castle'
  | 'industry'
  | 'farmTab'
  | 'town'
  | 'keep'
  | 'hovel'
  | 'woodcutter'
  | 'stockpile'
  | 'granary'
  | 'quarry'
  | 'farm'
  | 'wall'
  | 'gate'
  | 'tower'
  | 'demolish';

/** Each icon's inner SVG markup on a `0 0 16 16` view box. */
export const ICONS: Readonly<Record<IconName, string>> = Object.freeze({
  wood: log(2) + log(9),
  stone:
    rect(4, 3, 7, 5, C.stoneLight) +
    rect(2, 7, 7, 6, C.stone) +
    rect(8, 8, 6, 5, C.stoneDark) +
    rect(2, 12, 12, 1, C.dark),
  food: SHEAF,
  peasant:
    `<circle cx="8" cy="4" r="2.5" fill="${C.skin}"/>` +
    path('M4 15 L5 8 L11 8 L12 15 Z', C.cloth) +
    rect(5, 11, 6, 1, C.woodDark),
  castle:
    rect(2, 6, 12, 9, C.stone) +
    crenels(2, 4, 4, C.stone) +
    rect(6, 10, 4, 5, C.woodDark) +
    rect(7, 1, 1, 5, C.dark) +
    path('M8 1 L12 2.5 L8 4 Z', C.red),
  industry: rect(2, 11, 9, 4, C.wood) + `<ellipse cx="11" cy="13" rx="2" ry="2" fill="${C.ring}"/>` + HAMMER,
  farmTab:
    path('M3 13 Q2 4 11 3 Q5 6 5 13 Z', C.iron) +
    line(4, 13, 6, 15, 2.5, C.wood) +
    rect(10, 7, 1, 8, C.wheatDark) +
    `<ellipse cx="10.5" cy="6" rx="1.5" ry="2.5" fill="${C.wheat}"/>`,
  town:
    path('M1 8 L8 2 L15 8 Z', C.roof) +
    rect(3, 8, 10, 7, C.ring) +
    rect(7, 10, 3, 5, C.woodDark) +
    rect(4, 9, 2, 2, C.dark),
  keep:
    rect(3, 5, 10, 10, C.stone) +
    crenels(3, 3, 4, C.stone) +
    rect(3, 5, 10, 1, C.stoneDark) +
    rect(6, 10, 4, 5, C.woodDark) +
    rect(7, 7, 2, 2, C.dark) +
    rect(12, 0, 1, 4, C.dark) +
    path('M12 0 L15 1 L12 2 Z', C.red),
  hovel: path('M1 9 L8 3 L15 9 Z', C.wheatDark) + rect(3, 9, 10, 6, C.wood) + rect(7, 11, 3, 4, C.woodDark),
  woodcutter:
    rect(2, 10, 10, 5, C.wood) +
    `<ellipse cx="7" cy="10" rx="5" ry="1.5" fill="${C.ring}"/>` +
    line(5, 10, 11, 3, 1.5, C.woodDark) +
    path('M10 1 L14 3 L12 7 L9 4 Z', C.iron),
  stockpile:
    [rect(1, 8, 7, 7, C.wood), rect(8, 8, 7, 7, C.wood), rect(4, 2, 7, 6, C.wood)].join('') +
    line(1, 8, 8, 15, 1, C.woodDark) +
    line(8, 8, 15, 15, 1, C.woodDark) +
    line(4, 2, 11, 8, 1, C.woodDark),
  granary:
    path('M4 15 Q2 9 5 6 L11 6 Q14 9 12 15 Z', C.ring) +
    rect(5, 5, 6, 1.5, C.woodDark) +
    path('M5 5 L6 2 L10 2 L11 5 Z', C.ring) +
    `<ellipse cx="8" cy="11" rx="2" ry="2.5" fill="${C.wheat}"/>`,
  quarry:
    path('M1 15 L3 9 L8 7 L13 9 L15 15 Z', C.stone) +
    path('M8 7 L13 9 L15 15 L9 15 Z', C.stoneDark) +
    line(4, 13, 11, 2, 1.5, C.wood) +
    path('M7 2 Q11 0 15 4 Q11 2 9 4 Z', C.iron),
  farm:
    rect(1, 7, 14, 8, C.green) +
    [8, 11, 14].map((y) => rect(2, y, 12, 1.5, C.wheat)).join('') +
    `<circle cx="12" cy="3" r="2" fill="${C.wheat}"/>`,
  wall:
    rect(1, 6, 14, 9, C.stone) +
    crenels(1, 4, 5, C.stone) +
    [9, 12].map((y) => rect(1, y, 14, 0.75, C.stoneDark)).join('') +
    rect(5, 6, 0.75, 3, C.stoneDark) +
    rect(10, 9, 0.75, 3, C.stoneDark),
  gate:
    rect(1, 4, 14, 11, C.stone) +
    crenels(1, 2, 5, C.stone) +
    path('M4 15 L4 9 Q8 4 12 9 L12 15 Z', C.dark) +
    [6, 8, 10].map((x) => rect(x, 7, 0.75, 8, C.iron)).join('') +
    rect(4, 11, 8, 0.75, C.iron),
  tower:
    rect(4, 4, 8, 11, C.stone) +
    crenels(3, 1, 4, C.stone) +
    rect(3, 3, 10, 2, C.stone) +
    rect(3, 5, 10, 1, C.stoneDark) +
    rect(7.5, 7, 1, 3, C.dark) +
    rect(6, 12, 4, 3, C.woodDark),
  demolish: HAMMER + line(2, 2, 7, 7, 2, C.red) + line(7, 2, 2, 7, 2, C.red),
});

/** The icon of each resource. */
export const RESOURCE_ICONS: Readonly<Record<ResourceKind, IconName>> = Object.freeze({
  [ResourceKind.Wood]: 'wood',
  [ResourceKind.Stone]: 'stone',
  [ResourceKind.Food]: 'food',
});

/** The full `<svg>` markup of icon `name`, class `icon`, hidden from screen readers. Set as an element's innerHTML. */
export function iconSvg(name: IconName): string {
  return `<svg viewBox="0 0 16 16" class="icon" aria-hidden="true">${ICONS[name]}</svg>`;
}
