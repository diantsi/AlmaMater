import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import ErrorSummary from './ErrorSummary.jsx';
import RadioGroup from './RadioGroup.jsx';
import SelectField from './SelectField.jsx';
import TextField from './TextField.jsx';
import { FIELD_LABELS, OPTIONAL_FIELDS, activeFields, validate, withField } from '../lib/eventForm.js';
import { FORMAT_OPTIONS, NEWCOMERS_OPTIONS, PARTICIPATION_METHOD_OPTIONS } from '../lib/eventOptions.js';

/** @typedef {{ id: string, name: string }} ReferenceOption */
/** @typedef {Record<string, string>} FormValues */
/** @typedef {import('../lib/eventForm.js').SubmissionErrors} SubmissionErrors */

const LINK_HINT = 'Повне посилання, що починається з https://.';

/**
 * Back link, heading with the pencil sticker and the line under it, shared by the create and edit pages
 * @param {{ backTo: string, backLabel: string, title: string, meta: import('react').ReactNode }} props
 */
export function EventFormHeading({ backTo, backLabel, title, meta }) {
  return (
    <>
      <Link className="back-link" to={backTo}>
        <svg className="arrow" aria-hidden="true">
          <use href="#arrow" />
        </svg>
        {backLabel}
      </Link>
      <div className="create-heading">
        <h1>{title}</h1>
        <svg className="heading-sticker" viewBox="0 0 100 90" aria-hidden="true">
          <g stroke="#262422" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 14 74 9 78 74 12 79Z" fill="#fffaf0" />
            <path d="m19 29 40-3m-39 13 28-2m-27 12 31-2" stroke="#365ec4" />
            <path d="m48 60 5-14 29-31 10 9-29 32Z" fill="#f5d54c" />
            <path d="m48 60 15-4-10-10Z" fill="#f6d4df" />
            <path d="m78 19 10 9" />
            <path d="m77 4 1-2m16 38 4 2M6 4 3 1" stroke="#d62663" />
          </g>
        </svg>
      </div>
      <div className="form-meta">
        {meta}
        <span>
          Поля з <span className="required">*</span> обов’язкові
        </span>
      </div>
    </>
  );
}

/**
 * Numbered form section with a coloured top and an illustration
 * @param {{ number: string, tone?: string, title: string, art: import('react').ReactNode, children: import('react').ReactNode }} props
 */
function Panel({ number, tone = '', title, art, children }) {
  const headingId = `section-${number}`;
  return (
    <section className="form-panel" aria-labelledby={headingId}>
      <div className={`panel-top ${tone}`}>
        <span className="number" aria-hidden="true">
          {number}
        </span>
        <h2 id={headingId}>{title}</h2>
        <svg className="panel-icon" viewBox="0 0 100 100" aria-hidden="true">
          <g fill="none" stroke="#262422" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round">
            {art}
          </g>
        </svg>
      </div>
      <div className="panel-content">{children}</div>
    </section>
  );
}

/**
 * Every §5.1 event field, shared by the create and edit pages. Runs the client checks, then hands the values to
 * `onSubmit`, which resolves with `null` on success or with the errors to show; entered values are always kept
 *
 * @param {{
 *   initialValues: FormValues,
 *   topics: ReferenceOption[],
 *   faculties: ReferenceOption[],
 *   cancelTo: string,
 *   submitLabel: string,
 *   pendingLabel: string,
 *   onSubmit: (values: FormValues) => Promise<SubmissionErrors | null>
 * }} props
 */
export default function EventForm({ initialValues, topics, faculties, cancelTo, submitLabel, pendingLabel, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState(/** @type {Record<string, string[]>} */ ({}));
  const [formErrors, setFormErrors] = useState(/** @type {string[]} */ ([]));
  const [failedAttempt, setFailedAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Blocks a second submit fired before the disabled button re-renders
  const submittingRef = useRef(false);
  const summaryRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (failedAttempt > 0) summaryRef.current?.focus();
  }, [failedAttempt]);

  const setField = (field) => (value) => {
    const next = withField(values, field, value);
    const active = new Set(activeFields(next));
    setValues(next);
    // Drop the edited field's errors, those of fields that are no longer shown and, when the start moves,
    // the deadline's order error
    const stale = new Set([field, ...(field === 'startsAt' ? ['registrationDeadline'] : [])]);
    setFieldErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([name]) => !stale.has(name) && active.has(name))),
    );
  };

  /** @param {SubmissionErrors} errors */
  const fail = ({ fieldErrors: nextFieldErrors, formErrors: nextFormErrors }) => {
    setFieldErrors(nextFieldErrors);
    setFormErrors(nextFormErrors);
    setFailedAttempt((count) => count + 1);
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) return;

    const clientErrors = validate(values);
    if (Object.keys(clientErrors).length > 0) {
      fail({ fieldErrors: clientErrors, formErrors: [] });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setFieldErrors({});
    setFormErrors([]);
    const errors = await onSubmit(values);
    submittingRef.current = false;
    // On success the page usually replaces the form
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (errors) fail(errors);
  }

  const props = (field) => ({
    id: field,
    label: FIELD_LABELS[field],
    value: values[field],
    onChange: setField(field),
    errors: fieldErrors[field],
    required: !OPTIONAL_FIELDS.has(field),
    optional: OPTIONAL_FIELDS.has(field),
  });

  return (
    <form className="event-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
      <ErrorSummary ref={summaryRef} fieldErrors={fieldErrors} formErrors={formErrors} labels={FIELD_LABELS} />

      <div className="form-grid">
        <div className="form-column">
          <Panel
            number="01"
            title="Про подію"
            art={
              <>
                <path d="M19 13 64 9 70 76 23 80Z" fill="#fffaf0" />
                <path d="m30 27 27-3m-26 13 24-3m-23 14 18-2" stroke="#365ec4" />
                <path d="m49 64 5-13 26-32 11 9-27 32Z" fill="#f5d54c" />
                <path d="m49 64 15-4-10-9Z" fill="#f6d4df" />
                <path d="m80 19 5-6 11 9-5 6" fill="#d62663" />
                <path d="M8 22 3 18m8-5-1-6" stroke="#d62663" />
              </>
            }
          >
            <TextField {...props('title')} maxLength={160} counter placeholder="Назва події" />
            <TextField {...props('description')} multiline rows={5} placeholder="Розкажіть про подію" />
            <TextField {...props('startsAt')} type="datetime-local" hint="За київським часом." />
            <TextField {...props('speakerName')} maxLength={160} placeholder="Ім’я спікера" />
            <TextField {...props('durationMinutes')} inputMode="numeric" placeholder="120" />
          </Panel>

          <Panel
            number="02"
            tone="yellow"
            title="Тема та факультет"
            art={
              <>
                <path d="M16 22 49 13 77 37 54 65 16 45Z" fill="#f6d4df" />
                <circle cx="28" cy="31" r="4" fill="#fffaf0" />
                <path d="m29 31 29-7 29 25-25 29-32-26Z" fill="#d4ed68" />
                <circle cx="43" cy="39" r="4" fill="#fffaf0" />
                <path d="m48 51 18 15m-13-21 13 11" stroke="#365ec4" />
                <path d="m75 16 7-7m-1 15 11-2" stroke="#d62663" />
              </>
            }
          >
            <SelectField {...props('topicId')} options={topics} placeholder="Оберіть тему" />
            <SelectField {...props('facultyId')} options={faculties} placeholder="Оберіть факультет" />
            <TextField {...props('intendedAudience')} placeholder="Для кого ця подія" />
            <SelectField {...props('newcomersWelcome')} options={NEWCOMERS_OPTIONS} />
          </Panel>
        </div>

        <div className="form-column">
          <Panel
            number="03"
            tone="blue"
            title="Формат і місце"
            art={
              <>
                <path d="m10 39 22-10 22 9 28-12v47L54 85l-22-9-22 10Z" fill="#fffaf0" />
                <path d="M32 29v47m22-38v47" stroke="#365ec4" />
                <path d="M69 30c0 13-17 29-17 29S34 43 34 30a17.5 17.5 0 0 1 35 0Z" fill="#d62663" />
                <circle cx="51.5" cy="30" r="6.5" fill="#f5d54c" />
                <path d="M11 16 5 12m18 0-2-7" stroke="#365ec4" />
              </>
            }
          >
            <RadioGroup {...props('format')} options={FORMAT_OPTIONS} />
            {values.format === 'IN_PERSON' && (
              <TextField {...props('venue')} maxLength={500} placeholder="Корпус, аудиторія" />
            )}
            {values.format === 'ONLINE' && (
              <TextField {...props('meetingUrl')} type="url" placeholder="https://…" hint={LINK_HINT} />
            )}
          </Panel>

          <Panel
            number="04"
            tone="pink"
            title="Участь"
            art={
              <>
                <path d="m8 31 76-9 2 15c-13 1-11 17 2 16l2 17-76 9-2-16c12-2 10-17-2-16Z" fill="#f5d54c" />
                <path d="m62 26 5 45" strokeDasharray="5 5" />
                <path d="m36 39 6 9 11 1-8 8 2 11-10-5-10 6 2-11-9-7 11-2Z" fill="#365ec4" />
                <path d="m75 12 7-9m3 12 10-2" stroke="#d62663" />
              </>
            }
          >
            <RadioGroup {...props('participationMethod')} options={PARTICIPATION_METHOD_OPTIONS} />
            {values.participationMethod === 'GOOGLE_FORM' && (
              <TextField {...props('googleFormUrl')} type="url" placeholder="https://…" hint={LINK_HINT} />
            )}
            {values.participationMethod === 'DIRECT_CONTACT' && (
              <TextField
                {...props('contactDetails')}
                multiline
                rows={3}
                placeholder="Як зв’язатися з організаторами"
              />
            )}
            {values.participationMethod === 'OPEN_ATTENDANCE' && (
              <TextField
                {...props('attendanceInstructions')}
                multiline
                rows={3}
                placeholder="Як долучитися до події"
              />
            )}
            <TextField
              {...props('registrationDeadline')}
              type="datetime-local"
              hint="За київським часом. Не пізніше початку події."
            />
          </Panel>
        </div>
      </div>

      <div className="form-bottom">
        <Link className="cancel-link" to={cancelTo}>
          Скасувати
        </Link>
        <button type="submit" className="button publish-button" disabled={submitting}>
          {submitting ? pendingLabel : submitLabel}
          <svg className="arrow" aria-hidden="true">
            <use href="#arrow" />
          </svg>
        </button>
      </div>
    </form>
  );
}
