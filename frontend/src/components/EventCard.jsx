// Labels for the api-contracts.md §5.1 `format` enum
const FORMAT_LABELS = {
  ONLINE: 'Online',
  IN_PERSON: 'In person',
};

// Event times are shown in Europe/Kyiv, the timezone of catalog dates (api-contracts.md §2)
const startFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Kyiv',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export default function EventCard({ event }) {
  return (
    <article className="event-card">
      <h2>{event.title}</h2>
      <dl>
        <dt>Starts</dt>
        <dd>
          <time dateTime={event.startsAt}>{startFormat.format(new Date(event.startsAt))}</time>
        </dd>
        <dt>Organisation</dt>
        <dd>{event.organizationName}</dd>
        <dt>Format</dt>
        <dd>{FORMAT_LABELS[event.format] ?? event.format}</dd>
      </dl>
    </article>
  );
}
