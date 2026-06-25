import React, { HTMLAttributes } from "react";
import type { UserProgress } from "../../../../../types/moviematch";
import { Avatar } from "../atoms/Avatar";

import styles from "./UserProgressItem.module.css";

export const UserProgressItem = (
  { user, progress, ...props }: UserProgress & HTMLAttributes<HTMLDivElement>,
) => {
  return (
    <div className={styles.userProgress} {...props}>
      <Avatar
        userName={user.displayName ?? user.userName}
        avatarUrl={user.avatarImage}
        progress={progress * 100}
      />
      <p className={styles.userName}>{user.displayName ?? user.userName}</p>
    </div>
  );
};
