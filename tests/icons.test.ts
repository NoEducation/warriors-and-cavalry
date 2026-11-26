import { describe, expect, it } from 'vitest';
import { ICONS, type IconName, RESOURCE_ICONS, iconSvg } from '../src/ui/icons';
import { BUILD_CATEGORIES, BUILD_TOOLS } from '../src/ui/BuildTool';
import { RESOURCE_KINDS } from '../src/sim/ResourceKind';

describe('ICONS', () => {
  it('draws every icon with some markup', () => {
    for (const [name, markup] of Object.entries(ICONS)) expect(markup.length, name).toBeGreaterThan(0);
  });

  it('has an icon for every build tool, category tab and resource', () => {
    const used: IconName[] = [
      ...BUILD_TOOLS.map((e) => e.icon),
      ...BUILD_CATEGORIES.map((c) => c.icon),
      ...RESOURCE_KINDS.map((k) => RESOURCE_ICONS[k]),
      'peasant',
    ];
    for (const name of used) expect(Object.keys(ICONS)).toContain(name);
  });
});

describe('iconSvg', () => {
  it('wraps an icon in a 16 by 16 svg hidden from screen readers', () => {
    const svg = iconSvg('wood');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain(ICONS.wood);
    expect(svg.endsWith('</svg>')).toBe(true);
  });
});
