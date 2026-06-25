import React, {
  memo,
  ReactNode,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { Media } from "../../../../../types/moviematch";
import { useGesture } from "react-use-gesture";
import { animated, Controller, Spring } from "@react-spring/web";
import { Tr } from "../atoms/Tr";
import { useStore } from "../../store";

import styles from "./CardStack.module.css";
import { HeartIcon } from "../icons/HeartIcon";
import { CloseIcon } from "../icons/CloseIcon";
const { abs, sign } = Math;

type Card = Media;

interface CardStackProps {
  cards: Card[];
  renderCard: (card: Card) => ReactNode;
  onCardDismissed: (card: Card, direction: "left" | "right") => void;
}

type Spring = {
  x: number;
  y: number;
  opacity: number;
  brightness: number;
};

const INITIAL_COUNT = 5;
// Cards behind the front one cascade up-and-left off its top-left corner — a
// straight diagonal offset with no rotation (so it doesn't fan like a hand of cards).
const FAN_X = 26; // px left per card behind the front
const FAN_Y = 20; // px up per card behind the front
// Upcoming cards stay opaque but get progressively darker, so each looks shadowed
// by the card in front of it.
const DARK_STEP = 0.2; // brightness lost per card behind the front
const MIN_BRIGHTNESS = 0.35;

// Resting transform for a card `depth` steps behind the front (0 = front card).
const restSpring = (depth: number): Spring => ({
  x: -depth * FAN_X,
  y: -depth * FAN_Y,
  opacity: 1,
  brightness: Math.max(MIN_BRIGHTNESS, 1 - depth * DARK_STEP),
});

interface StackItem<T> {
  id: string;
  index: number;
  controller: Controller<Spring>;
  item: T;
  removed: boolean;
}

export const useViewportWidth = (transform?: (n: number) => number) => {
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return transform ? transform(viewportWidth) : viewportWidth;
};

export const useFirstChildWidth = (transform?: (n: number) => number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const rect = ref.current?.firstElementChild?.getBoundingClientRect();
    if (rect) {
      setWidth(transform ? transform(rect.width) : rect.width);
    }
  }, [transform, ref]);
  return [ref, width] as const;
};

export const CardStack = memo(
  ({ cards, renderCard, onCardDismissed }: CardStackProps) => {
    const vw = useViewportWidth((n) => n / 2);
    const [{ connectionStatus }] = useStore(["connectionStatus"]);
    const [elRef, ew] = useFirstChildWidth();

    const [{ items }, dispatch] = useReducer(
      function reducer(
        { items, index }: { items: StackItem<Card>[]; index: number },
        action:
          | { type: "add" }
          | {
            type: "remove";
            payload: { id: string; direction: "left" | "right" };
          }
          | { type: "finalizeRemove"; payload: { id: string } },
      ) {
        let newIndex = index;
        let newItems = items;

        switch (action.type) {
          case "add": {
            newIndex = index + 1;
            if (newIndex > cards.length) {
              return { items, index };
            }
            const [newCard] = cards.slice(index, newIndex);
            // New card enters at the back (index 0); it fades in from opacity 0 and
            // the rest loop below animates it to its fanned resting position.
            const controller = new Controller<Spring>({
              x: 0,
              y: 0,
              opacity: 0,
              brightness: 1,
            });
            newItems = [
              {
                id: newCard.id,
                item: newCard,
                index: 0,
                controller,
                removed: false,
              },
              ...items.map((item) => ({ ...item, index: item.index + 1 })),
            ];
            break;
          }
          case "remove": {
            const item = items.find((_) => _.id === action.payload.id);
            if (item && !item.removed) {
              const itemIndex = items.indexOf(item);

              // Always fly the card off. (We previously gated this on the card's
              // x-spring being idle, which silently dropped a rate when the user
              // rated before the incoming front card finished settling into place
              // — making the next card feel "stuck". The `!item.removed` check
              // above already prevents removing the same card twice.)
              item.controller
                .start({
                  x: (action.payload.direction === "left" ? -1 : 1) *
                    (vw + ew),
                  config: { duration: 150 },
                })
                .then(() => {
                  dispatch({
                    type: "finalizeRemove",
                    payload: { id: action.payload.id },
                  });
                  onCardDismissed(item.item, action.payload.direction);
                });

              newItems = items.map((item, i) =>
                item.id === action.payload.id ? { ...item, removed: true } : {
                  ...item,
                  index: i > itemIndex ? item.index - 1 : item.index,
                }
              );
            }
            break;
          }
          case "finalizeRemove": {
            if (newItems.find((_) => _.id === action.payload.id)) {
              newItems = newItems.filter((_) => _.id !== action.payload.id);
            }
            break;
          }
        }

        // Recompute resting positions for live cards only. A card being swiped
        // off (removed but still animating) must keep flying out and must not
        // skew the depth of the card now coming to the front.
        const liveItems = newItems.filter((it) => !it.removed);
        const maxIndex = liveItems.reduce((m, it) => Math.max(m, it.index), 0);
        for (const item of liveItems) {
          item.controller.start(restSpring(maxIndex - item.index));
        }

        return { index: newIndex, items: newItems };
      },
      {
        items: cards.slice(0, INITIAL_COUNT).map((card, i) => ({
          id: card.id,
          index: i,
          item: card,
          controller: new Controller<Spring>(
            restSpring(INITIAL_COUNT - 1 - i),
          ),
          removed: false,
        })),
        index: INITIAL_COUNT,
      },
    );

    const rateItem = (direction: "left" | "right") => {
      const item = items.reduceRight<StackItem<Media> | null>(
        (item, _) => item || (!_.removed ? _ : null),
        null,
      );

      if (item) {
        dispatch({
          type: "remove",
          payload: {
            id: item.id,
            direction,
          },
        });
        dispatch({ type: "add" });
      }
    };

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (connectionStatus !== "connected") {
          return;
        }

        if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
          rateItem(e.code === "ArrowLeft" ? "left" : "right");
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [items]);

    const bind = useGesture(
      {
        onDrag({ args: [id], down, delta: [x], movement: [mx] }) {
          if (down && connectionStatus === "connected") {
            const p = abs(mx / (vw + ew));
            items.forEach(({ removed, id: _id, controller }) => {
              if (!removed && id === _id) {
                controller.set({
                  x: (controller.springs as any).x.get() + x,
                  opacity: 1 - p,
                });
              }
            });
          }
        },
        onDragEnd({ args: [id], movement: [x], velocities: [vx] }) {
          const p = abs(x / (vw + ew));
          if (p > 0.5 || (abs(vx) > 0.5 && connectionStatus === "connected")) {
            // TODO: dispatch is called once, but the
            // remove action is handled twice. Investigate why this
            // is, and if `useReducer` is the best tool for the job.
            dispatch({
              type: "remove",
              payload: {
                id,
                direction: sign(x) === -1 ? "left" : "right",
              },
            });
            dispatch({ type: "add" });
          } else {
            // Not a swipe — snap the front card back to its resting position.
            items.forEach(({ removed, id: _id, controller }) => {
              if (!removed && id === _id) {
                controller.start(restSpring(0));
              }
            });
          }
        },
      },
      // filterTaps lets a tap fall through as a click (Card flips) while a drag swipes.
      { drag: { axis: "x", filterTaps: true } },
    );

    const isEmpty = items.length === 0;
    // Highest index among live cards = the front card the user interacts with.
    const frontIndex = items.reduce(
      (max, it) => (!it.removed && it.index > max ? it.index : max),
      -1,
    );

    return (
      <>
        <div className={isEmpty ? styles.emptyStack : styles.stack} ref={elRef}>
          {isEmpty && (
            <p className={styles.emptyText}>
              <Tr name="RATE_SECTION_EXHAUSTED_CARDS" />
            </p>
          )}
          {!isEmpty && (
            <>
              <button
                className={styles.dislikeButton}
                onClick={() => rateItem("left")}
              >
                <CloseIcon />
              </button>
              <button
                className={styles.likeButton}
                onClick={() => rateItem("right")}
              >
                <HeartIcon />
              </button>
            </>
          )}
          {items.map((item) => {
            const { x, y, opacity, brightness } = item.controller.springs;
            // The front card is the live (non-removed) one with the highest index.
            // We mark it explicitly rather than via CSS :last-of-type, because a
            // card being swiped off stays at the end of the array until its removal
            // is finalized — so :last-of-type would point at the flying-off card and
            // leave the real front card non-interactive ("stuck").
            const isFront = !item.removed && item.index === frontIndex;
            return (
              <animated.div
                key={item.id}
                data-index={item.index}
                data-front={isFront ? "true" : undefined}
                className={`${styles.item} ${isFront ? styles.itemFront : ""}`}
                style={{
                  x,
                  y,
                  opacity,
                  filter: brightness.to((b) => `brightness(${b})`),
                }}
                {...bind(item.id)}
              >
                {renderCard(item.item)}
              </animated.div>
            );
          })}
        </div>
      </>
    );
  },
  () => true,
);
