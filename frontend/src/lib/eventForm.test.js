// US-44a — Edit a published event: the edit form's prefill, PATCH body and error mapping
// (api-contracts.md §5.2, §6.4, §7; used by pages/EditEventPage.jsx)
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/http.js';
import { buildPatch, submissionErrors, validate, valuesFromEvent, withField } from './eventForm.js';

/** A loaded event shaped like api-contracts.md §5.2 */
function loadedEvent(overrides = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    organizationId: '00000000-0000-4000-8000-000000000020',
    organizationName: 'Test organisation',
    status: 'PUBLISHED',
    revision: 3,
    title: 'Test workshop',
    description: 'Test description',
    startsAt: '2099-11-20T14:00:00Z',
    speakerName: null,
    topicId: '00000000-0000-4000-8000-000000000030',
    facultyId: '00000000-0000-4000-8000-000000000040',
    intendedAudience: null,
    newcomersWelcome: true,
    format: 'IN_PERSON',
    venue: 'Test room',
    meetingUrl: null,
    durationMinutes: 90,
    registrationDeadline: '2099-11-19T16:00:00Z',
    participationMethod: 'GOOGLE_FORM',
    googleFormUrl: 'https://forms.example/test',
    contactDetails: null,
    attendanceInstructions: null,
    publishedAt: '2099-10-28T12:00:00Z',
    updatedAt: '2099-10-28T12:00:00Z',
    cancelledAt: null,
    eventUrl: '/events/00000000-0000-4000-8000-000000000001',
    canManage: true,
    subscribed: false,
    ...overrides,
  };
}

function editForm(overrides = {}) {
  const initial = valuesFromEvent(loadedEvent(overrides));
  return { initial, values: { ...initial } };
}

describe('US-44a valuesFromEvent: the edit form starts from the published event', () => {
  it('shows instants as Kyiv wall time and nulls as empty inputs', () => {
    const { initial } = editForm();

    expect(initial.startsAt).toBe('2099-11-20T16:00'); // winter, UTC+2
    expect(initial.registrationDeadline).toBe('2099-11-19T18:00');
    expect(initial.speakerName).toBe('');
    expect(initial.meetingUrl).toBe('');
    expect(initial.durationMinutes).toBe('90');
    expect(initial.newcomersWelcome).toBe('true');
    expect(initial.venue).toBe('Test room');
  });

  it('round-trips a summer start without shifting it', () => {
    const { initial, values } = editForm({ startsAt: '2099-07-10T15:30:00Z' });

    expect(initial.startsAt).toBe('2099-07-10T18:30'); // summer, UTC+3
    expect(buildPatch(values, initial)).toEqual({});
  });
});

describe('US-44a buildPatch: only valid changes are sent (AC1)', () => {
  it('sends nothing when the organiser changed nothing', () => {
    const { initial, values } = editForm();

    expect(buildPatch(values, initial)).toEqual({});
  });

  it('ignores surrounding whitespace that the server trims anyway', () => {
    const { initial, values } = editForm();

    expect(buildPatch({ ...values, title: '  Test workshop ' }, initial)).toEqual({});
  });

  it('sends only the changed field, trimmed', () => {
    const { initial, values } = editForm();

    expect(buildPatch({ ...values, title: '  New title ' }, initial)).toEqual({ title: 'New title' });
  });

  it('sends a changed start as an offset-aware Kyiv time', () => {
    const { initial, values } = editForm();

    expect(buildPatch({ ...values, startsAt: '2099-11-21T18:00' }, initial)).toEqual({
      startsAt: '2099-11-21T18:00:00+02:00',
    });
    expect(buildPatch({ ...values, startsAt: '2099-06-01T18:00' }, initial)).toEqual({
      startsAt: '2099-06-01T18:00:00+03:00',
    });
  });

  it('clears an emptied optional field with null and converts typed values', () => {
    const { initial, values } = editForm();

    const patch = buildPatch(
      { ...values, registrationDeadline: '', speakerName: 'Test speaker', durationMinutes: '45', newcomersWelcome: 'false' },
      initial,
    );

    expect(patch).toEqual({
      registrationDeadline: null,
      speakerName: 'Test speaker',
      durationMinutes: 45,
      newcomersWelcome: false,
    });
  });

  it('sends null for the venue when the format switches to online', () => {
    const { initial, values } = editForm();

    let edited = withField(values, 'format', 'ONLINE');
    edited = withField(edited, 'meetingUrl', 'https://meet.example/x');

    expect(buildPatch(edited, initial)).toEqual({
      format: 'ONLINE',
      venue: null,
      meetingUrl: 'https://meet.example/x',
    });
  });

  it('sends null for the old method field when the participation method changes', () => {
    const { initial, values } = editForm();

    let edited = withField(values, 'participationMethod', 'DIRECT_CONTACT');
    edited = withField(edited, 'contactDetails', '@test_org');

    expect(buildPatch(edited, initial)).toEqual({
      participationMethod: 'DIRECT_CONTACT',
      googleFormUrl: null,
      contactDetails: '@test_org',
    });
  });
});

describe('US-44a validate: invalid changes are stopped before saving (AC2)', () => {
  it('accepts an unchanged published event', () => {
    expect(validate(editForm().values)).toEqual({});
  });

  it('requires a title that is not only spaces', () => {
    const { values } = editForm();

    expect(validate({ ...values, title: '   ' })).toEqual({ title: ['Заповніть це поле.'] });
  });

  it('requires the meeting link once the format switches to online', () => {
    const edited = withField(editForm().values, 'format', 'ONLINE');

    expect(validate(edited)).toEqual({ meetingUrl: ['Заповніть це поле.'] });
  });

  it('rejects a meeting link that is not https', () => {
    const edited = withField(editForm().values, 'format', 'ONLINE');

    expect(validate({ ...edited, meetingUrl: 'http://meet.example/x' })).toEqual({
      meetingUrl: ['Введіть повне посилання, що починається з https://.'],
    });
  });

  it('allows a registration deadline equal to the start but not after it', () => {
    const { values } = editForm();

    expect(validate({ ...values, registrationDeadline: values.startsAt })).toEqual({});
    expect(validate({ ...values, registrationDeadline: '2099-11-20T16:01' })).toEqual({
      registrationDeadline: ['Дедлайн не може бути пізніше початку події.'],
    });
  });

  it.each(['0', '-5', '1.5', 'abc'])('rejects duration %s', (duration) => {
    const { values } = editForm();

    expect(validate({ ...values, durationMinutes: duration })).toEqual({
      durationMinutes: ['Введіть ціле додатне число.'],
    });
  });
});

describe('US-44a submissionErrors: a rejected save is explained, values are kept (AC2)', () => {
  const action = 'зберегти зміни';

  it('puts 422 details under visible inputs and the rest at form level', () => {
    const { values } = editForm();
    const error = new ApiError(422, 'VALIDATION_ERROR', 'Validation failed.', [
      { field: 'startsAt', message: 'Must be in the future.' },
      { field: 'meetingUrl', message: 'Must be empty for in-person events.' },
      { message: 'General problem.' },
    ]);

    expect(submissionErrors(error, values, action)).toEqual({
      fieldErrors: { startsAt: ['Must be in the future.'] },
      formErrors: ['Посилання на зустріч: Must be empty for in-person events.', 'General problem.'],
    });
  });

  it.each([
    [409, 'EVENT_REVISION_CONFLICT', 'Event was changed by someone else; reload it.'],
    [403, 'ORGANIZATION_ACCESS_DENIED', 'Only the owning organisation can change this event.'],
    [409, 'EVENT_NOT_EDITABLE', 'Cancelled or past events cannot be edited.'],
  ])('reports a %i %s at form level', (status, code, message) => {
    const error = new ApiError(status, code, message);

    expect(submissionErrors(error, editForm().values, action)).toEqual({
      fieldErrors: {},
      formErrors: [`Не вдалося зберегти зміни: ${message}`],
    });
  });

  it('reports a network failure without blaming the input', () => {
    expect(submissionErrors(new TypeError('Failed to fetch'), editForm().values, action)).toEqual({
      fieldErrors: {},
      formErrors: ['Не вдалося зв’язатися із сервером. Перевірте з’єднання та спробуйте ще раз.'],
    });
  });
});
