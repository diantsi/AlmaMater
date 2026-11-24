// Enum values from api-contracts.md §5.1 with their UI labels
export const FORMAT_OPTIONS = [
  { value: 'ONLINE', label: 'Online' },
  { value: 'IN_PERSON', label: 'In person' },
];

export const PARTICIPATION_METHOD_OPTIONS = [
  { value: 'GOOGLE_FORM', label: 'Google Form' },
  { value: 'DIRECT_CONTACT', label: 'Direct contact' },
  { value: 'OPEN_ATTENDANCE', label: 'Open attendance' },
];

// `newcomersWelcome` (api-contracts.md §5.1) as form values: '' means not specified and is omitted (no invented default)
export const NEWCOMERS_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
  { value: '', label: 'Not specified' },
];

export function formatLabel(value) {
  return FORMAT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function participationMethodLabel(value) {
  return PARTICIPATION_METHOD_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
