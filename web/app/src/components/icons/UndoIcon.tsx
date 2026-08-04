import React from "react";
import { IconProps, iconProps } from "./Icon";

export const UndoIcon = (props: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...iconProps(props)}
  >
    <path
      d="M9 14L4 9L9 4"
      stroke="var(--strokeColor, currentColor)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
    </path>
    <path
      d="M4 9H14.5C17.5376 9 20 11.4624 20 14.5C20 17.5376 17.5376 20 14.5 20H10"
      stroke="var(--strokeColor, currentColor)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
    </path>
  </svg>
);
