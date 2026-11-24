import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import Footer from '../components/Footer.jsx';
import Header from '../components/Header.jsx';

/**
 * Tilt and animation offset of one campus drawing
 * @param {string} rot
 * @param {string} delay
 */
function bob(rot, delay) {
  return /** @type {import('react').CSSProperties} */ ({ '--rot': rot, '--delay': delay });
}

// Public landing page: no event data, so it needs no session; its links lead to the members-only pages
export default function LandingPage() {
  const [paused, setPaused] = useState(false);
  const [inkVisible, setInkVisible] = useState(false);
  const pathsRef = useRef(/** @type {HTMLElement | null} */ (null));

  // The route doodle above the two paths draws itself once the visitor scrolls them into view
  useEffect(() => {
    if (inkVisible) return undefined;
    function reveal() {
      const section = pathsRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const scrolled = window.scrollY > 6 || document.documentElement.scrollHeight <= window.innerHeight + 1;
      if (scrolled && rect.top < window.innerHeight - 45 && rect.bottom > 0) setInkVisible(true);
    }
    window.addEventListener('scroll', reveal, { passive: true });
    window.addEventListener('resize', reveal);
    reveal();
    return () => {
      window.removeEventListener('scroll', reveal);
      window.removeEventListener('resize', reveal);
    };
  }, [inkVisible]);

  return (
    <div className={paused ? 'landing motion-off' : 'landing'}>
      <Header>
        <nav className="nav-links" aria-label="Основна навігація">
          <Link to="/events">Афіша</Link>
        </nav>
        <Link className="button button--nav nav-end" to="/events/new">
          Створити подію
          <svg className="arrow" aria-hidden="true">
            <use href="#arrow" />
          </svg>
        </Link>
      </Header>
      <main id="main">
        <section className="wrap hero">
        <div className="hero-copy">
        <h1><span className="line">Могилянка</span><span className="line"><span className="highlight">поза парами</span></span></h1>
        <p className="intro">Події, спільноти й можливості Могилянки — в одній афіші.</p>
        <div className="hero-actions"><Link className="button button--primary" to="/events">Переглянути афішу <svg className="arrow" aria-hidden="true"><use href="#arrow"/></svg></Link></div></div>
        <div className="hero-art" aria-hidden="true">
        <div className="board"><div className="grid-paper"></div>
        <svg className="building" viewBox="0 0 520 300" preserveAspectRatio="xMidYMax slice" ><g stroke="#f9f0d9" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M-20 274H540M0 269V155h82v-38l42-28 42 28v40h45v-20l50-35 50 35v20h45v-40l42-28 42 28v38h80v114M-8 155h90m358 0h88M166 157h45m100 0h45M210 138h102M82 118h84m190 0h84M0 180h82m84 0h45m100 0h45m84 0h80M0 253h520"/><path d="M233 269v-42a28 28 0 0 1 56 0v42M246 269v-40a15 15 0 0 1 30 0v40M104 143h40v18h-40zM376 143h40v18h-40zM245 151h32v20h-32z"/><g id="windows"><path d="M12 195h18v36H12zM43 195h18v36H43zM100 195h18v36h-18zM130 195h18v36h-18zM177 195h18v36h-18z"/></g><use href="#windows" transform="translate(520 0) scale(-1 1)"/><path d="M12 213h18m13 0h18m39 0h18m12 0h18m29 0h18M508 213h-18m-13 0h-18m-39 0h-18m-12 0h-18m-29 0h-18M124 90V73m274 17V73M260 102V78M251 78h18M260 68v20M0 284h520M-4 293h528"/></g></svg></div>
        <div className="sheet sheet-main"><div className="ticket-top"><span>AlmaMater</span><svg className="ticket-icon" viewBox="0 0 32 32"><rect x="4" y="7" width="24" height="22" rx="3"/><path d="M4 13h24M10 3v8M22 3v8m-12 8h3m5 0h3m-11 5h3"/></svg></div><div className="ticket-title">Афіша</div></div>
        <div className="sheet sheet-pink"><strong>Студентські<br />організації</strong><small>Публікуйте свої події</small></div>
        <div className="sheet sheet-white"><strong>Подія</strong><div>Коли?<br />Де?<br />Як долучитися?</div></div>
        <div className="sticker-star"><svg viewBox="0 0 100 100"><path d="M50 4 59 26 80 13 78 36 96 48 76 59 85 81 62 76 50 97 39 76 16 85 23 62 4 50 26 39 16 16 40 25Z" fill="#f0d449" stroke="#fffdf5" strokeWidth="6" strokeLinejoin="round"/><path d="M31 50h38M50 31v38M37 37l26 26m0-26L37 63" fill="none" stroke="#262422" strokeWidth="3" strokeLinecap="round"/></svg></div>
        <div className="tape"></div></div></section>
        <div className="campus-strip" aria-hidden="true">
        <div className="wrap campus-items">
        <span className="campus-item" style={bob('-10deg', '0.00s')}><svg viewBox="0 0 96 96" fill="none" stroke="#262422" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><g transform="rotate(-8 48 47)"><path d="M13 20q17 7 35 0l-2 26Q32 67 18 47Z" fill="#f5d54c"/><path d="M21 33l6-2m10 0 5 2M25 42q6 9 13 0" fill="none"/><path d="M43 36q17-4 35-16l7 25Q79 69 60 62Z" fill="#d62663"/><path d="m52 43 5-4m12-3 6 1M58 54q6-9 13-6" stroke="#fffaf0" fill="none"/></g><path d="m9 13 2-5m73 7 5-5M87 67l5 4" stroke="#365ec4"/></svg></span>
        <span className="campus-item" style={bob('8deg', '-0.73s')}><svg viewBox="0 0 96 96" fill="none" stroke="#262422" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="43" cy="49" r="32" fill="#365ec4"/><circle cx="43" cy="49" r="13" fill="#d4ed68"/><circle cx="43" cy="49" r="3" fill="#262422"/><path d="M25 31a25 25 0 0 1 34-3M19 45a24 24 0 0 1 7-12m33 38a24 24 0 0 0 8-12" stroke="#fffaf0" fill="none"/><path d="M75 9v30m0-30 13 9v8l-13-8" fill="#f5d54c"/><ellipse cx="69" cy="40" rx="8" ry="5" transform="rotate(-20 69 40)" fill="#f5d54c"/></svg></span>
        <span className="campus-item" style={bob('-6deg', '-1.46s')}><svg viewBox="0 0 96 96" fill="none" stroke="#262422" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 25q0-11 11-11h38q11 0 11 11v21q0 11-11 11H34L19 68l3-11h-2Q9 57 9 46Z" fill="#d4ed68"/><path d="M42 46q0-10 10-10h26q10 0 10 10v21q0 10-10 10h-3l3 10-15-10H52q-10 0-10-10Z" fill="#d62663"/><path d="m19 28 34 0m-34 10h22" fill="none"/><path d="M53 55h24m-24 9h15" stroke="#fffaf0" fill="none"/><path d="m74 11 2-5m7 10 6-3" stroke="#365ec4"/></svg></span>
        <span className="campus-item" style={bob('6deg', '-2.19s')}><svg viewBox="0 0 96 96" fill="none" stroke="#262422" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M48 65C39 55 13 39 17 22c4-17 25-16 31-2 8-14 29-15 33 2 4 17-22 33-33 43Z" fill="#d62663"/><path d="m9 54 15 0 13 14 12 2q5 3 1 8l-19-1-13-8H9Z" fill="#f5d54c"/><path d="m87 54-15 0-13 14-12 2q-5 3-1 8l19-1 13-8h9Z" fill="#f5d54c"/><path d="M28 23q4-8 12-4" stroke="#fffaf0" fill="none"/><path d="M9 13l6 4m72-4-6 4M48 3v6" stroke="#365ec4"/></svg></span>
        <span className="campus-item" style={bob('-8deg', '-2.92s')}><svg viewBox="0 0 96 96" fill="none" stroke="#262422" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 37h72v42H12Z" fill="#365ec4"/><path d="m12 37-4-16 70-15 4 16Z" fill="#f5d54c"/><path d="m19 19 12 14m8-18 12 14m8-18 12 14" stroke="#262422"/><path d="M12 37h72v11H12Z" fill="#fffaf0"/><path d="m20 38 8 9m12-9 8 9m12-9 8 9"/><path d="m42 54 16 10-16 10Z" fill="#d4ed68" stroke="#fffaf0"/></svg></span>
        <span className="campus-item" style={bob('10deg', '-3.65s')}><svg viewBox="0 0 96 96" fill="none" stroke="#262422" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><g transform="rotate(20 48 48)"><rect x="34" y="9" width="29" height="49" rx="14.5" fill="#f5d54c"/><path d="M35 26h27M35 34h27M35 42h27"/><path d="M27 36v9a22 22 0 0 0 44 0v-9M49 67v17m-14 0h28" fill="none" stroke="#365ec4" strokeWidth="4"/></g><path d="m8 28 12 5m-8-19 10 9m62 12 7-7m-6 19 9 0" stroke="#d62663"/></svg></span>
        <span className="campus-item" style={bob('-7deg', '-4.38s')}><svg viewBox="0 0 96 96" fill="none" stroke="#262422" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M48 11C23 9 10 25 10 47s20 36 39 32c8-2 10-10 5-16-4-5-3-10 4-11l13-1c20-3 20-26 2-35-8-4-16-5-25-5Z" fill="#f5d54c"/><circle cx="28" cy="30" r="7" fill="#d62663"/><circle cx="49" cy="23" r="7" fill="#365ec4"/><circle cx="67" cy="35" r="7" fill="#d4ed68"/><circle cx="24" cy="51" r="6" fill="#fffaf0"/><ellipse cx="45" cy="64" rx="8" ry="6" fill="#fffaf0"/><path d="m61 79 23-44 6 4-22 44Z" fill="#365ec4"/><path d="m84 35 4-9 6-7 0 10-4 10Z" fill="#d62663"/><path d="m9 12 5 5m72 55 5 3" stroke="#d62663"/></svg></span>
        <span className="campus-item" style={bob('9deg', '-5.11s')}><svg viewBox="0 0 96 96" fill="none" stroke="#262422" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="47" cy="49" r="33" fill="#fffaf0"/><path d="M47 16 36 31 18 34M77 35 60 31 47 16M77 35 80 55 65 70 47 82 28 70 14 55 18 34" fill="none"/><path d="m36 31 24 0 9 22-22 16-21-16Z" fill="#365ec4"/><path d="M26 53 14 55m55-2 11 2M47 69v13M36 31 27 22m33 9 10-10"/><path d="m9 12 9 6m-13 6 9 3m66 47 9 4m-13 3 3 9" stroke="#d62663"/><path d="M22 38q-5 12 0 21" stroke="#f5d54c" strokeWidth="4"/></svg></span></div></div>
        <section className={paused ? 'ticker paused' : 'ticker'} aria-label="Події, спільноти та можливості">
        <div className="ticker-inner" aria-hidden="true">
        <div className="ticker-part">Події <b>✳</b> Спільноти <b>✳</b> Можливості <b>✳</b> Події <b>✳</b> Спільноти <b>✳</b> Можливості <b>✳</b></div>
        <div className="ticker-part">Події <b>✳</b> Спільноти <b>✳</b> Можливості <b>✳</b> Події <b>✳</b> Спільноти <b>✳</b> Можливості <b>✳</b></div></div>
        <button className="pause" type="button" aria-label={paused ? 'Відновити анімації' : 'Призупинити анімації'} aria-pressed={paused} onClick={() => setPaused((value) => !value)}><svg viewBox="0 0 16 16" aria-hidden="true"><path d={paused ? 'M4 2l10 6-10 6z' : 'M3 2h4v12H3zm6 0h4v12H9z'} /></svg></button></section>
        <section ref={pathsRef} className={inkVisible ? 'wrap paths ink-visible' : 'wrap paths'} aria-label="Можливості платформи">
        <Link className="path" to="/events"><div><h2>Для студентів</h2><p>Знаходь події та обирай, до чого долучитися.</p></div><span className="path-icon"><svg className="arrow" aria-hidden="true"><use href="#arrow"/></svg></span></Link>
        <Link className="path" to="/events/new"><div><h2>Для організаторів</h2><p>Публікуйте події своєї студентської організації.</p></div><span className="path-icon"><svg className="arrow" aria-hidden="true"><use href="#arrow"/></svg></span></Link>
        <svg className="route-doodle" viewBox="0 0 600 60" aria-hidden="true">
        <path className="scroll-ink" pathLength="1" d="M296 4C275 23 188 4 151 23Q133 34 125 52M120 36l5 16 15-8" stroke="#365ec4"/>
        <path className="scroll-ink route-second" pathLength="1" d="M324 4C345 23 432 4 469 23Q487 34 495 52M480 44l15 8 5-16" stroke="#d62663"/>
        <path className="scroll-ink route-mobile" pathLength="1" d="M316 4Q266 16 291 33Q300 41 300 53M288 42l12 11 11-12" stroke="#365ec4"/></svg></section>
      </main>
      <Footer />
    </div>
  );
}
