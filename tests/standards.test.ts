import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { calendarTranslations, defaultCalendarText } from '../src/index.js';

const require = createRequire(import.meta.url);
const sourceFiles = ['Calendar.tsx', 'EventPopover.tsx', 'ResourceGrid.tsx', 'TimeGrid.tsx'];

describe('@_linked/calendar presentation standards', () => {
  it('uses LINKED primitives instead of raw interactive and typography controls', async () => {
    const sources = await Promise.all(
      sourceFiles.map((file) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')),
    );
    const source = sources.join('\n');

    expect(source).not.toMatch(/<(button|input|label|h[1-6])(?:\s|>)/);
    expect(source).not.toMatch(/role=["']button["']/);
    expect(source).toContain("@_linked/primitives/components/Button");
    expect(source).toContain("@_linked/primitives/components/Heading");
    expect(source).toContain("@_linked/primitives/components/Input");
    expect(source).toContain("@_linked/primitives/components/Label");
  });

  it('resolves every CSS variable through a local definition or the real @_linked/css catalog', async () => {
    const packageManifest = require.resolve('@_linked/css/package.json');
    const defaults = await readFile(join(dirname(packageManifest), 'theme-defaults.css'), 'utf8');
    const css = await readFile(new URL('../src/Calendar.module.css', import.meta.url), 'utf8');
    const definedByLinked = new Set(
      [...defaults.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map((match) => match[1]),
    );
    const definedLocally = new Set(
      [...css.matchAll(/--([a-zA-Z0-9-]+)\s*:/g)].map((match) => match[1]),
    );
    // These are instance-level presentation values supplied through React's style object. They
    // encode event color/accent and calculated geometry, rather than theme decisions.
    const definedAtRuntime = new Set(['a', 'c', 'hour-h', 'm-bar-h', 'm-date-h', 'resource-color']);
    const integrationSeamsWithLiteralDefaults = new Set(['calendar-mobile-navigation-clearance']);
    const derivedEventSurfaceTokens = new Set([
      'calendar-event-surface-bg',
      'calendar-event-surface-bg-hover',
      'calendar-event-multiday-surface-bg',
    ]);
    const used = [...css.matchAll(/var\(--([a-zA-Z0-9-]+)/g)].map((match) => match[1]);

    for (const token of used) {
      if (token.startsWith('calendar-')) {
        if (integrationSeamsWithLiteralDefaults.has(token)) {
          expect(css).toContain(`var(--${token}, 0px)`);
          continue;
        }
        if (derivedEventSurfaceTokens.has(token)) {
          const fallback = new RegExp(
            `var\\(--${token},\\s*color-mix\\(in srgb,\\s*var\\(--c,\\s*var\\(--control-accent\\)\\)\\s+\\d+%,\\s*var\\(--box-bg\\)\\)\\s*\\)`,
          );
          expect(css, `${token} must derive from the event/control accent and box surface`).toMatch(
            fallback,
          );
          continue;
        }
        const fallback = new RegExp(
          `var\\(--${token},\\s*var\\(--([a-zA-Z0-9-]+)\\)\\)`,
        ).exec(css)?.[1];
        expect(fallback, `${token} must have a semantic type-token fallback`).toBeTruthy();
        expect(definedByLinked.has(fallback!), `${token} falls back to undefined ${fallback}`).toBe(true);
        continue;
      }
      expect(
        definedByLinked.has(token) || definedLocally.has(token) || definedAtRuntime.has(token),
        `undefined CSS variable --${token}`,
      ).toBe(true);
    }

    expect(css).not.toMatch(/var\(--(?:bg-2|bg-rich|text-secondary|label-font-family|space-(?:2xs|xs|sm|md|lg)|safe-bottom|nav-clearance)(?:[,)]|\s)/);
  });

  it('uses one accent-derived event surface model instead of the primitive ghost jump', async () => {
    const sources = await Promise.all(
      sourceFiles.map((file) => readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')),
    );
    const source = sources.join('\n');
    const css = await readFile(new URL('../src/Calendar.module.css', import.meta.url), 'utf8');

    for (const className of ['agItem', 'tgAllDayEvent', 'tgEvent', 'mBar', 'resourceEvent']) {
      const marker = `className={style.${className}}`;
      const markerIndex = source.indexOf(marker);
      const buttonIndex = source.lastIndexOf('<Button', markerIndex);
      const openingTag = source.slice(buttonIndex, source.indexOf('>', markerIndex) + 1);

      expect(markerIndex, `${className} must remain a LINKED Button`).toBeGreaterThan(-1);
      expect(openingTag, `${className} must use the token-remappable solid state`).toContain(
        'variant="solid"',
      );
    }

    expect(css).toContain('--calendar-event-surface-bg,');
    expect(css).toContain('--calendar-event-surface-bg-hover,');
    expect(css).toContain('var(--c, var(--control-accent)) 12%');
    expect(css).toContain('var(--c, var(--control-accent)) 20%');
    expect(css.match(/--calendar-event-surface-bg,/g)).toHaveLength(1);
    expect(css.match(/--calendar-event-surface-bg-hover,/g)).toHaveLength(1);
    expect(css.match(/box-shadow: inset 3px 0 0 var\(--a, var\(--c\)\);/g)).toHaveLength(2);
  });

  it('ships one complete component-owned translation catalog', () => {
    expect(calendarTranslations.schemaVersion).toBe(1);
    expect(calendarTranslations.packageName).toBe('@_linked/calendar');
    expect(calendarTranslations.components).toHaveLength(1);
    expect(calendarTranslations.components[0].componentIri).toBe(
      'https://linked.cm/comp/calendar/Calendar',
    );

    const entries = calendarTranslations.components.flatMap((component) => component.entries);
    expect(new Set(entries.map(({ key }) => key)).size).toBe(entries.length);
    expect(entries.every(({ sourceText }) => sourceText.length > 0)).toBe(true);
    expect(defaultCalendarText.interactionHint).toContain('drag');
  });

  it('loads rrule through its browser and SSR compatible namespace boundary', async () => {
    const recurrence = await readFile(new URL('../src/recurrence.ts', import.meta.url), 'utf8');

    expect(recurrence).toContain("import * as rruleModule from 'rrule'");
    expect(recurrence).not.toMatch(/import\s+\{\s*rrulestr\s*\}\s+from\s+['"]rrule['"]/);
    expect(recurrence).not.toMatch(/import\s+rrulePackage\s+from\s+['"]rrule['"]/);
  });
});
