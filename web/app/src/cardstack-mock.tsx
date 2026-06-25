// Throwaway harness for headless testing of the swipe deck (CardStack) with mock
// data — no server/Plex needed. Served at /cardstack-mock.html.
import React, { useState } from "react";
import { render } from "react-dom";
import { Provider } from "react-redux";
import { createStore } from "redux";
import type { Media } from "../../../types/moviematch";
import { CardStack } from "./components/organisms/CardStack";
import { Card } from "./components/molecules/Card";

import "./main.css";

// CardStack only reads `connectionStatus`; keep it "connected" so drag/keys work.
const mockStore = createStore(() => ({ connectionStatus: "connected" }));

const mockCards: Media[] = Array.from({ length: 14 }, (_, i) => ({
  id: `mock-${i}`,
  type: "movie",
  title: `Mock Movie ${i + 1}`,
  description: "Mock description for testing the swipe deck.",
  year: 2000 + i,
  posterUrl: "",
  linkUrl: "#",
  genres: ["Test"],
  duration: 5_400_000,
  rating: 7.5,
}));

const Harness = () => {
  const [dismissed, setDismissed] = useState<string[]>([]);
  return (
    <>
      <div
        id="status"
        data-dismissed-count={dismissed.length}
        data-last={dismissed[dismissed.length - 1] ?? ""}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 9999,
          background: "#fff",
          color: "#000",
          fontFamily: "monospace",
          fontSize: "12px",
          padding: "4px 8px",
        }}
      >
        dismissed={dismissed.length} last={dismissed[dismissed.length - 1] ?? "-"}
      </div>
      <CardStack
        cards={mockCards}
        renderCard={(card) => <Card media={card} key={card.id} />}
        onCardDismissed={(card, dir) =>
          setDismissed((d) => [...d, `${card.id}:${dir}`])}
      />
    </>
  );
};

document.body.dataset.rootPath = "";
document.body.style.setProperty("--vh", window.innerHeight / 100 + "px");

render(
  <Provider store={mockStore}>
    <Harness />
  </Provider>,
  document.getElementById("app"),
);
