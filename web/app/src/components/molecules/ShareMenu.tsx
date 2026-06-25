import React from "react";
import { useDispatch } from "react-redux";
import { Dispatch, useStore } from "../../store";
import { ShareIcon } from "../icons/ShareIcon";

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

  const handleShare = async () => {
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
    <button className={styles.shareButton} onClick={handleShare}>
      <span className={styles.roomName}>{room.name}</span>
      <ShareIcon size="1.4rem" />
    </button>
  );
};
