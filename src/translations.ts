import calendarTranslationCatalog from './translations/en.json' with { type: 'json' };

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
  resource: sourceText('calendar.view.resource'),
  viewSwitcher: sourceText('calendar.viewSwitcher'),
  loading: sourceText('calendar.loading'),
  allDay: sourceText('calendar.allDay'),
  more: sourceText('calendar.more'),
  empty: sourceText('calendar.empty'),
  resourceView: sourceText('calendar.resource.view'),
  resourceEmpty: sourceText('calendar.resource.empty'),
  resourceColumnEmpty: sourceText('calendar.resource.columnEmpty'),
  unassigned: sourceText('calendar.resource.unassigned'),
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
