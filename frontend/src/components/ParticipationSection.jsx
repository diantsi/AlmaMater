import { formatKyivDateTime } from '../lib/kyivTime.js';

/**
 * "Як долучитися" panel: the external participation route by method (api-contracts.md §5.3), never implying in-app
 * registration; when participation is closed (cancelled or started event) only the reason is shown
 *
 * @param {{
 *   event: {
 *     participationMethod: string,
 *     googleFormUrl: string | null,
 *     contactDetails: string | null,
 *     attendanceInstructions: string | null,
 *     registrationDeadline: string | null
 *   },
 *   closedReason: string | null
 * }} props
 */
export default function ParticipationSection({ event, closedReason }) {
  return (
    <section className="paper-panel participation" aria-labelledby="participation-heading">
      <svg className="part-star" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M30 3 39 22 61 20 46 36 54 59 33 47 11 59 17 36 3 22 24 22Z"
          fill="#f5d54c"
          stroke="#262422"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <h2 id="participation-heading">Як долучитися</h2>

      {closedReason ? (
        <p>{closedReason}</p>
      ) : (
        <>
          {event.participationMethod === 'GOOGLE_FORM' && <p>Організатор збирає заявки через Google Form.</p>}
          {event.participationMethod === 'DIRECT_CONTACT' && event.contactDetails && (
            <>
              <p>Щоб долучитися, зв’яжіться з організатором:</p>
              <p className="preformatted">{event.contactDetails}</p>
            </>
          )}
          {event.participationMethod === 'OPEN_ATTENDANCE' && event.attendanceInstructions && (
            <>
              <p>Реєстрація не потрібна. Як долучитися:</p>
              <p className="preformatted">{event.attendanceInstructions}</p>
            </>
          )}

          {event.registrationDeadline && (
            <div className="deadline">
              <span>Реєстрація до (за Києвом)</span>
              <strong>
                <time dateTime={event.registrationDeadline}>{formatKyivDateTime(event.registrationDeadline)}</time>
              </strong>
            </div>
          )}

          {event.participationMethod === 'GOOGLE_FORM' && event.googleFormUrl && (
            <a className="button join-button" href={event.googleFormUrl} target="_blank" rel="noopener noreferrer">
              Відкрити Google Form
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M13 5h6v6m0-6-9 9M19 13v6H5V5h6" />
              </svg>
            </a>
          )}
        </>
      )}
    </section>
  );
}
