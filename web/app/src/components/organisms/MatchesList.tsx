import React, {
  Children,
  forwardRef,
  isValidElement,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";

import { Tr } from "../atoms/Tr";
import styles from "./MatchesList.module.css";

interface MatchesListProps {
  children: ReactNode;
}

export const MatchesList = forwardRef<HTMLUListElement, MatchesListProps>(
  ({ children }, ref) => {
    const childCount = Children.count(children);

    // Keep our own handle on the <ul> for the centre-detection scroll logic while
    // still forwarding the node to the parent (Room uses it to scrollTo on sort).
    const listRef = useRef<HTMLUListElement | null>(null);
    const setListRef = useCallback((node: HTMLUListElement | null) => {
      listRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLUListElement | null>).current = node;
      }
    }, [ref]);

    // Mark the poster nearest the carousel's horizontal centre so CSS can enlarge
    // and brighten it (the iTunes cover-flow emphasis). Toggling the class directly
    // on the DOM avoids a React re-render on every scroll frame.
    useEffect(() => {
      const el = listRef.current;
      if (!el) return;

      const update = () => {
        const items = Array.from(
          el.getElementsByClassName(styles.item),
        ) as HTMLElement[];
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;

        let closest: HTMLElement | null = null;
        let min = Infinity;
        for (const item of items) {
          const r = item.getBoundingClientRect();
          const distance = Math.abs(r.left + r.width / 2 - centerX);
          if (distance < min) {
            min = distance;
            closest = item;
          }
        }
        for (const item of items) {
          item.classList.toggle(styles.centered, item === closest);
        }
      };

      let raf = 0;
      const onScroll = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          update();
        });
      };

      // Mouse wheel browses the carousel horizontally while hovered. Advance one
      // card per notch — a small raw delta would just be snapped back to the
      // current card by `scroll-snap-type: x mandatory`. Only hijack the wheel
      // when there's something to scroll, so normal page scroll still works.
      const onWheel = (e: WheelEvent) => {
        if (el.scrollWidth <= el.clientWidth || e.deltaY === 0) return;
        e.preventDefault();
        const cards = el.getElementsByClassName(
          styles.item,
        ) as HTMLCollectionOf<HTMLElement>;
        const pitch = cards.length > 1
          ? cards[1].offsetLeft - cards[0].offsetLeft
          : cards[0]?.offsetWidth ?? 300;
        el.scrollBy({ left: Math.sign(e.deltaY) * pitch, behavior: "smooth" });
      };

      el.addEventListener("scroll", onScroll, { passive: true });
      el.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("resize", onScroll);
      update();

      return () => {
        el.removeEventListener("scroll", onScroll);
        el.removeEventListener("wheel", onWheel);
        window.removeEventListener("resize", onScroll);
        if (raf) cancelAnimationFrame(raf);
      };
    }, [childCount]);

    return (
      <div className={styles.matches}>
        {childCount === 0
          ? (
            <p className={styles.noMatchesText}>
              <Tr name="MATCHES_SECTION_NO_MATCHES" />
            </p>
          )
          : (
            <ul className={styles.list} ref={setListRef}>
              {Children.map(children, (child) => {
                if (isValidElement(child)) {
                  return (
                    <li className={styles.item} key={`${child.key}-item`}>
                      {child}
                    </li>
                  );
                }
              })}
            </ul>
          )}
      </div>
    );
  },
);
