/**
 * Label with a required or optional marker, the control, an optional hint and error messages, wired together for
 * screen readers
 * @param {{
 *   id: string,
 *   label: string,
 *   required: boolean,
 *   optional?: boolean,
 *   hint?: string,
 *   errors?: string[],
 *   children: (controlProps: Record<string, any>) => import('react').ReactNode
 * }} props
 */
export default function Field({ id, label, required, optional = false, hint = '', errors = [], children }) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, errors.length > 0 && errorId].filter(Boolean).join(' ');
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
        {optional && <OptionalMark />}
      </label>
      {children({
        id,
        name: id,
        required,
        'aria-invalid': errors.length > 0 || undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {hint && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
      <FieldErrors id={errorId} errors={errors} />
    </div>
  );
}

export function RequiredMark() {
  // The control's `required` attribute is what assistive technology announces
  return (
    <span className="required" aria-hidden="true">
      {' *'}
    </span>
  );
}

// Visible text, so optional inputs are distinguishable from required ones without relying on colour (US-13)
export function OptionalMark() {
  return <span className="optional"> (необов’язково)</span>;
}

/** @param {{ id: string, errors: string[] }} props */
export function FieldErrors({ id, errors }) {
  if (errors.length === 0) return null;
  return (
    <span id={id} className="field-errors">
      {errors.map((message, index) => (
        <span key={index} className="field-error">
          {message}
        </span>
      ))}
    </span>
  );
}
