import React, { useEffect, useRef, useState } from "react";
import styles from "./GlassSelect.module.css";

export interface GlassOption {
  value: string;
  label: string;
  hint?: string;
}

interface GlassSelectProps {
  name: string;
  value: string;
  options: GlassOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  testHandle?: string;
}

export const GlassSelect = ({
  name,
  value,
  options,
  placeholder = "— Select —",
  onChange,
  onBlur,
  testHandle,
}: GlassSelectProps) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); onBlur?.(); }
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onBlur]);

  return (
    <div className={styles.wrapper} ref={wrapperRef} data-test-handle={testHandle}>
      {/* Hidden native select keeps the field accessible to forms/tests */}
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.hiddenNative}
        aria-hidden="true"
        tabIndex={-1}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected
          ? (
            <>
              <span className={styles.triggerLabel}>{selected.label}</span>
              {selected.hint && (
                <span className={styles.triggerHint}>{selected.hint}</span>
              )}
            </>
          )
          : <span className={styles.triggerPlaceholder}>{placeholder}</span>}
      </button>

      {open && (
        <ul className={styles.dropdown} role="listbox">
          <li
            role="option"
            aria-selected={value === ""}
            className={`${styles.option} ${value === "" ? styles.optionSelected : ""}`}
            onMouseDown={(e) => { e.preventDefault(); onChange(""); setOpen(false); }}
          >
            <span className={styles.optionLabel}>{placeholder}</span>
          </li>
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`${styles.option} ${o.value === value ? styles.optionSelected : ""}`}
              onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); }}
            >
              <span className={styles.optionLabel}>{o.label}</span>
              {o.hint && <span className={styles.optionHint}>{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
