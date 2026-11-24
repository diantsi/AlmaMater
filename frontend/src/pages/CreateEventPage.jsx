import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';

import {fetchFaculties, fetchTopics} from '../api/dictionaries.js';
import {createEvent} from '../api/events.js';
import {useAuth} from '../components/AuthProvider.jsx';
import ErrorSummary from '../components/ErrorSummary.jsx';
import {RequiredMark} from '../components/Field.jsx';
import RadioGroup from '../components/RadioGroup.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import {
    EMPTY_VALUES,
    FIELD_LABELS,
    activeFields,
    buildPayload,
    publicationErrors,
    validate,
    withField,
} from '../lib/eventForm.js';
import {FORMAT_OPTIONS, PARTICIPATION_METHOD_OPTIONS} from '../lib/eventOptions.js';

/** @typedef {{ id: string, name: string }} ReferenceOption */
/** @typedef {{ state: 'loading' } | { state: 'ok', topics: ReferenceOption[], faculties: ReferenceOption[] } | { state: 'error', message: string }} ReferenceState */

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
    // Blocks a second submit fired before the disabled button re-renders
    const submittingRef = useRef(false);
    const summaryRef = useRef(null);
    const navigate = useNavigate();

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
        // Drop the edited field's errors and those of fields that are no longer shown
        setFieldErrors((current) =>
            Object.fromEntries(Object.entries(current).filter(([name]) => name !== field && active.has(name))),
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
            const created = await createEvent(buildPayload(values));
            navigate('/events', {state: {published: created.title}});
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
        required: true,
    });

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
                        Fields marked <RequiredMark/> are required.
                    </p>

                    <p>
                        Publishing as <strong>{organizationName}</strong>.
                    </p>

                    <section className="form-section">
                        <h2>About the event</h2>
                        <TextField {...props('title')} maxLength={160}/>
                        <TextField {...props('description')} multiline rows={5}/>
                        <TextField {...props('startsAt')} type="datetime-local" hint="Kyiv time."/>
                    </section>

                    <section className="form-section">
                        <h2>Topic and faculty</h2>
                        <SelectField {...props('topicId')} options={reference.topics}/>
                        <SelectField {...props('facultyId')} options={reference.faculties}/>
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
