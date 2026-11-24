import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/** @typedef {'idle' | 'copied' | 'failed'} CopyState */

const COPY_MESSAGES = {
  idle: '',
  copied: 'Link copied.',
  failed: 'Could not copy automatically. Select the link and copy it.',
};

/**
 * Shown only after POST /api/events returned 201 (US-41): confirms the event is live, links to it and offers its
 * stable `eventUrl` as a copyable share link (US-43)
 *
 * @param {{ event: { title: string, eventUrl: string }, onCreateAnother: () => void }} props
 */
export default function PublicationConfirmation({ event, onCreateAnother }) {
  const headingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null));
  const [copyState, setCopyState] = useState(/** @type {CopyState} */ ('idle'));
  const shareUrl = new URL(event.eventUrl, window.location.origin).href;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState('copied');
    } catch {
      // Clipboard API missing or permission denied; the read-only input still lets the user copy by hand
      setCopyState('failed');
    }
  }

  return (
    <section className="confirmation" aria-labelledby="confirmation-title">
      <h1 id="confirmation-title" ref={headingRef} tabIndex={-1}>
        Event published
      </h1>
      <p className="status status-ok">
        “{event.title}” is live on the Events page. Signed-in university members can now find it.
      </p>

      <p className="confirmation-actions">
        <Link className="button-primary" to={event.eventUrl}>
          View event
        </Link>
        <Link to="/events">Go to events</Link>
      </p>

      <div className="field">
        <label htmlFor="share-link">Share link</label>
        <p id="share-link-hint" className="hint">
          Opens the event for signed-in university members.
        </p>
        <div className="share-link">
          <input
            id="share-link"
            type="url"
            readOnly
            value={shareUrl}
            aria-describedby="share-link-hint"
            onFocus={(e) => e.target.select()}
          />
          <button type="button" className="button-secondary" onClick={copyLink}>
            Copy link
          </button>
        </div>
        <p className="hint" role="status">
          {COPY_MESSAGES[copyState]}
        </p>
      </div>

      <p>
        <button type="button" className="button-secondary" onClick={onCreateAnother}>
          Create another event
        </button>
      </p>
    </section>
  );
}
