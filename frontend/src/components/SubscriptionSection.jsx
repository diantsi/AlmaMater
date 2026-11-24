import { useRef, useState } from 'react';

import { subscribe, unsubscribe } from '../api/events.js';
import { ApiError } from '../api/http.js';

/** @param {unknown} error */
function subscriptionErrorMessage(error) {
  if (error instanceof ApiError && error.code === 'EVENT_NOT_FOUND') return 'Цієї події більше не існує.';
  if (error instanceof TypeError) return 'Не вдалося зв’язатися із сервером. Перевірте з’єднання та спробуйте ще раз.';
  return `Не вдалося змінити сповіщення: ${error instanceof Error ? error.message : String(error)}`;
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
    <section className="paper-panel subscription" aria-labelledby="subscription-heading">
      <h2 id="subscription-heading">Сповіщення</h2>
      <p>
        {subscribed
          ? 'Ви отримаєте лист на університетську пошту, якщо подію змінять або скасують.'
          : 'Отримуйте лист на університетську пошту, якщо подію змінять або скасують.'}{' '}
        Це не реєстрація на подію.
      </p>
      <button type="button" className="button join-button join-button--plain" disabled={pending} onClick={toggle}>
        {pending ? 'Зберігаємо…' : subscribed ? 'Вимкнути сповіщення' : 'Повідомляти про зміни'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      </button>
      {error && (
        <p className="status status-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
