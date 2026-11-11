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

export function formatLabel(value) {
  return FORMAT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
