# `@_linked/calendar`

`@_linked/calendar` is the first-party, shape-agnostic calendar engine shared by LINKED applications.
It is a controlled projection: hosts provide render-ready calendar items and handle change callbacks through
their own canonical Shape verbs. The package never becomes an authoritative event store.

## Architecture

- The generic engine, recurrence windowing, timezone helpers, lanes, invitations, and refresh contract live
  here.
- Serve's Event/Mission/RSVP/Resource mappings remain in `serve-community/src/services/calendar`.
- The Schedule organizer add-on supplies a separate adapter over its authorized Event and occurrence queries.
- Interactive and heading elements compose `@_linked/primitives`; the package does not create competing
  atoms.
- Calendar-specific CSS seams fall back to the component/type tokens shipped by `@_linked/css`. Host themes
  may override those seams, but the package does not own a Serve or Create Now palette.
- English source copy and stable translation keys live in `src/translations/en.json`. Consumers may pass a
  translated `labels` contract without forking the component or its markup.

```tsx
import { Calendar, type CalEventData } from '@_linked/calendar';

const items: CalEventData[] = graphProjection.map(toCalendarItem);

<Calendar
  events={items}
  view="week"
  cursor={cursor}
  onView={setView}
  onCursor={setCursor}
  onMove={(item, start, end) => hostCommands.reschedule(item.id, start, end)}
/>;
```

## Package identity

- npm: `@_linked/calendar`
- package IRI: `https://linked.cm/pkg/calendar`
- repository target: `linked-cm/calendar`

The current Serve workspace is the extraction staging location. The package is structured so moving it into
its own public repository does not change imports, package identity, or graph identifiers.
