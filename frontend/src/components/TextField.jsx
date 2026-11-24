import Field from './Field.jsx';

/**
 * Labelled text input, or a textarea when `multiline`; `counter` shows the length against `maxLength`, and a
 * `datetime-local` input gets the calendar decoration
 * @param {{
 *   id: string,
 *   label: string,
 *   value: string,
 *   onChange: (value: string) => void,
 *   required: boolean,
 *   optional?: boolean,
 *   errors?: string[],
 *   hint?: string,
 *   multiline?: boolean,
 *   counter?: boolean,
 *   [inputProp: string]: any
 * }} props
 */
export default function TextField({
  id,
  label,
  value,
  onChange,
  required,
  optional = false,
  errors,
  hint = '',
  multiline = false,
  counter = false,
  ...inputProps
}) {
  const fieldHint = counter ? `${value.length} / ${inputProps.maxLength}` : hint;
  return (
    <Field id={id} label={label} required={required} optional={optional} hint={fieldHint} errors={errors}>
      {(controlProps) => {
        const control = multiline ? (
          <textarea {...controlProps} {...inputProps} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input {...controlProps} {...inputProps} value={value} onChange={(e) => onChange(e.target.value)} />
        );
        if (inputProps.type !== 'datetime-local') return control;
        return (
          <div className="date-control">
            {control}
            <span className="date-decoration" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M3 10h18M8 3v5m8-5v5m-9 8h2m4 0h3" />
              </svg>
            </span>
          </div>
        );
      }}
    </Field>
  );
}
