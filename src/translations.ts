import calendarTranslationCatalog from './translations/en.json';

type CatalogEntry = {
  key: string;
  sourceText: string;
  format?: 'simple' | 'icu';
};

const entries = new Map(
  calendarTranslationCatalog.components.flatMap((component) =>
    component.entries.map((entry) => [entry.key, entry] as const),
  ),
);

function sourceText(key: string): string {
  const entry = entries.get(key) as CatalogEntry | undefined;
  if (!entry) throw new Error(`Missing @_linked/calendar source translation: ${key}`);
  return entry.sourceText;
}

export const calendarTranslations = calendarTranslationCatalog;

export const defaultCalendarText = {
  today: sourceText('calendar.today'),
  previous: sourceText('calendar.previous'),
  next: sourceText('calendar.next'),
  month: sourceText('calendar.view.month'),
  week: sourceText('calendar.view.week'),
  day: sourceText('calendar.view.day'),
  agenda: sourceText('calendar.view.agenda'),
  viewSwitcher: sourceText('calendar.viewSwitcher'),
  loading: sourceText('calendar.loading'),
  allDay: sourceText('calendar.allDay'),
  more: sourceText('calendar.more'),
  empty: sourceText('calendar.empty'),
  start: sourceText('calendar.start'),
  end: sourceText('calendar.end'),
  save: sourceText('calendar.save'),
  cancel: sourceText('calendar.cancel'),
  edit: sourceText('calendar.edit'),
  eventLocalTime: sourceText('calendar.eventLocalTime'),
  directions: sourceText('calendar.directions'),
  join: sourceText('calendar.join'),
  share: sourceText('calendar.share'),
  checkIn: sourceText('calendar.checkIn'),
  expand: sourceText('calendar.expand'),
  close: sourceText('calendar.close'),
  continued: sourceText('calendar.continued'),
  confirm: sourceText('calendar.confirm'),
  interactionHint: sourceText('calendar.interactionHint'),
} as const;
