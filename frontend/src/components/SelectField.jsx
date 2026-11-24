import { useEffect, useRef, useState } from 'react';

import Field from './Field.jsx';

/**
 * Labelled paper dropdown over { id, name } options (combobox button + listbox, as in the HTML references).
 * Keyboard: ↑/↓/Home/End move, Enter/Space choose or open, Escape/Tab close, typing jumps to a matching option.
 * A `placeholder` adds an empty first option; the control is disabled ("Поки немає варіантів") when the list is empty
 * @param {{
 *   id: string,
 *   label: string,
 *   options: { id: string, name: string }[],
 *   value: string,
 *   onChange: (value: string) => void,
 *   required: boolean,
 *   optional?: boolean,
 *   errors?: string[],
 *   placeholder?: string
 * }} props
 */
export default function SelectField({ id, label, options, value, onChange, required, optional = false, errors, placeholder }) {
  const empty = options.length === 0;
  const items = placeholder ? [{ id: '', name: empty ? 'Поки немає варіантів' : placeholder }, ...options] : options;
  const selectedIndex = Math.max(0, items.findIndex((item) => item.id === value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const wrapRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const triggerRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const search = useRef({ text: '', at: 0 });

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  function show(index = selectedIndex) {
    setActive(index);
    setOpen(true);
  }

  function choose(index) {
    onChange(items[index].id);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(event) {
    const { key } = event;
    const last = items.length - 1;
    if (key === 'Tab') return setOpen(false);
    if (key === 'Escape') {
      if (open) event.preventDefault();
      return setOpen(false);
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) {
      event.preventDefault();
      if (!open) return show(key === 'Home' ? 0 : key === 'End' ? last : selectedIndex);
      if (key === 'Enter' || key === ' ') return choose(active);
      if (key === 'Home') return setActive(0);
      if (key === 'End') return setActive(last);
      return setActive(Math.min(last, Math.max(0, active + (key === 'ArrowDown' ? 1 : -1))));
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      search.current.text = (now - search.current.at > 700 ? '' : search.current.text) + key.toLocaleLowerCase('uk');
      search.current.at = now;
      const match = items.findIndex((item) => item.name.toLocaleLowerCase('uk').startsWith(search.current.text));
      if (match >= 0) {
        event.preventDefault();
        show(match);
      }
    }
    return undefined;
  }

  return (
    <Field id={id} label={label} required={required} optional={optional} errors={errors}>
      {({ id: controlId, required: isRequired, 'aria-invalid': invalid, 'aria-describedby': describedBy }) => (
        <div
          ref={wrapRef}
          className={`paper-select${placeholder ? ' paper-select--placeholder' : ''}${open ? ' is-open' : ''}`}
          onBlur={(event) => {
            if (!wrapRef.current?.contains(/** @type {Node | null} */ (event.relatedTarget))) setOpen(false);
          }}
        >
          <button
            id={controlId}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            ref={triggerRef}
            type="button"
            role="combobox"
            className={value ? 'paper-select-trigger' : 'paper-select-trigger is-placeholder'}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={`${id}-menu`}
            aria-required={isRequired || undefined}
            aria-activedescendant={open ? `${id}-option-${active}` : undefined}
            disabled={empty}
            onClick={() => (open ? setOpen(false) : show())}
            onKeyDown={onKeyDown}
          >
            <span className="select-value">{items[selectedIndex]?.name}</span>
            <span className="select-arrow" aria-hidden="true">
              <svg viewBox="0 0 20 20">
                <path d="m5 8 5 5 5-5" />
              </svg>
            </span>
          </button>
          <div className="paper-select-menu" id={`${id}-menu`} role="listbox" aria-label={label} hidden={!open}>
            {items.map((item, index) => (
              <div
                key={item.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === selectedIndex}
                className={index === active ? 'paper-option is-active' : 'paper-option'}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                <span>{item.name}</span>
                <svg className="option-check" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m4 10 4 4 8-8" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}
    </Field>
  );
}
