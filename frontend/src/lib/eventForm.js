import { ApiError } from '../api/http.js';
import { kyivLocalToIso } from './kyivTime.js';

// Create-event form state and rules (api-contracts.md §5.1, database-schema.md §5); optional fields are not in the form yet

// Conditional field activated by each format / participation method value
export const LOCATION_FIELD = { ONLINE: 'meetingUrl', IN_PERSON: 'venue' };
export const METHOD_FIELD = {
  GOOGLE_FORM: 'googleFormUrl',
  DIRECT_CONTACT: 'contactDetails',
  OPEN_ATTENDANCE: 'attendanceInstructions',
};

// Every form field in display order; keys are the camelCase request fields
export const FIELD_LABELS = {
  organizationId: 'Organisation',
  title: 'Title',
  description: 'Description',
  startsAt: 'Start date and time',
  topicId: 'Topic',
  facultyId: 'Faculty',
  format: 'Format',
  venue: 'Venue',
  meetingUrl: 'Meeting link',
  participationMethod: 'Participation method',
  googleFormUrl: 'Google Form link',
  contactDetails: 'Contact details',
  attendanceInstructions: 'Attendance instructions',
};

const HTTPS_FIELDS = new Set(['meetingUrl', 'googleFormUrl']);

export const EMPTY_VALUES = Object.fromEntries(Object.keys(FIELD_LABELS).map((field) => [field, '']));

// Fields shown, validated and submitted under the current format and participation method; all are required
export function activeFields(values) {
  return [
    'organizationId',
    'title',
    'description',
    'startsAt',
    'topicId',
    'facultyId',
    'format',
    LOCATION_FIELD[values.format],
    'participationMethod',
    METHOD_FIELD[values.participationMethod],
  ].filter(Boolean);
}

// Sets one field; changing format or method clears the stale values of the inactive conditional fields
export function withField(values, field, value) {
  const next = { ...values, [field]: value };
  const conditional = { format: LOCATION_FIELD, participationMethod: METHOD_FIELD }[field];
  if (conditional) {
    for (const [option, dependent] of Object.entries(conditional)) {
      if (option !== value) next[dependent] = '';
    }
  }
  return next;
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.host !== '' && !/\s/.test(value);
  } catch {
    return false;
  }
}

// Client-side checks of required values and URL syntax; the server re-validates everything
export function validate(values) {
  const errors = {};
  for (const field of activeFields(values)) {
    const value = values[field].trim();
    if (!value) {
      errors[field] = [`${FIELD_LABELS[field]} is required.`];
    } else if (HTTPS_FIELDS.has(field) && !isHttpsUrl(value)) {
      errors[field] = ['Enter a full link starting with https://.'];
    } else if (field === 'startsAt' && !kyivLocalToIso(value)) {
      errors[field] = ['Enter a valid date and time.'];
    }
  }
  return errors;
}

// POST /api/events body: active fields only, text trimmed, start converted to an offset-aware date-time
export function buildPayload(values) {
  return Object.fromEntries(
    activeFields(values).map((field) => [
      field,
      field === 'startsAt' ? kyivLocalToIso(values.startsAt) : values[field].trim(),
    ]),
  );
}

// Splits a failed publication into per-field messages (details[].field on a visible input) and form-level messages
export function publicationErrors(error, values) {
  if (!(error instanceof ApiError)) {
    return { fieldErrors: {}, formErrors: ['Could not reach the server. Check your connection and try again.'] };
  }

  const visible = new Set(activeFields(values));
  const fieldErrors = {};
  const formErrors = [];
  for (const { field, message } of error.details) {
    if (visible.has(field)) {
      (fieldErrors[field] ??= []).push(message);
    } else {
      formErrors.push(field ? `${FIELD_LABELS[field] ?? field}: ${message}` : message);
    }
  }
  if (error.details.length === 0) {
    formErrors.push(`Publication failed: ${error.message}`);
  }
  return { fieldErrors, formErrors };
}
