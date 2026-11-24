/**
 * Hand-drawn paper outline with a paper clip (and optionally a star) behind header and footer content
 * @param {{ className: string, star?: boolean, children: import('react').ReactNode }} props
 */
export default function PaperFrame({ className, star = false, children }) {
  return (
    <div className={`wrap paper-frame ${className}`}>
      <svg className="paper-outline" viewBox="0 0 1200 132" preserveAspectRatio="none" aria-hidden="true">
        <use href="#paper-outline" />
      </svg>
      <svg className="paper-clip" aria-hidden="true">
        <use href="#paper-clip" />
      </svg>
      {star && (
        <svg className="frame-star" aria-hidden="true">
          <use href="#frame-star" />
        </svg>
      )}
      {children}
    </div>
  );
}
