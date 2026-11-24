/**
 * External participation route by method (api-contracts.md §5.3). Never implies in-app registration.
 *
 * @param {{ event: {
 *   participationMethod: string,
 *   googleFormUrl: string | null,
 *   contactDetails: string | null,
 *   attendanceInstructions: string | null
 * } }} props
 */
export default function ParticipationSection({ event }) {
  return (
    <section className="details-section" aria-labelledby="participation-heading">
      <h2 id="participation-heading">How to participate</h2>

      {event.participationMethod === 'GOOGLE_FORM' && event.googleFormUrl && (
        <>
          <p>The organiser collects registrations in an external Google Form.</p>
          <a className="button-primary" href={event.googleFormUrl} target="_blank" rel="noopener noreferrer">
            Open the Google Form (external site)
          </a>
        </>
      )}

      {event.participationMethod === 'DIRECT_CONTACT' && event.contactDetails && (
        <>
          <p>Contact the organiser to ask to participate:</p>
          <p className="preformatted">{event.contactDetails}</p>
        </>
      )}

      {event.participationMethod === 'OPEN_ATTENDANCE' && event.attendanceInstructions && (
        <>
          <p>No registration is needed. Attendance instructions:</p>
          <p className="preformatted">{event.attendanceInstructions}</p>
        </>
      )}
    </section>
  );
}
