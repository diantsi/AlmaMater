import { ApiError } from '../api/http.js';
import { isoToKyivLocal, kyivLocalToIso } from './kyivTime.js';

// Event form state and rules for create and edit (api-contracts.md §5.1, §6.4, database-schema.md §5).
// There is no organisation field: the server assigns the signed-in organiser's organisation (US-03)

// Conditional field activated by each format / participation method value
export const LOCATION_FIELD = { ONLINE: 'meetingUrl', IN_PERSON: 'venue' };
export const METHOD_FIELD = {
  GOOGLE_FORM: 'googleFormUrl',
  DIRECT_CONTACT: 'contactDetails',
  OPEN_ATTENDANCE: 'attendanceInstructions',
};

// Every form field in display order; keys are the camelCase request fields
export const FIELD_LABELS = {
  title: 'Назва',
  description: 'Опис',
  startsAt: 'Дата та час початку',
  speakerName: 'Спікер',
  durationMinutes: 'Тривалість, хв',
  topicId: 'Тема',
  facultyId: 'Факультет',
  intendedAudience: 'Для кого',
  newcomersWelcome: 'Чи можуть долучитися новачки?',
  format: 'Формат',
  venue: 'Місце проведення',
  meetingUrl: 'Посилання на зустріч',
  participationMethod: 'Спосіб участі',
  googleFormUrl: 'Посилання на Google Form',
  contactDetails: 'Контактні дані',
  attendanceInstructions: 'Інструкції для участі',
  registrationDeadline: 'Дедлайн реєстрації',
};

// Always shown, never required; an empty value is omitted from the payload (US-12c, US-16a/b, US-17c, US-21)
export const OPTIONAL_FIELDS = new Set([
  'speakerName',
  'intendedAudience',
  'newcomersWelcome',
  'durationMinutes',
  'registrationDeadline',
]);

const HTTPS_FIELDS = new Set(['meetingUrl', 'googleFormUrl']);
const DATE_TIME_FIELDS = new Set(['startsAt', 'registrationDeadline']);

export const EMPTY_VALUES = Object.fromEntries(Object.keys(FIELD_LABELS).map((field) => [field, '']));

// Required fields under the current format and participation method
export function requiredFields(values) {
  return [
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

// Fields shown and validated under the current selections: the required ones plus every optional field
export function activeFields(values) {
  return [...requiredFields(values), ...OPTIONAL_FIELDS];
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

// The raw string is what gets sent, and `new URL` silently repairs `https:host`, `https:/host`, `https:///host` and
// backslashes, so the text itself must start with `https://` plus a host and contain no whitespace or backslash
function isHttpsUrl(value) {
  if (!/^https:\/\/[^/?#\\\s]/i.test(value) || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.host !== '' && !/\s/.test(value);
  } catch {
    return false;
  }
}

// Message for one non-empty value, or null when it passes the client-side checks
function formatError(field, value) {
  if (HTTPS_FIELDS.has(field) && !isHttpsUrl(value)) return 'Введіть повне посилання, що починається з https://.';
  if (DATE_TIME_FIELDS.has(field) && !kyivLocalToIso(value)) return 'Введіть коректні дату та час.';
  if (field === 'durationMinutes' && !(/^\d+$/.test(value) && Number(value) > 0)) {
    return 'Введіть ціле додатне число.';
  }
  return null;
}

/** @typedef {Record<string, string[]>} FieldErrors */
/** @typedef {{ fieldErrors: FieldErrors, formErrors: string[] }} SubmissionErrors */

/**
 * Client-side checks of required values, value syntax and deadline order; the server re-validates everything
 * @param {Record<string, string>} values
 * @returns {FieldErrors}
 */
export function validate(values) {
  /** @type {FieldErrors} */
  const errors = {};
  for (const field of activeFields(values)) {
    const value = values[field].trim();
    if (!value) {
      if (!OPTIONAL_FIELDS.has(field)) errors[field] = ['Заповніть це поле.'];
      continue;
    }
    const message = formatError(field, value);
    if (message) errors[field] = [message];
  }

  const startsAt = kyivLocalToIso(values.startsAt);
  const deadline = kyivLocalToIso(values.registrationDeadline);
  if (startsAt && deadline && Date.parse(deadline) > Date.parse(startsAt)) {
    errors.registrationDeadline = ['Дедлайн не може бути пізніше початку події.'];
  }
  return errors;
}

// One request value: date-times become offset-aware, duration a number, newcomers a boolean, text is trimmed
function toRequestValue(field, value) {
  if (DATE_TIME_FIELDS.has(field)) return kyivLocalToIso(value);
  if (field === 'durationMinutes') return Number(value);
  if (field === 'newcomersWelcome') return value === 'true';
  return value;
}

// POST /api/events body: active fields only, with empty optional fields left out
export function buildPayload(values) {
  return Object.fromEntries(
    activeFields(values)
      .map((field) => [field, values[field].trim()])
      .filter(([, value]) => value !== '')
      .map(([field, value]) => [field, toRequestValue(field, value)]),
  );
}

// Form values of a loaded §5.2 event: null optionals become empty inputs, instants Kyiv `datetime-local` values
export function valuesFromEvent(event) {
  return Object.fromEntries(
    Object.keys(FIELD_LABELS).map((field) => {
      const value = event[field];
      if (value === null || value === undefined) return [field, ''];
      if (DATE_TIME_FIELDS.has(field)) return [field, isoToKyivLocal(value)];
      return [field, String(value)];
    }),
  );
}

// PATCH /api/events/{id} fields (without `revision`): only fields whose value differs from `initial`; an emptied
// optional and a field made irrelevant by a format / method change are sent as null (api-contracts.md §6.4)
export function buildPatch(values, initial) {
  const active = new Set(activeFields(values));
  const patch = {};
  for (const field of Object.keys(FIELD_LABELS)) {
    const value = active.has(field) ? values[field].trim() : '';
    if (value === initial[field].trim()) continue;
    patch[field] = value === '' ? null : toRequestValue(field, value);
  }
  return patch;
}

// Splits a failed publish or save into per-field messages (details[].field on a visible input) and form-level
// messages; `action` names the attempt in generic messages, e.g. "опублікувати подію"
/**
 * @param {unknown} error
 * @param {Record<string, string>} values
 * @param {string} action
 * @returns {SubmissionErrors}
 */
export function submissionErrors(error, values, action) {
  if (!(error instanceof ApiError)) {
    // fetch rejects with a TypeError when the request never reaches the server
    const message =
      error instanceof TypeError
        ? 'Не вдалося зв’язатися із сервером. Перевірте з’єднання та спробуйте ще раз.'
        : `Не вдалося ${action}: ${error instanceof Error ? error.message : String(error)}`;
    return { fieldErrors: {}, formErrors: [message] };
  }

  const visible = new Set(activeFields(values));
  /** @type {FieldErrors} */
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
    formErrors.push(`Не вдалося ${action}: ${error.message}`);
  }
  return { fieldErrors, formErrors };
}
