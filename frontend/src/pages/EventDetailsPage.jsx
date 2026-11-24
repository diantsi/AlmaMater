import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { fetchFaculties, fetchTopics } from '../api/dictionaries.js';
import { fetchEvent } from '../api/events.js';
import { ApiError } from '../api/http.js';
import CancelEventDialog from '../components/CancelEventDialog.jsx';
import { FormatTag, ticketStyle, topicArt } from '../components/EventCard.jsx';
import ManageActions from '../components/ManageActions.jsx';
import PageNotice from '../components/PageNotice.jsx';
import ParticipationSection from '../components/ParticipationSection.jsx';
import SubscriptionSection from '../components/SubscriptionSection.jsx';
import { participationMethodLabel } from '../lib/eventOptions.js';
import { MONTHS_SHORT, formatKyivDateTime, kyivDateParts } from '../lib/kyivTime.js';

/**
 * Full event representation from api-contracts.md §5.2 (fields this page reads)
 *
 * @typedef {{
 *   id: string,
 *   organizationName: string,
 *   status: 'PUBLISHED' | 'CANCELLED',
 *   revision: number,
 *   title: string,
 *   description: string,
 *   startsAt: string,
 *   speakerName: string | null,
 *   topicId: string,
 *   facultyId: string,
 *   intendedAudience: string | null,
 *   newcomersWelcome: boolean | null,
 *   format: string,
 *   venue: string | null,
 *   meetingUrl: string | null,
 *   durationMinutes: number | null,
 *   registrationDeadline: string | null,
 *   participationMethod: string,
 *   googleFormUrl: string | null,
 *   contactDetails: string | null,
 *   attendanceInstructions: string | null,
 *   publishedAt: string,
 *   cancelledAt: string | null,
 *   eventUrl: string,
 *   canManage: boolean,
 *   subscribed: boolean
 * }} EventDetails
 */

/** @typedef {{ id: string, name: string, code?: string }} DictionaryItem */

/**
 * @typedef {{ state: 'loading' }
 *   | { state: 'ok', event: EventDetails, topic: DictionaryItem | undefined, facultyName: string | undefined }
 *   | { state: 'not-found' }
 *   | { state: 'invalid-id' }
 *   | { state: 'error', message: string }} DetailsState
 */

/**
 * @param {DictionaryItem[]} items
 * @param {string} id
 */
function nameOf(items, id) {
  return items.find((item) => item.id === id)?.name;
}

/** @param {unknown} error @returns {DetailsState} */
function toErrorState(error) {
  if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') return { state: 'not-found' };
  if (error instanceof ApiError && error.code === 'MALFORMED_REQUEST') return { state: 'invalid-id' };
  return { state: 'error', message: error instanceof Error ? error.message : String(error) };
}

// Line icons of the details list, in the reference's order
const INFO_ICONS = {
  start: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M7 3v4m10-4v4m-9 8h3m3 0h3" />
    </>
  ),
  duration: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  place: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  speaker: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  faculty: <path d="M12 6v15M3 4c4-1 7 0 9 2 3-2 6-3 9-2v15c-3-1-6 0-9 2-3-2-6-3-9-2Z" />,
  audience: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M2 21v-3a7 7 0 0 1 14 0v3m1-17a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5" />
    </>
  ),
  newcomers: <path d="m5 12 4 4 10-10" />,
  method: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6m-6 4h6m-6 4h4" />
    </>
  ),
};

/**
 * One label/value pair of the details list; callers skip it when an optional value is null (BR-43)
 * @param {{ icon: keyof typeof INFO_ICONS, label: string, children: import('react').ReactNode }} props
 */
function InfoItem({ icon, label, children }) {
  return (
    <div className="info-item">
      <span className="info-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">{INFO_ICONS[icon]}</svg>
      </span>
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  );
}

export default function EventDetailsPage() {
  const { eventId = '' } = useParams();
  const location = useLocation();
  const [result, setResult] = useState(/** @type {DetailsState} */ ({ state: 'loading' }));
  const [reloads, setReloads] = useState(0);
  // Set after a save (EditEventPage passes it in the navigation state) or a cancellation
  const [notice, setNotice] = useState(/** @type {string | null} */ (location.state?.notice ?? null));
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    setResult({ state: 'loading' });
    Promise.all([fetchEvent(eventId), fetchTopics(), fetchFaculties()])
      .then(([event, topics, faculties]) => {
        if (ignore) return;
        setResult({
          state: 'ok',
          event,
          topic: topics.find((item) => item.id === event.topicId),
          facultyName: nameOf(faculties, event.facultyId),
        });
      })
      .catch((error) => !ignore && setResult(toErrorState(error)));
    return () => {
      ignore = true;
    };
  }, [eventId, reloads]);

  if (result.state === 'loading') return <PageNotice role="status">Завантаження події…</PageNotice>;
  if (result.state === 'not-found' || result.state === 'invalid-id') {
    return (
      <PageNotice title="Подію не знайдено">
        {result.state === 'not-found'
          ? 'За цим посиланням немає події. Можливо, в ньому помилка.'
          : 'Це посилання на подію недійсне.'}
      </PageNotice>
    );
  }
  if (result.state === 'error') {
    return <PageNotice title="Подія">Не вдалося завантажити подію: {result.message}</PageNotice>;
  }

  const { event, topic, facultyName } = result;
  const cancelled = event.status === 'CANCELLED';
  const past = new Date(event.startsAt).getTime() <= Date.now();
  const attendable = !cancelled && !past;
  // api-contracts.md §5.2: edit and cancel only for the owning organisation and only while the event is upcoming
  const manageable = event.canManage && attendable;
  const shareUrl = new URL(event.eventUrl, window.location.origin).href;
  const { year, month, day, time } = kyivDateParts(event.startsAt);

  return (
    <article className="detail-page" aria-labelledby="event-heading">
      <Link className="back-link" to="/events">
        <svg className="arrow" aria-hidden="true">
          <use href="#arrow" />
        </svg>
        До афіші
      </Link>

      {notice && (
        <p className="status status-ok detail-notice" role="status">
          {notice}
        </p>
      )}
      {cancelled && (
        <p className="status status-error detail-notice" role="status">
          <strong>Подію скасовано</strong>
          {event.cancelledAt && <> {formatKyivDateTime(event.cancelledAt)}</>}. Вона не відбудеться.
        </p>
      )}
      {!cancelled && past && (
        <p className="status detail-notice" role="status">
          <strong>Подія вже почалася або відбулася.</strong>
        </p>
      )}

      <div className="detail-ticket" style={ticketStyle(event.id)}>
        <div className="ticket-copy">
          <div className="ticket-kicker">
            {topic && <span className="topic-label">{topic.name}</span>}
            <FormatTag format={event.format} />
          </div>
          <h1 className="detail-title" id="event-heading">
            {event.title}
          </h1>
          <p className="organizer">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {INFO_ICONS.audience}
            </svg>
            Організатор: {event.organizationName}
          </p>
        </div>
        <div className="ticket-date">
          <svg
            className="detail-sticker"
            viewBox="0 0 100 100"
            fill="none"
            stroke="#262422"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {topicArt(topic?.code)}
            <path d="m79 10 4-7m8 16 7-2" stroke="#365ec4" />
          </svg>
          <span className="date-number">{day}</span>
          <span className="date-month">
            {MONTHS_SHORT[month - 1]} {year}
          </span>
          <span className="date-clock">{time}</span>
        </div>
      </div>

      <div className="detail-layout">
        <div className="detail-left">
          <section className="paper-panel">
            <h2>Про подію</h2>
            <p className="description">{event.description}</p>
          </section>
          <section className="paper-panel">
            <h2>Деталі події</h2>
            <dl className="detail-info">
              <InfoItem icon="start" label="Початок (за Києвом)">
                <time dateTime={event.startsAt}>{formatKyivDateTime(event.startsAt)}</time>
              </InfoItem>
              {event.durationMinutes !== null && (
                <InfoItem icon="duration" label="Тривалість">
                  {event.durationMinutes} хв
                </InfoItem>
              )}
              {event.venue !== null && (
                <InfoItem icon="place" label="Місце">
                  {event.venue}
                </InfoItem>
              )}
              {event.meetingUrl !== null && (
                <InfoItem icon="place" label="Посилання на зустріч">
                  {attendable ? (
                    <a href={event.meetingUrl} target="_blank" rel="noopener noreferrer">
                      {event.meetingUrl}
                    </a>
                  ) : (
                    event.meetingUrl
                  )}
                </InfoItem>
              )}
              {event.speakerName !== null && (
                <InfoItem icon="speaker" label="Спікер">
                  {event.speakerName}
                </InfoItem>
              )}
              {facultyName && (
                <InfoItem icon="faculty" label="Факультет">
                  {facultyName}
                </InfoItem>
              )}
              {event.intendedAudience !== null && (
                <InfoItem icon="audience" label="Для кого">
                  {event.intendedAudience}
                </InfoItem>
              )}
              {event.newcomersWelcome !== null && (
                <InfoItem icon="newcomers" label="Новачкам">
                  {event.newcomersWelcome ? 'Так, можна долучитися' : 'Ні'}
                </InfoItem>
              )}
              <InfoItem icon="method" label="Спосіб участі">
                {participationMethodLabel(event.participationMethod)}
              </InfoItem>
            </dl>
          </section>
        </div>

        <div className="detail-right">
          {manageable && <ManageActions eventUrl={event.eventUrl} onCancel={() => setDialogOpen(true)} />}
          <ParticipationSection
            event={event}
            closedReason={
              attendable
                ? null
                : `Участь закрита, бо подію ${cancelled ? 'скасовано' : 'вже розпочато'}.`
            }
          />
          {/* api-contracts.md §5.2: no subscription action for cancelled or past events (US-45a AC3) */}
          {attendable && (
            <SubscriptionSection
              eventId={event.id}
              subscribed={event.subscribed}
              onChange={(subscribed) => setResult({ ...result, event: { ...event, subscribed } })}
              onNotSubscribable={() => {
                setNotice('Подію скасовано або вона вже почалася, тому сповіщення більше недоступні.');
                setReloads((count) => count + 1);
              }}
            />
          )}
          <section className="paper-panel share-panel">
            <h2>Поділитися</h2>
            <p>Посилання для авторизованих користувачів університету.</p>
            <Link className="share-link" to={event.eventUrl}>
              {shareUrl}
            </Link>
          </section>
        </div>
      </div>

      {event.canManage && (
        <CancelEventDialog
          open={dialogOpen && manageable}
          event={event}
          onCancelled={({ status, revision, cancelledAt }) => {
            setResult({ ...result, event: { ...event, status, revision, cancelledAt } });
            setNotice('Подію скасовано. Її більше немає в афіші.');
            setDialogOpen(false);
          }}
          onConflict={(message) => {
            setNotice(message);
            setDialogOpen(false);
            setReloads((count) => count + 1);
          }}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </article>
  );
}
