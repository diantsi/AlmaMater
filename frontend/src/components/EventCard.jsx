import { formatLabel } from '../lib/eventOptions.js';
import { formatKyivDateTime } from '../lib/kyivTime.js';

export default function EventCard({ event }) {
  return (
    <article className="event-card">
      <h2>{event.title}</h2>
      <dl>
        <dt>Starts</dt>
        <dd>
          <time dateTime={event.startsAt}>{formatKyivDateTime(event.startsAt)}</time>
        </dd>
        <dt>Organisation</dt>
        <dd>{event.organizationName}</dd>
        <dt>Format</dt>
        <dd>{formatLabel(event.format)}</dd>
      </dl>
    </article>
  );
}
