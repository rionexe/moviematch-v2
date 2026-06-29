import React, { HTMLAttributes } from "react";
import type { UserProgress } from "../../../../../types/moviematch";

import styles from "./UserProgressItem.module.css";

export const UserProgressItem = (
  { user, progress: _progress, ...props }: UserProgress & HTMLAttributes<HTMLDivElement>,
) => {
  return (
    <div className={styles.userProgress} {...props}>
      <p className={styles.userName}>{user.displayName ?? user.userName}</p>
    </div>
  );
};
