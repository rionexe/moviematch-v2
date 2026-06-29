import React, { useEffect, useRef, useState } from "react";
import styles from "./ThemeSelector.module.css";

interface Theme {
  id: string;
  label: string;
  accent: string;
}

const THEMES: Theme[] = [
  { id: "forest", label: "Forest", accent: "#4f7a57" },
  { id: "ocean", label: "Ocean", accent: "#2e8b7a" },
  { id: "parchment", label: "Parchment", accent: "#9bad72" },
  { id: "willow", label: "Willow", accent: "#a8c870" },
];

const STORAGE_KEY = "mm-theme";

function getStoredTheme(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "forest";
  } catch {
    return "forest";
  }
}

function applyTheme(id: string) {
  document.documentElement.setAttribute("data-theme", id);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* storage unavailable */ }
}

export const ThemeSelector = () => {
  const [current, setCurrent] = useState(getStoredTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(current);
  }, [current]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const currentTheme = THEMES.find((t) => t.id === current) ?? THEMES[0];

  return (
    <div className={styles.root} ref={rootRef}>
      {open && (
        <ul className={styles.menu}>
          {THEMES.map((t) => (
            <li key={t.id}>
              <button
                className={`${styles.option}${t.id === current ? ` ${styles.active}` : ""}`}
                onClick={() => {
                  setCurrent(t.id);
                  setOpen(false);
                }}
              >
                <span className={styles.swatch} style={{ background: t.accent }} />
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-label="Change theme"
        title="Change theme"
      >
        <span className={styles.dot} style={{ background: currentTheme.accent }} />
      </button>
    </div>
  );
};
