// Labelled select over reference data ({ id, name }); disabled with a hint when the list is empty
export default function SelectField({ id, label, options, value, onChange }) {
  const empty = options.length === 0;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={empty} required>
        <option value="" disabled>
          {empty ? 'None available yet' : `Select ${label.toLowerCase()}`}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}
