import { describe, expect, it } from 'vitest';
import manifest from '../package.json';

import {
  Calendar,
  calendarPackageBaseUri,
  calendarPackageName,
  packageExports,
  packageMetadata,
  packageName,
} from '../src/index.js';

describe('@_linked/calendar package identity', () => {
  it('keeps the first-party package name and linked.cm identity root', () => {
    expect(packageName).toBe('@_linked/calendar');
    expect(calendarPackageName).toBe('@_linked/calendar');
    expect(calendarPackageBaseUri).toBe('https://linked.cm/');
    expect(packageMetadata.id).toBe('https://linked.cm/pkg/calendar');
  });

  it('registers the public Calendar component under the owning package', () => {
    expect(packageExports.Calendar).toBe(Calendar);
  });

  it('declares buildable ESM/CJS exports and the reviewed recurrence dependency', () => {
    expect(manifest.main).toBe('lib/cjs/index.js');
    expect(manifest.module).toBe('lib/esm/index.js');
    expect(manifest.exports['.']).toMatchObject({
      development: './src/index.ts',
      import: './lib/esm/index.js',
      require: './lib/cjs/index.js',
    });
    expect(manifest.dependencies.rrule).toBe('2.8.1');
    expect(manifest.files).toContain('THIRD_PARTY_NOTICES.md');
  });
});
