import { useEffect, useRef } from 'react';

/**
 * Modal confirmation before POST /api/events/{id}/cancel (US-44b). "Keep event" has the initial focus so a stray
 * Enter never cancels; Escape closes it unless the request is pending
 *
 * @param {{
 *   open: boolean,
 *   title: string,
 *   pending: boolean,
 *   error: string | null,
 *   onConfirm: () => void,
 *   onClose: () => void
 * }} props
 */
export default function CancelEventDialog({ open, title, pending, error, onConfirm, onClose }) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="cancel-dialog-title"
      aria-describedby="cancel-dialog-text"
      onCancel={(event) => {
        // Escape key
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <h2 id="cancel-dialog-title">Cancel this event?</h2>
      <p id="cancel-dialog-text">
        “{title}” will be marked as cancelled and removed from the Events page. Its link keeps working and shows the
        cancellation. Subscribers get an email. This cannot be undone.
      </p>
      {error && (
        <p className="status status-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" className="button-secondary" onClick={onClose} disabled={pending} autoFocus>
          Keep event
        </button>
        <button type="button" className="button-danger" onClick={onConfirm} disabled={pending}>
          {pending ? 'Cancelling…' : 'Cancel event'}
        </button>
      </div>
    </dialog>
  );
}
