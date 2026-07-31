import { linkedPackage } from '@_linked/core/utils/Package';

/** Official first-party package identity. Hosting it inside Serve does not change its Linked identity. */
export const calendarPackageName = '@_linked/calendar' as const;
export const calendarPackageBaseUri = 'https://linked.cm/' as const;

const registration = linkedPackage(calendarPackageName, {
  baseUri: calendarPackageBaseUri,
});

export const {
  getPackageShape,
  linkedOntology,
  linkedShape,
  linkedUtil,
  packageExports,
  packageMetadata,
  registerPackageExport,
  registerPackageModule,
} = registration;

export const packageName = registration.packageName;
