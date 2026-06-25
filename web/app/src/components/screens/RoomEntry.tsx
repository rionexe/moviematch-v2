import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Filter } from "../../../../../types/moviematch";
import { useStore } from "../../store";
import { Button } from "../atoms/Button";
import { ErrorMessage } from "../atoms/ErrorMessage";
import { Field } from "../molecules/Field";
import { FilterField } from "../molecules/FilterField";
import { AddRemoveList } from "../atoms/AddRemoveList";
import {
  SegmentedControlOption,
  SegmentedControls,
} from "../atoms/SegmentedControls";
import { Layout } from "../layout/Layout";
import { Tr } from "../atoms/Tr";

import styles from "./RoomEntry.module.css";

const AGE_OPTIONS = [
  { value: 2, label: "2 · TV-Y" },
  { value: 6, label: "6 · G · TV-G" },
  { value: 7, label: "7 · TV-Y7" },
  { value: 10, label: "10 · PG · TV-PG" },
  { value: 13, label: "13 · PG-13" },
  { value: 14, label: "14 · TV-14" },
  { value: 17, label: "17 · R · TV-MA" },
  { value: 18, label: "18 · NC-17" },
];

type Mode = "join" | "create";

// Uppercase + digits (36^4 ≈ 1.7M combos); the server still guards duplicates.
const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const generateRoomCode = () =>
  Array.from(
    { length: 4 },
    () => ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)],
  ).join("");

export const RoomEntryScreen = () => {
  const [
    { translations, createRoom, error, route, routeParams, room, user },
    dispatch,
  ] = useStore([
    "translations",
    "createRoom",
    "error",
    "route",
    "routeParams",
    "room",
    "user",
  ]);

  // Land in the mode that matches the current route, so a create/join error
  // (which routes back here) keeps the user on the tab they were using.
  const [mode, setMode] = useState<Mode>(
    route === "createRoom" ? "create" : "join",
  );

  const [userName, setUserName] = useState<string>(
    // Prefer the display name so we never prefill the hidden unique key (e.g. "John2").
    user?.displayName ?? user?.userName ?? localStorage.getItem("userName") ?? "",
  );
  const [userNameError, setUserNameError] = useState<string | null>(null);

  const [roomName, setRoomName] = useState<string>(
    room?.name ?? routeParams?.roomName ??
      new URLSearchParams(location.search).get("roomName") ?? "",
  );
  const [roomNameError, setRoomNameError] = useState<string | null>(null);
  const [minAge, setMinAge] = useState<number | undefined>(undefined);
  const [maxAge, setMaxAge] = useState<number | undefined>(undefined);
  const [includeUnrated, setIncludeUnrated] = useState(false);
  const filters = useRef(new Map<number, Filter>());

  // Fetch the available filters lazily, only once the user is in Create mode.
  const filtersRequested = useRef(false);
  useEffect(() => {
    if (mode === "create" && !filtersRequested.current) {
      filtersRequested.current = true;
      dispatch({ type: "requestFilters" });
    }
  }, [mode]);

  const handleSubmit = useCallback(() => {
    const name = userName.trim();

    if (!name) {
      setUserNameError(translations?.FIELD_REQUIRED_ERROR!);
      return;
    }

    // Join needs a room code; Create generates one automatically (no field).
    if (mode === "join" && !roomName.trim()) {
      setRoomNameError(translations?.FIELD_REQUIRED_ERROR!);
      return;
    }

    // The server requires a logged-in user before create/join. There is no
    // sign-in screen anymore, so log in implicitly (anonymously) here whenever
    // the entered name isn't the one already associated with this connection.
    // Messages are sent in dispatch order and processed sequentially by the
    // server, so the login is handled before the create/join that follows.
    if (name !== (user?.displayName ?? user?.userName)) {
      dispatch({ type: "login", payload: { userName: name } });
    }

    if (mode === "join") {
      dispatch({
        type: "joinRoom",
        payload: { roomName: roomName.trim().toUpperCase() },
      });
      return;
    }

    dispatch({
      type: "createRoom",
      payload: {
        roomName: generateRoomCode(),
        filters: [...filters.current.values()],
        ...(minAge !== undefined ? { minAge } : {}),
        ...(maxAge !== undefined ? { maxAge } : {}),
        includeUnrated,
      },
    });
  }, [mode, userName, roomName, minAge, maxAge, includeUnrated, translations, user]);

  return (
    <Layout>
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <SegmentedControls
          name="roomEntryMode"
          value={mode}
          onChange={(value) => setMode(value as Mode)}
          paddingTop="s5"
        >
          <SegmentedControlOption value="create" testHandle="mode-create">
            <Tr name="CREATE_ROOM" />
          </SegmentedControlOption>
          <SegmentedControlOption value="join" testHandle="mode-join">
            <Tr name="JOIN_ROOM" />
          </SegmentedControlOption>
        </SegmentedControls>

        <div className={styles.card}>
          {error && (
            <ErrorMessage message={error.message ?? error.type ?? ""} />
          )}

          <Field
            label={<Tr name="LOGIN_NAME" />}
            name="given-name"
            autoComplete="given-name"
            value={userName}
            errorMessage={userNameError ?? undefined}
            onChange={(e) => {
              setUserNameError(null);
              setUserName(e.target.value);
            }}
          />

          {/* Join enters a room code; Create auto-generates one on submit. */}
          {mode === "join" && (
            <Field
              label={<Tr name="LOGIN_ROOM_NAME" />}
              name="roomName"
              value={roomName}
              errorMessage={roomNameError ?? undefined}
              onChange={(e) => {
                setRoomNameError(null);
                setRoomName(e.target.value);
              }}
            />
          )}

          {mode === "create" && (
            <div className={styles.filters}>
              <h2 className={styles.filtersTitle}>Filters</h2>

              <div className={styles.ageFilters}>
                <label className={styles.ageLabel}>
                  Min age
                  <select
                    className={styles.ageSelect}
                    value={minAge ?? ""}
                    onChange={(e) =>
                      setMinAge(
                        e.target.value ? Number(e.target.value) : undefined,
                      )}
                  >
                    <option value="">Any</option>
                    {AGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                <label className={styles.ageLabel}>
                  Max age
                  <select
                    className={styles.ageSelect}
                    value={maxAge ?? ""}
                    onChange={(e) =>
                      setMaxAge(
                        e.target.value ? Number(e.target.value) : undefined,
                      )}
                  >
                    <option value="">Any</option>
                    {[...AGE_OPTIONS].reverse().map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>

                <label className={styles.unratedLabel}>
                  <input
                    type="checkbox"
                    checked={includeUnrated}
                    onChange={(e) => setIncludeUnrated(e.target.checked)}
                  />
                  Include unrated
                </label>
              </div>

              <AddRemoveList
                initialChildren={0}
                onRemove={(i) => filters.current.delete(i)}
                testHandle="filter"
              >
                {(i) =>
                  createRoom?.availableFilters && (
                    <FilterField
                      key={i}
                      name={String(i)}
                      onChange={(filter) =>
                        filter && filters.current.set(i, filter)}
                      filters={createRoom.availableFilters}
                      suggestions={createRoom?.filterValues}
                      requestSuggestions={(key: string) => {
                        dispatch({
                          type: "requestFilterValues",
                          payload: { key },
                        });
                      }}
                    />
                  )}
              </AddRemoveList>
            </div>
          )}

          <div className={styles.submitRow}>
            <Button
              appearance="Primary"
              type="submit"
              testHandle={mode === "create" ? "create-room" : "join-room"}
            >
              <Tr name={mode === "create" ? "CREATE_ROOM" : "JOIN_ROOM"} />
            </Button>
          </div>
        </div>
      </form>
    </Layout>
  );
};
