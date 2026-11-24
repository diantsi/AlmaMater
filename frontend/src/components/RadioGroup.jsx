import { FieldErrors, OptionalMark, RequiredMark } from './Field.jsx';

/**
 * One-of choice over { value, label } options as paper choice cards; the fieldset carries `id` so error links can
 * target it
 * @param {{
 *   id: string,
 *   label: string,
 *   options: { value: string, label: string }[],
 *   value: string,
 *   onChange: (value: string) => void,
 *   required: boolean,
 *   optional?: boolean,
 *   errors?: string[]
 * }} props
 */
export default function RadioGroup({ id, label, options, value, onChange, required, optional = false, errors = [] }) {
  const errorId = `${id}-error`;
  const invalid = errors.length > 0 || undefined;

  return (
    <fieldset id={id} className="choice-group" aria-describedby={invalid && errorId}>
      <legend className="choice-legend">
        {label}
        {required && <RequiredMark />}
        {optional && <OptionalMark />}
      </legend>
      <div className={options.length === 2 ? 'choices two' : 'choices'}>
        {options.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              required={required}
              aria-invalid={invalid}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <FieldErrors id={errorId} errors={errors} />
    </fieldset>
  );
}
