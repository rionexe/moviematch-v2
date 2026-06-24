import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Filter } from "../../../../../types/moviematch";
import { useStore } from "../../store";
import { Button } from "../atoms/Button";
import { ButtonContainer } from "../layout/ButtonContainer";
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

export const RoomEntryScreen = () => {
  const [{ translations, createRoom, error, route, routeParams, room }, dispatch] =
    useStore([
      "translations",
      "createRoom",
      "error",
      "route",
      "routeParams",
      "room",
    ]);

  // Land in the mode that matches the current route, so a create/join error
  // (which routes back here) keeps the user on the tab they were using.
  const [mode, setMode] = useState<Mode>(
    route === "createRoom" ? "create" : "join",
  );

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
    if (!roomName) {
      setRoomNameError(translations?.FIELD_REQUIRED_ERROR!);
      return;
    }

    if (mode === "join") {
      dispatch({ type: "joinRoom", payload: { roomName } });
      return;
    }

    dispatch({
      type: "createRoom",
      payload: {
        roomName,
        filters: [...filters.current.values()],
        ...(minAge !== undefined ? { minAge } : {}),
        ...(maxAge !== undefined ? { maxAge } : {}),
        includeUnrated,
      },
    });
  }, [mode, roomName, minAge, maxAge, includeUnrated, translations]);

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

        {error && <ErrorMessage message={error.message ?? error.type ?? ""} />}

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
                    setMinAge(e.target.value ? Number(e.target.value) : undefined)}
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
                    setMaxAge(e.target.value ? Number(e.target.value) : undefined)}
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
                      dispatch({ type: "requestFilterValues", payload: { key } });
                    }}
                  />
                )}
            </AddRemoveList>
          </div>
        )}

        <ButtonContainer paddingTop="s5" spread>
          <Button
            appearance="Tertiary"
            onPress={() => dispatch({ type: "logout" })}
            testHandle="logout"
          >
            <Tr name="LOGOUT" />
          </Button>
          <Button
            appearance="Primary"
            type="submit"
            onPress={handleSubmit}
            testHandle={mode === "create" ? "create-room" : "join-room"}
          >
            <Tr name={mode === "create" ? "CREATE_ROOM" : "JOIN_ROOM"} />
          </Button>
        </ButtonContainer>
      </form>
    </Layout>
  );
};
