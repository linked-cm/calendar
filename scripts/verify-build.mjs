import { access } from 'node:fs/promises';

const requiredArtifacts = [
  'lib/esm/index.js',
  'lib/esm/index.d.ts',
  'lib/esm/Calendar.module.css',
  'lib/esm/translations/en.json',
];

await Promise.all(requiredArtifacts.map((artifact) => access(new URL(`../${artifact}`, import.meta.url))));
