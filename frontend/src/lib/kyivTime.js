// Event times are entered and shown in Europe/Kyiv, the timezone of catalog dates (api-contracts.md §2)
const TIME_ZONE = 'Europe/Kyiv';

const displayFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

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

export function formatKyivDateTime(iso) {
  return displayFormat.format(new Date(iso));
}

// Minutes Kyiv is ahead of UTC at the given instant
function kyivOffsetMinutes(ms) {
  const parts = Object.fromEntries(
    partsFormat.formatToParts(new Date(ms)).map(({ type, value }) => [type, Number(value)]),
  );
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((wall - ms) / 60000);
}

const pad = (n) => String(n).padStart(2, '0');

// `<input type="datetime-local">` value read as Kyiv wall time → RFC 3339 with offset, e.g. 2026-11-20T16:00:00+02:00
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
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${date}T${hour}:${minute}:${second}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
