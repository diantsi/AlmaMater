import { FieldErrors, RequiredMark } from './Field.jsx';

// One-of choice over { value, label } options; the fieldset carries `id` so error links can target it
export default function RadioGroup({ id, label, options, value, onChange, required, errors = [] }) {
  const errorId = `${id}-error`;

  return (
    <fieldset
      id={id}
      className="field radio-group"
      aria-invalid={errors.length > 0 || undefined}
      aria-describedby={errors.length > 0 ? errorId : undefined}
    >
      <legend>
        {label}
        {required && <RequiredMark />}
      </legend>
      {options.map((option) => (
        <label key={option.value} className="radio">
          <input
            type="radio"
            name={id}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            required={required}
          />
          {option.label}
        </label>
      ))}
      <FieldErrors id={errorId} errors={errors} />
    </fieldset>
  );
}
