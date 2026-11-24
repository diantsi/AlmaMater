import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/** @typedef {'idle' | 'copied' | 'failed'} CopyState */

const COPY_MESSAGES = {
  idle: '',
  copied: 'Посилання скопійовано.',
  failed: 'Не вдалося скопіювати автоматично. Виділіть посилання й скопіюйте його вручну.',
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
    <div className="create-page">
      <section className="confirmation paper-panel" aria-labelledby="confirmation-title">
        <div className="create-heading">
          <h1 id="confirmation-title" ref={headingRef} tabIndex={-1}>
            Подію опубліковано
          </h1>
        </div>
        <p className="form-message ok">
          «{event.title}» уже в афіші. Авторизовані учасники університету можуть її знайти.
        </p>

        <div className="form-field">
          <label htmlFor="share-link">Посилання для поширення</label>
          <div className="share-row">
            <input
              id="share-link"
              type="url"
              readOnly
              value={shareUrl}
              aria-describedby="share-link-hint"
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="clear clear--inline" onClick={copyLink}>
              Скопіювати
            </button>
          </div>
          <span id="share-link-hint" className="field-hint">
            Відкриває подію для авторизованих учасників університету.
          </span>
          <span className="field-hint" role="status">
            {COPY_MESSAGES[copyState]}
          </span>
        </div>

        <div className="form-bottom">
          <button type="button" className="cancel-link" onClick={onCreateAnother}>
            Створити ще одну подію
          </button>
          <Link className="cancel-link" to="/events">
            До афіші
          </Link>
          <Link className="button publish-button" to={event.eventUrl}>
            Переглянути подію
            <svg className="arrow" aria-hidden="true">
              <use href="#arrow" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}
