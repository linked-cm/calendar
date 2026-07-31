import { describe, expect, it } from 'vitest';

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
});
