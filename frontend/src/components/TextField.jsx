import Field from './Field.jsx';

// Labelled text input, or a textarea when `multiline`
export default function TextField({ id, label, value, onChange, required, errors, hint = '', multiline = false, ...inputProps }) {  return (
    <Field id={id} label={label} required={required} hint={hint} errors={errors}>
      {(controlProps) =>
        multiline ? (
          <textarea {...controlProps} {...inputProps} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input {...controlProps} {...inputProps} value={value} onChange={(e) => onChange(e.target.value)} />
        )
      }
    </Field>
  );
}
