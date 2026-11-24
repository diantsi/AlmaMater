import { useRef, useState } from 'react';

import { subscribe, unsubscribe } from '../api/events.js';
import { ApiError } from '../api/http.js';

/** @param {unknown} error */
function subscriptionErrorMessage(error) {
  if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') return 'This event no longer exists.';
  if (error instanceof TypeError) return 'Could not reach the server. Check your connection and try again.';
  return `Could not update email updates: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Email updates toggle (US-45a, api-contracts.md §6.6, §6.7). Separate from the participation route:
 * it never registers attendance. The parent renders it only for upcoming, non-cancelled events.
 *
 * @param {{
 *   eventId: string,
 *   subscribed: boolean,
 *   onChange: (subscribed: boolean) => void,
 *   onNotSubscribable: () => void
 * }} props
 */
export default function SubscriptionSection({ eventId, subscribed, onChange, onNotSubscribable }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  // Blocks a second request before the disabled state renders
  const pendingRef = useRef(false);

  async function toggle() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribe(eventId);
        onChange(false);
      } else {
        await subscribe(eventId);
        onChange(true);
      }
    } catch (caught) {
      // §6.6: cancelled or started meanwhile; the parent reloads the event and hides this section
      if (caught instanceof ApiError && caught.code === 'EVENT_NOT_SUBSCRIBABLE') onNotSubscribable();
      else setError(subscriptionErrorMessage(caught));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <section className="details-section subscription" aria-labelledby="subscription-heading">
      <h2 id="subscription-heading">Email updates</h2>
      <p>
        {subscribed
          ? 'You will get an email at your university address if this event is changed or cancelled.'
          : 'Get an email at your university address if this event is changed or cancelled.'}{' '}
        This does not register you for the event.
      </p>
      <button
        type="button"
        className="button-secondary"
        disabled={pending}
        onClick={toggle}
      >
        {pending ? 'Saving…' : subscribed ? 'Stop email updates' : 'Email me about changes'}
      </button>
      {error && (
        <p className="status status-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
