import React, {
  Children,
  forwardRef,
  isValidElement,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./MatchesList.module.css";

const NO_MATCHES_MESSAGES = [
  "No matches yet... have you tried compromising your clearly impeccable taste?",
  "No matches yet. Maybe your standards need a reality check?",
  "Still no matches. Have you considered that your co-watcher has feelings too?",
  "Nothing matched so far. Perhaps try something you wouldn't normally pick?",
  "No matches yet... the algorithm is judging both of you equally.",
  "Zero matches. Bold choices were made. No regrets though, right?",
  "The only thing you two have agreed on so far is 'not this one.'",
  "At this rate, you'll still be swiping when the sequel comes out.",
  "No matches. You've achieved something mathematically impressive here.",
  "Have you considered lowering your standards? Start by removing them entirely.",
  "Both of you are making bold choices. None of them are movies you'll actually watch.",
  "This is a match app, not a speed run for who can reject the most films.",
  "Nothing yet. A wall would be cheaper to stare at.",
  "The movies are fine. We're just saying.",
  "You've vetoed enough films to fill two cinema screens. Still nothing.",
  "Not a single movie has survived contact with both of your opinions.",
  "Your taste is either very refined or just very inconvenient. Hard to tell.",
  "At some point a movie has to happen. We're rooting for you.",
  "No matches. The streaming service is starting to take it personally.",
  "Somewhere out there, a perfect film for you both exists. You've rejected it twice.",
  "You two should probably just describe movies to each other and argue about those instead.",
];

interface MatchesListProps {
  children: ReactNode;
  ratedCount?: number;
}

const randomMessage = () =>
  NO_MATCHES_MESSAGES[Math.floor(Math.random() * NO_MATCHES_MESSAGES.length)];

const randomInterval = () => 7 + Math.floor(Math.random() * 9);

export const MatchesList = forwardRef<HTMLUListElement, MatchesListProps>(
  ({ children, ratedCount = 0 }, ref) => {
    const childCount = Children.count(children);
    const [noMatchesText, setNoMatchesText] = useState(randomMessage);
    const nextThreshold = useRef(randomInterval());

    useEffect(() => {
      if (ratedCount >= nextThreshold.current) {
        setNoMatchesText(randomMessage());
        nextThreshold.current = ratedCount + randomInterval();
      }
    }, [ratedCount]);

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
              {noMatchesText}
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
