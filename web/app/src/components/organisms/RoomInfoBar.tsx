import React, { useState } from "react";
import { Tr } from "../atoms/Tr";

import styles from "./RoomInfoBar.module.css";
import { useStore } from "../../store";
import { UserMenu } from "../molecules/UserMenu";
import { ShareMenu } from "../molecules/ShareMenu";

export const RoomInfoBar = () => {
  const [store] = useStore(["room"]);
  const [showUsers, setShowUsers] = useState(false);
  const users = store.room?.users ?? [];

  return (
    <div className={styles.infoBarWrapper}>
      <div className={styles.infoBar}>
        <div className={styles.item}>
          <UserMenu />
        </div>
        <div className={styles.matchCountWrapper}>
          <p className={styles.matchCount}>
            {(store.room?.matches ?? []).length}
          </p>
          <p className={styles.matchCountTitle}>
            <Tr name="MATCHES_SECTION_TITLE" />
          </p>
        </div>
        <button
          className={styles.occupancyButton}
          onClick={() => setShowUsers((v) => !v)}
          aria-expanded={showUsers}
        >
          {users.length} in room
        </button>
        <div className={styles.item}>
          <ShareMenu />
        </div>
      </div>
      {showUsers && users.length > 0 && (
        <ul className={styles.userList}>
          {users.map(({ user, progress }) => (
            <li key={user.userName} className={styles.userItem}>
              <span>{user.userName}</span>
              <span className={styles.userProgress}>
                {Math.round(progress * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
