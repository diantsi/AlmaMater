import { useEffect, useRef, useState } from 'react';

import { cancelEvent } from '../api/events.js';
import { ApiError } from '../api/http.js';

// §6.5 errors that mean the event can no longer be cancelled; the parent reloads to show its real state
const CANCEL_CONFLICTS = {
  EVENT_ALREADY_CANCELLED: 'Цю подію вже скасовано.',
  EVENT_NOT_EDITABLE: 'Подія вже почалася, тому її більше не можна скасувати.',
};

/** @param {unknown} error */
function cancelErrorMessage(error) {
  if (error instanceof ApiError && error.code === 'ORGANIZATION_ACCESS_DENIED') {
    return 'Скасувати подію може лише організація, яка її опублікувала.';
  }
  if (error instanceof TypeError) return 'Не вдалося зв’язатися із сервером. Перевірте з’єднання та спробуйте ще раз.';
  return `Не вдалося скасувати подію: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Modal confirmation that sends POST /api/events/{id}/cancel (US-44b). "Залишити" has the initial focus so a stray
 * Enter never cancels; Escape closes it unless the request is pending. A conflict closes the dialog and is reported
 * to the parent, other errors stay inside it
 *
 * @param {{
 *   open: boolean,
 *   event: { id: string, title: string },
 *   onCancelled: (result: { status: 'CANCELLED', revision: number, cancelledAt: string }) => void,
 *   onConflict: (message: string) => void,
 *   onClose: () => void
 * }} props
 */
export default function CancelEventDialog({ open, event, onCancelled, onConflict, onClose }) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function confirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      // Resolves only on 200; the response carries the new status, revision and cancelledAt
      onCancelled(await cancelEvent(event.id));
    } catch (caught) {
      if (caught instanceof ApiError && caught.code in CANCEL_CONFLICTS) onConflict(CANCEL_CONFLICTS[caught.code]);
      else setError(cancelErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="paper-dialog"
      aria-labelledby="cancel-dialog-title"
      aria-describedby="cancel-dialog-text"
      onCancel={(e) => {
        // Escape key
        e.preventDefault();
        if (!pending) onClose();
      }}
    >
      <svg
        className="dialog-icon"
        viewBox="0 0 80 80"
        fill="none"
        stroke="#262422"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M8 19h64v13a9 9 0 0 0 0 18v13H8V50a9 9 0 0 0 0-18Z" fill="#f6d4df" />
        <path d="M53 19v44" strokeDasharray="3 5" />
        <path d="m23 32 17 17m0-17L23 49" stroke="#d62663" strokeWidth="4" />
      </svg>
      <h2 id="cancel-dialog-title">Скасувати подію?</h2>
      <p id="cancel-dialog-text">
        «{event.title}». Подія більше не відображатиметься як активна в афіші. Її посилання працюватиме й показуватиме
        скасування, підписники отримають лист. Цю дію не можна відмінити.
      </p>
      {error && (
        <p className="status status-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onClose} disabled={pending} autoFocus>
          Залишити
        </button>
        <button type="button" className="button button-danger" onClick={confirm} disabled={pending}>
          {pending ? 'Скасовуємо…' : 'Скасувати подію'}
        </button>
      </div>
    </dialog>
  );
}
