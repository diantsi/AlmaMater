import Field from './Field.jsx';

// Labelled select over reference data ({ id, name }); disabled with a hint when the list is empty
export default function SelectField({ id, label, options, value, onChange, required, errors }) {
  const empty = options.length === 0;

  return (
    <Field id={id} label={label} required={required} errors={errors}>
      {(controlProps) => (
        <select {...controlProps} value={value} onChange={(e) => onChange(e.target.value)} disabled={empty}>
          <option value="" disabled>
            {empty ? 'None available yet' : `Select ${label.toLowerCase()}`}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
