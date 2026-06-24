import React, { ReactNode } from "react";

import styles from "./ButtonContainer.module.css";

interface ButtonContainerProps {
  children: ReactNode;
  paddingTop?: "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "s7";
  reverseMobile?: boolean;
  /** Push children to opposite ends on desktop (e.g. a left escape + right primary). */
  spread?: boolean;
}

export const ButtonContainer = ({
  children,
  paddingTop,
  reverseMobile,
  spread,
}: ButtonContainerProps) => (
  <div
    className={[
      reverseMobile ? styles.containerMobileReverse : styles.container,
      spread ? styles.spread : "",
    ].join(" ").trim()}
    style={paddingTop ? { paddingTop: `var(--${paddingTop})` } : {}}
  >
    {children}
  </div>
);
