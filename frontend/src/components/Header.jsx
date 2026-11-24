import Logo from './Logo.jsx';
import PaperFrame from './PaperFrame.jsx';

/**
 * Site header: skip link, logo and the page's navigation inside the hand-drawn frame. `simple` lays the content out
 * as one row (sign-in page); otherwise the centred `.nav-links` and a right-aligned `.nav-end` follow the logo
 * @param {{ children: import('react').ReactNode, simple?: boolean, className?: string, after?: import('react').ReactNode }} props
 */
export default function Header({ children, simple = false, className = '', after = null }) {
  return (
    <header className="header">
      <a className="skip" href="#main">
        До основного вмісту
      </a>
      <PaperFrame className="header-frame">
        <div className={`nav ${simple ? 'nav--simple' : ''} ${className}`}>
          <Logo />
          {children}
        </div>
      </PaperFrame>
      {after}
    </header>
  );
}
