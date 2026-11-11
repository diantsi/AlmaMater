import { forwardRef } from 'react';

// Every issue of a failed publication: field issues link to their input, form-level issues are listed as text

/**
 * @param {{ fieldErrors: Record<string, string[]>, formErrors: string[], labels: Record<string, string> }} props
 * @param {import('react').ForwardedRef<HTMLDivElement>} ref
 */
function ErrorSummary({ fieldErrors, formErrors, labels }, ref) { const fieldItems = Object.keys(labels).flatMap((field) =>
    (fieldErrors[field] ?? []).map((message) => ({ field, message })),
  );
  const count = fieldItems.length + formErrors.length;
  if (count === 0) return null;

  const focusField = (event, field) => {
    event.preventDefault();
    const element = document.getElementById(field);
    // Radio groups are fieldsets; focus their first option
    (element?.matches('fieldset') ? element.querySelector('input') : element)?.focus();
  };

  return (
    <div ref={ref} className="error-summary" role="alert" tabIndex={-1}>
      <h2>{count === 1 ? 'There is 1 problem' : `There are ${count} problems`}</h2>
      <ul>
        {fieldItems.map(({ field, message }, index) => (
          <li key={`${field}-${index}`}>
            <a href={`#${field}`} onClick={(event) => focusField(event, field)}>
              {labels[field]}
            </a>
            : {message}
          </li>
        ))}
        {formErrors.map((message, index) => (
          <li key={`form-${index}`}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

export default forwardRef(ErrorSummary);