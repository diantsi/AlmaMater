import { useEffect, useState } from 'react';

import { fetchFaculties, fetchTopics } from '../api/dictionaries.js';
import { fetchOrganizations } from '../api/organizations.js';
import SelectField from '../components/SelectField.jsx';

// Form shell (US-07): reference-data selects only; submission (POST /api/events) is not wired yet
export default function CreateEventPage() {
  const [reference, setReference] = useState({ state: 'loading' });
  const [values, setValues] = useState({ organizationId: '', topicId: '', facultyId: '' });

  useEffect(() => {
    let ignore = false;
    Promise.all([fetchOrganizations(), fetchTopics(), fetchFaculties()])
      .then(
        ([organizations, topics, faculties]) =>
          !ignore && setReference({ state: 'ok', organizations, topics, faculties }),
      )
      .catch((error) => !ignore && setReference({ state: 'error', message: error.message }));
    return () => {
      ignore = true;
    };
  }, []);

  const setField = (field) => (value) => setValues((current) => ({ ...current, [field]: value }));

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
        <form className="event-form" onSubmit={(e) => e.preventDefault()}>
          <SelectField
            id="organizationId"
            label="Organisation"
            options={reference.organizations}
            value={values.organizationId}
            onChange={setField('organizationId')}
          />
          <SelectField
            id="topicId"
            label="Topic"
            options={reference.topics}
            value={values.topicId}
            onChange={setField('topicId')}
          />
          <SelectField
            id="facultyId"
            label="Faculty"
            options={reference.faculties}
            value={values.facultyId}
            onChange={setField('facultyId')}
          />
          <p className="hint">The remaining event fields and publishing will be added in the next iteration.</p>
        </form>
      )}
    </>
  );
}
