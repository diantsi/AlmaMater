import {useEffect, useRef, useState} from 'react';

import {fetchFaculties, fetchTopics} from '../api/dictionaries.js';
import {createEvent} from '../api/events.js';
import {useAuth} from '../components/AuthProvider.jsx';
import ErrorSummary from '../components/ErrorSummary.jsx';
import {RequiredMark} from '../components/Field.jsx';
import PublicationConfirmation from '../components/PublicationConfirmation.jsx';
import RadioGroup from '../components/RadioGroup.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import {
    EMPTY_VALUES,
    FIELD_LABELS,
    OPTIONAL_FIELDS,
    activeFields,
    buildPayload,
    publicationErrors,
    validate,
    withField,
} from '../lib/eventForm.js';
import {FORMAT_OPTIONS, NEWCOMERS_OPTIONS, PARTICIPATION_METHOD_OPTIONS} from '../lib/eventOptions.js';

/** @typedef {{ id: string, name: string }} ReferenceOption */
/** @typedef {{ state: 'loading' } | { state: 'ok', topics: ReferenceOption[], faculties: ReferenceOption[] } | { state: 'error', message: string }} ReferenceState */
/** @typedef {{ title: string, eventUrl: string }} PublishedEvent */

// Create and publish an event (US-07 … US-39) through POST /api/events; only for organisers (US-07 AC2)
export default function CreateEventPage() {
    const {canPublish, organization} = useAuth();
    if (!canPublish) {
        return (
            <>
                <h1>Create event</h1>
                <p className="status status-error" role="alert">
                    You do not have access to event creation. Only a registered student organisation account can
                    publish events.
                </p>
            </>
        );
    }
    return <CreateEventForm organizationName={organization?.name ?? ''}/>;
}

/** @param {{ organizationName: string }} props */
function CreateEventForm({organizationName}) {
    const [reference, setReference] = useState(
        /** @type {ReferenceState} */ ({state: 'loading'})
    );
    const [values, setValues] = useState(EMPTY_VALUES);
    const [fieldErrors, setFieldErrors] = useState({});
    const [formErrors, setFormErrors] = useState([]);
    const [failedAttempt, setFailedAttempt] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [published, setPublished] = useState(/** @type {PublishedEvent | null} */ (null));
    // Blocks a second submit fired before the disabled button re-renders
    const submittingRef = useRef(false);
    const summaryRef = useRef(null);

    useEffect(() => {
        let ignore = false;
        Promise.all([fetchTopics(), fetchFaculties()])
            .then(
                ([topics, faculties]) =>
                    !ignore && setReference({state: 'ok', topics, faculties}),
            )
            .catch((error) => !ignore && setReference({state: 'error', message: error.message}));
        return () => {
            ignore = true;
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

    const fail = (nextFieldErrors, nextFormErrors) => {
        setFieldErrors(nextFieldErrors);
        setFormErrors(nextFormErrors);
        setFailedAttempt((count) => count + 1);
    };

    async function handleSubmit(event) {
        event.preventDefault();
        if (submittingRef.current) return;

        const clientErrors = validate(values);
        if (Object.keys(clientErrors).length > 0) {
            fail(clientErrors, []);
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setFieldErrors({});
        setFormErrors([]);
        try {
            // createEvent resolves only on 201, so the confirmation never follows a failed publication (US-41 AC2)
            const created = await createEvent(buildPayload(values));
            setValues(EMPTY_VALUES);
            setPublished(created);
        } catch (error) {
            // Entered values stay as they are so the organiser only fixes what failed
            const {fieldErrors: nextFieldErrors, formErrors: nextFormErrors} = publicationErrors(error, values);
            fail(nextFieldErrors, nextFormErrors);
        } finally {
            submittingRef.current = false;
            setSubmitting(false);
        }
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

    if (published) {
        return <PublicationConfirmation event={published} onCreateAnother={() => setPublished(null)}/>;
    }

    return (
        <>
            <h1>Create event</h1>

            {reference.state === 'loading' && <p className="status">Loading form options…</p>}
            {reference.state === 'error' && (
                <p className="status status-error" role="alert">
                    Could not load form options: {reference.message}
                </p>
            )}
            {reference.state === 'ok' && (
                <form className="event-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
                    <ErrorSummary ref={summaryRef} fieldErrors={fieldErrors} formErrors={formErrors}
                                  labels={FIELD_LABELS}/>

                    <p className="hint">
                        Fields marked <RequiredMark/> are required; fields marked (optional) can be left empty.
                    </p>

                    <p>
                        Publishing as <strong>{organizationName}</strong>.
                    </p>

                    <section className="form-section">
                        <h2>About the event</h2>
                        <TextField {...props('title')} maxLength={160}/>
                        <TextField {...props('description')} multiline rows={5}/>
                        <TextField {...props('startsAt')} type="datetime-local" hint="Kyiv time."/>
                        <TextField
                            {...props('durationMinutes')}
                            inputMode="numeric"
                            hint="Whole number of minutes, for example 90."
                        />
                        <TextField {...props('speakerName')} maxLength={160}/>
                    </section>

                    <section className="form-section">
                        <h2>Topic and audience</h2>
                        <SelectField {...props('topicId')} options={reference.topics}/>
                        <SelectField {...props('facultyId')} options={reference.faculties}/>
                        <TextField
                            {...props('intendedAudience')}
                            multiline
                            rows={2}
                            hint="Who the event is for, for example first-year students."
                        />
                        <RadioGroup {...props('newcomersWelcome')} options={NEWCOMERS_OPTIONS}/>
                    </section>

                    <section className="form-section">
                        <h2>Format and location</h2>
                        <RadioGroup {...props('format')} options={FORMAT_OPTIONS}/>
                        {values.format === 'IN_PERSON' && <TextField {...props('venue')} maxLength={500}/>}
                        {values.format === 'ONLINE' && (
                            <TextField {...props('meetingUrl')} type="url" hint="Full link starting with https://"/>
                        )}
                    </section>

                    <section className="form-section">
                        <h2>Participation</h2>
                        <RadioGroup {...props('participationMethod')} options={PARTICIPATION_METHOD_OPTIONS}/>
                        {values.participationMethod === 'GOOGLE_FORM' && (
                            <TextField {...props('googleFormUrl')} type="url" hint="Full link starting with https://"/>
                        )}
                        {values.participationMethod === 'DIRECT_CONTACT' && (
                            <TextField {...props('contactDetails')} multiline rows={3}/>
                        )}
                        {values.participationMethod === 'OPEN_ATTENDANCE' && (
                            <TextField {...props('attendanceInstructions')} multiline rows={3}/>
                        )}
                        <TextField
                            {...props('registrationDeadline')}
                            type="datetime-local"
                            hint="Kyiv time. Must not be after the start."
                        />
                    </section>

                    <div>
                        <button type="submit" className="button-primary" disabled={submitting}>
                            {submitting ? 'Publishing…' : 'Publish'}
                        </button>
                    </div>
                </form>
            )}
        </>
    );
}
