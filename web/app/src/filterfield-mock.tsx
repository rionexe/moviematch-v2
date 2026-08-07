// Throwaway harness for eyeballing the FilterField width fix — no server/Plex
// needed. Served at /filterfield-mock.html.
import React from "react";
import { render } from "react-dom";
import type { Filters } from "../../../types/moviematch";
import { FilterField } from "./components/molecules/FilterField";
import { AddRemoveList } from "./components/atoms/AddRemoveList";

import "./main.css";

const mockFilters: Filters = {
  filters: [
    { key: "library", title: "Library", type: "tag", libraryTypes: ["movie", "show"] },
    { key: "genre", title: "Genre", type: "tag", libraryTypes: ["movie"] },
    { key: "year", title: "Year", type: "tag", libraryTypes: ["movie"] },
    { key: "decade", title: "Decade", type: "tag", libraryTypes: ["movie"] },
    { key: "contentRating", title: "Content Rating", type: "tag", libraryTypes: ["movie"] },
    { key: "collection", title: "Collection", type: "tag", libraryTypes: ["movie"] },
    { key: "edition", title: "Edition", type: "tag", libraryTypes: ["movie"] },
    { key: "labels", title: "Labels", type: "tag", libraryTypes: ["movie"] },
    { key: "folderLocation", title: "Folder Location", type: "tag", libraryTypes: ["movie"] },
    { key: "duplicates", title: "Duplicates", type: "boolean", libraryTypes: ["movie"] },
    { key: "network", title: "Network", type: "tag", libraryTypes: ["show"] },
    { key: "unwatched", title: "Unwatched", type: "boolean", libraryTypes: ["movie"] },
  ],
  filterTypes: {
    tag: [{ key: "=", title: "is" }, { key: "!=", title: "is not" }],
    boolean: [{ key: "=", title: "is" }],
  },
};

const Harness = () => (
  <div style={{ maxWidth: "600px", margin: "3rem auto", padding: "0 1rem" }}>
    <AddRemoveList initialChildren={1} testHandle="filter">
      {(i) => (
        <FilterField
          key={i}
          name={String(i)}
          filters={mockFilters}
          onChange={() => {}}
          requestSuggestions={() => {}}
        />
      )}
    </AddRemoveList>
  </div>
);

document.body.dataset.rootPath = "";

render(<Harness />, document.getElementById("app"));
