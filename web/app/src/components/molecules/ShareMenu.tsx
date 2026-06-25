import React from "react";
import { useDispatch } from "react-redux";
import { Dispatch, useStore } from "../../store";
import { CopyIcon } from "../icons/CopyIcon";

import styles from "./ShareMenu.module.css";

export const ShareMenu = () => {
  const [{ room, translations }] = useStore(["room", "translations"]);
  const dispatch = useDispatch<Dispatch>();

  if (!room) return null;

  // navigator.clipboard is undefined in insecure contexts (plain-HTTP LAN access),
  // so fall back to a temporary <textarea> + execCommand so copying still works.
  const copyText = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      if (!document.execCommand("copy")) {
        throw new Error("execCommand copy failed");
      }
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const handleCopy = async () => {
    try {
      await copyText(room.name ?? "");
      dispatch({
        type: "addToast",
        payload: {
          id: Date.now(),
          showTimeMs: 2_000,
          message: translations?.COPY_LINK_SUCCESS ?? "COPY_LINK_SUCCESS",
          appearance: "Success",
        },
      });
    } catch (err) {
      dispatch({
        type: "addToast",
        payload: {
          id: Date.now(),
          showTimeMs: 2_000,
          message: translations?.COPY_LINK_FAILURE ?? "COPY_LINK_FAILURE",
          appearance: "Failure",
        },
      });
    }
  };

  return (
    <button className={styles.copyButton} onClick={handleCopy}>
      <span className={styles.label}>
        Room ID:{" "}
        <span className={styles.code}>{room.name}</span>
      </span>
      <CopyIcon size="0.75em" />
      <span className={styles.tooltip} aria-hidden="true">Click to copy</span>
    </button>
  );
};
