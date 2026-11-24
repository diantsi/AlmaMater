
import { Link } from 'react-router-dom';

/** Lime "Створити подію" button with a plus (catalog, dashboard and its empty state) */
export function CreateEventButton() {
  return (
    <Link className="button create-button" to="/events/new">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      Створити подію
    </Link>
  );
}

/**
 * Organisation name with the graduation-cap sticker, shown under the page heading
 * @param {{ name: string }} props
 */
export function OrganizationName({ name }) {
  return (
    <p className="org-name">
      <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="#262422" strokeWidth="1.7" strokeLinejoin="round">
        <path d="M3 12 16 4l13 8-13 7Z" fill="#f5d54c" />
        <path d="M8 16v10q8 5 16 0V16" fill="#d4ed68" />
        <path d="M29 12v10" stroke="#365ec4" />
        <circle cx="29" cy="24" r="2" fill="#d62663" />
      </svg>
      {name}
    </p>
  );
}
