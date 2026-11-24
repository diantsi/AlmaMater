import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchTopics } from '../api/dictionaries.js';

import { FORMAT_TAGS } from '../lib/eventOptions.js';
import { MONTHS_SHORT, kyivDateParts } from '../lib/kyivTime.js';

// Ticket colours from the design palette; the ink keeps the date readable on blue
const COLORS = [
  { accent: '#d4ed68' },
  { accent: '#f5d54c' },
  { accent: '#f6d4df' },
  { accent: '#365ec4', ink: '#fffaf0' },
];

// Hand-drawn stickers; `ticket` is the neutral one for topics without their own drawing
const ART = {
  code: (
      <>
        <rect x="15" y="22" width="66" height="47" rx="6" fill="#fffaf0" />
        <path d="M8 70h80l-5 10H13Z" fill="#365ec4" />
        <path d="m37 37-11 8 11 8m21-16 11 8-11 8m-7-21-7 26" fill="none" stroke="#d62663" />
      </>
  ),
  cv: (
      <>
        <path d="M24 8h40l14 15v63H24Z" fill="#fffaf0" />
        <path d="M64 8v15h14" fill="#d4ed68" />
        <circle cx="40" cy="34" r="7" fill="#d62663" />
        <path d="M29 50q11-15 22 0m5-12h13m-13 10h13M32 61h37M32 70h29" fill="none" stroke="#365ec4" />
        <path d="m63 75 8 8 18-23" fill="none" stroke="#262422" strokeWidth="5" />
      </>
  ),
  film: (
      <>
        <path d="M13 35h70v45H13Z" fill="#365ec4" />
        <path d="M12 22 79 9l4 16-68 13Z" fill="#f5d54c" />
        <path d="m26 20 12 13m9-17 12 13m9-17 12 13M14 43h69" />
        <path d="m42 51 18 11-18 11Z" fill="#d4ed68" />
      </>
  ),
  robot: (
      <>
        <rect x="17" y="29" width="62" height="46" rx="10" fill="#fffaf0" />
        <path d="M48 29V15" />
        <circle cx="48" cy="11" r="6" fill="#f5d54c" />
        <rect x="7" y="41" width="10" height="22" rx="4" fill="#d62663" />
        <rect x="79" y="41" width="10" height="22" rx="4" fill="#d62663" />
        <circle cx="35" cy="48" r="6" fill="#365ec4" />
        <circle cx="61" cy="48" r="6" fill="#365ec4" />
        <path d="M36 63q12 8 24 0" fill="none" />
      </>
  ),
  talk: (
      <>
        <path d="M10 16h48q9 0 9 9v24q0 9-9 9H35L22 70l2-12H19q-9 0-9-9Z" fill="#d4ed68" />
        <path d="M37 41h42q9 0 9 9v23q0 8-9 8h-4l2 11-14-11H37q-8 0-8-8V49q0-8 8-8Z" fill="#d62663" />
        <path d="M21 29h34M21 39h23m-3 17h35M41 66h25" stroke="#fffaf0" fill="none" />
      </>
  ),
  write: (
      <>
        <rect x="19" y="11" width="53" height="75" rx="5" fill="#fffaf0" />
        <path d="M31 11v75M13 23h17M13 35h17M13 47h17M13 59h17M13 71h17" fill="none" />
        <path d="M39 28h25M39 39h25M39 50h22M39 61h17" stroke="#365ec4" />
        <path d="m54 69 30-43 9 6-31 43-12 6Z" fill="#f5d54c" />
        <path d="m84 26 5-7 9 6-5 7" fill="#d62663" />
      </>
  ),
  ticket: (
      <>
        <path d="m8 31 76-9 2 15c-13 1-11 17 2 16l2 17-76 9-2-16c12-2 10-17-2-16Z" fill="#fffaf0" />
        <path d="m62 26 5 45" strokeDasharray="5 5" />
        <path d="m36 39 6 9 11 1-8 8 2 11-10-5-10 6 2-11-9-7 11-2Z" fill="#d62663" />
      </>
  ),
};

// Topic code keyword → sticker; the first match wins (seed codes such as `example-science`)
const TOPIC_ART = [
  ['science', 'code'],
  ['tech', 'code'],
  ['robot', 'robot'],
  ['engineer', 'robot'],
  ['career', 'cv'],
  ['job', 'cv'],
  ['art', 'film'],
  ['film', 'film'],
  ['cinema', 'film'],
  ['debate', 'talk'],
  ['social', 'talk'],
  ['communit', 'talk'],
  ['writ', 'write'],
  ['literat', 'write'],
  ['educat', 'write'],
];

/**
 * Sticker of a topic, chosen by its stable `code`; unknown or missing codes get the neutral ticket
 * @param {string | undefined} topicCode
 */
export function topicArt(topicCode) {
  const words = (topicCode ?? '').toLowerCase().split(/[^a-z]+/);
  const match = TOPIC_ART.find(([keyword]) => words.some((word) => word.startsWith(keyword)));
  return ART[match ? match[1] : 'ticket'];
}

/**
 * Topic codes by topic id for the catalog lists, whose items carry only `topicId`; empty until loaded or on error
 * @returns {Record<string, string>}
 */
export function useTopicCodes() {
  const [codes, setCodes] = useState(/** @type {Record<string, string>} */ ({}));
  useEffect(() => {
    let ignore = false;
    fetchTopics()
      .then((topics) => !ignore && setCodes(Object.fromEntries(topics.map((topic) => [topic.id, topic.code]))))
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);
  return codes;
}

/**
 * Ticket colour of an event: a stable hash of its id over the palette, so events of one topic still vary.
 * Returns the CSS variables the poster, details ticket and dashboard card read
 * @param {string} eventId
 */
export function ticketStyle(eventId) {
  let hash = 0;
  for (const char of eventId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const color = COLORS[hash % COLORS.length];
  return /** @type {import('react').CSSProperties} */ ({
    '--accent': color.accent,
    '--poster-ink': color.ink ?? 'var(--ink)',
  });
}

/** @param {{ format: string }} props */
export function FormatTag({ format }) {
  return (
    <span className={format === 'ONLINE' ? 'format-tag online' : 'format-tag'}>
      <span className="format-dot" />
      {FORMAT_TAGS[format] ?? format}
    </span>
  );
}

/**
 * Event ticket: poster with the Kyiv date, time, organisation and format; in the catalog the title link covers the
 * whole card. With `children` (the organisation dashboard) it shows the published status and the given actions
 * instead of the organisation name and the arrow
 * @param {{
 *   event: { id: string, title: string, startsAt: string, organizationName: string, format: string, eventUrl: string },
 *   topicCode?: string,
 *   children?: import('react').ReactNode
 * }} props
 */
export default function EventCard({ event, topicCode, children }) {
  const { year, month, day, time } = kyivDateParts(event.startsAt);

  return (
    <article className={children ? 'event-ticket event-ticket--managed' : 'event-ticket'} style={ticketStyle(event.id)}>
      <div className="poster">
        <time className="date-stamp" dateTime={event.startsAt}>
          <b>{day}</b>
          <span>
            {MONTHS_SHORT[month - 1]} {year}
          </span>
        </time>
        <span className="poster-icon" aria-hidden="true">
          <svg
            viewBox="0 0 100 100"
            fill="none"
            stroke="#262422"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {topicArt(topicCode)}
          </svg>
        </span>
      </div>
      <div className="event-content">
        <h2 className="event-title">
          <Link to={event.eventUrl}>{event.title}</Link>
        </h2>
        <div className="event-meta">
          <div>
            <svg className="meta-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>{time}</span>
          </div>
          {!children && (
            <div>
              <svg className="meta-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="7" r="3" />
                <path d="M5 20v-3a7 7 0 0 1 14 0v3M4 8a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6" />
              </svg>
              <span>{event.organizationName}</span>
            </div>
          )}
        </div>
        <div className="event-bottom">
          {children && <span className="status-tag">Опубліковано</span>}
          <FormatTag format={event.format} />
          {!children && (
            <span className="detail-arrow" aria-hidden="true">
              <svg className="arrow">
                <use href="#arrow" />
              </svg>
            </span>
          )}
        </div>
        {children}
      </div>
    </article>
  );
}
