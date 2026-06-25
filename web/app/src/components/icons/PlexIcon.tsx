import React from "react";

/** Plex badge icon — orange squircle with white "P" letterform. No text. */
export const PlexIcon = ({ size = "2.25rem" }: { size?: string }) => (
  <svg
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: size, height: size, display: "block" }}
    aria-label="Open in Plex"
    role="img"
  >
    <rect width="64" height="64" rx="14" fill="#E5A00D" />
    {/* White "P" letterform: stem + semicircular bowl, cut with evenodd */}
    <path
      fill="white"
      fillRule="evenodd"
      d="
        M 16 12 L 16 52 L 32 52
        C 43.05 52 52 43.05 52 32
        C 52 20.95 43.05 12 32 12 Z
        M 24 44 L 32 44
        C 38.63 44 44 38.63 44 32
        C 44 25.37 38.63 20 32 20
        L 24 20 Z
      "
    />
  </svg>
);
