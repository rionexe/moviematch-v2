import React from "react";

import styles from "./RoomInfoBar.module.css";
import { UserMenu } from "../molecules/UserMenu";
import { ShareMenu } from "../molecules/ShareMenu";

export const RoomInfoBar = () => {
  return (
    <div className={styles.infoBarWrapper}>
      <div className={styles.infoBar}>
        <UserMenu />
        <ShareMenu />
      </div>
    </div>
  );
};
