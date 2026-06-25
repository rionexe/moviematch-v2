// Throwaway harness for headless testing of the horizontal matches carousel
// (MatchesList) — wheel scrolling, etc. Served at /matches-mock.html.
import React, { useRef } from "react";
import { render } from "react-dom";
import type { Media } from "../../../types/moviematch";
import { MatchesList } from "./components/organisms/MatchesList";
import { Card } from "./components/molecules/Card";

import "./main.css";

const mockCards: Media[] = Array.from({ length: 10 }, (_, i) => ({
  id: `mock-${i}`,
  type: "movie",
  title: `Mock Movie ${i + 1}`,
  description: "Mock description.",
  year: 2000 + i,
  posterUrl: "",
  linkUrl: "#",
  genres: ["Test"],
  duration: 5_400_000,
  rating: 7.5,
}));

const Harness = () => {
  const ref = useRef<HTMLUListElement>(null);
  return (
    <MatchesList ref={ref}>
      {mockCards.map((m) => <Card media={m} key={m.id} title="Voted by test" />)}
    </MatchesList>
  );
};

document.body.dataset.rootPath = "";
document.body.style.setProperty("--vh", window.innerHeight / 100 + "px");

render(<Harness />, document.getElementById("app"));
