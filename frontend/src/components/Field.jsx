// Label with a required or optional marker, an optional hint and error messages, wired to the control for screen readers
export default function Field({id, label, required, optional = false, hint = '', errors = [], children}) {
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    const describedBy = [hint && hintId, errors.length > 0 && errorId].filter(Boolean).join(' ');
    return (
        <div className="field">
            <label htmlFor={id}>
                {label}
                {required && <RequiredMark/>}
                {optional && <OptionalMark/>}
            </label>
            {hint && (
                <p id={hintId} className="hint">
                    {hint}
                </p>
            )}
            {children({
                id,
                name: id,
                required,
                'aria-invalid': errors.length > 0 || undefined,
                'aria-describedby': describedBy || undefined,
            })}
            <FieldErrors id={errorId} errors={errors}/>
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
    return <span className="optional"> (optional)</span>;
}

export function FieldErrors({id, errors}) {
    if (errors.length === 0) return null;
    return (
        <div id={id} className="field-error">
            {errors.map((message, index) => (
                <p key={index}>{message}</p>
            ))}
        </div>
    );
}
