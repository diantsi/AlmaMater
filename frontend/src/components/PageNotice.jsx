import { Link } from 'react-router-dom';

/**
 * Whole-page message for loading, not-found, no-access and error states
 * @param {{
 *   title?: string,
 *   children: import('react').ReactNode,
 *   backTo?: string,
 *   backLabel?: string,
 *   role?: 'alert' | 'status'
 * }} props
 */
export default function PageNotice({ title, children, backTo = '/events', backLabel = 'До афіші', role = 'alert' }) {
  return (
    <div className="page-section">
      <Link className="back-link" to={backTo}>
        <svg className="arrow" aria-hidden="true">
          <use href="#arrow" />
        </svg>
        {backLabel}
      </Link>
      <div className="empty-state" role={role}>
        {title && <h1 className="notice-title">{title}</h1>}
        <p>{children}</p>
      </div>
    </div>
  );
}
