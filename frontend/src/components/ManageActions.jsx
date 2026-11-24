import { Link } from 'react-router-dom';

/**
 * Edit and cancel actions of the owning organisation (event details and the organisation dashboard); the backend
 * still enforces ownership
 * @param {{ eventUrl: string, onCancel: () => void }} props
 */
export default function ManageActions({ eventUrl, onCancel }) {
  return (
    <div className="ticket-actions">
      <Link className="ticket-action" to={`${eventUrl}/edit`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4.5 19.5 5.4 15.8 15.7 5.5a2.1 2.1 0 0 1 3 0l.9.9a2.1 2.1 0 0 1 0 3L9.3 19.7 5.6 20.6Z" />
          <path d="m13.9 7.4 2.8 2.8" />
          <path d="M4.6 20.3h5" />
        </svg>
        Редагувати
      </Link>
      <button type="button" className="ticket-action danger" onClick={onCancel}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.2" />
          <path d="M8.5 8.5 15.5 15.5" />
          <path d="M15.5 8.5 8.5 15.5" />
        </svg>
        Скасувати
      </button>
    </div>
  );
}
