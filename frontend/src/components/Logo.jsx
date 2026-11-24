import { Link } from 'react-router-dom';

/** AlmaMater star mark and wordmark, linking to the landing page */
export default function Logo() {
  return (
    <Link className="brand" to="/" aria-label="AlmaMater, головна">
      <svg className="brand-mark" aria-hidden="true">
        <use href="#brand" />
      </svg>
      <span className="wordmark">
        alma<span>mater</span>
      </span>
    </Link>
  );
}
