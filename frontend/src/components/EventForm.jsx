import { useEffect, useRef, useState } from 'react';

import ErrorSummary from './ErrorSummary.jsx';
import { RequiredMark } from './Field.jsx';
import RadioGroup from './RadioGroup.jsx';
import SelectField from './SelectField.jsx';
import TextField from './TextField.jsx';
import { FIELD_LABELS, OPTIONAL_FIELDS, activeFields, validate, withField } from '../lib/eventForm.js';
import { FORMAT_OPTIONS, NEWCOMERS_OPTIONS, PARTICIPATION_METHOD_OPTIONS } from '../lib/eventOptions.js';

/** @typedef {{ id: string, name: string }} ReferenceOption */
/** @typedef {Record<string, string>} FormValues */
/** @typedef {import('../lib/eventForm.js').SubmissionErrors} SubmissionErrors */

/**
 * Every §5.1 event field, shared by the create and edit pages. Runs the client checks, then hands the values to
 * `onSubmit`, which resolves with `null` on success or with the errors to show; entered values are always kept
 *
 * @param {{
 *   initialValues: FormValues,
 *   topics: ReferenceOption[],
 *   faculties: ReferenceOption[],
 *   intro?: import('react').ReactNode,
 *   actions?: import('react').ReactNode,
 *   submitLabel: string,
 *   pendingLabel: string,
 *   onSubmit: (values: FormValues) => Promise<SubmissionErrors | null>
 * }} props
 */
export default function EventForm({
  initialValues,
  topics,
  faculties,
  intro = null,
  actions = null,
  submitLabel,
  pendingLabel,
  onSubmit,
}) {
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

      <p className="hint">
        Fields marked <RequiredMark /> are required; fields marked (optional) can be left empty.
      </p>

      {intro}

      <section className="form-section">
        <h2>About the event</h2>
        <TextField {...props('title')} maxLength={160} />
        <TextField {...props('description')} multiline rows={5} />
        <TextField {...props('startsAt')} type="datetime-local" hint="Kyiv time." />
        <TextField
          {...props('durationMinutes')}
          inputMode="numeric"
          hint="Whole number of minutes, for example 90."
        />
        <TextField {...props('speakerName')} maxLength={160} />
      </section>

      <section className="form-section">
        <h2>Topic and audience</h2>
        <SelectField {...props('topicId')} options={topics} />
        <SelectField {...props('facultyId')} options={faculties} />
        <TextField
          {...props('intendedAudience')}
          multiline
          rows={2}
          hint="Who the event is for, for example first-year students."
        />
        <RadioGroup {...props('newcomersWelcome')} options={NEWCOMERS_OPTIONS} />
      </section>

      <section className="form-section">
        <h2>Format and location</h2>
        <RadioGroup {...props('format')} options={FORMAT_OPTIONS} />
        {values.format === 'IN_PERSON' && <TextField {...props('venue')} maxLength={500} />}
        {values.format === 'ONLINE' && (
          <TextField {...props('meetingUrl')} type="url" hint="Full link starting with https://" />
        )}
      </section>

      <section className="form-section">
        <h2>Participation</h2>
        <RadioGroup {...props('participationMethod')} options={PARTICIPATION_METHOD_OPTIONS} />
        {values.participationMethod === 'GOOGLE_FORM' && (
          <TextField {...props('googleFormUrl')} type="url" hint="Full link starting with https://" />
        )}
        {values.participationMethod === 'DIRECT_CONTACT' && (
          <TextField {...props('contactDetails')} multiline rows={3} />
        )}
        {values.participationMethod === 'OPEN_ATTENDANCE' && (
          <TextField {...props('attendanceInstructions')} multiline rows={3} />
        )}
        <TextField
          {...props('registrationDeadline')}
          type="datetime-local"
          hint="Kyiv time. Must not be after the start."
        />
      </section>

      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? pendingLabel : submitLabel}
        </button>
        {actions}
      </div>
    </form>
  );
}
