import Logo from './Logo.jsx';
import PaperFrame from './PaperFrame.jsx';

export default function Footer() {
  return (
    <footer className="foot">
      <PaperFrame className="footer-frame" star>
        <div className="foot-inner">
          <Logo />
          <p>Національний університет «Києво-Могилянська академія»</p>
        </div>
      </PaperFrame>
    </footer>
  );
}
