// Enum values from api-contracts.md §5.1 with their UI labels
export const FORMAT_OPTIONS = [
  { value: 'ONLINE', label: 'Онлайн' },
  { value: 'IN_PERSON', label: 'Офлайн' },
];

// Short format label on event tickets and the details page
export const FORMAT_TAGS = { ONLINE: 'Онлайн', IN_PERSON: 'Очно' };

export const PARTICIPATION_METHOD_OPTIONS = [
  { value: 'GOOGLE_FORM', label: 'Google Form' },
  { value: 'DIRECT_CONTACT', label: 'Прямий контакт' },
  { value: 'OPEN_ATTENDANCE', label: 'Вільне відвідування' },
];

// `newcomersWelcome` (api-contracts.md §5.1) as select options: '' means not specified and is omitted (no invented default)
export const NEWCOMERS_OPTIONS = [
  { id: '', name: 'Не зазначено' },
  { id: 'true', name: 'Так' },
  { id: 'false', name: 'Ні' },
];

export function participationMethodLabel(value) {
  return PARTICIPATION_METHOD_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

const EVENT_WORDS = { one: 'подія', few: 'події', many: 'подій', other: 'події' };
const pluralRules = new Intl.PluralRules('uk');

/**
 * Ukrainian event count, e.g. "1 подія", "3 події", "5 подій"
 * @param {number} count
 */
export function eventCount(count) {
  return `${count} ${EVENT_WORDS[pluralRules.select(count)]}`;
}
