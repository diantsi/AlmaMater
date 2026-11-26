// Event times are entered and shown in Europe/Kyiv, the timezone of catalog dates (api-contracts.md §2)
const TIME_ZONE = 'Europe/Kyiv';

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

// Ukrainian month names: short for date stamps, genitive for full dates
export const MONTHS_SHORT = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
const MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

/**
 * Full Kyiv date and time, e.g. "18 лютого 2027, 18:00"
 * @param {string} iso
 */
export function formatKyivDateTime(iso) {
  const { year, month, day, time } = kyivDateParts(iso);
  return `${day} ${MONTHS_GENITIVE[month - 1]} ${year}, ${time}`;
}

const pad = (n) => String(n).padStart(2, '0');

/** @param {Date} date */
function kyivParts(date) {
  return Object.fromEntries(partsFormat.formatToParts(date).map(({ type, value }) => [type, Number(value)]));
}

/**
 * Kyiv wall-clock parts of an instant for compact displays such as the catalog date stamp
 * @param {string} iso
 * @returns {{ year: number, month: number, day: number, time: string }} month is 1–12, time is HH:MM
 */
export function kyivDateParts(iso) {
  const parts = kyivParts(new Date(iso));
  return { year: parts.year, month: parts.month, day: parts.day, time: `${pad(parts.hour)}:${pad(parts.minute)}` };
}

// Minutes Kyiv is ahead of UTC at the given instant
function kyivOffsetMinutes(ms) {
  const parts = kyivParts(new Date(ms));
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((wall - ms) / 60000);
}

// `<input type="datetime-local">` value read as Kyiv wall time → RFC 3339 with offset, e.g. 2026-11-20T16:00:00+02:00;
// null when that wall time does not exist in Kyiv (spring DST gap, Feb 29 of a common year, hour 25, minute 60)
export function kyivLocalToIso(local) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!match) return null;
  const [, date, hour, minute, second = '00'] = match;
  const [year, month, day] = date.split('-').map(Number);
  const wall = Date.UTC(year, month - 1, day, Number(hour), Number(minute), Number(second));
  if (Number.isNaN(wall)) return null;

  // Second pass settles the offset when the first guess lands across a DST switch
  let offset = kyivOffsetMinutes(wall);
  offset = kyivOffsetMinutes(wall - offset * 60000);

  // Date.UTC rolls overflowing parts over and a skipped spring time has no instant, so the entered value is real
  // only if the resulting instant shows exactly that Kyiv wall time
  const shown = kyivParts(new Date(wall - offset * 60000));
  const entered = { year, month, day, hour: Number(hour), minute: Number(minute), second: Number(second) };
  if (Object.entries(entered).some(([part, value]) => shown[part] !== value)) return null;

  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${date}T${hour}:${minute}:${second}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// RFC 3339 instant → `<input type="datetime-local">` value in Kyiv wall time to the minute, e.g. 2026-11-20T16:00
export function isoToKyivLocal(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(ms)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}
